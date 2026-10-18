from pathlib import Path
import re
p=Path('../deliverables/转正答辩-HyperFrames/slides/slide-08.html');s=p.read_text(encoding='utf-8');s=re.sub(r'\s*tl\.(?:set|to|fromTo)\("#slide-08-case-visual",[\s\S]*?\);','',s);s=s.replace('window.__timelines=window.__timelines||{};', 'tl.fromTo("#slide-08-case-visual",{x:0,y:0,scale:1},{x:-180.5,y:197.589,scale:9.4375,duration:1.4,ease:"power2.inOut"},5.9);\nwindow.__timelines=window.__timelines||{};');p.write_text(s,encoding='utf-8')
