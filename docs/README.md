# Documentation

The single home for all Draw-to-Web documentation. Product source lives in
[`../src/`](../src/); the target output and feature specs live in
[`../draft/`](../draft/).

## Top-level

| Path                           | What it is                                                       |
| ------------------------------ | ---------------------------------------------------------------- |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history (v0.1.0 → v1.0.0).                               |
| [`DECISIONS.md`](DECISIONS.md) | Architecture / scope decision log (D-01 … D-04).                 |
| [`guides/`](guides/)           | Developer guide + user manual (PDF).                             |
| [`report/`](report/README.md)  | LaTeX graduation report — self-contained (figures + UML, biber). |

## Versioned docs

Draw-to-Web is task-driven; each version folder holds the docs current at that
cut. **`0.2.0v/plan.md` is the sprint source of truth** for what was built.

| Path                 | What it is                                                              |
| -------------------- | ----------------------------------------------------------------------- |
| [`1.0.0v/`](1.0.0v/) | Current cut — supervisor report, demo run-sheet, perf checklist.        |
| [`0.2.0v/`](0.2.0v/) | Execution plan (`plan.md`), architecture, element model, perf baseline. |
| [`0.1.0v/`](0.1.0v/) | Archived v0.1.0 docs (old architecture, roles) — historical.            |

## Diagrams

The five architecture diagrams and four UML diagrams (class, use-case, two
sequence) live under [`report/figures/`](report/figures/) as PNG **plus** their
Mermaid `.mmd` sources. That folder is the canonical home — regenerate the PNGs
from the `.mmd` files with the Mermaid CLI if you restyle them. The report itself
renders the UML natively in TikZ (see [`report/README.md`](report/README.md)).
