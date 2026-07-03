# Draw-to-Web — Graduation Report (LaTeX)

The full project report. Every chapter is written from the repository evidence
(the `% SOURCES:` block at the top of each `sections/*.tex` names the backing
files), the bibliography is in place, and **all UML diagrams are embedded** —
the class, use-case, and two sequence diagrams are drawn natively in TikZ inside
`sections/07-analysis.tex`, so the report is self-contained and needs no external
diagram tool (no PlantUML/Mermaid/Java/dot).

What is left for you: a few identity details on the title page in `main.tex` that
cannot be derived from the repo — the third author's student ID (`[ID]`), the
supervisor's name (`[Supervisor Name]`), the university logo, and (optionally) the
Arabic title. The performance numbers in ch. 10 are the verified headless figures;
the render-layer numbers are reported honestly as pending (issue #95) — do not
invent them.

> This folder is your academic deliverable. It lives under `docs/report/` with the
> rest of the project documentation, but stays fully self-contained so you can move
> or upload it on its own.

## Build

```bash
# from report/
latexmk -pdf main.tex        # recommended (handles biber automatically)
# or manually:
pdflatex main.tex && biber main && pdflatex main.tex && pdflatex main.tex
```

**Overleaf:** upload the `docs/report/` folder as-is. It already contains the figures
under `figures/`, so it is self-contained. Set the compiler to _pdfLaTeX_ and the
bibliography runs via _biber_ (Overleaf default).

Requirements: a TeX distribution (TeX Live / MiKTeX) with `biber`, or Overleaf.

## Layout

```
docs/report/
  main.tex                 # documentclass, packages, title page, TOC, \input list
  references.bib           # starter bibliography (real, citable keys)
  figures/                 # 5 architecture diagrams + 4 UML diagrams (PNG + .mmd sources)
  sections/
    00-abstract.tex        # write LAST
    01-introduction.tex    … 11-results-conclusion.tex
```

## How to work through it

1. Fill the two title-page placeholders in `main.tex` (`[ID]`, `[Supervisor Name]`),
   add the university logo, and (optionally) the Arabic title.
2. Read through chapter by chapter and adjust wording to your voice. Each file
   starts with a `% SOURCES:` block naming the repo files that back it.
3. The four UML diagrams in ch. 7 (class, use-case, and two sequence diagrams) are
   already drawn in TikZ; the styles are defined in `main.tex`. Edit them there if
   you want to restyle.
4. **Do not invent the pending performance numbers** (render-layer FPS, rehearsal
   outcomes). They're tracked in issue #95 and reported as pending in ch. 10–11.

## Sources map (chapter → repo evidence)

| Chapter                 | Backing files                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| 1 Introduction          | `README.md`, `draft/Features/features.md`, `docs/0.2.0v/plan.md §1–2`                                 |
| 2 Objective             | `docs/0.2.0v/plan.md §1,§4`, `CLAUDE.md` (design rules)                                               |
| 3 Methodology           | `docs/0.2.0v/plan.md §4,§6,§17`, `.claude/rules/*`, `docs/1.0.0v/supervisor-report.md §8`             |
| 4 Implementation plan   | `docs/0.2.0v/plan.md §10,§17`, `docs/CHANGELOG.md`, `docs/DECISIONS.md`                               |
| 5 Requirements          | `draft/Features/features.md`, `docs/0.2.0v/plan.md §5,§11,§12`                                        |
| 6 Reference study       | external (verify) + `draft/Features/*` for positioning                                                |
| 7 Analysis (UML)        | `figures/*` (PNG + `.mmd`), `docs/0.2.0v/{architecture,element-model}.md`, `src/document/types.ts`    |
| 8 Technologies          | `README.md` (Stack), `docs/0.2.0v/plan.md §9` (library→feature justification)                         |
| 9 Implementation        | `docs/0.2.0v/architecture.md`, `docs/1.0.0v/supervisor-report.md §4–6,§5a`, `src/*`                   |
| 10 Testing & evaluation | `docs/0.2.0v/plan.md §13,§14`, `docs/1.0.0v/supervisor-report.md §7,§10`, `perf-capture-checklist.md` |
| 11 Results & conclusion | `docs/1.0.0v/supervisor-report.md §9,§12,§13`, `docs/DECISIONS.md`, `draft/Features/future-*.md`      |

## Figures

**Architecture (PNG, under `figures/`):** `01-architecture`, `02-dataflow`,
`03-export-pipeline`, `04-component-hierarchy`, `05-state-stores`, each with its
Mermaid `.mmd` source alongside. `figures/` is now the canonical home for these
(the former duplicate `docs/diagrams/` copies were removed). Regenerate from the
`.mmd` sources with the Mermaid CLI if you restyle them.

**UML (native TikZ, in `sections/07-analysis.tex`):** the class diagram of the
Document Model (generated from `src/document/types.ts`), the use-case diagram, and
two sequence diagrams (draw-to-create and the export pipeline). These are code, not
images, so they always compile with the report and never go stale. Portable Mermaid
equivalents are also kept in `figures/` (`uml-class`, `uml-usecase`, `uml-seq-draw`,
`uml-seq-export`, each as `.mmd` + `.png`) for reuse outside LaTeX — the compiled
report renders the TikZ versions, not these.
