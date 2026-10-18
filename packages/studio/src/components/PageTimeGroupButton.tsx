import { t } from "../i18n";
import { useRef, useState } from "react";
import { useFileManagerContext } from "../contexts/FileManagerContext";
import { useStudioShellContext } from "../contexts/StudioContext";
import { usePlayerStore } from "../player";
import { commitPageTimeGroup } from "../utils/pageTimeGroup";
import type { RecordEditInput } from "../utils/studioFileHistory";

export function PageTimeGroupButton({
  recordEdit,
  onGrouped,
  resync,
}: {
  recordEdit: (entry: RecordEditInput) => Promise<void>;
  onGrouped: () => void;
  resync: () => void;
}) {
  const shell = useStudioShellContext();
  const files = useFileManagerContext();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const path = shell.activeCompPath || "index.html";
  async function groupPage() {
    if (inFlight.current || shell.writeBlockedReason) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await files.flushPendingSourceSave();
      await shell.waitForPendingDomEditSaves();
      const key = crypto.randomUUID();
      const childPath = path.slice(0, path.lastIndexOf("/") + 1) + "time-group-" + key + ".html";
      await commitPageTimeGroup({
        path,
        childPath,
        key,
        duration: usePlayerStore.getState().duration,
        readFile: files.readProjectFile,
        readOptionalFile: files.readOptionalProjectFile,
        writeFile: files.writeProjectFile,
        recordEdit,
      });
      resync();
      onGrouped();
      await files.refreshFileTree();
      shell.showToast(t("group.done"), "info");
    } catch (error) {
      shell.showToast(error instanceof Error ? error.message : t("group.failed"), "error");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      disabled={busy || !!shell.writeBlockedReason}
      title={shell.writeBlockedReason || t("group.hint")}
      onClick={() => void groupPage()}
      className="rounded px-2 py-1 text-xs text-text-1 hover:bg-hover disabled:opacity-40 whitespace-nowrap"
    >
      {busy ? t("group.creating") : t("group.create")}
    </button>
  );
}
