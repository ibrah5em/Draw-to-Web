## Summary

<!-- 1–3 sentences. What changed and why. -->

## Task ID

<!-- e.g. I-GEN-19, L-TOP-04, Y-STR-02. See Section 10 of docs/0.2.0v/plan.md. -->

Task: <!-- ID here -->

## Checklist

- [ ] Conventional commit (`feat|fix|refactor|docs|test(scope): …`)
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` + `npm run typecheck:web` pass
- [ ] `npm test` passes
- [ ] Per-PR skill sweep run if applicable (see CLAUDE.local.md — `/accessibility-audit`, `/runtime-audit`, `/seo-check`, `/token-validate`, `/export-test`)
- [ ] If this touches a C1–C12 contract: PR labeled `contract-change` and review requested from the named downstream consumer
- [ ] CLAUDE.local.md task checkbox flipped to `- [x]` (or `- [~]` with reason) in the same commit

## Notes for reviewer

<!-- Anything non-obvious: tricky edge case, deliberate trade-off, follow-up. -->
