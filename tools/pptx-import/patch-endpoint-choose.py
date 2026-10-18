from pathlib import Path
p=Path('packages/studio/src/components/editor/PropertyPanelFlat.tsx');s=p.read_text(encoding='utf-8').replace('<AnimationEndpoints element={element} animations={gsapAnimations} onSeek={onSeekToTime} />','<AnimationEndpoints element={element} animations={gsapAnimations} onSeek={onSeekToTime} onChoose={() => setOpenGroupId("layout")} />');p.write_text(s,encoding='utf-8')
