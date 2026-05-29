---
description: Detect cross-owner contract changes (C1–C12), identify the named downstream consumer, and verify the PR carries the `contract-change` label + review request. Use when the user mentions a contract change, when a PR touches a contract file, or before opening any PR.
invocation: user
---

## Context

`docs/0.2.0v/plan.md` Section 6 defines **12 sharp interfaces (C1–C12)** between Ibrahim, LuF8y, and Yousef. Per `.claude/rules/git.md` and `CLAUDE.md`, **any change to a contract file requires a PR labeled `contract-change` and a review request from the named downstream consumer.** Silent contract breaks cause the cross-lane regressions called out in `.claude/rules/preflight.md`.

## Contract Registry

Source of truth: `docs/0.2.0v/plan.md` Section 6. Producer → file → downstream consumer(s):

| ID  | Producer | File | Downstream consumer(s) |
| --- | -------- | ---- | ---------------------- |
| C1  | Ibrahim  | `src/document/types.ts` | LuF8y, Yousef |
| C2  | Ibrahim  | `src/document/schemas.ts` | Yousef |
| C3  | Ibrahim  | `src/document/operations.ts` | Yousef |
| C4  | Ibrahim  | `src/shared/electronAPI.d.ts` (+ `src/preload/index.ts`) | LuF8y, Yousef |
| C5  | Yousef   | `src/store/documentStore.ts`, `historyStore.ts`, `sessionStore.ts` | LuF8y, Ibrahim |
| C6  | Ibrahim  | `src/generator/index.ts` | self (export) |
| C7  | Ibrahim  | `src/document/presets/index.ts` | LuF8y, Yousef |
| C8  | Ibrahim  | `src/document/validation.ts` | LuF8y, self |
| C9  | Ibrahim  | `src/document/tokens.ts` | LuF8y |
| C10 | LuF8y    | `src/ui/canvas/inferSemantics.ts` | Ibrahim |
| C11 | Ibrahim  | `src/main/ipc.ts` (image upload) + `src/preload/index.ts` | LuF8y |
| C12 | Ibrahim  | `src/export/index.ts` | LuF8y |

## Instructions

1. **Collect the diff.**
   - On a branch with no PR yet: `git diff --name-only origin/main...HEAD`.
   - On an open PR: `gh pr view --json files -q '.files[].path'` (preferred — handles squash bases).
2. **Match touched files against the registry above.** A file may map to multiple contracts (`src/preload/index.ts` is part of both C4 and C11) — flag all matches.
3. For each match, classify the change:
   - **Type-level break** — removed export, renamed export, changed function signature, narrowed/widened a Zod schema, changed `Operation` discriminator, added a required field.
   - **Additive non-break** — added optional field, added new export, widened a union with all consumers still covered by the default branch.
   - **Internal-only** — JSDoc, comments, dead-code removal, test-only changes. Not a contract change.
   Run `git diff origin/main...HEAD -- <file>` to inspect.
4. **For type-level breaks, verify the PR ritual:**
   - Has the `contract-change` label: `gh pr view --json labels -q '.labels[].name' | grep contract-change`.
   - Has a review request from every named downstream consumer (map name → GitHub handle: Ibrahim=`ibrah5em`, LuF8y=`<handle>`, Yousef=`<handle>` — ask the user if unknown). `gh pr view --json reviewRequests -q '.reviewRequests[].login'`.
   - PR body lists the contract IDs affected and what changed.
5. **For additive non-breaks**, no label is required but the PR body should still mention the contract ID so downstream consumers can opt in.
6. If a contract is broken and the ritual is missing:
   - Offer to `gh pr edit --add-label contract-change`.
   - Offer to `gh pr edit --add-reviewer <handle>`.
   - Offer to append a PR-body section listing the touched contracts + migration notes for the downstream consumer.
7. If migrations are owed (C1/C2 type shape change), check `src/document/migrations.ts` registers a bump from the current `documentSchema` version to the next. Flag if missing.

## Output Format

Markdown table: **Contract | File | Change type | Downstream consumer | Ritual status | Action**.

End with one of:

- **CLEAN** — no contract files touched, or all changes are additive non-breaks.
- **READY** — type-level break detected and ritual is fully satisfied.
- **BLOCKED** — type-level break detected, ritual incomplete. List the exact `gh` commands to run.

When BLOCKED, do not open or merge the PR until ritual is satisfied. Surface the migration owe-back if it applies.
