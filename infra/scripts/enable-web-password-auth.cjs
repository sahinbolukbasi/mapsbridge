// Preserve the complete deployed app-client configuration when adding the
// password flow already used by apps/web/app/lib/cognito.ts.
const {CognitoIdentityProviderClient,DescribeUserPoolClientCommand,UpdateUserPoolClientCommand}=require('../lambda/node_modules/@aws-sdk/client-cognito-identity-provider');
const {writeFileSync,mkdirSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
async function main(){
 const client=new CognitoIdentityProviderClient({region:'eu-central-1'});
 const identity={UserPoolId:'eu-central-1_TKABiLn5f',ClientId:'62t35qsehl3o9cdc6i4mg01tqt'};
 const describe=()=>client.send(new DescribeUserPoolClientCommand(identity));
 const {UserPoolClient:before}=await describe();
 const {CreationDate,LastModifiedDate,ClientSecret,...settings}=before;
 const defaults=['ALLOW_REFRESH_TOKEN_AUTH','ALLOW_USER_SRP_AUTH','ALLOW_CUSTOM_AUTH'];
 const flows=settings.ExplicitAuthFlows||defaults;
 const after=[...new Set([...flows,'ALLOW_USER_PASSWORD_AUTH'])];
 console.log(JSON.stringify({before:flows,after,otherSettings:'preserved'}));
 if(!process.argv.includes('--apply') || flows.includes('ALLOW_USER_PASSWORD_AUTH'))return;
 const backup=path.resolve(__dirname,'../admin-runtime/.build');mkdirSync(backup,{recursive:true});
 writeFileSync(path.join(backup,'cognito-client-before-password-auth.json'),JSON.stringify(settings,null,2),{mode:0o600});
 await client.send(new UpdateUserPoolClientCommand({...settings,...identity,ExplicitAuthFlows:after}));
 const {UserPoolClient:verified}=await describe();
 assert.ok(verified.ExplicitAuthFlows.includes('ALLOW_USER_PASSWORD_AUTH'));
 for(const [key,value] of Object.entries(settings))if(key!=='ExplicitAuthFlows')assert.deepEqual(verified[key],value,`Unexpected setting change: ${key}`);
 console.log('Password flow enabled; all other returned settings verified unchanged');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
