from pathlib import Path
import zipfile
root=Path('../deliverables/转正答辩-HyperFrames')
with zipfile.ZipFile('../deliverables/转正答辩-HyperFrames.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in root.rglob('*'):
  if p.is_file() and '.hyperframes' not in p.parts: z.write(p,p.relative_to(root))
print('Archive updated')
