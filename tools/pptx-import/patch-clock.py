from pathlib import Path
r=Path('packages/studio/src')
for name in ['gsapRuntimeBridge.ts','gsapResizeIntercept.ts','gsapDragPositionCommit.ts','gsapValueAtPlayhead.ts']:
 p=r/'hooks'/name
 s=p.read_text(encoding='utf-8').replace('editMoment(stamp)', 'editMoment(stamp, selection)').replace('editMoment(callbacks.stamp)', 'editMoment(callbacks.stamp, selection)').replace('parkPlayheadOnKeyframe(anim, pct)', 'parkPlayheadOnKeyframe(anim, pct, selection)').replace('parkPlayheadOnKeyframe(anim, parkAt)', 'parkPlayheadOnKeyframe(anim, parkAt, selection)')
 p.write_text(s,encoding='utf-8')
p=r/'hooks/gsapDragCommit.ts';s=p.read_text(encoding='utf-8').replace('import { usePlayerStore }','import { selectionTimeOffset } from "./selectionClock";\nimport { usePlayerStore }',1).replace('time = usePlayerStore.getState().currentTime,','time = usePlayerStore.getState().currentTime - selectionTimeOffset(selection),').replace('anim: GsapAnimation, pct: number): void','anim: GsapAnimation, pct: number, selection?: DomEditSelection): void').replace('requestSeek(roundTo3(time))','requestSeek(roundTo3(time + selectionTimeOffset(selection)))');p.write_text(s,encoding='utf-8')
p=r/'components/editor/MotionPathOverlay.tsx';s=p.read_text(encoding='utf-8');s=s.replace('parkPlayheadOnKeyframe(anim,', 'parkPlayheadOnKeyframe(anim,')
p.write_text(s,encoding='utf-8')
