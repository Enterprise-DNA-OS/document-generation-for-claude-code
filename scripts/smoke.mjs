import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {seed} from './seed.mjs';
import {run,usage} from './documents.mjs';
import {merge,parseTemplate,validateData} from './lib/merge.mjs';
import {readTemplate,hash} from './lib/import.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'document-generation-'));
process.env.DATA_DIR=path.join(tmp,'db');process.env.OUTPUT_DIR=tmp;process.env.DATABASE_URL='';
const seen=new Set();let db;
const call=async(c,a=[],o={})=>{seen.add(c);return run(db,c,a,o);};
const write=(name,data)=>{const file=path.join(tmp,name);fs.writeFileSync(file,data);return file;};
const dataFile=(name,data)=>write(name,JSON.stringify(data));
const later=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
const past=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
const rejects=assert.rejects;
try{
 db=await getDb();assert.equal((await migrate(db)).ran.length,2);assert.equal((await migrate(db)).ran.length,0);await seed(db);await seed(db);
 for(const c of ['help','templates','jobs','merge-queue','attention','template-review','workload','outputs','activity','imports','compliance','insights'])await call(c);
 assert.equal((await call('jobs')).length,4);assert.equal((await call('insights')).length,10);assert((await call('attention')).some(r=>r.issue==='retention decision due'));
 assert.equal(merge('{{A}}{{TableStart:ITEMS}}{{X}}{{TableEnd:ITEMS}}',{a:'Hi',ITEMS:[{X:'1'},{X:'2'}]}).text,'Hi12');
 assert.deepEqual(merge('{{A}}{{TableStart:ITEMS}}{{X}}{{TableEnd:ITEMS}}',{ITEMS:[{}]}).missing,['A','ITEMS[0].X']);
 assert.equal(merge('{{TableStart:OUTER}}{{TableStart:INNER}}{{NAME}}{{TableEnd:INNER}}{{TableEnd:OUTER}}',{OUTER:[{INNER:[{NAME:'nested'}]}]}).text,'nested');
 for(const body of ['{{TableStart:X}}{{TableEnd:Y}}','{{#if x}}','{{A','«ACCOUNT»','{{{A}}}'])assert.throws(()=>parseTemplate(body));
 assert.throws(()=>validateData(JSON.parse('{"__proto__":{}}')),/Reserved/);assert.throws(()=>validateData({A:1,a:2}),/Ambiguous/);
 const body=write('letter.txt','Hello {{NAME}}\n{{TableStart:ITEMS}}{{LABEL}}\n{{TableEnd:ITEMS}}');
 const t=await call('add-template',[],{name:'Test Letter',owner:'Team',file:body,actor:'Editor'});
 await rejects(()=>call('approve-template',[t.id],{decision:'approved',evidence:'Read',due:later,actor:'editor'}),/differ/);
 await call('approve-template',[t.id],{decision:'approved',evidence:'Wording and fields checked',due:later,actor:'Reviewer'});
 const sample={NAME:'<script>alert(1)</script>',ITEMS:[{LABEL:'One & two'},{LABEL:'Second'}]};
 const j=await call('add',[],{name:'Test Job',template:t.id,owner:'Owner',due:past,data:dataFile('data.json',sample),actor:'Operator'});
 assert.equal((await call('validate',[j.id])).ready,false);
 await rejects(()=>call('generate',[j.id],{actor:'Operator'}),/Classify/);
 await rejects(()=>call('assign',[j.id],{owner:'Owner',due:'2026-02-30',actor:'Operator'}),/valid/);
 await call('assign',[j.id],{owner:'New owner',due:later,actor:'Operator'});
 await call('classify',[j.id],{privacy:'personal',purpose:'Prepare service letter',retention:later,actor:'Operator'});
 await rejects(()=>call('generate',[j.id],{actor:'Operator'}),/accuracy/);
 await call('check-accuracy',[j.id],{evidence:'Compared with current source',actor:'Operator'});
 assert.equal((await call('validate',[j.id])).ready,true);
 const out=await call('generate',[j.id],{actor:'Operator'});assert.equal(out.sent,false);
 const html=fs.readFileSync(out.file,'utf8');assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert.equal(hash(html),out.sha256);
 await rejects(()=>call('review-output',[out.id],{actor:'Operator',decision:'approved',evidence:'Checked'}),/differ/);
 await call('review-output',[out.id],{actor:'Reviewer',decision:'approved',evidence:'Recipient and lines checked'});
 assert.equal((await call('job',[j.id])).job.status,'complete');
 assert.equal((await call('render-output',[out.id])).sha256,out.sha256);
 await call('set-data',[j.id],{data:dataFile('changed.json',{...sample,NAME:'Changed'}),actor:'Operator'});
 assert.equal((await call('job',[j.id])).job.status,'open');
 await rejects(()=>call('review-output',[out.id],{actor:'Reviewer',decision:'approved',evidence:'Old'}),/superseded/);
 await rejects(()=>call('generate',[j.id],{actor:'Operator'}),/accuracy/);
 await call('check-accuracy',[j.id],{evidence:'New source checked',actor:'Operator'});
 await call('revise',[t.id],{file:body,note:'Second wording review',actor:'Editor'});
 assert.equal((await call('template',[t.id])).versions.length,2);
 await rejects(()=>call('generate',[j.id],{actor:'Operator'}),/approval/);
 await call('approve-template',[t.id],{decision:'changes',evidence:'Needs change',due:later,actor:'Reviewer'});
 await rejects(()=>call('generate',[j.id],{actor:'Operator'}),/approval/);
 await call('approve-template',[t.id],{decision:'approved',evidence:'Changes checked',due:later,actor:'Reviewer'});
 const next=await call('generate',[j.id],{actor:'Operator'});
 await call('review-output',[next.id],{actor:'Reviewer',decision:'changes',evidence:'Double check copy'});
 await call('classify',[j.id],{privacy:'business',actor:'Operator'});
 await rejects(()=>call('review-output',[next.id],{actor:'Reviewer',decision:'approved',evidence:'Old classification'}),/superseded/);
 // Failed database writes must not modify append-only evidence.
 await rejects(()=>db.query('update outputs set body=$2 where id=$1',[out.id,'tampered']),/append-only/);
 await rejects(()=>db.query('delete from template_versions where template_id=$1',[t.id]),/append-only/);
 // A real workbook import: master record plus repeated detail rows.
 const workbook=path.join(tmp,'source.xlsx');
 async function makeBook({duplicate=false,formula=false,second=false,missing=false}={}){
  const b=new ExcelJS.Workbook();const m=b.addWorksheet('Master');m.addRow(duplicate?['NAME','NAME']:['NAME','DATE']);
  m.addRow([formula?{formula:'1+1',result:2}:'Imported account',new Date('2026-10-21T00:00:00Z')]);if(second)m.addRow(['Extra','2026-10-21']);
  const d=b.addWorksheet('ITEMS');d.addRow(['LABEL']);d.addRow([missing?'':'Imported line']);await b.xlsx.writeFile(workbook);
 }
 await makeBook();const io={master:'Master',template:t.id,key:'CONGA-1',name:'Imported Job',owner:'Importer',due:later,actor:'Import operator'};
 assert.equal((await call('import',['conga',workbook],{...io,'dry-run':true})).action,'insert');
 assert.equal((await db.query('select count(*)::int as n from import_runs'))[0].n,0);
 const imported=await call('import',['conga',workbook],io);assert.equal((await call('job',[imported.id])).job.data.DATE,'2026-10-21');
 assert.equal((await call('import',['conga',workbook],io)).unchanged,true);
 for(const opts of [{duplicate:true},{formula:true},{second:true}]){await makeBook(opts);await rejects(()=>call('import',['conga',workbook],io));assert.equal((await db.query('select count(*)::int as n from import_runs'))[0].n,1);}
 await makeBook();await rejects(()=>call('import',['conga',workbook],{...io,master:'Wrong'}),/available/);
 await call('set-data',[imported.id],{data:dataFile('local.json',{NAME:'Local',ITEMS:[]}),actor:'Operator'});
 await rejects(()=>call('import',['conga',workbook],io),/Local data changed/);
 // Same-name ambiguity must list candidates and fail.
 const duplicateJob=await call('add',[],{name:'Imported Job',template:t.id,owner:'Owner',due:later,data:dataFile('dup.json',sample),actor:'Operator'});
 await rejects(()=>call('job',['Imported Job']),/Ambiguous.*Imported Job/);
 assert.equal((await call('job',[duplicateJob.id.slice(0,12)])).job.id,duplicateJob.id);
 assert.equal((await call('template',['test letter'])).template.id,t.id);
 await call('classify',[imported.id],{privacy:'personal',purpose:'History review',retention:past,actor:'Operator'});await call('archive',[imported.id],{actor:'Operator'});
 assert((await call('compliance')).some(r=>r.name==='Imported Job'&&r.issue==='retention decision due'));
 await rejects(()=>call('import',['conga',workbook],io),/archived/);
 await call('archive-template',[t.id],{actor:'Operator'});
 await rejects(()=>call('add',[],{name:'Blocked',template:t.id,owner:'Owner',due:later,data:path.join(tmp,'data.json'),actor:'Operator'}),/archived/);
 const packet=await call('draft-review',[j.id]);assert(fs.readFileSync(packet.file,'utf8').includes('Review: Test Job'));
 const weekly=await call('weekly-review');assert(fs.readFileSync(weekly.file,'utf8').includes('compliance'));
 const backup=await call('export',[],{out:path.join(tmp,'backup.json')});assert.equal(JSON.parse(fs.readFileSync(backup.file)).records.outputs.length,2);await rejects(()=>call('export',[],{out:backup.file}),/EEXIST/);
 // Real DOCX text extraction, with split text runs around a merge token.
 const zip=new JSZip();zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello {{NA</w:t></w:r><w:r><w:t>ME}}</w:t></w:r></w:p></w:body></w:document>');
 const docx=write('template.docx',await zip.generateAsync({type:'nodebuffer'}));assert((await readTemplate(docx)).body.includes('{{NAME}}'));
 assert.deepEqual([...seen].sort(),Object.keys(usage).sort());
 await db.close();db=null;
 for(const script of ['view.mjs','docs.mjs']){
  const proc=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts',script)],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(proc.status,0,proc.stderr);
 }
 assert(fs.readFileSync(path.join(tmp,'views/week.html'),'utf8').includes('Document production week'));
 const docFiles=fs.readdirSync(path.join(tmp,'docs-out/job-packet'));assert(docFiles.length>=6);
 const bad=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts/documents.mjs'),'job','Imported Job'],{env:process.env,encoding:'utf8'});assert.equal(bad.status,1);assert(bad.stderr.includes('Ambiguous'));
 const cli=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts/documents.mjs'),'templates','--json'],{env:process.env,encoding:'utf8'});assert.equal(cli.status,0,cli.stderr);assert(Array.isArray(JSON.parse(cli.stdout)));
 console.log(`PASS: ${seen.size} CLI commands; merge nesting, missing fields, workbook and DOCX imports, ambiguity, review gates, immutable snapshots, privacy, exports and branded HTML`);
}finally{if(db)await db.close();fs.rmSync(tmp,{recursive:true,force:true});}
