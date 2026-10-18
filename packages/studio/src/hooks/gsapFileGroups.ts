import {
  gsapWriteFile,
  type CommitMutationCall,
  type MutationResult,
} from "./gsapScriptCommitTypes";
import { rollbackOwnedMutation } from "./gsapMutationClient";

export function groupGsapCalls(calls: CommitMutationCall[], activePath: string | null) {
  const groups = new Map<string, CommitMutationCall[]>();
  for (const call of calls) {
    const file = gsapWriteFile(call.selection, activePath);
    const members = groups.get(file) ?? [];
    members.push(call);
    groups.set(file, members);
  }
  // A stable lock order prevents overlapping multi-file gestures from deadlocking.
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, calls]) => ({ file, calls }));
}

/** Keep history and preview untouched until all source files have been saved. */
export async function commitGsapFileGroups(
  projectId: string,
  groups: ReturnType<typeof groupGsapCalls>,
  save: (file: string, calls: CommitMutationCall[]) => Promise<MutationResult>,
): Promise<MutationResult[]> {
  const results: MutationResult[] = [];
  const owned: { file: string; before: string; after: string }[] = [];
  try {
    for (const group of groups) {
      const result = await save(group.file, group.calls);
      results.push(result);
      const files = { ...result.linkedFiles };
      if (typeof result.before === "string" && typeof result.after === "string")
        files[group.file] = { before: result.before, after: result.after };
      for (const [file, pair] of Object.entries(files))
        if (pair.before !== pair.after) owned.push({ file, ...pair });
    }
    return results;
  } catch (error) {
    const failures: unknown[] = [];
    for (const item of owned.reverse()) {
      try {
        const status = await rollbackOwnedMutation(projectId, item.file, item.after, item.before);
        if (status === "conflict") throw new Error(`A newer edit prevents restoring ${item.file}`);
      } catch (failure) {
        failures.push(failure);
      }
    }
    if (failures.length)
      throw new AggregateError(
        [error, ...failures],
        "Group save failed; some files could not be restored. Reload before editing again.",
      );
    throw error;
  }
}
