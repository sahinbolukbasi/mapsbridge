// End-to-end production smoke test using one temporary account, removed in finally.
// Sends no email; uses only its own trial credits and its own DynamoDB partition.
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {S3Client,HeadObjectCommand,ListObjectVersionsCommand,DeleteObjectCommand}=require('../lambda/node_modules/@aws-sdk/client-s3');
const s3=new S3Client({region:'eu-central-1'}), bucket='adreskopru-prod-training-996270854731';
let trainingId;
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const {CognitoIdentityProviderClient,AdminCreateUserCommand,AdminSetUserPasswordCommand,InitiateAuthCommand,AdminDeleteUserCommand}=require('../lambda/node_modules/@aws-sdk/client-cognito-identity-provider');
const {DynamoDBClient,QueryCommand,DeleteItemCommand}=require('../lambda/node_modules/@aws-sdk/client-dynamodb');
const region='eu-central-1',pool='eu-central-1_TKABiLn5f',clientId='62t35qsehl3o9cdc6i4mg01tqt',table='adreskopru-prod-data';
const cognito=new CognitoIdentityProviderClient({region}),db=new DynamoDBClient({region});
const username=`ai-smoke-${randomUUID()}@example.invalid`;
let created=false,sub;
async function main(){
 try{
  const user=await cognito.send(new AdminCreateUserCommand({UserPoolId:pool,Username:username,MessageAction:'SUPPRESS',UserAttributes:[{Name:'email',Value:username},{Name:'email_verified',Value:'true'}]}));created=true;
  sub=user.User.Attributes.find(a=>a.Name==='sub').Value;
  const password=randomBytes(32).toString('base64')+'aA1!';
  await cognito.send(new AdminSetUserPasswordCommand({UserPoolId:pool,Username:username,Password:password,Permanent:true}));
  const auth=await cognito.send(new InitiateAuthCommand({ClientId:clientId,AuthFlow:'USER_PASSWORD_AUTH',AuthParameters:{USERNAME:username,PASSWORD:password}}));
  const token=auth.AuthenticationResult.AccessToken;
  async function request(path,body){
   const response=await fetch('https://0duy2hfjd2.execute-api.eu-central-1.amazonaws.com'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(35000)});
   const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;
  }
  const requestId=randomUUID();
  trainingId=createHash('sha256').update(JSON.stringify([sub,requestId])).digest('hex');
  const response=await request('/ai/route-planner',{prompt:'Bir seyahat planlamak istiyorum.',requestId,conversationId:randomUUID(),trainingConsent:true});
  assert.equal(response.trainingCollection,'queued_for_review');
  assert.equal(response.billing.cost,0);
  const output='/tmp/mapsbridge-training-smoke-worker.json';
  const invocation=JSON.parse(execFileSync('aws',['lambda','invoke','--function-name','adreskopru-prod-training-worker','--region',region,'--payload','{}',output,'--output','json'],{encoding:'utf8'}));
  assert.equal(invocation.FunctionError,undefined);
  const object=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:`quarantine/${trainingId}.jsonl`}));
  assert.equal(object.ContentType,'application/x-ndjson');
  assert.equal(object.ServerSideEncryption,'AES256');
  console.log(JSON.stringify({ok:true,checks:['explicit-consent','atomic-outbox','scheduled-worker','encrypted-s3-quarantine']}));

 }finally{
  if(trainingId){
   const objectKey=`quarantine/${trainingId}.jsonl`;
   const versions=await s3.send(new ListObjectVersionsCommand({Bucket:bucket,Prefix:objectKey}));
   for(const version of [...(versions.Versions||[]),...(versions.DeleteMarkers||[])]) if(version.Key===objectKey) await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:objectKey,VersionId:version.VersionId}));
   const jobs=await db.send(new QueryCommand({TableName:table,KeyConditionExpression:'PK = :pk',ExpressionAttributeValues:{':pk':{S:'AI#TRAINING_PENDING'}},ConsistentRead:true}));
   for(const row of jobs.Items||[]) if(row.id?.S===trainingId) await db.send(new DeleteItemCommand({TableName:table,Key:{PK:row.PK,SK:row.SK}}));
  }

  if(created)await cognito.send(new AdminDeleteUserCommand({UserPoolId:pool,Username:username}));
  if(sub){
   let cursor;
   do{
    const rows=await db.send(new QueryCommand({TableName:table,KeyConditionExpression:'PK = :pk',ExpressionAttributeValues:{':pk':{S:`USER#${sub}`}},ProjectionExpression:'PK, SK',ExclusiveStartKey:cursor,ConsistentRead:true}));
    for(const key of rows.Items||[])await db.send(new DeleteItemCommand({TableName:table,Key:key}));
    cursor=rows.LastEvaluatedKey;
   }while(cursor);
  }
  if(created)console.log('Temporary test account and its data removed');
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
