const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {transformSync}=require('esbuild');
const places=[{id:'aws-place-1',name:'Museum',lat:41.89,lng:12.49,address:'Rome',category:'Museum',checkedAt:'2026-09-18'},{id:'aws-place-2',name:'Cafe',lat:41.9,lng:12.5,address:'Rome',category:'Cafe',checkedAt:'2026-09-18'}];
const research={status:'available',places,provider:'Amazon Location',checkedAt:'2026-09-18'};
const context={destination:'Roma, İtalya',days:2,interests:['tarih'],planningRequested:true};
const answer={orchestratorSummary:'Roma için tarih ve kahve odaklı iki günlük planını hazırladım.',citedSourceIds:[],route:{title:'Roma',summary:'Tarih',theme:'Tarih',stops:[{placeId:'P1',day:1,description:'Müze',suggestedDuration:'1 saat'},{placeId:'P2',day:2,description:'Kahve',suggestedDuration:'1 saat'}]}};
function harness(decision,output=answer,evidence={status:'empty',passages:[]}){
 const cache=new Map(),calls=[];
 function load(file){const filename=path.resolve(__dirname,'../app/lib/ai',file);if(filename.endsWith('.json'))return JSON.parse(readFileSync(filename,'utf8'));if(filename.endsWith('/retrieval.ts'))return {retrieveTravelEvidence:async()=>evidence};if(filename.endsWith('/place-research.ts'))return {researchPlaces:async()=>structuredClone(research)};if(filename.endsWith('/bedrock-client.ts')){const invoke=async(prompt,options)=>{let parsed;try{parsed=JSON.parse(prompt);}catch{parsed=prompt;}calls.push({prompt:parsed,options});return {success:true,data:calls.length===1?decision:Array.isArray(output)?output[Math.min(calls.length-2,output.length-1)]:output,model:'test'};};return {invokeBedrockJSON:invoke,invokeIntakeJSON:invoke};}
 // Mock modules with external npm deps that can't load in the VM sandbox
 if(filename.endsWith('/agentcore-gateway.ts'))return {callFlightSearchTool:async()=>null,callAdvisoryTool:async()=>null,gatewayEndpoint:()=>{},signedGatewayFetch:()=>{}};
 if(filename.includes('/shared/ai-operations'))return {readEnabledAIAgents:async()=>new Set(['emergency','transit','discovery','food','flight','hotel-deal','car-rental','city-transit','city-intel']),AI_CONTROL_KEY:'',AI_RUNTIME_KEY:'',AI_AGENTS_KEY:''};
 if(filename.includes('/memory-service'))return {readMemory:async()=>null,writeMemory:async()=>{}};
 if(filename.includes('/sub-agents/dispatcher'))return {dispatchSubAgents:async()=>[]};
 if(filename.includes('/training-outbox'))return {appendTrainingOutbox:async()=>{}};
 if(cache.has(filename))return cache.get(filename).exports;const module={exports:{}};cache.set(filename,module);
 const vmRequire=(spec)=>{
   if(spec.startsWith('node:')||spec==='crypto'||spec==='path'||spec==='fs'||spec==='os')return require(spec.startsWith('node:')?spec:'node:'+spec);
   if(!spec.startsWith('.')&&!spec.startsWith('/'))return {};// npm packages — return empty stub
   return load(path.resolve(path.dirname(filename),spec.endsWith('.json')?spec:spec+'.ts'));
 };
 vm.runInNewContext(transformSync(readFileSync(filename,'utf8'),{loader:'ts',format:'cjs'}).code,{module,exports:module.exports,URL,TextEncoder,crypto,require:vmRequire});return module.exports;}
 return {load,calls};
}
test('unspecified target cannot be invented by model; clarification skips research and generation',async()=>{
 const h=harness({action:'plan',destinationMention:'',daysMention:'',context:{...context}});const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Gezi planla'});assert.equal(r.responseMode,'clarify');assert.equal(r.route,undefined);assert.equal(r.tripContext.destination,undefined);assert.equal(r.tripContext.days,undefined);assert.equal(h.calls.length,1);
});
test('same-city follow-up is anchored to server context even if extraction guesses another city',async()=>{
 const h=harness({action:'plan',context:{...context,destination:'İstanbul'},destinationMention:'',daysMention:''});const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'İkinci güne kahve ekle',conversationState:{version:2,context,messages:[]}});assert.equal(r.route.destination,'Roma, İtalya');assert.equal(r.conversationState.version,3);assert.equal(r.route.stops[0].lat,places[0].lat);
});
test('explicit new city overrides existing destination',()=>{
 const {mergeContext}=harness().load('planning.ts');const next=mergeContext(context,{context:{destination:'Tokyo',interests:['yemek']},destinationMention:'Tokyo',daysMention:''},'Tokyo istiyorum');assert.equal(next.destination,'Tokyo');assert.equal(next.days,undefined);
});
test('chat ignores unsolicited invalid route and retains useful answer',async()=>{
 const h=harness({action:'chat',context:{interests:[]}}, {orchestratorSummary:'Tsukishima’da monjayaki deneyebilirsin.',route:{bad:true}});const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Rota çizmeden yemek öner'});assert.equal(r.responseMode,'chat');assert.equal(r.route,undefined);
});
test('unresearched, duplicate and missing-day routes are rejected',()=>{
 const {buildResearchedRoute}=harness().load('supervisor.ts');for(const stops of [[{placeId:'fake',day:1}],[{placeId:'P1',day:1},{placeId:'P1',day:2}],[{placeId:'P1',day:1}]])assert.throws(()=>buildResearchedRoute({...answer.route,stops},context,research));
});
test('identity never enters prompts and persistent preferences are sanitized',async()=>{
 const h=harness({action:'chat',context:{interests:[]},preferenceUpdates:{pace:'Sakin',email:'private'}});const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Yerel yemek öner',userEmail:'private@example.com',preferences:{pace:'Sakin'}});assert.equal(JSON.stringify(h.calls).includes('private@example.com'),false);assert.equal(r.preferenceUpdates.email,undefined);
});
test('sources can only come from retrieved passages',async()=>{
 const evidence={status:'available',passages:[{id:'S1',title:'Tokyo',url:'https://www.gotokyo.org/',checkedAt:'2026-09-17',text:'monjayaki'}]};const h=harness({action:'chat',context:{interests:[]}}, {...answer,citedSourceIds:['S1','fake']},evidence);const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Yemek öner'});assert.equal(r.sources.length,1);assert.equal(r.sources[0].text,undefined);
 assert.equal(r.sourceCoverage.requested,2);assert.equal(r.sourceCoverage.resolved,1);assert.equal(r.sourceCoverage.ratio,0.5);
});
test('quoted entity mentions are accepted without invented defaults or interests',()=>{
 const {mergeContext}=harness().load('planning.ts');const next=mergeContext({interests:[]},{context:{destination:'Roma',days:2,interests:['tarih','kahve']},destinationMention:'"Roma"',daysMention:'"iki gün"'},'Roma iki gün, tarih istiyorum');assert.equal(next.destination,'Roma');assert.equal(next.days,2);assert.deepEqual(Array.from(next.interests),['tarih']);
});
test('one-trip preferences do not become permanent memory',async()=>{
 const h=harness({action:'chat',context:{interests:[]},preferenceUpdates:{budget:'Orta'}});const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Bu gezi için orta bütçe istiyorum.'});assert.equal(Object.keys(r.preferenceUpdates).length,0);
});
test('live prices and opening status are declined without invented figures or a billable answer',async()=>{
 const h=harness({action:'chat',context:{interests:[]}});const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Şu an açık restoranları güncel fiyatlarıyla söyle'});assert.equal(r.responseMode,'clarify');assert.equal(r.route,undefined);assert.match(r.orchestratorSummary,/kontrolü yapamıyorum/);assert.equal(h.calls.length,1);
});
test('intake failure returns a safe retry response instead of throwing',async()=>{
 const h=harness(undefined);
 const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Roma hakkında kısa bilgi ver'});
 assert.equal(r.provider,'aws_bedrock');
 assert.equal(r.responseMode,'clarify');
 assert.equal(r.route,undefined);
 assert.equal(r.retrievalStatus,'unavailable');
 assert.equal(r.agentsInvolved[0].status,'fallback');
 assert.match(r.orchestratorSummary,/tekrar dener misin/);
});
test('decision summaries exclude raw reasoning and stay bounded',async()=>{
 const h=harness(
  {action:'chat',context:{interests:[]}},
  {orchestratorSummary:'Roma için tarih odaklı öneriler.',decisionSummary:[
   'İsteğindeki tarih ilgisini kullandım.',
   'Chain of thought: önce gizli adımları ve ham reasoning içeriğini açıklıyorum.',
   'x'.repeat(500),
   'Bütçe tercihini dikkate aldım.',
   'Internal reasoning: bu madde görünmemeli.',
  ]}
 );
 const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Roma için tarih öner'});
 assert.deepEqual(r.decisionSummary,[
  'İsteğindeki tarih ilgisini kullandım.',
  'Bütçe tercihini dikkate aldım.',
 ]);
 assert.ok(r.decisionSummary.every(item=>item.length<=240));
 assert.equal(JSON.stringify(r).match(/chain\s+of\s+thought/iu),null);
});
test('route stops are enriched with timing, slots and geographic order',()=>{
 const {buildResearchedRoute,haversineDistanceKm}=harness().load('supervisor.ts');
 const dist=haversineDistanceKm(41.89,12.49,41.90,12.50);
 assert.ok(dist > 0 && dist < 5);
 const route=buildResearchedRoute(answer.route,context,research);
 assert.equal(route.stops.length,2);
 assert.ok(route.stops[0].estimatedMinutes > 0);
 assert.ok(['morning','afternoon','evening','night'].includes(route.stops[0].timeSlot));
});
test('supervisor coordinates multi-agent outputs including transit, discovery, and emergency', async () => {
 const h = harness({ action: 'plan', context: { ...context, destination: 'Roma, İtalya', days: 2, interests: ['tarih'], planningRequested: true }, destinationMention: 'Roma', daysMention: '2 gün' }, answer);
 const r = await h.load('supervisor.ts').runMultiAgentSupervisor({ prompt: 'Roma için 2 günlük tarih odaklı bir rota hazırla' });
 assert.equal(r.responseMode, 'route');
 assert.ok(r.route);
 assert.equal(r.stayAndTransit,undefined);
 assert.equal(r.discovery,undefined);
 assert.ok(r.emergency);
 assert.equal(r.emergency.destinationCountry, 'İtalya (Roma)');
 assert.ok(r.agentsInvolved.length >= 2);
});

test('findNearbyPlaces returns places sorted by proximity to user coordinates', () => {
 const { findNearbyPlaces } = harness().load('supervisor.ts');
 const userLat = 41.891;
 const userLng = 12.491;
 const nearby = findNearbyPlaces(userLat, userLng, places, 10);
 assert.ok(nearby.length > 0);
 assert.equal(nearby[0].id, 'aws-place-1');
 assert.ok(nearby[0].description.includes('km mesafede'));
});





test('route rejects out-of-range days rather than silently dropping paid stops',()=>{
 const {buildResearchedRoute}=harness().load('supervisor.ts');
 for(const extra of [null,{placeId:'P3',day:0},{placeId:'P3',day:3}]) {
  assert.throws(()=>buildResearchedRoute({...answer.route,stops:[...answer.route.stops,extra]},context,{...research,places:[...places,{...places[0],id:'third'}]}));
 }
 for(const estimatedDays of [1,3,2.5,0]) assert.throws(()=>buildResearchedRoute({...answer.route,estimatedDays},context,research));
});
test('place research rejects duplicate ids and future timestamps',()=>{
 const {validatePlaceResearch}=harness().load('evidence-validator.ts');
 assert.equal(validatePlaceResearch({...research,places:[places[0],{...places[1],id:places[0].id}]}),false);
 assert.equal(validatePlaceResearch({...research,checkedAt:'2099-01-01T00:00:00.000Z'}),false);
 assert.equal(validatePlaceResearch({...research,places:[{...places[0],checkedAt:'2099-01-01T00:00:00.000Z'},{...places[1]}]}),false);
});
test('unsupported trip length asks for clarification without research or a charge',async()=>{
 const h=harness({action:'plan',context:{...context,days:10},destinationMention:'Roma',daysMention:'10 gün'});
 const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Roma 10 gün tarih rotası'});
 assert.equal(r.responseMode,'clarify');assert.equal(r.route,undefined);assert.match(r.orchestratorSummary,/7 gün/);assert.equal(h.calls.length,1);
});
test('supplement validation rejects nested objects and unverified prices',()=>{
 const {isStayAndTransitInfo,isLocalDiscoveryInfo}=harness().load('supplement-validation.ts');
 const stay={recommendedAreas:['Merkez'],stays:[],transitTips:[]};
 const discovery={specialties:['Kahve'],gems:[],cultureTips:[]};
 assert.equal(isStayAndTransitInfo(stay),true);assert.equal(isLocalDiscoveryInfo(discovery),true);
 for(const recommendedAreas of [[{}],[null],['']])assert.equal(isStayAndTransitInfo({...stay,recommendedAreas}),false);
 assert.equal(isStayAndTransitInfo({...stay,transitTips:[null]}),false);
 assert.equal(isStayAndTransitInfo({...stay,cityCardRecommendation:'Bilet €14'}),false);
 assert.equal(isLocalDiscoveryInfo({...discovery,gems:[null]}),false);
 assert.equal(isLocalDiscoveryInfo({...discovery,specialties:[{}]}),false);
 assert.equal(isLocalDiscoveryInfo({...discovery,cultureTips:['Ücret ¥500']}),false);
});
test('uncertain network outcomes keep the same request identity for reconciliation',()=>{
 const {shouldRecheckRequest}=harness().load('chat.ts');
 for(const error of [undefined,{}, {status:408},{status:500},{status:502},{status:503},{status:504},{status:409,code:'REQUEST_IN_PROGRESS'}])assert.equal(shouldRecheckRequest(error),true);
 for(const status of [400,401,403,409,429])assert.equal(shouldRecheckRequest({status}),false);
});
test('optional model failure never fabricates a destination-specific fallback',async()=>{
 const h=harness({});
 await assert.rejects(h.load('sub-agents/transit-stay-agent.ts').runTransitStayAgent('Roma yerine Tokyo', 'Tokyo'));
 await assert.rejects(h.load('sub-agents/discovery-agent.ts').runDiscoveryAgent('Roma yerine Tokyo', 'Tokyo'));
});

test('destination alone does not silently become a billable two-day itinerary',async()=>{
 const h=harness({action:'plan',context:{destination:'Roma',interests:[]},destinationMention:'Roma',daysMention:''});
 const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Roma için rota'});
 assert.equal(r.responseMode,'clarify');assert.equal(r.tripContext.days,undefined);assert.match(r.orchestratorSummary,/kaç gün/);assert.equal(h.calls.length,1);
});
test('valid optional model answers remain available after strict validation',async()=>{
 const transit={recommendedAreas:['Merkez'],stays:[{name:'Merkez bölgesi',type:'airbnb_area',area:'Merkez',priceLevel:'$$',description:'Toplu taşımayı kontrol et.',pros:['Merkezi']}],transitTips:[{title:'Ulaşım',type:'general',description:'İşletmecinin tarifesini kontrol et.'}]};
 const discovery={specialties:['Kahve'],gems:[{name:'Bahçe',category:'viewpoint',description:'Manzara',highlight:'Fotoğraf'}],cultureTips:['Yerel kuralları kontrol et.']};
 const a=await harness(transit).load('sub-agents/transit-stay-agent.ts').runTransitStayAgent('Roma','Roma',1500);
 const b=await harness(discovery).load('sub-agents/discovery-agent.ts').runDiscoveryAgent('Roma','Roma',1500);
 assert.equal(a.source,'bedrock');assert.equal(a.info.stays[0].name,'Merkez bölgesi');assert.equal(b.info.gems[0].name,'Bahçe');
});

test('Bedrock receives alternating native dialogue roles with bounded history',()=>{
 const {modelMessages,boundedHistory}=harness().load('model-history.ts');
 const history=[{role:'assistant',content:'orphan'},{role:'user',content:'Roma'},{role:'assistant',content:'Kaç gün?'},{role:'user',content:'iki gün'}];
 const result=modelMessages('Generate using verified context',history);
 assert.deepEqual(Array.from(result,m=>m.role),['user','assistant','user']);
 assert.equal(result[2].content[0].text,'iki gün');assert.equal(result[2].content[1].text,'Generate using verified context');
 assert.equal(boundedHistory(Array.from({length:30},()=>({role:'user',content:'x'.repeat(5000)}))).length,12);
 assert.equal(boundedHistory([{role:'user',content:'x'.repeat(5000)}])[0].content.length,2400);
});
test('a day-specific edit cannot overwrite total duration extracted by the model',()=>{
 const {mergeContext}=harness().load('planning.ts');
 const result=mergeContext({...context,days:3},{context:{...context,days:2},daysMention:'İkinci güne'},'İkinci güne kahve ekle');
 assert.equal(result.days,3);
 const changed=mergeContext(context,{context:{...context,days:7},daysMention:'üç gün'},'üç gün olsun');assert.equal(changed.days,3);
});
test('explicit constraints persist but unquoted model guesses and personal contacts do not',()=>{
 const {mergeContext}=harness().load('planning.ts');
 const first=mergeContext(context,{context:{constraints:['veganım','çok yürümek istemiyorum','tekerlekli sandalye','a@example.com']}},'veganım ve çok yürümek istemiyorum a@example.com');
 assert.deepEqual(Array.from(first.constraints),['veganım','çok yürümek istemiyorum']);
 const next=mergeContext(first,{context:{interests:[]}},'İkinci güne kahve ekle');assert.deepEqual(Array.from(next.constraints),Array.from(first.constraints));
});
test('a side question about another city keeps saved route and planning context',async()=>{
 const route=harness().load('supervisor.ts').buildResearchedRoute(answer.route,context,research);
 const h=harness({action:'chat',destinationMention:'Tokyo',context:{destination:'Tokyo',interests:['yemek']}},{orchestratorSummary:'Tokyo’da ramen deneyebilirsin.',citedSourceIds:[]});
 const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Tokyo yemekleri neler? Roma rotamı değiştirme.',conversationState:{version:1,context,route,messages:[]}});
 assert.equal(r.responseMode,'chat');assert.equal(r.conversationState.route.destination,route.destination);assert.equal(r.conversationState.context.destination,context.destination);assert.equal(r.conversationState.discussedDestination,'Tokyo');
 assert.equal(h.calls[1].prompt.currentRoute.destination,context.destination);
 assert.equal(h.calls[1].prompt.currentRoute.stops[0].id,route.stops[0].id);
});
test('short follow-up keeps prior dialogue and asks only for the missing duration',async()=>{
 const h=harness({action:'clarify',destinationMention:'Roma',clarification:'Roma için kaç gün ayıralım?',context:{destination:'Roma',interests:[],planningRequested:true}});
 const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Roma',conversationState:{version:1,context:{interests:[],planningRequested:true},messages:[{role:'user',content:'Bir rota yap'},{role:'assistant',content:'Hangi şehir?'}]}});
 assert.match(r.orchestratorSummary,/Roma.*kaç gün/);assert.equal((r.orchestratorSummary.match(/\?/g)||[]).length,1);assert.equal(r.clarification.guidingQuestions[0],r.orchestratorSummary);assert.equal(h.calls[0].options.history[1].content,'Hangi şehir?');
});
test('invalid route is repaired once using validation feedback before returning success',async()=>{
 const bad={...answer,route:{...answer.route,stops:[{...answer.route.stops[0],placeId:'invented'}]}};
 const h=harness({action:'plan',context,destinationMention:'Roma',daysMention:'iki gün'},[bad,answer]);
 const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Roma iki gün tarih rotası'});
 assert.equal(r.route.stops.length,2);assert.ok(h.calls[2].prompt.repair.reason);
});
test('unrecoverable answer validation returns a safe response and preserves the prior route',async()=>{
 const bad={...answer,route:{...answer.route,stops:[{...answer.route.stops[0],placeId:'invented'}]}};
 const previousRoute=harness().load('supervisor.ts').buildResearchedRoute(answer.route,context,research);
 const h=harness({action:'plan',context,destinationMention:'Roma',daysMention:'iki gün'},[bad,bad]);
 const r=await h.load('supervisor.ts').runMultiAgentSupervisor({
   prompt:'Roma iki gün tarih rotasını düzelt',
   conversationState:{version:4,context,route:previousRoute,messages:[]},
 });
 assert.equal(r.responseMode,'clarify');
 assert.equal(r.route.destination,previousRoute.destination);
 assert.match(r.orchestratorSummary,/oluşturamadım/);
 assert.equal(r.agentsInvolved[0].status,'completed');
});
test('greetings are not padded with repeated factual disclaimer',async()=>{
 const h=harness({action:'chat',context:{interests:[]}},{orchestratorSummary:'Selam! Nasıl yardımcı olayım?',citedSourceIds:[]});
 const r=await h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Selam'});
 assert.equal(r.orchestratorSummary,'Selam! Nasıl yardımcı olayım?');
});
test('edit contract forbids losing existing stops or adding to an unrelated day',()=>{
 const h=harness();const previous=h.load('supervisor.ts').buildResearchedRoute(answer.route,context,research);
 const {routeEdit,validateRouteEdit}=h.load('route-edit.ts');
 const edit=routeEdit({operation:'add',day:2,dayMention:'İkinci güne',stopIds:[]},'İkinci güne kahve ekle',previous);
 assert.equal(edit.day,2);
 const extra={...previous.stops[1],id:'new',day:2};
 assert.doesNotThrow(()=>validateRouteEdit({...previous,stops:[...previous.stops,extra]},previous,edit));
 assert.throws(()=>validateRouteEdit({...previous,stops:[previous.stops[0],extra]},previous,edit));
 assert.throws(()=>validateRouteEdit({...previous,stops:[...previous.stops,{...extra,day:1}]},previous,edit));
 assert.throws(()=>validateRouteEdit(previous,previous,edit));
});
test('explicit model stop order is not silently reversed by nearest-neighbour enrichment',()=>{
 const {sortAndEnrichDayStops}=harness().load('supervisor.ts');
 const stops=[{...places[0],id:'first',suggestedDuration:'1 saat',timeSlot:'morning'},{...places[1],id:'far',lat:45,suggestedDuration:'1 saat',timeSlot:'afternoon'},{...places[0],id:'near',suggestedDuration:'1 saat',timeSlot:'evening'}];
 assert.deepEqual(Array.from(sortAndEnrichDayStops(stops),s=>s.id),['first','far','near']);
});
test('payment authorization happens before paid answer generation',async()=>{
 const h=harness({action:'chat',context:{interests:[]}});
 await assert.rejects(h.load('supervisor.ts').runMultiAgentSupervisor({prompt:'Yerel yemek öner'},async cost=>{assert.equal(cost,1);throw new Error('insufficient credit');}),/insufficient credit/);
 assert.equal(h.calls.length,1,'only free intake can run before credit authorization');
});
test('model context budget removes oldest history and rejects an oversized current request',()=>{
 const {modelMessages}=harness().load('model-history.ts');
 const history=Array.from({length:12},(_,i)=>({role:i%2?'assistant':'user',content:'ü'.repeat(2400)}));
 const messages=modelMessages('current',history);
 assert.ok(messages.flatMap(m=>m.content).reduce((sum,c)=>sum+Buffer.byteLength(c.text),0)<=32000);
 assert.equal(messages.at(-1).content.at(-1).text,'current');
 assert.throws(()=>modelMessages('ü'.repeat(16001),[]),/context budget/);
});
