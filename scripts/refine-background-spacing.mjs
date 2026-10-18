import {readFileSync,writeFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
const root='../deliverables/转正答辩-HyperFrames/';
const path=root+'backgrounds/background-global.html';
const d=parseHTML(readFileSync(path,'utf8')).document;
for(const [id,x] of [['background-dot-matrix',1221],['bg-right-bar',1244],['bg-right-accent',1244],['bg-page-mark',1212],['bg-slash',161]]) d.getElementById(id).style.left=x+'px';
const line=d.getElementById('bg-left-line');
line.setAttribute('data-label','固定 · 左下连续折线');
line.setAttribute('style','position:absolute;left:19px;top:596px;width:31px;height:100px');
line.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="31" height="100" viewBox="0 0 31 100" aria-hidden="true"><path d="M 2 1 L 2 72 L 27 97" fill="none" stroke="#999" stroke-width="2" stroke-linejoin="miter" /></svg>';
d.getElementById('bg-left-angle-1')?.remove();d.getElementById('bg-left-angle-2')?.remove();
writeFileSync(path,d.toString());
for(let i=1;i<=17;i++){const n=String(i).padStart(2,'0'),p=root+'backgrounds/frame-'+n+'.html';const f=parseHTML(readFileSync(p,'utf8')).document;f.getElementById('background-title-'+n).style.left='195px';f.getElementById('background-page-'+n).style.left='1212px';writeFileSync(p,f.toString());}
