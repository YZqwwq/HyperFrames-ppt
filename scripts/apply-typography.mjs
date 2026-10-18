import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';import{parseHTML}from'linkedom';
const root='../deliverables/转正答辩-HyperFrames/',backup='../deliverables/typography-before/';
const tokens={cover:[80,600,1.15],section:[80,600,1.15],title:[56,600,1.2],lead:[28,400,1.4],heading:[28,600,1.3],body:[24,400,1.5],compact:[22,400,1.45],caption:[18,400,1.4],label:[18,500,1.3],page:[14,400,1.2],metric:[96,400,1], 'metric-large':[144,400,1],'metric-hero':[192,400,1],sequence:[24,400,1.2]};
let css='/* 中文演示文字角色，1280×720 */\n:root{\n';for(const[r,[s,w,h]]of Object.entries(tokens))css+=`--type-${r}-size:${s}px;--type-${r}-weight:${w};--type-${r}-line:${h};\n`;css+='}\n[data-text-role]{font-family:"Noto Sans CJK SC",sans-serif;letter-spacing:0;}\n';
writeFileSync(root+'assets/typography.css',css);
const files=Array.from({length:17},(_,i)=>'slides/slide-'+String(i+1).padStart(2,'0')+'.html');
for(const file of files){mkdirSync(backup+'slides',{recursive:true});if(!existsSync(backup+file))copyFileSync(root+file,backup+file);const d=parseHTML(readFileSync(root+file,'utf8')).document;let n=+file.match(/(\d+)\.html/)[1];
if(!d.querySelector('link[href*="typography.css"]'))d.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="../assets/typography.css">');
for(const e of d.querySelectorAll('[style]')){
if(!e.style.fontSize||!e.textContent.trim()||e.querySelector('[style*="font-size"]'))continue;
const size=parseFloat(e.style.fontSize),weight=+e.style.fontWeight||400,text=e.textContent.trim(),box=e.closest('[id]'),id=box?.id||'',top=parseFloat(box?.style.top),table=/-r\dc\d/.test(id);
let role='body';
if(size>=190)role='metric-hero';else if(size>=100)role='metric-large';else if(size>=80)role='section';else if(size>=50){role=/^[\d,.]+$/.test(text)?'metric':n===1?'cover':'title';}
else if(table)role=/-r1c/.test(id)?'heading':'compact';
else if(/^\d{2}$/.test(text))role='sequence';
else if(weight>=600)role='heading';
else if(top>620||size<=17||id.endsWith('case-label'))role='caption';
else if(top<270&&size>=23)role='lead';
else if([4,5,8,10,11,13,15].includes(n))role='compact';
else if(size>=30)role='lead';
if(n===9&&/shape-(8|12)$/.test(id))role='heading';
if(n===14&&/shape-(5|7|8)$/.test(id))role='heading';
e.setAttribute('data-text-role',role);e.style.fontFamily='"Noto Sans CJK SC",sans-serif';e.style.fontSize=`var(--type-${role}-size)`;e.style.fontWeight=`var(--type-${role}-weight)`;e.style.lineHeight=`var(--type-${role}-line)`;e.style.letterSpacing='0';
if(e.style.color==='#9c9c9c'||e.style.color==='#777777')e.style.color='#707070';
}
// Expand short text containers vertically; keep content separate from animation transforms.
for(const box of d.querySelectorAll('[id][style]')){const ps=[...box.children].filter(e=>e.tagName==='P'&&e.hasAttribute('data-text-role'));if(!ps.length)continue;const width=parseFloat(box.style.width)-20;let need=10;for(const p of ps){const[s,,h]=tokens[p.getAttribute('data-text-role')];const lines=p.textContent.split(/\r?\n/).reduce((sum,t)=>sum+Math.max(1,Math.ceil([...t].reduce((v,c)=>v+(/[\u0000-\u007f]/.test(c)?0.52:1),0)*s/width)),0);need+=lines*s*h;}if(need>parseFloat(box.style.height))box.style.height=Math.ceil(need)+'px';}
writeFileSync(root+file,d.toString());}
