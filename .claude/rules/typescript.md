---
paths:
  - 'src/**/*.ts'
  - 'src/**/*.tsx'
---

# TypeScript Conventions

- Strict mode enabled across all three tsconfigs (main, preload, renderer).
- **No `any`.** Use `unknown` + type guards or Zod parsing at boundaries (IPC, file load). Enforced by ESLint.
- Every exported function in `src/document/`, `src/generator/`, `src/seo/`, `src/export/`, `src/runtime/`, `src/main/`, `src/preload/` has a JSDoc comment.
- Path aliases: `@document/`, `@store/`, `@ui/`, `@generator/`, `@runtime/`, `@seo/`, `@export/`, `@main/`, `@preload/`, `@shared/`. Configure once per tsconfig.
- Interfaces for data shapes; types for unions / intersections.
- `readonly` on document data exposed outside an immer draft.
- Named exports only (no default exports).
- File names: kebab-case for modules, PascalCase for React components.
- Zod schemas mirror every `src/document/types.ts` shape via `type X = z.infer<typeof xSchema>`; lockstep is asserted at compile time.
- Validate at the edge, trust inside: Zod at IPC and file-load boundaries; pure TypeScript types between modules.
