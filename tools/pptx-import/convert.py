"""Convert the supplied editable PPTX shapes into a HyperFrames scene per slide.
Supported: rectangles, ellipses, lines, groups, pictures, rich text and tables.
Unrecognized geometry is reported instead of silently rasterizing whole slides.
"""
import argparse, json, html, re, shutil, hashlib
from pathlib import Path
from pptx import Presentation
from lxml import etree

NS={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
EMU=9525
THEME={'tx1':'151515','dk1':'151515','bg1':'FFFFFF','lt1':'FFFFFF','tx2':'444444','dk2':'444444','bg2':'EEEEEE','lt2':'EEEEEE','accent1':'FFC600','accent2':'222222'}
def one(el,path):
 return el.find(path,NS) if el is not None else None
def esc(s):return html.escape(str(s),quote=True)
def num(n):return f'{float(n):.3f}'.rstrip('0').rstrip('.') or '0'
def color(el,default='#151515'):
 if el is None:return default
 for child in el:
  tag=etree.QName(child).localname
  if tag=='srgbClr':value=child.get('val')
  elif tag=='schemeClr':value=THEME.get(child.get('val'),'151515')
  elif tag=='sysClr':value=child.get('lastClr','151515')
  else:continue
  rgb=[int(value[i:i+2],16) for i in (0,2,4)]
  for mod in child:
   name=etree.QName(mod).localname;v=int(mod.get('val','100000'))/100000
   if name=='lumMod':rgb=[round(c*v) for c in rgb]
   if name=='lumOff':rgb=[round(c+255*v) for c in rgb]
  alpha=one(child,'a:alpha');a=float(alpha.get('val'))/100000 if alpha is not None else 1
  return f'rgba({",".join(str(max(0,min(255,c))) for c in rgb)},{num(a)})' if a<1 else '#'+''.join(f'{max(0,min(255,c)):02x}' for c in rgb)
 return default
def fill(el,default='transparent'):
 return color(one(el,'a:solidFill'),default)
def border(el):
 if el is None or one(el,'a:noFill') is not None:return 'none'
 width=float(el.get('w','12700'))/EMU
 if width<=0:return 'none'
 dash=one(el,'a:prstDash');style='dashed' if dash is not None and dash.get('val')!='solid' else 'solid'
 return f'{num(width)}px {style} {fill(el,"#151515")}'
def font_style(nodes):
 attrs={};font='Noto Sans CJK SC';fg='#151515'
 for n in nodes:
  if n is None:continue
  attrs.update(n.attrib)
  for name in ['a:latin','a:ea']:
   f=one(n,name)
   if f is not None and not f.get('typeface','').startswith('+'):font=f.get('typeface')
  if one(n,'a:solidFill') is not None:fg=color(one(n,'a:solidFill'))
 size=float(attrs.get('sz','1800'))/100*4/3
 return f'font-family:&quot;{esc(font)}&quot;,&quot;Microsoft YaHei&quot;,&quot;PingFang SC&quot;,sans-serif;font-size:{num(size)}px;font-weight:{"700" if attrs.get("b")=="1" else "400"};font-style:{"italic" if attrs.get("i")=="1" else "normal"};color:{fg};'+('text-decoration:underline;' if attrs.get('u') not in (None,'none') else '')+(f'letter-spacing:{num(float(attrs["spc"])/100*4/3)}px;' if 'spc'in attrs else ''),size

def text_html(tf,cellpr=None):
 body=tf._txBody;bp=one(body,'a:bodyPr');lst=one(body,'a:lstStyle/a:defPPr/a:defRPr')
 margin=lambda key,default:float((cellpr if cellpr is not None else bp).get(key,str(default)))/EMU
 if cellpr is not None:m=[margin('marT',45720),margin('marR',91440),margin('marB',45720),margin('marL',91440)]
 else:m=[margin('tIns',45720),margin('rIns',91440),margin('bIns',45720),margin('lIns',91440)]
 anchor=(cellpr.get('anchor') if cellpr is not None else bp.get('anchor')) or 't'
 valign={'ctr':'center','b':'flex-end'}.get(anchor,'flex-start')
 wrap=bp.get('wrap','square')!='none';out=[]
 for p in tf.paragraphs:
  pel=p._p;pp=one(pel,'a:pPr');default=one(pp,'a:defRPr');end=one(pel,'a:endParaRPr')
  style,size=font_style([lst,default,end])
  align={'ctr':'center','r':'right','just':'justify'}.get(pp.get('algn') if pp is not None else '', 'left')
  line=one(pp,'a:lnSpc/a:spcPct');pts=one(pp,'a:lnSpc/a:spcPts')
  lh=num(float(line.get('val'))/100000) if line is not None else (num(float(pts.get('val'))/100*4/3)+'px' if pts is not None else '1.2')
  before=one(pp,'a:spcBef/a:spcPts');after=one(pp,'a:spcAft/a:spcPts')
  spacing=f'margin-top:{num(float(before.get("val"))/100*4/3 if before is not None else 0)}px;margin-bottom:{num(float(after.get("val"))/100*4/3 if after is not None else 0)}px;'
  runs=[];run_styles=[];plain=[]
  for child in pel:
   tag=etree.QName(child).localname
   if tag in ['r','fld']:
    rs,_=font_style([lst,default,one(child,'a:rPr')]);txt=one(child,'a:t')
    runs.append(f'<span style="{rs}">{esc(txt.text or "") if txt is not None else ""}</span>');run_styles.append(rs);plain.append(txt.text or '' if txt is not None else '')
   elif tag=='br':runs.append('<br>');plain.append('\n')
  content=''.join(runs)
  if len(set(run_styles))<=1:
   content=esc(''.join(plain));style=run_styles[0] if run_styles else style
  out.append(f'<p style="margin:0;{spacing}{style}text-align:{align};line-height:{lh};white-space:{"pre-wrap" if wrap else "pre"};overflow-wrap:normal;">{content}</p>')
 return f'display:flex;flex-direction:column;justify-content:{valign};padding:{" ".join(num(v)+"px" for v in m)};', ''.join(out)

class Converter:
 def __init__(self,src,out,duration):
  self.p=Presentation(src);self.out=Path(out);self.duration=duration;self.manifest={'source':Path(src).name,'size':[self.p.slide_width/EMU,self.p.slide_height/EMU],'secondsPerSlide':duration,'slides':[],'limitations':['PowerPoint slide transitions are not imported; editable static slide content is preserved.','Original text font families are retained; Noto Sans SC is embedded as the CJK substitute. Open Sans Light falls back to Segoe UI Light if unavailable.','Table cells remain editable text and geometry, not spreadsheet formulas.']};self.assets={};self.warnings=[]
  for d in ['assets','slides']:(self.out/d).mkdir(parents=True,exist_ok=True)
 def shape(self,s,sid,track,transform=(1,1,0,0),timed=True):
  sx,sy,ox,oy=transform;x=s.left/EMU*sx+ox;y=s.top/EMU*sy+oy;w=s.width/EMU*sx;h=s.height/EMU*sy
  name=s.name
  if sid=='slide-14-shape-38':y+=27
  label=(s.text.strip().replace('\n',' ')[:45] if s.has_text_frame and s.text.strip() else name)
  style=f'position:absolute;left:{num(x)}px;top:{num(y)}px;width:{num(max(w,.1))}px;height:{num(max(h,.1))}px;'
  if s.rotation:style+=f'transform:rotate({num(s.rotation)}deg);transform-origin:center;'
  attrs=f'id="{sid}" data-label="{esc(label)}"'+(f' class="clip" data-start="0" data-duration="{self.duration}" data-track-index="{track}"' if timed else '')
  self.current['objects'].append({'id':sid,'sourceId':s.shape_id,'name':name,'type':str(s.shape_type),'text':s.text if s.has_text_frame else None})
  if s.shape_type==6:
   xf=one(s._element,'p:grpSpPr/a:xfrm');off=one(xf,'a:chOff');ext=one(xf,'a:chExt');gx=w/(float(ext.get('cx'))/EMU);gy=h/(float(ext.get('cy'))/EMU)
   children=''.join(self.shape(c,f'{sid}-{j+1}',j,(gx,gy,-float(off.get('x'))/EMU*gx,-float(off.get('y'))/EMU*gy),False) for j,c in enumerate(s.shapes))
   return f'<div {attrs} style="{style}">{children}</div>'
  if s.shape_type==13:
   image=s.image;digest=hashlib.sha256(image.blob).hexdigest()[:12];file=f'image-{digest}.{image.ext}'
   (self.out/'assets'/file).write_bytes(image.blob);self.assets[file]=len(image.blob)
   cw=1-s.crop_left-s.crop_right;ch=1-s.crop_top-s.crop_bottom
   picture=f'<img id="{sid}-image" src="../assets/{file}" alt="{esc(name)}" style="position:absolute;width:{num(100/cw)}%;height:{num(100/ch)}%;left:{num(-100*s.crop_left/cw)}%;top:{num(-100*s.crop_top/ch)}%;max-width:none;">'
   return f'<div {attrs} style="{style}overflow:hidden;">{picture}</div>'
  if s.has_table:
   table=s.table;cells=[];cy=0
   for r,row in enumerate(table.rows):
    cx=0
    for c,col in enumerate(table.columns):
     cell=table.cell(r,c);cw=col.width/EMU*sx;ch=row.height/EMU*sy
     if not cell.is_spanned:
      ww=sum(table.columns[k].width/EMU*sx for k in range(c,c+cell.span_width));hh=sum(table.rows[k].height/EMU*sy for k in range(r,r+cell.span_height));pr=cell._tc.get_or_add_tcPr()
      layout,content=text_html(cell.text_frame,pr)
      bs=''.join(f'border-{side}:{border(one(pr,"a:ln"+tag)) if one(pr,"a:ln"+tag) is not None else "1px solid #777777"};' for side,tag in [('left','L'),('right','R'),('top','T'),('bottom','B')])
      cells.append(f'<div id="{sid}-r{r+1}c{c+1}" style="position:absolute;left:{num(cx)}px;top:{num(cy)}px;width:{num(ww)}px;height:{num(hh)}px;background:{fill(pr)};{bs}{layout}">{content}</div>')
     cx+=cw
    cy+=row.height/EMU*sy
   return f'<div {attrs} style="{style}">'+''.join(cells)+'</div>'
  pr=one(s._element,'p:spPr');geom=one(pr,'a:prstGeom');kind=geom.get('prst') if geom is not None else 'rect';line=one(pr,'a:ln')
  if kind=='line':
   stroke=fill(line,'#151515');lw=float(line.get('w','12700'))/EMU if line is not None else 1
   style+=f'background:{stroke};'
   if w<h:style+=f'width:{num(max(lw,.1))}px;'
   else:style+=f'height:{num(max(lw,.1))}px;'
  else:
   style+=f'background:{fill(pr)};border:{border(line)};'
   if kind=='ellipse':style+='border-radius:50%;'
   elif kind not in ['rect']:self.warnings.append(f'{sid}: unsupported geometry {kind}')
  text=''
  if s.has_text_frame and s.text:
   layout,text=text_html(s.text_frame);style+=layout
  return f'<div {attrs} style="{style}">{text}</div>'
 def run(self):
  width,height=self.manifest['size'];hosts=[]
  for i,slide in enumerate(self.p.slides):
   sid=f'slide-{i+1:02d}';title=next((s.text.strip().replace('\n',' ') for s in slide.shapes if s.has_text_frame and s.name in ['title','chapter-title','cover-title']),f'第 {i+1} 页')
   if title==f'第 {i+1} 页':
    candidates=[sh for sh in slide.shapes if sh.has_text_frame and sh.text.strip() and not sh.name.startswith(('identity','page','number'))]
    title=''.join(sh.text for sh in candidates if sh.name.startswith('title-line')) or next((sh.text for sh in candidates if sh.text=='Skill Manager'),title)
   self.current={'id':sid,'number':i+1,'title':title,'file':f'slides/{sid}.html','start':i*self.duration,'duration':self.duration,'objects':[],'notes':slide.notes_slide.notes_text_frame.text if slide.has_notes_slide else ''}
   body=''.join(self.shape(s,f'{sid}-shape-{s.shape_id}',j) for j,s in enumerate(slide.shapes))
   bg=fill(one(slide._element,'p:cSld/p:bg/p:bgPr'),'#ffffff')
   content=f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>{esc(title)}</title><link rel="stylesheet" href="../assets/base.css"></head><body><div id="{sid}" data-composition-id="{sid}" data-no-timeline="" data-start="0" data-duration="{self.duration}" data-width="{num(width)}" data-height="{num(height)}" style="position:relative;width:100%;height:100%;overflow:hidden;background:{bg}">{body}</div></body></html>'
   (self.out/'slides'/f'{sid}.html').write_text(content,encoding='utf8')
   hosts.append(f'<div id="page-{i+1:02d}" class="clip" data-composition-id="{sid}" data-composition-src="slides/{sid}.html" data-start="{i*self.duration}" data-duration="{self.duration}" data-track-index="0" data-width="{num(width)}" data-height="{num(height)}" data-label="{i+1:02d} · {esc(title)}" style="position:absolute;inset:0"></div>')
   self.manifest['slides'].append(self.current)
  (self.out/'index.html').write_text(f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>7–9月转正答辩</title><link rel="stylesheet" href="assets/base.css"></head><body><div id="deck" data-composition-id="probation-review" data-no-timeline="" data-start="0" data-duration="{len(hosts)*self.duration}" data-width="{num(width)}" data-height="{num(height)}" style="position:relative;width:100%;height:100%;overflow:hidden">'+''.join(hosts)+'</div></body></html>',encoding='utf8')
  (self.out/'assets/base.css').write_text('''*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:white}p{margin:0}img{display:block}@font-face{font-family:"Noto Sans CJK SC";src:url("noto-sans-sc.ttf") format("truetype");font-weight:100 900;font-display:block}@font-face{font-family:"Open Sans Light";src:local("Segoe UI Light");font-weight:400}''',encoding='utf8')
  self.manifest['assets']=self.assets;self.manifest['warnings']=self.warnings
  (self.out/'import-manifest.json').write_text(json.dumps(self.manifest,ensure_ascii=False,indent=2),encoding='utf8')
  chars=''.join(s.text for slide in self.p.slides for s in slide.shapes if s.has_text_frame)+''.join(c.text for slide in self.p.slides for s in slide.shapes if s.has_table for row in s.table.rows for c in row.cells)
  fontpath=Path('C:/Windows/Fonts/NotoSansSC-VF.ttf')
  if fontpath.exists():shutil.copyfile(fontpath,self.out/'assets/noto-sans-sc.ttf')
  else:self.warnings.append('Noto Sans SC not installed; relies on system fonts')
  print(json.dumps({'slides':len(hosts),'objects':sum(len(s['objects']) for s in self.manifest['slides']),'assets':len(self.assets),'warnings':self.warnings},ensure_ascii=False))

if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('source');a.add_argument('output');a.add_argument('--duration',type=float,default=8);args=a.parse_args();Converter(args.source,args.output,args.duration).run()
