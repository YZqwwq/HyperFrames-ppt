import {readFileSync,writeFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
const root='../deliverables/转正答辩-HyperFrames/';
const p=root+'backgrounds/background-global.html';
const d=parseHTML(readFileSync(p,'utf8')).document;
d.getElementById('bg-left-accent')?.remove();
for(const [id,x] of [['bg-brand',24],['bg-team',24],['bg-slash',121]])d.getElementById(id).style.left=x+'px';
writeFileSync(p,d.toString());
for(let i=1;i<=17;i++){const n=String(i).padStart(2,'0'),p=root+'backgrounds/frame-'+n+'.html';const d=parseHTML(readFileSync(p,'utf8')).document;d.getElementById('background-title-'+n).style.left='155px';writeFileSync(p,d.toString());}
