const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {transformSync}=require('esbuild');
function harness(results, env={TRAVEL_KNOWLEDGE_BASE_ID:'test-kb'}) {
 const calls=[];
 function load(file){const module={exports:{}};vm.runInNewContext(transformSync(fs.readFileSync(path.resolve(__dirname,'../app/lib/ai',file),'utf8'),{loader:'ts',format:'cjs'}).code,{module,exports:module.exports,process:{env},URL,AbortSignal,console:{warn(){}},require:spec=>spec.startsWith('@aws-sdk')?{
 BedrockAgentRuntimeClient:class{async send(command){calls.push(command.input);if(results instanceof Error)throw results;return {retrievalResults:results};}},RetrieveCommand:class{constructor(input){this.input=input;}}
 }:load(spec+'.ts')});return module.exports;}
 return {...load('retrieval.ts'),calls};
}
const valid={content:{text:'Tokyo food'},metadata:{source_url:'https://www.gotokyo.org/',checked_at:'2026-09-17',visibility:'public',approved:true,valid_until:4102444800,title:'Tokyo'}};
test('retrieval bounds context, enforces public approved unexpired metadata, excludes identity',async()=>{
 const h=harness(Array.from({length:6},()=>({...valid,content:{text:'x'.repeat(3000)}})));
 const result=await h.retrieveTravelEvidence({prompt:'Tokyo',userEmail:'private@example.com',preferences:{pace:'Sakin'},profileContext:{userEmail:'secret@example.com'}});
 assert.equal(result.status,'available');assert.equal(result.passages.reduce((n,p)=>n+p.text.length,0),9000);
 assert.equal(JSON.stringify(h.calls).includes('@example.com'),false);
 assert.equal(h.calls[0].retrievalConfiguration.vectorSearchConfiguration.filter.andAll.length,3);
});
test('private, expired, malformed and unsafe-url documents never reach model',async()=>{
 const h=harness([
 {...valid,metadata:{...valid.metadata,visibility:'private'}},
 {...valid,metadata:{...valid.metadata,valid_until:1}},
 {...valid,metadata:{...valid.metadata,source_url:'javascript:alert(1)'}},
 {...valid,metadata:{...valid.metadata,checked_at:'invalid'}},valid]);
 const result=await h.retrieveTravelEvidence({prompt:'Tokyo'});assert.equal(result.passages.length,1);assert.equal(result.passages[0].id,'S1');
});
test('disabled, empty and unavailable retrieval remain distinguishable',async()=>{
 for(const [h,status] of [[harness([],{}),'disabled'],[harness([]),'empty'],[harness(new Error('timeout')),'unavailable']])assert.equal((await h.retrieveTravelEvidence({prompt:'Tokyo'})).status,status);
});
const {validate}=require('../../../infra/scripts/ingest-travel.cjs');
test('ingestion rejects unreviewed, private, duplicate and stale documents before upload',()=>{
 const good={id:'tokyo',title:'Tokyo',text:'Guide',city:'Tokyo',country:'JP',source_url:'https://www.gotokyo.org/',checked_at:'2026-09-17',valid_until:'2026-12-16',reviewer:'editor',rights:'original summary',approved:true,visibility:'public'};
 const now=Date.parse('2026-09-18');
 assert.equal(validate([good],now).length,1);
 for(const patch of [{approved:false},{visibility:'private'},{valid_until:'2026-09-01'},{source_url:'file:///etc/passwd'},{rights:''}])assert.throws(()=>validate([{...good,...patch}],now));
 assert.throws(()=>validate([good,good],now));
});
test('city filter canonicalizes country suffix and aliases while rejecting another city',async()=>{
 const h=harness([{...valid,metadata:{...valid.metadata,city:'Roma'}},{...valid,metadata:{...valid.metadata,city:'Tokyo'}}]);
 const result=await h.retrieveTravelEvidence({prompt:'Yerel yemek öner',researchDestination:'Rome, Italy'});
 assert.equal(h.calls[0].retrievalConfiguration.vectorSearchConfiguration.filter.andAll[3].equals.value,'Roma');
 assert.equal(result.passages.length,1);
 assert.equal(h.canonicalCity('İstanbul, Türkiye'),'İstanbul');
});
test('culture and transit queries use the vector store and redact contact details',async()=>{
 const h=harness([{...valid,metadata:{...valid.metadata,city:'Roma'}}]);
 const result=await h.retrieveTravelEvidence({prompt:'Roma müzeleri ve metro; user@example.com',researchDestination:'Roma'});
 assert.equal(result.status,'available');
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].retrievalQuery.text.includes('user@example.com'),false);
});
