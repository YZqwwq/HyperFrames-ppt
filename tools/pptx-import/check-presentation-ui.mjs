import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const p=await b.newPage();await p.setViewport({width:1600,height:1000});p.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await p.goto('http://127.0.0.1:5194/#project/probation-review?v=1&t=68.5&tab=design&rc=0');
 await new Promise(r=>setTimeout(r,5000));
 console.log('BODY',await p.evaluate(()=>document.body.innerText.slice(-3000)));
 console.log('FRAMES',p.frames().map(f=>f.url()));
 await p.screenshot({path:'tools/pptx-import/presentation-before.png'});
}finally{await b.close()}
