#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {table as textTable} from './lib/format.mjs';
import {page,esc,writeOut} from './lib/render.mjs';
import {merge,validateData} from './lib/merge.mjs';
import {readTemplate,readWorkbook,readLimited,hash} from './lib/import.mjs';
export const usage={
 help:'Show this usage',templates:'List templates and review readiness',jobs:'List document jobs',
 'merge-queue':'List open jobs in due-date order',attention:'Find overdue jobs and missing evidence',
 'template-review':'List template reviews needing attention',workload:'Compare owners and due work',
 outputs:'List generated snapshots and their decisions',activity:'Read change history',imports:'Read import receipts',
 compliance:'Check privacy evidence and house controls',insights:'Answer ten cross-record questions',
 template:'<name|id> Read template versions and review history',job:'<name|id> Read job, data and output history',
 'add-template':'--name= --owner= --file=template.txt|docx --actor=',
 revise:'<template> --file= --note= --actor=',
 'approve-template':'<template> --decision=approved|changes --evidence= --due=YYYY-MM-DD --actor=',
 'archive-template':'<template> --actor=',
 add:'--name= --template= --owner= --due=YYYY-MM-DD --data=file.json --actor=',
 'set-data':'<job> --data=file.json --actor=',
 assign:'<job> --owner= --due=YYYY-MM-DD --actor=',
 classify:'<job> --privacy=personal|business --purpose= --retention=YYYY-MM-DD --actor=',
 'check-accuracy':'<job> --evidence= --actor=',
 validate:'<job> Show merge fields and all generation blockers',
 generate:'<job> --actor= Save a new draft output snapshot',
 'review-output':'<output-id> --decision=approved|changes --evidence= --actor=',
 'render-output':'<output-id> Render the saved HTML snapshot again',
 archive:'<job> --actor= Archive without deleting history',
 import:'conga <workbook.xlsx> --master=Master --template=<name|id> --key=source-id --name= --owner= --due=YYYY-MM-DD --actor= [--dry-run]',
 export:'[--out=exports/backup.json] Export all records',
 'draft-review':'<job> Write a local review packet',
 'weekly-review':'Draft Monday review from queue, attention and compliance'
};
const reads={templates:'select * from template_register order by name',jobs:'select * from job_register order by due_date,name',
 'merge-queue':"select name,template,owner,due_date,readiness,privacy,output_count from job_register where status='open' order by due_date,name",
 attention:'select name,owner,issue from attention order by name,issue',
 'template-review':"select name,owner,current_version,readiness,review_due from template_register where readiness<>'ready' order by name",
 workload:'select * from owner_workload order by overdue desc,owner',outputs:'select * from output_register order by created_at desc,id',
 activity:'select * from activity order by created_at desc,id',imports:'select * from import_runs order by created_at desc,id'};
const writeCommands=new Set(['add-template','revise','approve-template','archive-template','add','set-data','assign','classify','check-accuracy','generate','review-output','archive','import']);
function need(o,k){const s=String(o[k]??'').trim();if(!s)throw Error(`Required --${k}`);return s;}
function date(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Expected a valid YYYY-MM-DD date');return s;}
const today=()=>new Date().toISOString().slice(0,10);
function decision(o){const d=need(o,'decision');if(!['approved','changes'].includes(d))throw Error('Decision must be approved or changes');return d;}
const jsonFile=f=>validateData(JSON.parse(readLimited(f,5000000).toString('utf8')));
async function one(db,kind,ref){
 if(!ref)throw Error(`Specify ${kind} name or id`);
 const name=kind==='outputs'?'id::text':'name';
 const exact=await db.query(`select * from ${kind} where lower(${name})=lower($1) or id::text=$1`,[ref]);
 const rows=exact.length?exact:await db.query(`select * from ${kind} where starts_with(id::text,lower($1)) order by id`,[ref]);
 if(rows.length!==1)throw Error(`${rows.length?'Ambiguous':'No match'} ${kind}: ${rows.map(r=>`${r.id} ${r.name||''}`).join('; ')||ref}`);
 return rows[0];
}
async function event(db,id,action,actor,detail){await db.query('insert into activity(entity_id,action,actor,detail) values($1,$2,$3,$4)',[id,action,actor,JSON.stringify(detail)]);}
async function current(db,t){return (await db.query('select * from template_versions where template_id=$1 and version=$2',[t.id,t.current_version]))[0];}
async function blockers(db,j){
 const t=await one(db,'templates',j.template_id),v=await current(db,t);
 const reg=(await db.query('select * from template_register where id=$1',[t.id]))[0];
 const result=merge(v.body,j.data);const reasons=[];
 if(j.status!=='open')reasons.push('Job is not open');
 if(reg.readiness!=='ready')reasons.push(`Template ${reg.readiness}`);
 if(j.privacy==='unknown')reasons.push('Classify information');
 if(j.privacy==='personal'){
  if(!j.purpose?.trim())reasons.push('Record lawful purpose');
  if(!j.accuracy_evidence?.trim()||j.accuracy_version!==j.data_version)reasons.push('Record current accuracy evidence');
  if(!j.retention_review||j.retention_review<today())reasons.push('Record a current retention decision');
 }
 if(result.missing.length)reasons.push(`Missing merge data: ${result.missing.join(', ')}`);
 return {job:j.name,version:v.version,data_version:j.data_version,missing:result.missing,reasons,ready:!reasons.length,text:result.text,version_id:v.id};
}
async function compliance(db){return [
 ...(await db.query("select name,owner,issue from attention where issue in ('classify information','accuracy evidence missing or stale','retention decision due','record lawful purpose') order by name,issue")).map(r=>({...r,rule:r.issue==='retention decision due'?'NZ IPP9 / house review date':r.issue.includes('accuracy')?'NZ IPP8 / recorded evidence':'House classification control'})),
 ...(await db.query("select name,owner,readiness as issue from template_register where active and readiness<>'ready'")).map(r=>({...r,rule:'House template approval control'}))];}
const insightQueries=[
 ['Which overdue jobs also lack an approved template?',"select name,template,owner,due_date from job_register where status='open' and due_date<current_date and readiness<>'ready' order by name"],
 ['Who has the most overdue documents?', 'select * from owner_workload where overdue>0 order by overdue desc,owner'],
 ['Which templates block the most open jobs?',"select template,count(*)::int as jobs from job_register where status='open' and readiness<>'ready' group by template order by jobs desc,template"],
 ['Which personal-information jobs need an accuracy check?',"select name,owner from attention where issue='accuracy evidence missing or stale' order by name"],
 ['Which archived jobs still need a retention decision?',"select name,owner,retention_review from jobs where status='archived' and privacy='personal' and (retention_review is null or retention_review<current_date) order by name"],
 ['Which outputs use superseded data or wording?', 'select name,template,version,data_version,decision from output_register where superseded order by name'],
 ['Which outputs are waiting for review?',"select name,template,actor,created_at from output_register where decision is null and not superseded order by created_at"],
 ['Which jobs are repeatedly generated?', 'select name,template,output_count from job_register where output_count>1 order by output_count desc,name'],
 ['Which imported jobs have never produced an output?',"select j.name,j.owner,j.external_key from jobs j where external_key is not null and not exists(select 1 from outputs o where o.job_id=j.id) order by j.name"],
 ['Which open jobs have missing merge fields?',null]
];
export async function run(db,cmd,args=[],o={}){
 if(!Object.hasOwn(usage,cmd))throw Error(`Unknown command ${cmd}; run help`);
 const mutation=writeCommands.has(cmd);const actor=mutation?need(o,'actor'):null;
 await db.exec(mutation?'BEGIN ISOLATION LEVEL SERIALIZABLE':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{const result=await execute(db,cmd,args,o,actor);await db.exec('COMMIT');return result;}catch(e){await db.exec('ROLLBACK');throw e;}
}
async function execute(db,cmd,args,o,actor){
 if(cmd==='help')return Object.entries(usage).map(([command,arguments_])=>({command,arguments:arguments_}));
 if(reads[cmd])return db.query(reads[cmd]);
 if(cmd==='compliance')return compliance(db);
 if(cmd==='insights'){const out=[];for(const [question,sql] of insightQueries){let rows;
  if(sql)rows=await db.query(sql);else{rows=[];for(const j of await db.query("select * from jobs where status='open' order by name")){const b=await blockers(db,j);if(b.missing.length)rows.push({name:j.name,missing:b.missing.join(', ')});}}
  out.push({question,rows});}return out;}
 if(cmd==='template'){const t=await one(db,'templates',args[0]);return {template:t,versions:await db.query('select * from template_versions where template_id=$1 order by version',[t.id]),reviews:await db.query('select r.* from template_reviews r join template_versions v on v.id=r.version_id where v.template_id=$1 order by r.created_at',[t.id])};}
 if(cmd==='job'){const j=await one(db,'jobs',args[0]);return {job:j,outputs:await db.query('select * from output_register where job_id=$1 order by created_at',[j.id]),history:await db.query('select * from activity where entity_id=$1 order by created_at',[j.id])};}
 if(cmd==='add-template'){
  const src=await readTemplate(need(o,'file'));const t=(await db.query('insert into templates(name,owner) values($1,$2) returning *',[need(o,'name'),need(o,'owner')]))[0];
  await db.query('insert into template_versions(template_id,version,body,editor,note,source_format,source_hash) values($1,1,$2,$3,$4,$5,$6)',[t.id,src.body,actor,'Initial template',src.source_format,src.source_hash]);await event(db,t.id,cmd,actor,{source_hash:src.source_hash});return t;
 }
 if(['revise','approve-template','archive-template'].includes(cmd)){
  const t=await one(db,'templates',args[0]);await db.query('select id from templates where id=$1 for update',[t.id]);const v=await current(db,t);
  if(cmd==='revise'){if(!t.active)throw Error('Template is archived');const src=await readTemplate(need(o,'file'));
   await db.query('insert into template_versions(template_id,version,body,editor,note,source_format,source_hash) values($1,$2,$3,$4,$5,$6,$7)',[t.id,t.current_version+1,src.body,actor,need(o,'note'),src.source_format,src.source_hash]);
   await db.query('update templates set current_version=current_version+1 where id=$1',[t.id]);await db.query("update jobs set status='open' where template_id=$1 and status='complete'",[t.id]);
  }else if(cmd==='approve-template'){
   if(!t.active)throw Error('Template is archived');if(actor.toLowerCase()===v.editor.toLowerCase())throw Error('Reviewer must differ from editor');const due=date(need(o,'due'));if(due<today())throw Error('Review date must be current or future');
   await db.query('insert into template_reviews(version_id,reviewer,decision,evidence,review_due) values($1,$2,$3,$4,$5)',[v.id,actor,decision(o),need(o,'evidence'),due]);
   if(o.decision==='changes')await db.query("update jobs set status='open' where template_id=$1 and status='complete'",[t.id]);
  }else{await db.query('update templates set active=false where id=$1',[t.id]);}
  await event(db,t.id,cmd,actor,{...o,file:o.file?path.basename(o.file):undefined});return (await db.query('select * from template_register where id=$1',[t.id]))[0];
 }
 if(cmd==='add'){
  const t=await one(db,'templates',need(o,'template'));if(!t.active)throw Error('Template is archived');const data=jsonFile(need(o,'data'));
  const j=(await db.query('insert into jobs(name,template_id,owner,due_date,data) values($1,$2,$3,$4,$5) returning *',[need(o,'name'),t.id,need(o,'owner'),date(need(o,'due')),JSON.stringify(data)]))[0];await event(db,j.id,cmd,actor,{data});return j;
 }
 if(['set-data','assign','classify','check-accuracy','archive'].includes(cmd)){
  const j=await one(db,'jobs',args[0]);if(j.status==='archived'&& !['classify','archive'].includes(cmd))throw Error('Job is archived');
  let detail={};
  if(cmd==='set-data'){detail={previous:j.data,next:jsonFile(need(o,'data'))};await db.query("update jobs set data=$2,data_version=data_version+1,accuracy_version=null,status='open' where id=$1",[j.id,JSON.stringify(detail.next)]);}
  if(cmd==='assign')await db.query('update jobs set owner=$2,due_date=$3 where id=$1',[j.id,need(o,'owner'),date(need(o,'due'))]);
  if(cmd==='classify'){const p=need(o,'privacy');if(!['personal','business'].includes(p))throw Error('Privacy must be personal or business');
   const purpose=p==='personal'?need(o,'purpose'):null,retention=p==='personal'?date(need(o,'retention')):null;
   await db.query("update jobs set privacy=$2,purpose=$3,retention_review=$4,data_version=data_version+1,accuracy_version=null,status=case when status='complete' then 'open' else status end where id=$1",[j.id,p,purpose,retention]);}
  if(cmd==='check-accuracy')await db.query('update jobs set accuracy_evidence=$2,accuracy_version=data_version where id=$1',[j.id,need(o,'evidence')]);
  if(cmd==='archive')await db.query("update jobs set status='archived' where id=$1",[j.id]);
  await event(db,j.id,cmd,actor,{...o,...detail});return (await db.query('select * from jobs where id=$1',[j.id]))[0];
 }
 if(['validate','generate'].includes(cmd)){
  const j=await one(db,'jobs',args[0]);const b=await blockers(db,j);if(cmd==='validate'){const {text,version_id,...result}=b;return result;}
  if(!b.ready)throw Error(b.reasons.join('; '));const id=randomUUID();
  const html=page({title:j.name,subtitle:`DRAFT | Template version ${b.version} | Data version ${j.data_version} | ${id}`,sections:[{title:'Document',html:`<div style="white-space:pre-wrap">${esc(b.text)}</div>`}]});
  const out=(await db.query('insert into outputs(id,job_id,version_id,data_version,data_snapshot,body,html,sha256,actor,privacy_snapshot) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id,sha256',[id,j.id,b.version_id,j.data_version,JSON.stringify(j.data),b.text,html,hash(html),actor,JSON.stringify({privacy:j.privacy,purpose:j.purpose,accuracy_evidence:j.accuracy_evidence,retention_review:j.retention_review})]))[0];
  await event(db,j.id,cmd,actor,{output:id});const file=writeOut('drafts',id,html);return {...out,file,sent:false};
 }
 if(cmd==='review-output'){
  const out=await one(db,'outputs',args[0]);const j=await one(db,'jobs',out.job_id);const b=await blockers(db,{...j,status:j.status==='complete'?'open':j.status});
  if(actor.toLowerCase()===out.actor.toLowerCase())throw Error('Reviewer must differ from generator');
  if(out.data_version!==j.data_version||out.version_id!==b.version_id)throw Error('Output is superseded');
  if(!b.ready)throw Error(b.reasons.join('; '));const d=decision(o);
  await db.query('insert into output_reviews(output_id,reviewer,decision,evidence) values($1,$2,$3,$4)',[out.id,actor,d,need(o,'evidence')]);
  await db.query('update jobs set status=$2 where id=$1',[j.id,d==='approved'?'complete':'open']);await event(db,j.id,cmd,actor,{output:out.id,decision:d,evidence:o.evidence});return {id:out.id,decision:d,sent:false};
 }
 if(cmd==='render-output'){const out=await one(db,'outputs',args[0]);if(hash(out.html)!==out.sha256)throw Error('Output hash mismatch');return {file:writeOut('drafts',out.id,out.html),sha256:out.sha256};}
 if(cmd==='import'){
  if(args[0]!=='conga'||!args[1])throw Error('Use import conga <workbook.xlsx>');
  const t=await one(db,'templates',need(o,'template'));if(!t.active)throw Error('Template is archived');
  const src=await readWorkbook(args[1],need(o,'master')),key=need(o,'key'),name=need(o,'name'),owner=need(o,'owner'),due=date(need(o,'due'));
  const digest=hash(JSON.stringify({data:src.data,master:o.master,template_id:t.id,name,owner,due}));
  const existing=(await db.query('select * from jobs where external_key=$1',[key]))[0];
  const preview={name,sheets:src.sheets,fields:Object.keys(src.data),action:existing?'update':'insert',dry_run:!!o['dry-run']};
  if(o['dry-run'])return preview;
  const last=(await db.query('select digest from import_runs where external_key=$1 order by created_at desc,id desc limit 1',[key]))[0];
  if(existing?.status==='archived')throw Error('Imported job is archived');
  if(last?.digest===digest){if(JSON.stringify(existing.data)!==JSON.stringify(src.data)){// jsonb key order differs; canonical hash below handles it
    const same=(await db.query('select data=$2::jsonb as same from jobs where id=$1',[existing.id,JSON.stringify(src.data)]))[0].same;
    if(!same)throw Error('Local data changed since import; use a new key or reconcile before reimport');}
   return {...preview,id:existing.id,unchanged:true};}
  if(existing?.status==='archived')throw Error('Imported job is archived');
  let j;
  if(existing){j=(await db.query("update jobs set name=$2,template_id=$3,owner=$4,due_date=$5,data=$6,data_version=data_version+1,privacy='unknown',accuracy_version=null,status='open',source_fields=$7 where id=$1 returning *",[existing.id,name,t.id,owner,due,JSON.stringify(src.data),JSON.stringify({sheets:src.sheets,source:path.basename(args[1])})]))[0];}
  else j=(await db.query('insert into jobs(name,template_id,owner,due_date,data,external_key,source_fields) values($1,$2,$3,$4,$5,$6,$7) returning *',[name,t.id,owner,due,JSON.stringify(src.data),key,JSON.stringify({sheets:src.sheets,source:path.basename(args[1])})]))[0];
  await db.query('insert into import_runs(external_key,digest,job_id,source_name,actor) values($1,$2,$3,$4,$5)',[key,digest,j.id,path.basename(args[1]),actor]);
  await event(db,j.id,cmd,actor,{source_digest:src.digest,previous:existing?.data||null,sheets:src.sheets});return {...preview,id:j.id};
 }
 if(cmd==='export'){
  const backup={format:'document-generation-v1',exported_at:new Date().toISOString(),records:{}};
  for(const name of ['templates','template_versions','template_reviews','jobs','outputs','output_reviews','activity','import_runs'])backup.records[name]=await db.query(`select * from ${name} order by id`);
  const file=path.resolve(REPO_ROOT,o.out||`exports/backup-${Date.now()}.json`);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,JSON.stringify(backup,null,2),{mode:0o600,flag:'wx'});return {file,records:Object.values(backup.records).reduce((n,a)=>n+a.length,0)};
 }
 if(cmd==='draft-review'||cmd==='weekly-review'){
  let content,title;
  if(cmd==='draft-review'){const j=await one(db,'jobs',args[0]);title=`Review: ${j.name}`;content={job:j,validation:await blockers(db,j),outputs:await db.query('select * from output_register where job_id=$1',[j.id])};}
  else{title='Monday document review';content={queue:await db.query(reads['merge-queue']),attention:await db.query(reads.attention),compliance:await compliance(db)};}
  const file=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'drafts',`${cmd}-${randomUUID()}.md`);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,`# ${title}\n\nDraft for operator review. Nothing sent.\n\n\`\`\`json\n${JSON.stringify(content,null,2)}\n\`\`\`\n`,{mode:0o600,flag:'wx'});return {file,sent:false};
 }
 throw Error(`Unimplemented command ${cmd}`);
}
function display(result){
 if(Array.isArray(result)){if(!result.length)return '(none)';if(result.some(r=>Object.values(r).some(v=>typeof v==='object'&&v!==null)))return JSON.stringify(result,null,2);
 const keys=Object.keys(result[0]);return textTable(result,keys.map(key=>({key,label:key,width:key==='id'?8:80})));}
 return JSON.stringify(result,null,2);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const args=[],o={};for(const a of process.argv.slice(2)){if(a.startsWith('--')){const i=a.indexOf('=');o[a.slice(2,i<0?undefined:i)]=i<0?true:a.slice(i+1);}else args.push(a);}
 let db;try{db=await getDb();const result=await run(db,args.shift()||'help',args,o);console.log(o.json?JSON.stringify(result):display(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}
}
