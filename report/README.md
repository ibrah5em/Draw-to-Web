# Draw-to-Web — Graduation Report (LaTeX scaffold)

A ready-to-write LaTeX skeleton for the project report. Structure, real figures,
a starter bibliography, and per-section **sources maps** are in place; the prose
is partly drafted from the repo docs and partly marked `% TODO` for you.

> This folder is **not committed** to the repo yet. Move it, commit it, or add
> `report/` to `.gitignore` as you prefer — it's your academic deliverable, kept
> separate from the product source on purpose.

## Build

```bash
# from report/
latexmk -pdf main.tex        # recommended (handles biber automatically)
# or manually:
pdflatex main.tex && biber main && pdflatex main.tex && pdflatex main.tex
```

**Overleaf:** upload the `report/` folder as-is. It already contains the figures
under `figures/`, so it is self-contained. Set the compiler to _pdfLaTeX_ and the
bibliography runs via _biber_ (Overleaf default).

Requirements: a TeX distribution (TeX Live / MiKTeX) with `biber`, or Overleaf.

## Layout

```
report/
  main.tex                 # documentclass, packages, title page, TOC, \input list
  references.bib           # starter bibliography (real, citable keys)
  figures/                 # the 5 project diagrams (PNG) + their .mmd sources
  sections/
    00-abstract.tex        # write LAST
    01-introduction.tex    … 11-results-conclusion.tex
```

## How to work through it

1. Fill the **title page** placeholders in `main.tex` (`<UNIVERSITY NAME>`, etc.).
2. Go chapter by chapter. Each file starts with a `% SOURCES:` block naming the
   repo files that back it — write from those, not from memory.
3. Content already drafted is **real but review it**; `% TODO` marks what's yours.
4. Produce the three UML diagrams in ch. 7 (class / use-case / sequence) — PlantUML
   starters are in the source comments; render them into `figures/`.
5. **Do not invent the pending performance numbers** (render-layer FPS, rehearsal
   outcomes). They're tracked in issue #95 and marked as pending in ch. 10–11.

## Sources map (chapter → repo evidence)

| Chapter                 | Backing files                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| 1 Introduction          | `README.md`, `draft/Features/features.md`, `docs/0.2.0v/plan.md §1–2`                                     |
| 2 Objective             | `docs/0.2.0v/plan.md §1,§4`, `CLAUDE.md` (design rules)                                                   |
| 3 Methodology           | `docs/0.2.0v/plan.md §4,§6,§17`, `.claude/rules/*`, `docs/1.0.0v/supervisor-report.md §8`                 |
| 4 Implementation plan   | `docs/0.2.0v/plan.md §10,§17`, `CHANGELOG.md`, `DECISIONS.md`                                             |
| 5 Requirements          | `draft/Features/features.md`, `docs/0.2.0v/plan.md §5,§11,§12`                                            |
| 6 Reference study       | external (verify) + `draft/Features/*` for positioning                                                    |
| 7 Analysis (UML)        | `docs/diagrams/*` (in `figures/`), `docs/0.2.0v/{architecture,element-model}.md`, `src/document/types.ts` |
| 8 Technologies          | `README.md` (Stack), `docs/0.2.0v/plan.md §9` (library→feature justification)                             |
| 9 Implementation        | `docs/0.2.0v/architecture.md`, `docs/1.0.0v/supervisor-report.md §4–6,§5a`, `src/*`                       |
| 10 Testing & evaluation | `docs/0.2.0v/plan.md §13,§14`, `docs/1.0.0v/supervisor-report.md §7,§10`, `perf-capture-checklist.md`     |
| 11 Results & conclusion | `docs/1.0.0v/supervisor-report.md §9,§12,§13`, `DECISIONS.md`, `draft/Features/future-*.md`               |

## Figures included

`01-architecture`, `02-dataflow`, `03-export-pipeline`, `04-component-hierarchy`,
`05-state-stores` (PNG + Mermaid `.mmd` source), copied from `docs/diagrams/`.
Regenerate from the `.mmd` sources with the Mermaid CLI if you restyle them.
