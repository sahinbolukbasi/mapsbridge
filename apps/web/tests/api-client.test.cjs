const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {transformSync}=require('esbuild');
const vm=require('node:vm');

test('lost authenticated retry response stays uncertain instead of becoming original 401',async()=>{
 const module={exports:{}};let calls=0;
 vm.runInNewContext(transformSync(readFileSync('app/lib/api-client.ts','utf8'),{loader:'ts',format:'cjs'}).code,{
  module,exports:module.exports,process:{env:{}},AbortSignal,
  require:()=>({getStoredSession:()=>({token:'expired'}),refreshSession:async()=>({token:'renewed'})}),
  fetch:async()=>{calls++;if(calls===1)return {status:401,ok:false,json:async()=>({error:'Expired'})};throw Error('connection lost after commit');},
 });
 await assert.rejects(module.exports.apiFetch('/ai/route-planner',{method:'POST',body:'{}'}),e=>e.status===undefined&&/tekrar kontrol/.test(e.message));
 assert.equal(calls,2);
});
