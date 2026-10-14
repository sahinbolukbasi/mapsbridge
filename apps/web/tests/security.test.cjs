const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const vm = require('node:vm');

function loadStorage(store) {
 const result = buildSync({ entryPoints: ['app/lib/user-storage.ts'], bundle:true, platform:'node', format:'cjs', write:false });
 const context = { module:{exports:{}}, window:{}, localStorage:store };
 vm.runInNewContext(result.outputFiles[0].text, context);
 return context.module.exports.userStorage;
}
function store() { const map = new Map(); return { getItem:k=>map.get(k)??null, setItem:(k,v)=>map.set(k,v), removeItem:k=>map.delete(k) }; }

test('account storage preserves legacy data without exposing it to another user', () => {
 const data=store(); data.setItem('adreskopru.savedAddresses','legacy');
 data.setItem('mapsbridge.userEmail','a@example.com'); data.setItem('mapsbridge.accessToken','token');
 const a=loadStorage(data);
 assert.equal(a.getItem('adreskopru.savedAddresses'),null);
 a.setItem('adreskopru.savedAddresses','A');
 data.setItem('mapsbridge.userEmail','b@example.com');
 assert.throws(()=>a.setItem('adreskopru.savedAddresses','stale A tab'));
 const b=loadStorage(data); assert.equal(b.getItem('adreskopru.savedAddresses'),null);
 b.setItem('adreskopru.savedAddresses','B');
 data.setItem('mapsbridge.userEmail','a@example.com');
 assert.equal(loadStorage(data).getItem('adreskopru.savedAddresses'),'A');
 assert.equal(data.getItem('adreskopru.savedAddresses'),'legacy');
 data.removeItem('mapsbridge.accessToken');
 assert.equal(a.getItem('adreskopru.savedAddresses'),null);
});

// Stub AWS Lambda streaming API so handler.cjs loads outside Lambda runtime
if (!global.awslambda) global.awslambda = {};
if (!global.awslambda.streamifyResponse) global.awslambda.streamifyResponse = (fn) => fn;
const { handler } = require('../../../infra/terraform/.build/ai/handler.cjs');
test('AI rejects missing token, bad request and wrong app client before planning', async () => {
 process.env.CLIENT_ID='our-client';
 const base={requestContext:{http:{method:'POST'}},body:JSON.stringify({prompt:'A trip'})};
 assert.equal((await handler(base)).statusCode,401);
 assert.equal((await handler({...base, headers:{authorization:'Bearer bad'},body:'[]'})).statusCode,400);
 const original=global.fetch;
 global.fetch=async()=>({ok:true,json:async()=>({UserAttributes:[{Name:'email',Value:'verified@example.com'}]})});
 try {
 const token='h.'+Buffer.from(JSON.stringify({client_id:'other-client'})).toString('base64url')+'.s';
 assert.equal((await handler({...base,headers:{authorization:'Bearer '+token}})).statusCode,401);
 } finally {global.fetch=original;}
});

test('route output rejects impossible coordinates and invalid day numbers', () => {
 const result=buildSync({entryPoints:['app/lib/ai/types.ts'],bundle:true,platform:'node',format:'cjs',write:false});
 const context={module:{exports:{}}}; vm.runInNewContext(result.outputFiles[0].text,context);
 const route={title:'Trip',summary:'Summary',destination:'City',theme:'Culture',estimatedDays:2,stops:[{id:'stop_1',name:'Stop',description:'Visit',suggestedDuration:'1h',lat:40,lng:29,day:1}]};
 assert.equal(context.module.exports.isRoutePlan(route),true);
 route.stops[0].lat=NaN; assert.equal(context.module.exports.isRoutePlan(route),false);
 route.stops[0].lat=40; route.stops[0].day=3; assert.equal(context.module.exports.isRoutePlan(route),false);
});
