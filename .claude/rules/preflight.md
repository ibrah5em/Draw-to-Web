# Preflight Checks

Rules that prevent the class of bugs that slipped through before.

## Before using any npm package API

Always verify the installed version and its actual exports before writing code against it:

```bash
node -e "console.log(require('./node_modules/<pkg>/package.json').version)"
node -e "console.log(Object.keys(require('./node_modules/<pkg>')))"
```

Do not assume the API from documentation or training data — package versions in this repo
may differ. Read the installed `.d.ts` if the export list is not enough.

## Renderer typecheck is a separate tsconfig

`npm run typecheck` uses the root `tsconfig.json` which covers only `src/main/` and
`src/preload/`. It does **not** cover the renderer.

For any change touching `src/renderer/`:

```bash
npx tsc -p tsconfig.web.json --noEmit
```

This must pass before committing or pushing. Add it to every pre-push run alongside the
standard three (`lint`, `typecheck`, `test`).

## Lane boundaries — do not fix what you don't own

Errors in these files belong to Ibrahim — flag them, do not patch them:

- `src/document/`
- `src/generator/`
- `src/seo/`
- `src/export/`
- `src/main/`
- `src/preload/`
- `src/shared/`

Errors in `src/store/` belong to Yousef.

Fixing cross-lane code without a `contract-change` PR causes silent regressions.
