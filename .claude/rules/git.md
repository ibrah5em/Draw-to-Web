# Git Workflow

- Conventional commits: `feat|fix|refactor|docs|test(scope): message`
- Scopes: `document`, `store`, `ui`, `canvas`, `generator`, `runtime`, `seo`, `export`, `electron`, `ci`
- Reference the task ID from `docs/0.2.0v/plan.md` Section 10 in the commit body when one applies (e.g. `feat(generator): emit skip-to-content link\n\nI-GEN-19`)
- Squash-merge feature branches into main
- Never force-push to main
- Run `npm run test` before every commit
- **Before every `git push`, run all three: `npm run lint`, `npm run typecheck`, `npm run test`.** The husky pre-push hook (`.husky/pre-push`, installed automatically by `npm install` via the `prepare` script) runs these on every push and aborts on failure. Never bypass with `--no-verify`. CI (`.github/workflows/ci.yml`) runs the same three commands; pushing a known-failing build wastes Actions minutes and breaks main. Markdown edits that change cell widths in a prettier-formatted table will fail lint until the table is re-padded (`npx prettier --write <file>`)
- Any change to a Section 6 contract (C1–C12) requires a PR labeled `contract-change` and a review from the downstream consumer named in that contract row
- Tag releases: `v0.1.0` (shipped), `v0.2.0` (M4 / Runtime + Output Hardening), `v0.3.0` (M5 polish), `v1.0.0` (sprint demo cut)
- Never add a Claude co-author or any AI attribution to commit messages (no `Co-Authored-By: Claude` lines)
- When commenting on PRs, issues, or reviews via GitHub MCP, post as the authenticated GitHub user only — no AI signatures, no "as Claude", no bot disclaimers
