import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import {createHash} from 'node:crypto';
import {validateData,parseTemplate} from './merge.mjs';
export const hash=v=>createHash('sha256').update(v).digest('hex');
export function readLimited(file,max=20000000){const stat=fs.statSync(file);if(!stat.isFile()||stat.size>max)throw Error('Input must be a file under the size limit');return fs.readFileSync(file);}
export async function readTemplate(file){
 const bytes=readLimited(file,5000000);let body;
 if(path.extname(file).toLowerCase()==='.docx'){
  const result=await mammoth.extractRawText({buffer:bytes});body=result.value;
 }else if(path.extname(file).toLowerCase()==='.txt')body=bytes.toString('utf8');
 else throw Error('Template must be .txt or .docx with literal merge tokens');
 parseTemplate(body);return {body,source_format:path.extname(file).slice(1),source_hash:hash(bytes)};
}
export async function readWorkbook(file,master){
 if(path.extname(file).toLowerCase()!=='.xlsx')throw Error('Export View Data Workbook as .xlsx; convert legacy .xls locally first');
 const bytes=readLimited(file);const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
 const data={};let found=false;
 for(const sheet of book.worksheets){
  if(sheet.rowCount>10001||sheet.columnCount>250)throw Error('Workbook exceeds row or column limit');
  if(!sheet.rowCount)continue;
  const cellValue=cell=>{const v=cell.value;if(v===null||v===undefined)return '';
   if(v instanceof Date)return v.toISOString().slice(0,10);
   if(typeof v==='object'){if(v.formula||v.sharedFormula)throw Error('Formula cells are not supported; export values only');if(v.richText)return v.richText.map(t=>t.text).join('');if(v.hyperlink)return v.text||'';throw Error('Unsupported workbook cell');}
   return v;};
  const headers=[];for(let c=1;c<=sheet.columnCount;c++)headers.push(String(cellValue(sheet.getRow(1).getCell(c))).trim());
  while(headers.length&&!headers.at(-1))headers.pop();
  if(!headers.length)continue;
  if(headers.some(h=>!h)||new Set(headers.map(h=>h.toLowerCase())).size!==headers.length)throw Error(`Worksheet ${sheet.name} requires unique nonempty headers`);
  const rows=[];
  for(let n=2;n<=sheet.rowCount;n++){
   const values=headers.map((_,i)=>cellValue(sheet.getRow(n).getCell(i+1)));
   if(values.every(v=>v===''))continue;
   for(let c=headers.length+1;c<=sheet.columnCount;c++)if(cellValue(sheet.getRow(n).getCell(c))!=='')throw Error('Data beyond named columns');
   rows.push(Object.fromEntries(headers.map((h,i)=>[h,values[i]])));
  }
  if(sheet.name===master){if(rows.length!==1)throw Error('Master worksheet must contain exactly one record');Object.assign(data,rows[0]);found=true;}
  else {if(Object.hasOwn(data,sheet.name))throw Error('Dataset name conflicts with master field');data[sheet.name]=rows;}
 }
 if(!found)throw Error(`No master worksheet ${master}; available: ${book.worksheets.map(s=>s.name).join(', ')}`);
 // A master worksheet loaded after a detail sheet must not overwrite its name.
 const masterHeaders=book.getWorksheet(master).getRow(1).values.filter(v=>v!==null&&v!==undefined).map(String);
 if(book.worksheets.some(s=>s.name!==master&&masterHeaders.some(h=>h.toLowerCase()===s.name.toLowerCase())))throw Error('Dataset name conflicts with master field');
 return {data:validateData(data),digest:hash(bytes),sheets:book.worksheets.map(s=>s.name)};
}
