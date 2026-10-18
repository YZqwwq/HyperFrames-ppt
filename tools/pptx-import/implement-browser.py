from pathlib import Path
p=Path('packages/studio/src/components/presentation/PresentationBrowser.tsx')
p.write_text('''import { useEffect, useState } from "react";
import { t } from "../../i18n";
import { useNLEContext } from "../nle/NLEContext";
import type { PresentationCue } from "./presentationCues";

export interface DisplayRange { cue: PresentationCue; start: number; end: number }
export function PresentationBrowser({ ranges, onClose, onPresent }: {
  ranges: DisplayRange[]; onClose: () => void;
  onPresent: (index: number, ended?: boolean) => void;
}) {
  const { pause, seek, projectId } = useNLEContext();
  const [selected, setSelected] = useState({ index: 0, ended: false });
  const [failed, setFailed] = useState(false);
  const range = ranges[selected.index];
  useEffect(() => { pause(); if (ranges[0]) seek(ranges[0].start); }, []);
  function choose(index: number, ended: boolean) {
    pause();
    setFailed(!seek(ended ? ranges[index].end : ranges[index].start));
    setSelected({ index, ended });
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); onClose(); }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);
  const button = "rounded-md border border-white/20 px-3 py-2 hover:bg-white/10 disabled:opacity-40";
  return <>
    <header className="absolute inset-x-0 top-0 h-16 flex items-center justify-between px-5 border-b border-white/15 text-white">
      <strong>{t("presentation.browseTitle")}</strong>
      <div className="flex gap-3">
        <button className={button} onClick={onClose}>{t("presentation.backEditor")}</button>
        <button className={button + " bg-emerald-700"} disabled={!range || failed}
          onClick={() => onPresent(selected.index, selected.ended)}>{t("presentation.play")}</button>
      </div>
    </header>
    <aside className="absolute left-0 top-16 bottom-0 w-60 overflow-y-auto border-r border-white/15 p-3 text-white" aria-label={t("presentation.groups")}>
      {ranges.map((item, index) => <details key={item.cue.id} open className="mb-4">
        <summary className="cursor-pointer py-2 text-sm">{index + 1}. {item.cue.label}</summary>
        {[false, true].map(ended => <button key={String(ended)}
          aria-pressed={selected.index === index && selected.ended === ended}
          className={"block w-full rounded-md border p-2 mb-2 text-left " + (selected.index === index && selected.ended === ended ? "border-emerald-400 bg-emerald-900/30" : "border-white/15")}
          onClick={() => choose(index, ended)}>
          <img loading="lazy" className="w-full aspect-video object-contain bg-white rounded" alt={ended ? t("presentation.endState") : t("presentation.startState")}
            src={`/api/projects/${encodeURIComponent(projectId)}/thumbnail/index.html?t=${ended ? item.end : item.start}&format=png&output=source`}/>
          <span className="block pt-2 text-sm">{ended ? t("presentation.endState") : t("presentation.startState")}</span>
        </button>)}
      </details>)}
      {!ranges.length && <p role="status">{t("presentation.noStates")}</p>}
    </aside>
    <footer className="absolute bottom-0 right-0 left-60 h-20 border-t border-white/15 px-5 flex items-center justify-between text-white gap-3">
      <span className="text-sm">{range?.cue.label}<br/>{failed ? t("presentation.seekFailed") : t("presentation.waiting")}</span>
      <button className={button} disabled={!range || failed || (selected.ended && selected.index === ranges.length - 1)}
        onClick={() => onPresent(selected.index, selected.ended)}>{t("presentation.play")}</button>
    </footer>
  </>;
}
''',encoding='utf8')
p=Path('packages/studio/src/components/presentation/PresentationControls.tsx');s=p.read_text(encoding='utf8');s='import { PresentationBrowser } from "./PresentationBrowser";\n'+s;s=s.replace('  onActiveChange,','  onActiveChange,\n  browsing,\n  onBrowseChange,',1).replace('  onActiveChange: (active: boolean) => void;','  onActiveChange: (active: boolean) => void;\n  browsing: boolean;\n  onBrowseChange: (active: boolean) => void;');s=s.replace('  return (\n    <div\n      data-presentation-controls', '''  if (browsing) return <PresentationBrowser ranges={playable} onClose={() => { pause(); onBrowseChange(false); }} onPresent={playback.enter} />;
  return (
    <div
      data-presentation-controls''');s=s.replace('<span className="text-xs">{t("presentation.title")}</span>','''<button className={button + " bg-emerald-700"} disabled={busy || !master || timelineDisabled || !!error} onClick={() => { pause(); onBrowseChange(true); }}>{t("presentation.browseTitle")}</button>
        <span className="text-xs">{t("presentation.title")}</span>''');p.write_text(s,encoding='utf8')
p=Path('packages/studio/src/components/nle/PreviewPane.tsx');s=p.read_text(encoding='utf8').replace('const [presenting, setPresenting] = useState(false);','const [presenting, setPresenting] = useState(false);\n  const [browsing, setBrowsing] = useState(false);');s=s.replace('style={{ position: "relative" }}','style={browsing ? { position: "fixed", inset: 0, zIndex: 1000, margin: 0, borderRadius: 0, paddingTop: presenting ? 0 : 64, paddingLeft: presenting ? 0 : 240, paddingBottom: presenting ? 0 : 80 } : { position: "relative" }}');s=s.replace('!presenting && <PreviewGuides','!presenting && !browsing && <PreviewGuides').replace('!isFullscreen && !presenting && previewOverlay','!isFullscreen && !presenting && !browsing && previewOverlay').replace('!isFullscreen && !presenting && compositionStack','!isFullscreen && !presenting && !browsing && compositionStack').replace('<PresentationControls stage={containerRef} onActiveChange={setPresenting} />','<PresentationControls stage={containerRef} onActiveChange={setPresenting} browsing={browsing} onBrowseChange={setBrowsing} />').replace('{!presenting && (','{!presenting && !browsing && (');s=s.replace('<AssetPreviewOverlay />','{!browsing && <AssetPreviewOverlay />}');s=s.replace('        <PreviewOverlayProvider>','        {browsing && <div className="absolute inset-0 z-50" />}\n        <PreviewOverlayProvider>');p.write_text(s,encoding='utf8')
p=Path('packages/studio/src/components/presentation/useCuePlayback.ts');s=p.read_text(encoding='utf8');a=s.index('    if (state.phase === "running") {');b=s.index('    const index =',a);s=s[:a]+'    if (state.phase === "running") return;\n'+s[b:];s=s.replace('function enter(index: number)', 'function enter(index: number, ended = false)').replace('if (!seek(range.start)) return;', 'if (!seek(ended ? range.end : range.start)) return;').replace('setSession({ index, phase: "ready" });\n    void stage','setSession({ index, phase: ended ? "ended" : "ready" });\n    void stage');p.write_text(s,encoding='utf8')
import json
texts={'browseTitle':('演示预览','Presentation preview'),'backEditor':('返回编辑','Back to editor'),'groups':('展示分组','Presentation groups'),'startState':('开始状态','Start state'),'endState':('点击后状态','After click'),'noStates':('尚无可用打点，请返回总时间轴设置动画起点和终点。','No valid cues. Set start and end points in the master timeline.'),'seekFailed':('定位失败，请等待画面就绪后重试。','Could not seek. Wait for the preview and try again.')}
for locale,i in [('zh-CN',0),('en',1)]:
 p=Path(f'packages/studio/src/i18n/{locale}.json');d=json.loads(p.read_text(encoding='utf8'));d.update({'presentation.'+k:v[i] for k,v in texts.items()});p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
