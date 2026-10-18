from pathlib import Path
p=Path('packages/studio/src/components/editor/PropertyPanelFlat.tsx');s=p.read_text(encoding='utf-8').replace('    isTextEditableSelection(element)\n      ? "text"','    gsapAnimations.length > 0 && !element.textContent?.trim()\n      ? "layout"\n      : isTextEditableSelection(element)\n      ? "text"');p.write_text(s,encoding='utf-8')
