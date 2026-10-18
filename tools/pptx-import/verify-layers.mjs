import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
const p=await b.newPage();await p.setViewport({width:1600,height:1000});await p.goto('http://127.0.0.1:5194/#project/probation-review?v=1&t=58&tab=design&rc=0');
await p.waitForFunction(()=>[...document.querySelectorAll('[data-clip]')].some(e=>e.textContent.includes('背景元素')));
console.log('MASTER',await p.$$eval('[data-clip]',es=>es.map(e=>e.textContent)));
await new Promise(r=>setTimeout(r,1500));
const frame=p.frames().find(f=>f.url().includes('/preview?'));await (await frame.$('#deck')).screenshot({path:'tools/pptx-import/layer-master.png'});
const clips=await p.$$('[data-clip]');for(const c of clips){if((await c.evaluate(e=>e.textContent)).includes('背景元素')){await c.click({count:2,delay:70});break;}}
await p.waitForFunction(()=>[...document.querySelectorAll('[data-clip]')].some(e=>e.textContent.includes('圆弧')));
console.log('BACKGROUND',await p.$$eval('[data-clip]',es=>es.map(e=>e.textContent)));
await p.screenshot({path:'tools/pptx-import/layer-editor.png'});
}finally{await b.close()}
