import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseHTML} from 'linkedom';
const root=resolve('../deliverables/转正答辩-HyperFrames');
const backup=resolve('../deliverables/background-before-master');
const read=p=>readFileSync(resolve(root,p),'utf8');
const save=(p,s)=>{mkdirSync(resolve(backup,p,'..'),{recursive:true});copyFileSync(resolve(root,p),resolve(backup,p));writeFileSync(resolve(root,p),s);};
const master=parseHTML(read('index.html')).document;
if(master.querySelector('[data-background-frame]')) throw new Error('Already migrated');
const removed=new Set();
const records=[];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const strip=s=>s.replace(/(["'])(#[^"']+)\1/g,(all,q,selector)=>{
 const parts=selector.split(','); const kept=parts.filter(x=>!removed.has(x.trim().slice(1)));
 return kept.length===parts.length?all:q+(kept.join(',')||'#background-retired-target')+q;
});
for(let i=1;i<=17;i++){
 const n=String(i).padStart(2,'0'),p=`slides/slide-${n}.html`;
 const doc=parseHTML(read(p)).document;
 const scopes=[doc,...doc.querySelectorAll('template')];let title='';
 for(const scope of scopes)for(const e of [...scope.querySelectorAll('[id][style]')]){
  const s=e.style,x=parseFloat(s.left),y=parseFloat(s.top),text=e.textContent.trim();
  const header=e.classList.contains('clip')&&y<85&&x<650&&text&&text.length<80;
  const number=x>1100&&y>650&&/^\d{2}$/.test(text);
  if(header||number||e.id==='slide-10-process-line'){
   if(header&&!['BD.02','业务开发二部','/'].includes(text))title=text;
   removed.add(e.id);e.remove();
  }
 }
 const page=master.getElementById(`page-${n}`);
 const start=page.getAttribute('data-start'),duration=page.getAttribute('data-duration');
 title=title||'转正答辩';
 records.push({page:n,title,clipId:`page-${n}`,source:`backgrounds/frame-${n}.html`});
 const frame=`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="../assets/base.css"><title>背景变量 · ${n}</title></head><body style="background:transparent"><div id="background-frame-${n}" data-composition-id="background-frame-${n}" data-start="0" data-duration="136" data-width="1280" data-height="720" style="position:relative;width:1280px;height:720px;background:transparent;font-family:'Noto Sans CJK SC',sans-serif"><div id="background-title-${n}" data-label="变量 · 标题" style="position:absolute;left:170px;top:44px;color:#666;font-size:18px">${esc(title)}</div><div id="background-page-${n}" data-label="变量 · 页码" style="position:absolute;left:1180px;top:666px;width:36px;text-align:right;color:#707070;font-size:14px">${n}</div></div></body></html>`;
 writeFileSync(resolve(root,`backgrounds/frame-${n}.html`),frame);
 const host=master.createElement('div');for(const[k,v]of Object.entries({id:`background-frame-host-${n}`,class:'clip','data-background-frame':'true','data-linked-clip':`page-${n}`,'data-composition-id':`background-frame-${n}`,'data-composition-src':`backgrounds/frame-${n}.html`,'data-start':start,'data-duration':duration,'data-track-index':'4','data-width':'1280','data-height':'720','data-label':`背景变量 · ${n} · ${title}`,style:'position:absolute;inset:0;z-index:4;'}))host.setAttribute(k,v);
 master.getElementById('deck').append(host);save(p,strip(doc.toString()));
}
save('presentation-timing-links.json',strip(read('presentation-timing-links.json')));
const global=parseHTML(read('backgrounds/background-global.html')).document;
const parent=global.getElementById('background-global');
const box=(id,label,style,text='')=>`<div id="${id}" data-label="固定 · ${label}" style="position:absolute;${style}">${text}</div>`;
parent.insertAdjacentHTML('beforeend',
 box('bg-brand','品牌','left:64px;top:23px;font:700 28px Arial;color:#151515','BD.02')+
 box('bg-team','部门','left:64px;top:60px;font:12px sans-serif;color:#707070','业务开发二部')+
 box('bg-slash','分隔符','left:145px;top:40px;font:24px Arial;color:#aaa','/')+
 box('bg-right-bar','右上竖线','left:1212px;top:88px;width:4px;height:94px;background:#888')+
 box('bg-right-accent','右上色点','left:1212px;top:196px;width:5px;height:6px;background:#ffc64b')+
 box('bg-left-accent','左下强调条','left:18px;top:425px;width:6px;height:110px;background:#ffc64b')+
 [0,1,2].map(i=>box('bg-left-dot-'+i,'左下点','left:20px;top:'+(560+i*10)+'px;width:3px;height:3px;border-radius:50%;background:#777')).join('')+
 box('bg-left-line','左下竖线','left:20px;top:596px;width:2px;height:72px;background:#999')+
 box('bg-left-angle-1','左下斜线','left:20px;top:667px;width:36px;height:2px;background:#999;transform:rotate(48deg);transform-origin:left')+
 box('bg-left-angle-2','左下斜线','left:27px;top:667px;width:31px;height:2px;background:#999;transform:rotate(48deg);transform-origin:left')+
 box('bg-page-mark','页码下标','left:1180px;top:699px;width:36px;height:2px;background:linear-gradient(to right,#ffc64b 50%,#888 50%)'));
save('backgrounds/background-global.html',global.toString());
const old=parseHTML(read('backgrounds/background-08-10.html')).document;
old.getElementById('background-detail-3')?.remove();old.getElementById('background-detail-4')?.remove();save('backgrounds/background-08-10.html',old.toString());
master.getElementById('background-global-host').setAttribute('data-label','背景固定项 · 品牌与四角 UI');
save('index.html',master.toString());
writeFileSync(resolve(root,'background-master.json'),JSON.stringify({version:1,fixed:{file:'backgrounds/background-global.html',items:['brand','team','separator','top-right UI','bottom-left UI','page underline'],scope:'whole-deck'},variable:{fields:['title','page'],timing:'host data-linked-clip follows page clip',frames:records}},null,2));
console.log('Built fixed background and 17 linked variable frames; removed connector.');
