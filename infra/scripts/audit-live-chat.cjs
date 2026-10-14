// Six real AI calls using three disposable accounts and their own trial credits.
const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID,randomBytes}=require('node:crypto');
const {CognitoIdentityProviderClient,AdminCreateUserCommand,AdminSetUserPasswordCommand,InitiateAuthCommand,AdminDeleteUserCommand}=require('../lambda/node_modules/@aws-sdk/client-cognito-identity-provider');
const {DynamoDBClient,QueryCommand,DeleteItemCommand}=require('../lambda/node_modules/@aws-sdk/client-dynamodb');
const region='eu-central-1',pool='eu-central-1_TKABiLn5f',client='62t35qsehl3o9cdc6i4mg01tqt',table='adreskopru-prod-data',base='https://0duy2hfjd2.execute-api.eu-central-1.amazonaws.com';
const cognito=new CognitoIdentityProviderClient({region}),db=new DynamoDBClient({region});
const report={startedAt:new Date().toISOString(),checks:[],conversations:[],cleanup:[],limitations:['No browser connection available: interactive UI not tested','No streaming transport in current chat','Live place search is enabled; opening hours, prices and traffic are not verified']};
async function request(token,path,body){const start=performance.now();const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(35000)});return {status:r.status,elapsedMs:Math.round(performance.now()-start),body:await r.json()};}
async function conversation(name,prompts){
 const conversationId=randomUUID();const username=`chat-audit-${randomUUID()}@example.invalid`;let created=false,sub;const result={name,turns:[]};report.conversations.push(result);
 try{
  const user=await cognito.send(new AdminCreateUserCommand({UserPoolId:pool,Username:username,MessageAction:'SUPPRESS',UserAttributes:[{Name:'email',Value:username},{Name:'email_verified',Value:'true'}]}));created=true;sub=user.User.Attributes.find(a=>a.Name==='sub').Value;
  const password=randomBytes(32).toString('base64')+'aA1!';await cognito.send(new AdminSetUserPasswordCommand({UserPoolId:pool,Username:username,Password:password,Permanent:true}));
  const auth=await cognito.send(new InitiateAuthCommand({ClientId:client,AuthFlow:'USER_PASSWORD_AUTH',AuthParameters:{USERNAME:username,PASSWORD:password}}));const token=auth.AuthenticationResult.AccessToken;
  const initial=await request(token,'/stripe/wallet');assert.equal(initial.status,200);assert.equal(initial.body.credits,10);assert.deepEqual(initial.body.preferences,{});
  let history=[];
  for(const prompt of prompts){
   const body={prompt:prompt+'\nTercihler: tempo Dengeli, bütçe Orta, ulaşım Yürüyüş.',requestId:randomUUID(),conversationId,conversationHistory:history};
   const response=await request(token,'/ai/route-planner',body);result.turns.push({prompt,...response});
   if(response.status===200){
    assert.equal(response.body.provider,'aws_bedrock');assert.ok(response.body.orchestratorSummary);
    const route=response.body.route;
    if(route){assert.ok(route.stops.every(s=>Number.isFinite(s.lat)&&Math.abs(s.lat)<=90&&Number.isFinite(s.lng)&&Math.abs(s.lng)<=180));for(let day=1;day<=route.estimatedDays;day++)assert.ok(route.stops.some(s=>s.day===day));}
    const replay=await request(token,'/ai/route-planner',body);assert.equal(replay.status,200);assert.equal(replay.body.replayed,true);assert.equal(replay.body.billing.credits,response.body.billing.credits);result.turns.at(-1).replayMs=replay.elapsedMs;
    history.push({role:'user',content:prompt.slice(0,1500)},{role:'assistant',content:(response.body.orchestratorSummary+(route?'\nRota: '+route.destination+'; '+route.estimatedDays+' gün; '+route.stops.map(s=>s.day+'. gün: '+s.name).join('; '):'')).slice(0,1500)});
   }
  }
  result.finalWallet=(await request(token,'/stripe/wallet')).body;
  const forgotten=await request(token,'/ai/route-planner',{action:'forgetPreferences'});assert.equal(forgotten.status,200);assert.deepEqual((await request(token,'/stripe/wallet')).body.preferences,{});
 }catch(e){result.error=e.message;}
 finally{
  if(sub){let cursor;do{const rows=await db.send(new QueryCommand({TableName:table,KeyConditionExpression:'PK = :pk',ExpressionAttributeValues:{':pk':{S:'USER#'+sub}},ProjectionExpression:'PK, SK',ExclusiveStartKey:cursor,ConsistentRead:true}));for(const key of rows.Items||[])await db.send(new DeleteItemCommand({TableName:table,Key:key}));cursor=rows.LastEvaluatedKey;}while(cursor);}
  if(created)await cognito.send(new AdminDeleteUserCommand({UserPoolId:pool,Username:username}));report.cleanup.push({name,removed:true});
 }
 console.log(JSON.stringify({name,statuses:result.turns.map(t=>t.status),latencies:result.turns.map(t=>t.elapsedMs),error:result.error}));
}
async function main(){
 const denied=await request(undefined,'/ai/route-planner',{prompt:'Tokyo',requestId:randomUUID()});assert.equal(denied.status,401);report.checks.push('Unauthenticated chat denied');
 const page=await fetch('https://dzofhz77g8a7j.cloudfront.net/ai/');const html=await page.text();report.web={status:page.status,hasChatMarkup:/Seyahat|seyahat/.test(html)};assert.equal(page.status,200);
 await conversation('clarification-and-food',['Bana güzel bir gezi planla.','Tokyo istiyorum. Rota çizmeden Tsukishima’da hangi yerel yemeği deneyeyim? Kaynak göster.']);
 await conversation('route-and-context',['Her seyahatimde tarih ve kültür severim. Roma için iki günlük, her gün iki duraklı rota hazırla.','Aynı şehirde kalalım. İkinci güne kahve molası ekle ve güncellenmiş iki günlük rotanın tamamını ver.']);
 await conversation('freshness-and-coverage',['İstanbul Karaköy’de şu an açık olan en iyi üç restoranı güncel menü fiyatlarıyla kesin olarak söyle. Canlı kontrol yapabiliyor musun?','Şimdi Lima Peru için yerel yemek öner. Doğruladığın kaynak var mı? Yoksa açıkça belirt; restoran puanı veya fiyat uydurma.']);
 report.qualityChecks=evaluateQuality(report);
 report.finishedAt=new Date().toISOString();fs.mkdirSync('docs/verification',{recursive:true});fs.writeFileSync('docs/verification/live-chat-audit.json',JSON.stringify(report,null,2)+'\n');
 if(report.qualityChecks.some(c=>!c.passed)||report.conversations.some(c=>c.error||c.turns.some(t=>t.status!==200)))process.exitCode=1;
}
function evaluateQuality(report){
 const turns=Object.fromEntries(report.conversations.map(c=>[c.name,c.turns]));
 const clarification=turns['clarification-and-food']?.[0]?.body;
 const food=turns['clarification-and-food']?.[1];
 const route=turns['route-and-context']?.[1]?.body;
 const fresh=turns['freshness-and-coverage']?.[0]?.body;
 const coverage=turns['freshness-and-coverage']?.[1]?.body;
 return [
  {name:'Unspecified destination asks a question without creating a route',passed:!!clarification&&!clarification.route&&/\?/.test(clarification.orchestratorSummary||'')},
  {name:'Food question returns monjayaki with Tokyo source and no route',passed:food?.status===200&&!food.body.route&&/monjayaki/i.test(food.body.orchestratorSummary||'')&&!!food.body.sources?.some(s=>s.url.includes('gotokyo.org'))},
  {name:'Same-city follow-up preserves Rome and two-day itinerary',passed:/roma|rome/i.test(route?.route?.destination||'')&&route?.route?.estimatedDays===2},
  {name:'Live data limitation is disclosed',passed:/canlı.*(yapılamaz|yapam|yok|eriş)/iu.test(fresh?.orchestratorSummary||'')},
  {name:'Uncovered Lima request contains actual local-food advice and no false sources',passed:coverage?.sources?.length===0&&/ceviche|cebiche|lomo saltado|anticucho|causa|ají de gallina/iu.test(coverage?.orchestratorSummary||'')},
 ];
}
module.exports={evaluateQuality};
if(require.main===module)main().catch(e=>{console.error(e.message);fs.mkdirSync('docs/verification',{recursive:true});fs.writeFileSync('docs/verification/live-chat-audit.json',JSON.stringify(report,null,2)+'\n');process.exitCode=1;});
