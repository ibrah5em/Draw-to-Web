Run the pre-push gate defined in `.claude/rules/git.md`. Every push to `main` (and CI) requires all three to pass.

1. Run `npm run lint`. Report any failures inline.
2. Run `npm run typecheck`. Report any failures inline.
3. Run `npm run test`. Report any failures inline.

If all three pass, say "preflight: OK — safe to push" and stop.

If any fail:

- Do NOT push.
- Do NOT skip hooks (`--no-verify`) or bypass checks.
- Diagnose the failure and propose a fix in the same response.
- Remind the user that the fix needs a new commit, then preflight must be re-run.
