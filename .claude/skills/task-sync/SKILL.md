---
description: Detect drift between CLAUDE.local.md task checkboxes and the git/code reality. Use before a session ends, when starting a session on a stale branch, or when the user asks "what's actually done".
invocation: user
---

## Context

`CLAUDE.local.md` is **the per-owner status of record** for Ibrahim's task sheet. Its protocol is strict:

- `- [ ]` = not started, `- [x]` = fully done on `main`, `- [~]` = partial with a trailing `(partial — <reason>)`.
- Flip the checkbox in the **same commit** as the code. Reference the task ID in the commit body (e.g. `I-GEN-19`).
- Never check off speculatively. Implementations against the v0.1.0 shape stay `- [~]` until rewired against `src/document/`.

Drift is expensive: the file is the first thing read at session start, and a stale entry causes wasted re-audits or duplicated work.

## Instructions

1. **Parse the task sheet.** Read `CLAUDE.local.md`. Extract every line matching `- \[( |x|~)\] \*\*(I-[A-Z]+-\d+)\*\*` into a map: `{ id, state, partialReason | null, lineNumber }`. The owned IDs are `I-DOC-*`, `I-ELE-*`, `I-GEN-*`, `I-RUN-*`, `I-SEO-*`, `I-EXP-*`, `I-TPL-*`, `I-BLD-*`.
2. **Scan git history for task ID references.** `git log --all --pretty='%H|%s|%b' main` → for each commit, extract every task ID in the subject + body. Build `{ id → [{ sha, subject }] }`.
3. **Cross-check four drift classes:**
   - **DRIFT-A — Checked but no commit trail.** `state === 'x'` and no commit references the ID. May indicate the ID was checked speculatively, or the commit body forgot the reference. Run `git log --all -S <evidence-keyword>` against a likely file (e.g. `src/runtime/themeToggle.ts` for `I-RUN-01`) to see if the code exists; if it does, the offence is missing reference, not missing work.
   - **DRIFT-B — Code exists but unchecked.** `state === ' '` but a file matching the task's owned path exists with non-trivial content. Map task ID → expected primary file from CLAUDE.local.md's "Files I Own" table. If the file exists and is >20 lines, flag.
   - **DRIFT-C — Partial without progress.** `state === '~'` and the trailing reason was written more than 4 weeks ago (check via `git log -1 --format=%cs -- CLAUDE.local.md`). Surface so the user re-evaluates whether the gap is still real.
   - **DRIFT-D — Partial that is now whole.** `state === '~'`, reason mentions a blocker (e.g. "waiting on I-ELE-05"), and that blocker is now `- [x]`. Likely safe to upgrade to `- [x]`.
4. **Verify `- [~]` reasons are still load-bearing.** For each partial, grep the reason for referenced files/IDs and check whether the gap actually persists. Example: a partial that says "still owed: minify call" — grep `src/export/index.ts` for `minify` to confirm.
5. **Surface the milestone impact.** For every drift entry, look up which milestone (M1–M5) the task gates (CLAUDE.local.md Milestone Gates section). Drift on M4-gating tasks is higher priority than M5.

## Output Format

Four sections, each a table:

- **DRIFT-A: Checked, no commit trail** — `ID | File | Last commit touching file | Suggested action`.
- **DRIFT-B: Code exists, box unchecked** — `ID | File | Lines of evidence | Owning milestone`.
- **DRIFT-C: Stale partials** — `ID | Reason age (weeks) | Reason summary | Likely status`.
- **DRIFT-D: Partial likely now whole** — `ID | Reason | Blocker (resolved) | Suggested action`.

End with a verdict:

- **CLEAN** — zero drift.
- **MINOR** — only DRIFT-A or DRIFT-D; cosmetic.
- **MAJOR** — any DRIFT-B or stale DRIFT-C on an M1–M4 gating task.

Do **not** edit `CLAUDE.local.md` unilaterally — only propose specific line edits the user can approve.
