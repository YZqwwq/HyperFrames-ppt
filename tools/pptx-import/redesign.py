from pathlib import Path
from lxml import html
import json,shutil
p=Path(r'F:\code\project\future-ppt\deliverables\转正答辩-HyperFrames')
b=Path('tools/pptx-import/design-before');b.mkdir(exist_ok=True)
for name in ['slides/slide-08.html','slides/slide-09.html','slides/slide-10.html','presentation-cues.json']:
 f=b/Path(name).name
 if not f.exists():shutil.copy2(p/name,f)
def style(e,**kw):
 d=dict(x.split(':',1) for x in e.get('style','').split(';') if ':' in x);d.update({k.replace('_','-'):str(v) for k,v in kw.items()});e.set('style',';'.join(k+':'+v for k,v in d.items())+';')
def add(root,id,css,text=None,track=80):
 e=html.Element('div',id=id,attrib={'class':'clip','data-start':'0','data-duration':'8','data-track-index':str(track),'data-label':text or id,'style':'position:absolute;'+css})
 if text:
  q=html.Element('p',style='margin:0;font-family:"Noto Sans CJK SC",sans-serif;font-size:16px;line-height:24px;color:#55534d;');q.text=text;e.append(q)
 root.append(e);return e
def font(e,size=None,color=None,line=None):
 for q in e.xpath('.//p'):
  kwargs={}
  if size:kwargs['font_size']=f'{size}px'
  if line:kwargs['line_height']=f'{line}px'
  if color:kwargs['color']=color
  style(q,**kwargs)
def script(d,code):
 for e in d.xpath('//script'):e.getparent().remove(e)
 d.find('head').append(html.Element('script',src='../assets/gsap.min.js'))
 e=html.Element('script');e.text='\n(()=>{const tl=gsap.timeline({paused:true});\n'+code+'\nwindow.__timelines=window.__timelines||{};window.__timelines["'+d.xpath('//*[@data-composition-id]')[0].get('data-composition-id')+'"]=tl;})();\n';d.find('body').append(e)
for n in (8,9,10):
 f=p/f'slides/slide-{n:02}.html';d=html.fromstring(f.read_text(encoding='utf8'));root=d.get_element_by_id(f'slide-{n:02}');root.attrib.pop('data-no-timeline',None)
 style(root,background='#f5f3ed')
 bg=add(root,f'slide-{n:02}-design-background','inset:0;overflow:hidden;pointer-events:none;',track=80);root.remove(bg);root.insert(0,bg)

 bg.append(html.Element('div',style='position:absolute;left:0;right:0;top:258px;bottom:0;opacity:0.45;background-image:linear-gradient(#dedbd1 1px,transparent 1px),linear-gradient(90deg,#dedbd1 1px,transparent 1px);background-size:48px 48px;'))
 bg.append(html.Element('div',style='position:absolute;left:1030px;top:-240px;width:680px;height:680px;border:1px solid #d8d3c7;border-radius:50%;'))
 bg.append(html.Element('div',style='position:absolute;left:1060px;top:-210px;width:620px;height:620px;border:1px solid #e1ddd3;border-radius:50%;'))
 bg.append(html.Element('div',style='position:absolute;left:32px;top:104px;width:4px;height:58px;background:#e3ad21;'))
 bg.append(html.Element('div',style='position:absolute;left:64px;top:696px;width:1152px;height:1px;background:#d8d3c7;'))
 for e in root:
  if e is not bg and e.get('id'):
   font(e,color=None)
   for q in e.xpath('.//p'):
    st=q.get('style','');q.set('style',st.replace('color:#9c9c9c','color:#6e6b64').replace('color:#777777','color:#6e6b64'))
 def shape(k):return d.get_element_by_id(f'slide-{n:02}-shape-{k}')
 if n==8:
  cards=add(root,'slide-08-tool-panels','inset:0;pointer-events:none;',track=81);root.remove(cards);root.insert(1,cards)
  for x in (48,346,644,942):cards.append(html.Element('div',style=f'position:absolute;left:{x}px;top:278px;width:282px;height:326px;background:#fcfbf7;border:1px solid #dedbd1;border-radius:12px;'))
  for i in range(4):
   font(shape(5+4*i),18,'#8d6a13',24)
   style(shape(6+4*i),top='345px',width='250px',height='84px');font(shape(6+4*i),24,'#20201d',34)
   style(shape(7+4*i),top='440px',background='#d1cbbf')
   style(shape(8+4*i),top='460px',width='246px',height='136px');font(shape(8+4*i),18,'#55534d',27)
  style(shape(45),top='440px');style(shape(46),top='632px',height='48px');font(shape(46),16,'#625e55',24)
  route=add(root,'slide-08-case-route','left:840px;top:145px;width:248px;height:1px;background:#c7bfad;',track=82)
  node=add(root,'slide-08-case-node','left:1088px;top:114px;width:64px;height:64px;',track=83)
  node.append(html.Element('div',id='slide-08-case-visual',attrib={'data-layout-allow-overflow':'','style':'position:absolute;inset:0;border-radius:50%;background:#151515;transform-origin:50% 50%;'}))
  add(root,'slide-08-case-label','left:850px;top:200px;width:340px;height:28px;text-align:right;','进入案例 / 行业主题评分',84)
  ids=','.join('#'+e.get('id') for e in root if e not in (bg,node))
  script(d,f'''tl.addLabel("聚焦项目",5.5);
tl.fromTo({json.dumps(ids)},{{opacity:1}},{{opacity:0,duration:0.4,ease:"power1.inOut"}},5.5);
tl.fromTo("#slide-08-case-visual",{{x:0,y:0,scale:1}},{{x:-180.5,y:197.589,scale:604/64,duration:1.4,ease:"power2.inOut"}},5.9);''')
 elif n==9:
  panel=add(root,'slide-09-comparison-panel','left:44px;top:342px;width:556px;height:276px;background:#fcfbf7;border:1px solid #dedbd1;border-radius:12px;',track=81);root.remove(panel);root.insert(1,panel)
  # Existing text remains editable; the comparison card makes the baseline distinct.
  font(shape(7),25,'#55534d',34);font(shape(9),20,'#55534d',27)
  circle=d.get_element_by_id('slide-09-shape-3')
  others=[e for e in root if e not in (bg,circle) and not e.get('id','').startswith('slide-09-split-')]
  ids=','.join('#'+e.get('id') for e in others)
  script(d,f'''tl.addLabel("案例信息出现",0);
tl.fromTo({json.dumps(ids)},{{opacity:0}},{{opacity:1,duration:0.6,ease:"power1.inOut"}},0);
tl.addLabel("展开四个环节",6);
tl.fromTo({json.dumps(ids)},{{opacity:1}},{{opacity:0,duration:0.35,ease:"power1.inOut",immediateRender:false}},6);
tl.fromTo("#slide-09-circle-visual",{{x:0,y:0,scale:1}},{{x:-404,y:-50.089,scale:64/604,duration:0.7,ease:"power2.inOut"}},6.35);
tl.fromTo("#slide-09-circle-visual",{{x:-404,y:-50.089,scale:64/604}},{{x:-843.5,y:-50.089,scale:64/604,duration:0.9,ease:"power2.inOut",immediateRender:false}},7.05);
[-146.5,146.5,439.5].forEach((x,i)=>{{const id="#slide-09-split-visual-"+(i+2);tl.fromTo(id,{{opacity:0}},{{opacity:1,duration:0.01}},7.05);tl.fromTo(id,{{x:0}},{{x,duration:0.9,ease:"power2.inOut"}},7.05);}});''')
 else:
  style(shape(21),width='490px');font(shape(21),17,'#625e55',24)
  cards=add(root,'slide-10-method-panels','inset:0;pointer-events:none;',track=81);root.remove(cards);root.insert(1,cards)
  for i,x in enumerate((48,341,634,927)):
   cards.append(html.Element('div',style=f'position:absolute;left:{x}px;top:342px;width:282px;height:212px;background:{"#f8edcc" if i==1 else "#fcfbf7"};border:1px solid {"#d6af4b" if i==1 else "#dedbd1"};border-radius:12px;'))
  line=add(root,'slide-10-process-line','left:96px;top:293px;width:879px;height:1px;background:#b6ab90;',track=82);root.remove(line);root.insert(2,line)
  for i in range(4):
   font(shape(28+i*5),24,'#20201d',34)
   for k in (29+i*5,30+i*5):style(shape(k),width='252px',height='62px');font(shape(k),18,'#55534d',27)
   style(shape(30+i*5),top='476px')
  caption=add(root,'slide-10-method-caption','left:650px;top:128px;width:560px;height:32px;text-align:right;','从案例成果，展开四个迁移环节',83)
  circles={f'slide-10-shape-{k}' for k in (26,31,36,41)}
  ids=','.join('#'+e.get('id') for e in root if e is not bg and e.get('id') not in circles)
  script(d,f'''tl.addLabel("四个迁移环节",0);
tl.fromTo({json.dumps(ids)},{{opacity:0}},{{opacity:1,duration:0.6,ease:"power1.inOut"}},0);''')
 f.write_text('<!DOCTYPE html>\n'+html.tostring(d,encoding='unicode'),encoding='utf8')
f=p/'presentation-cues.json';data=json.loads(f.read_text(encoding='utf8'));segments=data['segments']
for cue in segments:
 if cue['id']=='slide-09-to-10':cue.update(label='09 → 10 · 从案例展开四个环节',start={'clipId':'page-09','offset':6},end={'clipId':'page-10','offset':0.65})
if not any(c['id']=='slide-08-to-09' for c in segments):segments.insert(0,{'id':'slide-08-to-09','label':'08 → 09 · 从工具聚焦项目','start':{'clipId':'page-08','offset':5.5},'end':{'clipId':'page-09','offset':0.65}})
f.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Updated slides 08–10 and two presentation segments.')
