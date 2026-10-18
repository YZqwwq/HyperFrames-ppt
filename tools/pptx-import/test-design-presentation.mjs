import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const p=await b.newPage();await p.setViewport({width:1600,height:1000});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5194/#project/probation-review?v=1&t=61.5&tab=design&rc=0');
 await p.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent==='从这里放映');return b&&!b.disabled});
 await p.select('[aria-label=演示段]','slide-08-to-09');
 await p.evaluate(()=>[...document.querySelectorAll('button')].find(e=>e.textContent==='从这里放映').click());
 await p.waitForSelector('[data-presentation-mode]');
 const frame=p.frames().find(f=>f.url().includes('/preview?'));
 await p.keyboard.press('Space');await new Promise(r=>setTimeout(r,3700));
 let time=await frame.evaluate(()=>window.__player.getTime());assert.ok(Math.abs(time-64.65)<0.04,`first stop ${time}`);
 await p.screenshot({path:'tools/pptx-import/design-proof/presentation-page09.png'});
 await p.keyboard.press('Space');await new Promise(r=>setTimeout(r,3200));
 time=await frame.evaluate(()=>window.__player.getTime());assert.ok(Math.abs(time-72.65)<0.04,`second stop ${time}`);
 await p.screenshot({path:'tools/pptx-import/design-proof/presentation-page10.png'});
 await p.keyboard.press('Escape');assert.deepEqual(errors,[]);console.log('Two successive click transitions and stop points verified.');
}finally{await b.close()}
