import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseHTML } from 'linkedom';
const root = resolve('../deliverables/转正答辩-HyperFrames');
const backup = resolve('../deliverables/background-before-unification');
if (readFileSync(resolve(root,'index.html'),'utf8').includes('id="background-global-host"')) {
  throw new Error('Background migration already applied; refusing to overwrite the original backup.');
}
function save(path, text) {
  mkdirSync(resolve(backup, path, '..'), {recursive:true});
  copyFileSync(resolve(root,path),resolve(backup,path));
  writeFileSync(resolve(root,path),text);
}
for (const dir of ['slides','backgrounds']) for (const name of readdirSync(resolve(root,dir))) {
  if (!name.endsWith('.html')) continue;
  const path=dir+'/'+name, original=readFileSync(resolve(root,path),'utf8');
  const {document}=parseHTML(original);
  const roots=[document,...document.querySelectorAll('template')];
  for(const scope of roots) {
    const dots=[...scope.querySelectorAll('[data-label^="dot-matrix-"]')];
    const groups=new Set(dots.map(e=>e.parentElement).filter(e=>e?.getAttribute('style')?.includes('width:42px')));
    dots.forEach(e=>e.remove()); groups.forEach(e=>e.remove());
    scope.querySelectorAll('[data-label^="圆弧"]').forEach(e=>e.remove());
  }
  let next=document.toString();
  if(dir==='backgrounds') next=next.replace(/tl\.fromTo\("#slide-(?:08-shape-41|10-shape-76)"[^;]+;\s*/g,'');
  if(next!==original) save(path,next);
}
const dots=Array.from({length:16},(_,i)=>`<div id="background-dot-${i+1}" data-label="点 ${i+1}" style="position:absolute;left:${(i%4)*8}px;top:${Math.floor(i/4)*8}px;width:3px;height:3px;border-radius:50%;background:#777"></div>`).join('');
writeFileSync(resolve(root,'backgrounds/background-global.html'),`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>全篇背景 · 标准小点阵</title></head><body style="margin:0;background:transparent"><div id="background-global" data-composition-id="background-global" data-start="0" data-duration="136" data-width="1280" data-height="720" style="position:relative;width:1280px;height:720px;background:transparent"><div id="background-dot-matrix" class="clip" data-start="0" data-duration="136" data-track-index="0" data-label="标准点阵 · 4×4" style="position:absolute;left:1189px;top:37px;width:27px;height:27px">${dots}</div></div></body></html>`);
const path='index.html',original=readFileSync(resolve(root,path),'utf8');
const {document}=parseHTML(original);
const host=document.createElement('div');
for(const [k,v]of Object.entries({id:'background-global-host',class:'clip','data-composition-id':'background-global','data-composition-src':'backgrounds/background-global.html','data-start':'0','data-duration':'136','data-track-index':'3','data-width':'1280','data-height':'720','data-label':'背景元素 · 全篇标准点阵',style:'position:absolute;inset:0;z-index:3;pointer-events:none;'}))host.setAttribute(k,v);
document.getElementById('deck').append(host); save(path,document.toString());
console.log('Removed arcs and per-slide dots; one shared 27px matrix now spans the entire deck.');
