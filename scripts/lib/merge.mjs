// A deliberately small, non-executable merge language. Literal tokens and nested repeats only.
const valid=/^[A-Za-z_][A-Za-z0-9_. ]*$/;
export function parseTemplate(body){
 if(typeof body!=='string'||!body.trim()||body.length>1000000)throw Error('Template must contain 1 to 1000000 characters');
 const root=[],stack=[{name:null,nodes:root}];let pos=0;
 for(const m of body.matchAll(/\{\{([\s\S]*?)\}\}/g)){
  const before=body.slice(pos,m.index);if(/[{}]/.test(before))throw Error('Unmatched template braces');
  if(before)stack.at(-1).nodes.push({text:before});const token=m[1].trim();
  if(token.startsWith('TableStart:')){
   const name=token.slice(11).trim();if(!valid.test(name)||stack.length>5)throw Error('Invalid dataset or repeat nesting too deep');
   const node={repeat:name,nodes:[]};stack.at(-1).nodes.push(node);stack.push({name,nodes:node.nodes});
  }else if(token.startsWith('TableEnd:')){
   if(stack.length===1||stack.at(-1).name!==token.slice(9).trim())throw Error('Mismatched TableStart/TableEnd');stack.pop();
  }else{if(!valid.test(token))throw Error(`Unsupported merge token: ${token}`);stack.at(-1).nodes.push({field:token});}
  pos=m.index+m[0].length;
 }
 const tail=body.slice(pos);if(/[{}]/.test(tail)||stack.length!==1)throw Error('Unclosed template token or repeat');if(tail)root.push({text:tail});
 if(/[«»]/.test(body))throw Error('Traditional Word fields must be converted to literal {{FIELD}} tokens');
 return root;
}
function value(obj,key){const keys=Object.keys(obj||{}).filter(k=>k.toLowerCase()===key.toLowerCase());if(keys.length>1)throw Error(`Ambiguous field ${key}`);return keys.length?obj[keys[0]]:undefined;}
export function merge(body,data){
 const tree=parseTemplate(body);const missing=new Set();let size=0;
 function walk(nodes,contexts,where){let out='';for(const n of nodes){
  if(n.text!==undefined){out+=n.text;continue;}
  const key=n.field||n.repeat;let v;
  for(const c of contexts){v=value(c,key);if(v!==undefined)break;}
  if(n.repeat){
   if(!Array.isArray(v)){missing.add(`${where}${key} (dataset)`);continue;}
   if(v.length>10000)throw Error('Dataset exceeds 10000 rows');
   v.forEach((row,i)=>{if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Dataset rows must be objects');out+=walk(n.nodes,[row,...contexts],`${where}${key}[${i}].`);});
  }else if(v===undefined||v===null||v==='')missing.add(`${where}${key}`);
  else if(typeof v==='object')throw Error(`Field ${key} must be scalar`);else out+=String(v);
  if(out.length>5000000)throw Error('Merged document exceeds size limit');
 }size+=out.length;if(size>10000000)throw Error('Merge exceeds size limit');return out;}
 const text=walk(tree,[data],'');return {text,missing:[...missing]};
}
export function validateData(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Data must be an object');
 const visit=(o,depth=0)=>{if(depth>8)throw Error('Data nesting exceeds limit');if(!o||typeof o!=='object')return;
 const keys=Object.keys(o);if(new Set(keys.map(k=>k.toLowerCase())).size!==keys.length)throw Error('Ambiguous case-insensitive data keys');
 for(const k of keys){if(['__proto__','constructor','prototype'].includes(k.toLowerCase()))throw Error('Reserved field name');visit(o[k],depth+1);}};visit(data);return data;
}
