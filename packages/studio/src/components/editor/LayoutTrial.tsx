import { useEffect, useRef, useState, type RefObject } from "react";
import { LAYOUT_TRIAL_OFFER_EVENT } from "./layoutTrialEvents";
import { createPortal } from "react-dom";
import { liveTime } from "../../player/store/playerStore";
import { t } from "../../i18n";
import type { DomEditSelection } from "./domEditing";
import {
  captureLayoutTrial,
  describeLayoutTrial,
  measureTrialMotion,
  moveTrial,
  type LayoutTrialSnapshot,
  type TrialMotion,
} from "./layoutTrialSnapshot";

export function LayoutTrialLauncher({
  iframeRef,
  selections,
}: {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  selections: DomEditSelection[];
}) {
  const [snapshot, setSnapshot] = useState<LayoutTrialSnapshot | null>(null);
  const [error, setError] = useState("");
  const [offered, setOffered] = useState(false);
  useEffect(() => {
    const offer = (event: Event) => {
      if (event instanceof CustomEvent && event.detail === iframeRef.current?.contentDocument)
        setOffered(true);
    };
    window.addEventListener(LAYOUT_TRIAL_OFFER_EVENT, offer);
    return () => window.removeEventListener(LAYOUT_TRIAL_OFFER_EVENT, offer);
  }, [iframeRef]);
  return (
    <>
      <div
        className="pointer-events-auto absolute left-3 top-3 z-60 max-w-80"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {offered && (
          <p
            role="status"
            className="mb-2 rounded border border-amber-400/50 bg-panel-bg p-3 text-xs text-panel-text-1"
          >
            {t("layoutTrial.blocked")}
          </p>
        )}
        <button
          type="button"
          className="rounded border border-panel-hairline bg-panel-bg px-3 py-2 text-xs text-panel-text-1 shadow"
          onClick={() => {
            try {
              if (!iframeRef.current) return;
              setSnapshot(captureLayoutTrial(iframeRef.current, selections, liveTime.latest()));
              setError("");
              setOffered(false);
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : String(reason));
            }
          }}
        >
          {t("layoutTrial.enter")}
        </button>
        {error && (
          <p role="alert" className="mt-2 rounded bg-panel-bg p-2 text-xs text-panel-text-1">
            {error}
          </p>
        )}
      </div>
      {snapshot &&
        createPortal(
          <LayoutTrialDialog snapshot={snapshot} onClose={() => setSnapshot(null)} />,
          document.body,
        )}
    </>
  );
}

function LayoutTrialDialog({
  snapshot,
  onClose,
}: {
  snapshot: LayoutTrialSnapshot;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const motions = useRef<TrialMotion[]>([]);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [fit, setFit] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [copy, setCopy] = useState("");
  const [bounds, setBounds] = useState({ left: 0, top: 0, width: 0, height: 0 });
  useEffect(() => {
    dialog.current?.showModal();
    const host = viewport.current;
    if (!host) return;
    const observer = new ResizeObserver(() => {
      setFit(Math.min(host.clientWidth / snapshot.width, host.clientHeight / snapshot.height));
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [snapshot]);
  useEffect(() => {
    moveTrial(motions.current, offset.x * snapshot.scale, offset.y * snapshot.scale);
  }, [offset, snapshot.scale]);
  const button =
    "rounded border border-panel-hairline px-3 py-1.5 text-sm text-panel-text-1 hover:bg-panel-surface";
  return (
    <dialog
      role="dialog"
      aria-modal="true"
      ref={dialog}
      onCancel={onClose}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      aria-label={t("layoutTrial.title")}
      className="m-auto h-[90vh] w-[94vw] max-w-none rounded-xl border border-panel-hairline bg-panel-bg p-4 text-panel-text-1 backdrop:bg-black/70"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <strong>{t("layoutTrial.title")}</strong>
            <p className="text-xs text-panel-text-2">{t("layoutTrial.help")}</p>
          </div>
          <button autoFocus className={button} onClick={onClose}>
            {t("layoutTrial.cancel")}
          </button>
        </div>
        <div ref={viewport} className="relative min-h-0 flex-1 overflow-hidden bg-panel-bg-inset">
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: snapshot.width,
              height: snapshot.height,
              transform: `translate(-50%, -50%) scale(${fit})`,
            }}
          >
            <iframe
              ref={iframe}
              title={t("layoutTrial.title")}
              sandbox="allow-same-origin"
              srcDoc={snapshot.html}
              className="pointer-events-none absolute inset-0 border-0"
              width={snapshot.width}
              height={snapshot.height}
              onLoad={async () => {
                try {
                  const doc = iframe.current?.contentDocument;
                  if (!doc) return;
                  await doc.fonts.ready;
                  if (!iframe.current) return;
                  motions.current = measureTrialMotion(doc);
                  const rects = motions.current.map(({ element }) =>
                    element.getBoundingClientRect(),
                  );
                  if (!rects.length) throw new Error("无法定位试摆对象。");
                  const left = Math.min(...rects.map((r) => r.left));
                  const top = Math.min(...rects.map((r) => r.top));
                  setBounds({
                    left,
                    top,
                    width: Math.max(...rects.map((r) => r.right)) - left,
                    height: Math.max(...rects.map((r) => r.bottom)) - top,
                  });
                  setReady(true);
                } catch (reason) {
                  setError(String(reason));
                }
              }}
            />
            {ready && (
              <div
                data-layout-trial-selection="true"
                role="group"
                aria-label={t("layoutTrial.drag")}
                className="absolute cursor-move touch-none border-2 border-emerald-400 bg-emerald-400/5"
                style={{
                  ...bounds,
                  left: bounds.left + offset.x * snapshot.scale,
                  top: bounds.top + offset.y * snapshot.scale,
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drag.current = { x: event.clientX, y: event.clientY, dx: offset.x, dy: offset.y };
                }}
                onPointerMove={(event) => {
                  const start = drag.current;
                  if (!start) return;
                  setOffset({
                    x: Math.round(start.dx + (event.clientX - start.x) / fit / snapshot.scale),
                    y: Math.round(start.dy + (event.clientY - start.y) / fit / snapshot.scale),
                  });
                  setCopy("");
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onLostPointerCapture={() => {
                  drag.current = null;
                }}
              />
            )}
          </div>
          <div className="absolute bottom-3 right-3 max-w-md rounded-lg border border-amber-400/50 bg-panel-bg p-3 shadow-xl">
            <p className="text-sm font-semibold text-amber-600">{t("layoutTrial.unsaved")}</p>
            <p className="my-2 text-xs text-panel-text-2">
              {snapshot.targets.length} {t("layoutTrial.objects")} · {snapshot.time.toFixed(2)}s
            </p>
            <div className="flex gap-3">
              {(["x", "y"] as const).map((axis) => (
                <label key={axis} className="text-sm">
                  {axis.toUpperCase()} (px)
                  <input
                    type="number"
                    aria-label={`${axis.toUpperCase()} (px)`}
                    disabled={!ready}
                    value={offset[axis]}
                    className="ml-2 w-20 rounded bg-panel-bg-inset p-1 text-panel-text-1"
                    onChange={(event) => {
                      const value = event.currentTarget.valueAsNumber;
                      if (Number.isFinite(value)) {
                        setOffset((previous) => ({ ...previous, [axis]: value }));
                        setCopy("");
                      }
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className={button}
                disabled={!ready}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      describeLayoutTrial(snapshot, offset.x, offset.y),
                    );
                    setCopy(t("layoutTrial.copied"));
                  } catch {
                    setCopy(t("layoutTrial.copyFailed"));
                  }
                }}
              >
                {t("layoutTrial.copy")}
              </button>
              <button
                className={button}
                onClick={() => {
                  setOffset({ x: 0, y: 0 });
                  setCopy("");
                }}
              >
                {t("layoutTrial.reset")}
              </button>
            </div>
            <p role="status" className="mt-2 text-xs">
              {copy}
            </p>
            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
