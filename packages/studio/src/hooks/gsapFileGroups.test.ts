import { describe, expect, it, vi } from "vitest";
import { commitGsapFileGroups, groupGsapCalls } from "./gsapFileGroups";
import { rollbackOwnedMutation } from "./gsapMutationClient";
import type { CommitMutationCall } from "./gsapScriptCommitTypes";
vi.mock("./gsapMutationClient", () => ({ rollbackOwnedMutation: vi.fn() }));
const call = (sourceFile: string, x: number) =>
  ({
    selection: { sourceFile },
    mutation: { x },
    options: { label: "Move group" },
  }) as CommitMutationCall;
describe("cross-file group movement", () => {
  it("routes every member to its owning file and retains mutation order", async () => {
    const groups = groupGsapCalls(
      [call("subjects/circle.html", 1), call("slides/08.html", 2), call("subjects/circle.html", 3)],
      null,
    );
    const save = vi.fn(async () => ({ ok: true, before: "old", after: "new" }));
    await commitGsapFileGroups("deck", groups, save);
    expect(save.mock.calls.map((args: unknown[]) => args[0])).toEqual([
      "slides/08.html",
      "subjects/circle.html",
    ]);
    expect(groups[1]!.calls.map((c) => c.mutation.x)).toEqual([1, 3]);
  });
  it("restores the first file when the second is locked", async () => {
    vi.mocked(rollbackOwnedMutation).mockResolvedValue("restored");
    const groups = groupGsapCalls([call("a.html", 1), call("b.html", 2)], null);
    const save = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, before: "old", after: "new" })
      .mockRejectedValueOnce(new Error("locked"));
    await expect(commitGsapFileGroups("deck", groups, save)).rejects.toThrow("locked");
    expect(rollbackOwnedMutation).toHaveBeenCalledWith("deck", "a.html", "new", "old");
  });
  it("reports a rollback conflict without overwriting a newer edit", async () => {
    vi.mocked(rollbackOwnedMutation).mockResolvedValue("conflict");
    const save = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, before: "old", after: "new" })
      .mockRejectedValueOnce(new Error("locked"));
    await expect(
      commitGsapFileGroups(
        "deck",
        groupGsapCalls([call("a.html", 1), call("b.html", 2)], null),
        save,
      ),
    ).rejects.toThrow("could not be restored");
  });
});
