import { ArrowLeft, CaretRight } from "@phosphor-icons/react";
import { trackStudioEvent } from "../../utils/studioTelemetry";

export interface CompositionLevel {
  /** Unique id — "master" or composition file path */
  id: string;
  /** Display label — "Master" or filename without extension */
  label: string;
  /** Preview URL for this composition level */
  previewUrl: string;
}

interface CompositionBreadcrumbProps {
  stack: CompositionLevel[];
  onNavigate: (index: number) => void;
}

export function CompositionBreadcrumb({ stack, onNavigate }: CompositionBreadcrumbProps) {
  if (stack.length <= 1) return null;

  return (
    <nav
      aria-label="时间组导航"
      className="flex items-center gap-1 px-2 h-8 border-b border-hairline bg-bg-1 shrink-0"
    >
      {/* Back button — always goes to parent */}
      <button
        type="button"
        onClick={() => {
          trackStudioEvent("navigation", {
            action: "back",
            target: stack[stack.length - 2]?.label,
          });
          onNavigate(stack.length - 2);
        }}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs text-text-3 hover:text-text-0 hover:bg-hover active:scale-[0.98] transition-colors"
        title="返回上一级（Esc）"
        aria-label="返回上一级时间轴"
      >
        <ArrowLeft size={12} weight="bold" />
        返回上一级
      </button>

      {/* Breadcrumb path */}
      {stack.map((level, i) => {
        const isLast = i === stack.length - 1;
        return (
          <span key={level.id} className="flex items-center gap-1">
            {i > 0 && <CaretRight size={10} className="text-text-4 shrink-0" />}
            {isLast ? (
              <span className="text-xs text-text-1 font-medium">
                {level.id === "master" ? "总时间轴" : level.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  trackStudioEvent("navigation", { action: "breadcrumb", target: level.label });
                  onNavigate(i);
                }}
                className="text-xs text-text-3 hover:text-text-1 transition-colors"
              >
                {level.id === "master" ? "总时间轴" : level.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
