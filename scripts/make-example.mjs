import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import {REPO_ROOT} from './lib/db.mjs';
const book=new ExcelJS.Workbook();
const master=book.addWorksheet('Master');master.addRow(['ACCOUNT_NAME','REFERENCE','CONTACT_NAME']);master.addRow(['Fictional Business Ltd','EXAMPLE-1','Alex Example']);
const services=book.addWorksheet('SERVICES');services.addRow(['DESCRIPTION','HOURS']);services.addRow(['Records review','3']);
const dir=path.join(REPO_ROOT,'imports');fs.mkdirSync(dir,{recursive:true,mode:0o700});
await book.xlsx.writeFile(path.join(dir,'example.xlsx'));console.log('Fictional workbook written to imports/example.xlsx');
