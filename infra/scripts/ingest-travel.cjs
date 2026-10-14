// Curated input only: never fetch arbitrary URLs or ingest private user content.
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {S3Client,PutObjectCommand}=require('../lambda/node_modules/@aws-sdk/client-s3');
function validate(records,now=Date.now()) {
 if(!Array.isArray(records)||!records.length||records.length>1000)throw Error('Expected 1–1000 curated documents');
 const ids=new Set();
 for(const r of records){
  if(!r||typeof r.id!=='string'||!/^[a-z0-9-]{1,100}$/.test(r.id)||ids.has(r.id))throw Error('Invalid or duplicate document id');ids.add(r.id);
  for(const key of ['title','text','city','country','source_url','checked_at','reviewer','rights'])if(typeof r[key]!=='string'||!r[key].trim())throw Error(`Missing ${key}`);
  const u=new URL(r.source_url);
  if(u.protocol!=='https:'||u.username||u.password||r.text.length>20000||r.title.length>160)throw Error('Invalid source or document size');
  const checked=Date.parse(r.checked_at),expires=Date.parse(r.valid_until);
  if(!Number.isFinite(checked)||!Number.isFinite(expires)||checked>now||expires<=now||expires<=checked||expires-checked>180*86400000)throw Error('Review date/expiry invalid (max 180 days)');
  if(r.approved!==true||r.visibility!=='public')throw Error('Only approved public documents allowed');
 }
 return records;
}
async function main(){
 const filename=process.argv[2];if(!filename)throw Error('Usage: node infra/scripts/ingest-travel.cjs records.json [--apply]');
 const records=validate(JSON.parse(fs.readFileSync(filename,'utf8')));
 if(!process.argv.includes('--apply')){console.log(`Validated ${records.length} documents; no AWS writes`);return;}
 const outputs=JSON.parse(execFileSync('terraform',['-chdir=infra/travel-rag','output','-json'],{encoding:'utf8'}));
 const s3=new S3Client({region:'eu-central-1'});
 for(const r of records){
  const Key=`published/${r.id}.txt`;
  const metadataAttributes={title:r.title,city:r.city,country:r.country,source_url:r.source_url,checked_at:r.checked_at,valid_until:Date.parse(r.valid_until)/1000,approved:true,visibility:'public',rights:r.rights,reviewer:r.reviewer};
  await s3.send(new PutObjectCommand({Bucket:outputs.source_bucket.value,Key:Key+'.metadata.json',ContentType:'application/json',Body:JSON.stringify({metadataAttributes})}));
  await s3.send(new PutObjectCommand({Bucket:outputs.source_bucket.value,Key,ContentType:'text/plain; charset=utf-8',Body:`${r.title}\n${r.city}, ${r.country}\n${r.text}`}));
 }
 const job=execFileSync('aws',['bedrock-agent','start-ingestion-job','--region','eu-central-1','--knowledge-base-id',outputs.knowledge_base_id.value,'--data-source-id',outputs.data_source_id.value,'--output','json'],{encoding:'utf8'});
 console.log(job);
}
module.exports={validate};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
