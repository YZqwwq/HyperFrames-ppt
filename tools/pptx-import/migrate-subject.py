from pathlib import Path
from lxml import html, etree
import shutil,re,json
p=Path('../deliverables/转正答辩-HyperFrames'); backup=Path('tools/pptx-import/subject-before');backup.mkdir(exist_ok=True)
for name in ['index.html','presentation-cues.json','slides/slide-08.html','slides/slide-09.html','slides/slide-10.html']:
 dest=backup/name;dest.parent.mkdir(parents=True,exist_ok=True)
 if not dest.exists():shutil.copy2(p/name,dest)
# Keep the user's small-circle dimensions and authored start state.
docs={n:html.fromstring((p/f'slides/slide-{n:02}.html').read_text(encoding='utf8')) for n in (8,9,10)}
visual=docs[8].get_element_by_id('slide-08-case-visual');style=visual.get('style');size=float(re.search(r'(?<![-\w])width:\s*([\d.]+)px',style)[1]);script=docs[8].xpath('//script[not(@src)]')[0].text
start=re.search(r'"0%":\s*\{ x: ([\d.-]+), y: ([\d.-]+)',script);sx,sy=map(float,start.groups())
motion=re.search(r'duration:\s*([\d.]+)\s*\},([\d.]+)\)',script);duration,at=map(float,motion.groups())
baseX,baseY=1088+size/2,114+size/2
bigX,bigY=939.5-baseX,343.589-baseY
smallX,smallY=535.5-baseX,293.5-baseY
visual.getparent().remove(visual)
visual.set('style',f'position:absolute;left:1088px;top:114px;width:{size}px;height:{size}px;border-radius:50%;background:#151515;transform-origin:50% 50%;')
# Build a persistent shared subject with plain, editable GSAP calls.
root=html.Element('div',id='case-circle-08-10',attrib={'data-composition-id':'case-circle-08-10','data-start':'0','data-duration':'24','data-width':'1280','data-height':'720','style':'position:relative;width:100%;height:100%;overflow:hidden;'})
wrap=etree.SubElement(root,'div',id='case-circle-primary',attrib={'class':'clip','data-label':'主体圆 · 聚焦、收缩、分裂','data-start':'0','data-duration':'24','data-track-index':'0','style':'position:absolute;inset:0;'});wrap.append(visual)
calls=[f'tl.fromTo("#slide-08-case-visual",{{x:{sx},y:{sy},scale:1}},{{x:{bigX},y:{bigY},scale:{604/size},duration:{duration},ease:"power2.inOut"}},{at});',f'tl.fromTo("#slide-08-case-visual",{{x:{bigX},y:{bigY},scale:{604/size}}},{{x:{smallX},y:{smallY},scale:{64/size},duration:0.7,ease:"power2.inOut",immediateRender:false}},14.35);',f'tl.fromTo("#slide-08-case-visual",{{x:{smallX},y:{smallY}}},{{x:{96-baseX},y:{smallY},duration:0.9,ease:"power2.inOut",immediateRender:false}},15.05);']
for i,x in enumerate([389,682,975],2):
 w=etree.SubElement(root,'div',id=f'case-circle-branch-{i}',attrib={'class':'clip','data-label':f'分裂子圆 · {i}','data-start':'15.05','data-duration':'8.95','data-track-index':str(i-1),'style':'position:absolute;left:503.5px;top:261.5px;width:64px;height:64px;'})
 etree.SubElement(w,'div',id=f'case-circle-branch-visual-{i}',attrib={'style':'position:absolute;inset:0;border-radius:50%;background:#151515;'})
 calls.append(f'tl.fromTo("#case-circle-branch-visual-{i}",{{x:0}},{{x:{x-535.5},duration:0.9,ease:"power2.inOut"}},15.05);')
scriptNew='const tl=gsap.timeline({paused:true});\n'+'\n'.join(calls)+'\nwindow.__timelines["case-circle-08-10"]=tl;'
(p/'subjects').mkdir(exist_ok=True)
(p/'subjects/case-circle-08-10.html').write_text('<!DOCTYPE html><html><head><meta charset="utf-8"><title>案例圆：聚焦与分裂</title></head><body><template>'+html.tostring(root,encoding='unicode')+'<script>'+scriptNew+'</script></template></body></html>',encoding='utf8')
# Remove obsolete per-page shapes, keeping text and unrelated animation intact.
for n,d in docs.items():
 ids={8:['slide-08-case-node'],9:['slide-09-shape-3'],10:[f'slide-10-shape-{i}' for i in [26,31,36,41]]}[n]
 if n==9:
  ids += [e.getparent().get('id') for e in d.xpath('//*[starts-with(@id,"slide-09-split-visual-")]')]
 for id in ids:
  e=d.get_element_by_id(id);e.getparent().remove(e)
 s=d.xpath('//script[not(@src)]')[0]
 if n==8:
  s.text=re.sub(r'tl\.(?:set|to|fromTo)\("#slide-08-case-visual",[\s\S]*?\);','',s.text)
  s.text=s.text.replace('},5.5);',f'}},{at});')
 if n==9:
  s.text=re.sub(r'tl\.fromTo\("#slide-09-circle-visual",[\s\S]*?\);','',s.text)
  s.text=re.sub(r'\[-146.5,146.5,439.5\]\.forEach\([\s\S]*?\}\);','',s.text)
 (p/f'slides/slide-{n:02}.html').write_text('<!DOCTYPE html>\n'+html.tostring(d,encoding='unicode'),encoding='utf8')
d=html.fromstring((p/'index.html').read_text(encoding='utf8'));deck=d.get_element_by_id('deck')
for e in deck:
 if e.get('id','').startswith('page-'):e.set('data-track-index','2');e.set('style',e.get('style','')+';z-index:2;')
host=html.Element('div',id='case-circle-08-10',attrib={'class':'clip','data-composition-id':'case-circle-08-10','data-composition-src':'subjects/case-circle-08-10.html','data-label':'跨帧主体 · 案例圆：聚焦与分裂','data-start':'56','data-duration':'24','data-track-index':'1','data-width':'1280','data-height':'720','style':'position:absolute;inset:0;z-index:1;'})
deck.insert(1,host);(p/'index.html').write_text('<!DOCTYPE html>\n'+html.tostring(d,encoding='unicode'),encoding='utf8')
cues=json.loads((p/'presentation-cues.json').read_text(encoding='utf8'));cues['segments'][0]['start']['offset']=at;(p/'presentation-cues.json').write_text(json.dumps(cues,ensure_ascii=False,indent=2),encoding='utf8')
print('Migrated persistent subject; start',sx,sy,'size',size,'motion',at,duration)

