import { useEffect, useState } from "react";
import { useFileManagerContextOptional } from "../../contexts/FileManagerContext";
import { t } from "../../i18n";

export function MotionDependencyNotice({
  file,
  selector,
  ordinal,
}: {
  file?: string;
  selector: string;
  ordinal: number;
}) {
  const files = useFileManagerContextOptional();
  const [linked, setLinked] = useState(false);
  const read = files?.readOptionalProjectFile;
  useEffect(() => {
    let active = true;
    setLinked(false);
    read?.("presentation-timing-links.json")
      .then((source) => {
        if (!active || !source) return;
        const data = JSON.parse(source);
        setLinked(
          Array.isArray(data.links) &&
            data.links.some(
              (link: { source?: { file?: string; selector?: string; ordinal?: number } }) =>
                link.source?.file === file &&
                link.source?.selector === selector &&
                link.source?.ordinal === ordinal,
            ),
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [file, selector, ordinal, read]);
  return linked ? (
    <p className="mb-2 rounded border border-panel-hairline p-2 text-xs text-panel-text-2">
      {t("motion.linkedTiming")}
    </p>
  ) : null;
}
