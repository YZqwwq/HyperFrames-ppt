import type { DomEditGroupPathOffsetCommit } from "../components/editor/DomEditOverlay";
import type { DomEditSelection } from "../components/editor/domEditingTypes";

/** Reject a group before writing if any member cannot be edited. */
export function firstPreflightFailure(
  results: PromiseSettledResult<void>[],
  updates: DomEditGroupPathOffsetCommit[],
): { error: unknown; selection: DomEditSelection } | null {
  for (const [index, result] of results.entries()) {
    if (result.status !== "rejected") continue;
    const selection = updates[index]?.selection;
    if (selection) return { error: result.reason, selection };
  }
  return null;
}
