// Check embedded JavaScript too: HTML can contain syntax errors that
// `node --check public/*.js` cannot detect.
const fs=require('node:fs');
const vm=require('node:vm');
for(const path of ['public/index.html','public/multiplayer.html']){
 const html=fs.readFileSync(path,'utf8');
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
 let checked=0;
 for(let i=0;i<scripts.length;i++){
  const js=scripts[i][1].trim();
  if(!js)continue;
  try{new vm.Script(js,{filename:path+'#script-'+i})}
  catch(e){console.error('Invalid inline JavaScript in '+path+': '+e);process.exit(1)}
  checked++;
 }
 if(!checked)throw Error(path+' contains no inline scripts');
 console.log(path+': '+checked+' embedded JavaScript blocks parsed');
}
