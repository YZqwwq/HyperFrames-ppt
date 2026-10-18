from pathlib import Path
from lxml import html
import shutil
p=Path(r'F:\code\project\future-ppt\deliverables\转正答辩-HyperFrames');backup=Path('tools/pptx-import/layers-before');backup.mkdir(exist_ok=True)
for name in ['index.html','slides/slide-08.html','slides/slide-09.html','slides/slide-10.html']:
 dest=backup/Path(name).name
 if not dest.exists():shutil.copy2(p/name,dest)
(p/'backgrounds').mkdir(exist_ok=True)
doc=html.fromstring('<html lang="zh-CN"><head><meta charset="utf-8"><title>背景元素 · 08–10</title><link rel="stylesheet" href="../assets/base.css"><script src="../assets/gsap.min.js"></script></head><body></body></html>')
r=html.Element('div',id='background-08-10',attrib={'data-composition-id':'background-08-10','data-start':'0','data-duration':'24','data-width':'1280','data-height':'720','style':'position:relative;width:100%;height:100%;overflow:hidden;'})
doc.find('body').append(r)
base=html.Element('div',id='background-base',attrib={'class':'clip','data-label':'背景底色 · 暖白','data-start':'0','data-duration':'24','data-track-index':'0','style':'position:absolute;inset:0;background:#f5f3ed;'});r.append(base)
names=['网格','圆弧 · 外圈','圆弧 · 内圈','装饰线 · 章节强调','装饰线 · 页脚']
for n in (8,9,10):
 f=p/f'slides/slide-{n:02}.html';d=html.fromstring(f.read_text(encoding='utf8'));root=d.get_element_by_id(f'slide-{n:02}');bg=d.get_element_by_id(f'slide-{n:02}-design-background')
 if n==8:
  for i,e in enumerate(list(bg)):
   e.set('id',f'background-detail-{i}');e.set('class','clip');e.set('data-label',names[i]);e.set('data-start','0');e.set('data-duration','24');e.set('data-track-index',str(i+1));r.append(e)
 root.remove(bg);root.set('style',root.get('style').replace('background:#f5f3ed','background:transparent'))
 # Standalone editing retains a neutral canvas; shared decoration lives in the background composition.
 d.find('body').set('style','background:#f5f3ed;')
 if n in (8,10):
  id=f'slide-{n:02}-shape-'+('41' if n==8 else '76');dots=d.get_element_by_id(id);root.remove(dots)
  dots.set('data-label',f'装饰点阵 · {n:02}页');dots.set('data-start','0' if n==8 else '16');dots.set('data-duration','8');dots.set('data-track-index','6');r.append(dots)
  for s in d.xpath('//script[not(@src)]'):
   s.text=s.text.replace('#'+id+',','').replace(',#'+id,'')
 f.write_text('<!DOCTYPE html>\n'+html.tostring(d,encoding='unicode'),encoding='utf8')
s=html.Element('script');s.text='''(()=>{const tl=gsap.timeline({paused:true});
tl.fromTo("#slide-08-shape-41",{opacity:1},{opacity:0,duration:0.4,ease:"power1.inOut"},5.5);
tl.fromTo("#slide-10-shape-76",{opacity:0},{opacity:1,duration:0.6,ease:"power1.inOut"},16);
window.__timelines=window.__timelines||{};window.__timelines["background-08-10"]=tl;})();''';doc.find('body').append(s)
(p/'backgrounds/background-08-10.html').write_text('<!DOCTYPE html>\n'+html.tostring(doc,encoding='unicode'),encoding='utf8')
f=p/'index.html';d=html.fromstring(f.read_text(encoding='utf8'));root=d.get_element_by_id('deck')
for e in root:
 e.set('data-track-index','1');e.set('style',e.get('style','')+';z-index:1;')
 if e.get('id')=='page-01':e.set('data-label','页元素 · 01 · 转正答辩')
host=html.Element('div',id='background-08-10-host',attrib={'class':'clip','data-composition-id':'background-08-10','data-composition-src':'backgrounds/background-08-10.html','data-label':'背景元素 · 08–10','data-start':'56','data-duration':'24','data-track-index':'0','data-width':'1280','data-height':'720','style':'position:absolute;inset:0;z-index:0;'})
root.insert(0,host);f.write_text('<!DOCTYPE html>\n'+html.tostring(d,encoding='unicode'),encoding='utf8')
print('Separated background track and individually editable decorative elements.')
