// Disposable verified account; suppresses email and cleans only its own records.
const assert=require('node:assert/strict');const {randomUUID,randomBytes}=require('node:crypto');
const {CognitoIdentityProviderClient,AdminCreateUserCommand,AdminSetUserPasswordCommand,InitiateAuthCommand,AdminDeleteUserCommand}=require('../lambda/node_modules/@aws-sdk/client-cognito-identity-provider');
const {DynamoDBClient,QueryCommand,DeleteItemCommand}=require('../lambda/node_modules/@aws-sdk/client-dynamodb');
const region='eu-central-1',pool='eu-central-1_TKABiLn5f',client='62t35qsehl3o9cdc6i4mg01tqt',table='adreskopru-prod-data';
const cognito=new CognitoIdentityProviderClient({region}),db=new DynamoDBClient({region});
const username=`billing-smoke-${randomUUID()}@example.invalid`;let created=false,sub;
async function main(){try{
 const user=await cognito.send(new AdminCreateUserCommand({UserPoolId:pool,Username:username,MessageAction:'SUPPRESS',UserAttributes:[{Name:'email',Value:username},{Name:'email_verified',Value:'true'}]}));created=true;sub=user.User.Attributes.find(x=>x.Name==='sub').Value;
 const password=randomBytes(32).toString('base64')+'aA1!';await cognito.send(new AdminSetUserPasswordCommand({UserPoolId:pool,Username:username,Password:password,Permanent:true}));
 const auth=await cognito.send(new InitiateAuthCommand({ClientId:client,AuthFlow:'USER_PASSWORD_AUTH',AuthParameters:{USERNAME:username,PASSWORD:password}}));const token=auth.AuthenticationResult.AccessToken;
 async function request(path,body){const response=await fetch('https://0duy2hfjd2.execute-api.eu-central-1.amazonaws.com'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','idempotency-key':randomUUID()},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(40000)});return {status:response.status,body:await response.json()};}
 for(let i=0;i<2;i++){const wallet=await request('/stripe/wallet');assert.equal(wallet.status,200);assert.equal(wallet.body.credits,5);assert.equal(wallet.body.welcomeGift.credits,5);}console.log('PASS live welcome gift is 5 and does not repeat');
 const catalog=await request('/stripe/plans');assert.equal(catalog.body.enabled,false);
 const checkout=await request('/stripe/checkout',{mode:'credit_pack',targetId:'pack-starter'});assert.equal(checkout.status,503);console.log('PASS unconfigured checkout is honestly unavailable');
 const conversationId=randomUUID();
 let response=await request('/ai/route-planner',{prompt:'Birlikte bir gezi planlayalım.',conversationId,requestId:randomUUID()});assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.responseMode,'clarify');assert.equal(response.body.billing.credits,5);
 const body={prompt:'Roma için iki günlük tarih ve müze odaklı bir gezi istiyorum. Orta bütçe, dengeli tempo, yürüyüş. Şimdi rotayı oluştur.',conversationId,requestId:randomUUID()};
 response=await request('/ai/route-planner',body);assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.responseMode,'route');assert.equal(response.body.billing.credits,0);assert.equal(response.body.cost,5);console.log('PASS live AI produced a route using the gift');
 const replay=await request('/ai/route-planner',body);assert.equal(replay.body.replayed,true);assert.equal(replay.body.billing.credits,0);
 const denied=await request('/ai/route-planner',{prompt:'Rota oluşturmadan Roma için yerel yemek öner.',requestId:randomUUID()});assert.equal(denied.status,402,JSON.stringify(denied.body));console.log('PASS answer retry is free and exhausted wallet blocks paid chat');
 }finally{
 if(sub){let cursor;do{const rows=await db.send(new QueryCommand({TableName:table,KeyConditionExpression:'PK = :pk',ExpressionAttributeValues:{':pk':{S:'USER#'+sub}},ProjectionExpression:'PK, SK',ExclusiveStartKey:cursor,ConsistentRead:true}));for(const key of rows.Items||[])await db.send(new DeleteItemCommand({TableName:table,Key:key}));cursor=rows.LastEvaluatedKey;}while(cursor);}
 if(created)await cognito.send(new AdminDeleteUserCommand({UserPoolId:pool,Username:username}));console.log('Disposable account and its records removed');
 }}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
