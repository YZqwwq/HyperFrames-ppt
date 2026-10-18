import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
const dir='F:/code/project/future-ppt/deliverables/转正答辩-HyperFrames';
const out='tools/pptx-import/design-proof';await fs.mkdir(out,{recursive:true});
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const p=await b.newPage();await p.setViewport({width:1280,height:720});
 for(const n of [8,9,10]){
  const id=`slide-${String(n).padStart(2,'0')}`;
  await p.goto(`file:///${dir}/slides/${id}.html`);await p.evaluate(()=>document.fonts.ready);
  const times=n===8?[0,6.5,7.99,0]:n===9?[0,2,6.7,7.5,7.99,0]:[0,1,0];
  for(let i=0;i<times.length;i++){
   const t=times[i];await p.evaluate(({id,t})=>{window.__timelines[id].seek(t,false);},{id,t});
   await p.screenshot({path:`${out}/${id}-${i}-${t}.png`});
  }
 }
}finally{await b.close()}
