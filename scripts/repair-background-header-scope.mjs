import {readFileSync,writeFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
const root='../deliverables/转正答辩-HyperFrames/';
const meta=JSON.parse(readFileSync(root+'background-master.json','utf8'));
const master=parseHTML(readFileSync(root+'index.html','utf8')).document;
for(let i=1;i<=17;i++){
 const n=String(i).padStart(2,'0'),p='slides/slide-'+n+'.html';
 const before=parseHTML(readFileSync('../deliverables/background-before-master/'+p,'utf8')).document;
 const after=parseHTML(readFileSync(root+p,'utf8')).document;
 for(const el of before.querySelectorAll('[id][style]')){
  if(el.classList.contains('clip') || after.getElementById(el.id))continue;
  if(parseFloat(el.style.top)<85&&parseFloat(el.style.left)<650&&el.textContent.trim()){
   const parent=after.getElementById(el.parentElement.id);
   if(parent){ const next=el.nextElementSibling&&after.getElementById(el.nextElementSibling.id);parent.insertBefore(el.cloneNode(true),next?.parentElement===parent?next:null); }
  }
 }
 writeFileSync(root+p,after.toString());
 let title=[...before.querySelectorAll('.clip[id][style]')].filter(e=>parseFloat(e.style.top)<85&&parseFloat(e.style.left)<650).map(e=>e.textContent.trim()).filter(t=>!['BD.02','业务开发二部','/'].includes(t)).pop()||'转正答辩';
 const frame=parseHTML(readFileSync(root+'backgrounds/frame-'+n+'.html','utf8')).document;
 frame.getElementById('background-title-'+n).textContent=title;
 writeFileSync(root+'backgrounds/frame-'+n+'.html',frame.toString());
 meta.variable.frames[i-1].title=title;
 master.getElementById('background-frame-host-'+n).setAttribute('data-label','背景变量 · '+n+' · '+title);
}
writeFileSync(root+'index.html',master.toString());writeFileSync(root+'background-master.json',JSON.stringify(meta,null,2));
