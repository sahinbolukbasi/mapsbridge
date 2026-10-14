// Run only after the merchant's LIVE Stripe key is stored as an SSM SecureString.
// Never accepts or prints plaintext credentials. Writes only SSM references / price IDs.
const {SSMClient,GetParameterCommand,PutParameterCommand}=require('../lambda/node_modules/@aws-sdk/client-ssm');
const Stripe=require('../lambda/node_modules/stripe');
const fs=require('node:fs');const path=require('node:path');
const ssm=new SSMClient({region:'eu-central-1'});
const prefix='/mapsbridge/prod/stripe';
const endpoint='https://0duy2hfjd2.execute-api.eu-central-1.amazonaws.com/stripe/webhook';
async function parameter(name){try{return (await ssm.send(new GetParameterCommand({Name:prefix+'/'+name,WithDecryption:true}))).Parameter.Value;}catch(e){if(e.name==='ParameterNotFound')return '';throw e;}}
async function main(){
 const key=await parameter('secret-key');
 if(!key.startsWith('sk_live_'))throw new Error('Store the merchant live key in SSM /mapsbridge/prod/stripe/secret-key as SecureString first.');
 const stripe=new Stripe(key,{apiVersion:'2025-02-24.acacia',maxNetworkRetries:2});
 const account=await stripe.accounts.retrieve();
 if(!account.charges_enabled)throw new Error('Merchant account is not enabled for charges; finish Stripe onboarding first.');
 const env={BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'secret:'+prefix+'/secret-key',STRIPE_WEBHOOK_SECRET:'secret:'+prefix+'/webhook-secret'};
 const products=[['EXPLORER','explorer',100,19900,true],['PRO','pro',500,49900,true],['AGENCY','agency',2500,149900,true],['PACK_STARTER','pack-starter',50,8900,false],['PACK_POPULAR','pack-popular',300,29900,false],['PACK_MASTER','pack-master',1000,74900,false],['PACK_PRO','pack-pro',3000,189900,false]];
 for(const [envName,id,credits,amount,monthly] of products){
  const lookup='mapsbridge_'+id+'_try_'+amount+'_v1';
  let price=(await stripe.prices.list({lookup_keys:[lookup],active:true,limit:1})).data[0];
  if(!price){const product=await stripe.products.create({name:`MapsBridge ${credits} kredi${monthly?' / ay':''}`,metadata:{mapsbridgeProductId:id}},{idempotencyKey:lookup+'_product'});price=await stripe.prices.create({product:product.id,currency:'try',unit_amount:amount,lookup_key:lookup,...(monthly?{recurring:{interval:'month'}}:{})},{idempotencyKey:lookup+'_price'});}
  if(price.unit_amount!==amount||price.currency!=='try'||(monthly?price.recurring?.interval!=='month'||price.recurring?.interval_count!==1:!!price.recurring))throw new Error('Existing Stripe price mismatch: '+id);
  env['STRIPE_'+envName+'_PRICE_ID']=price.id;
 }
 const configs=await stripe.billingPortal.configurations.list({limit:100});
 let portal=configs.data.find(c=>c.metadata?.mapsbridge==='billing-v1');
 if(!portal)portal=await stripe.billingPortal.configurations.create({business_profile:{headline:'MapsBridge aboneliğini yönet'},metadata:{mapsbridge:'billing-v1'},features:{payment_method_update:{enabled:true},invoice_history:{enabled:true},subscription_cancel:{enabled:true,mode:'at_period_end'}}},{idempotencyKey:'mapsbridge-billing-portal-v1'});
 env.STRIPE_PORTAL_CONFIGURATION_ID=portal.id;
 const events=['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','charge.refunded','charge.dispute.created'];
 let existing;
 for await(const webhook of stripe.webhookEndpoints.list({limit:100})){if(webhook.url===endpoint){existing=webhook;break;}}
 const savedSecret=await parameter('webhook-secret');
 if(existing&&!savedSecret)throw new Error('Webhook exists but its signing secret is absent in SSM. Store its signing secret before continuing.');
 if(existing)await stripe.webhookEndpoints.update(existing.id,{enabled_events:events,disabled:false});
 else {const webhook=await stripe.webhookEndpoints.create({url:endpoint,enabled_events:events,api_version:'2025-02-24.acacia'},{idempotencyKey:'mapsbridge-billing-webhook-v1'});if(!webhook.secret)throw new Error('Webhook signing secret missing');await ssm.send(new PutParameterCommand({Name:prefix+'/webhook-secret',Value:webhook.secret,Type:'SecureString',Overwrite:true}));}
 fs.writeFileSync(path.resolve(__dirname,'../admin-runtime/billing.auto.tfvars.json'),JSON.stringify({billing_environment:env},null,2)+'\n',{mode:0o600});
 console.log('Catalog and signed webhook ready. Review and apply the billing Terraform plan to enable checkout. No customer was charged.');
}
main().catch(()=>{console.error('Billing activation could not complete. Check live merchant onboarding, SSM parameters, and Stripe product/webhook configuration. No credentials were printed.');process.exitCode=1;});
