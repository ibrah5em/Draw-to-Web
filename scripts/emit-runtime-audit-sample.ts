/**
 * Emit a portfolio-template bundle with every runtime flag on, for use
 * with `.claude/skills/runtime-audit`.
 *
 * Run via `npm run audit:sample`. Writes `tests/fixtures/output/`:
 *
 *   - `index.html`     — full HTML envelope (head + body + script tag)
 *   - `styles.css`     — generator-emitted CSS
 *   - `scripts.js`     — runtime IIFE concatenating every enabled snippet
 *   - `document.json`  — the source `Document` used as input, so an
 *                        auditor can cross-reference the runtime flags
 *
 * Output is deterministic; re-running this script with no source change
 * produces byte-identical files. CI does not run this — it is an
 * authoring aid for the manual runtime audit.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { generate } from '../src/generator'
import { createPortfolioTemplate } from '../src/templates/portfolio'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(HERE, '..', 'tests', 'fixtures', 'output')

async function main(): Promise<void> {
  const base = createPortfolioTemplate()
  const doc = {
    ...base,
    runtime: {
      themeToggle: true,
      scrollSpy: true,
      smoothScroll: true,
      mobileNav: true,
      navOnScroll: true,
      reveals: true,
      animationGating: true,
      terminalTyping: true,
    },
  }

  const { html, css, js } = await generate(doc)

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, 'index.html'), html, 'utf8')
  writeFileSync(resolve(OUT_DIR, 'styles.css'), css, 'utf8')
  writeFileSync(resolve(OUT_DIR, 'scripts.js'), js, 'utf8')
  writeFileSync(resolve(OUT_DIR, 'document.json'), JSON.stringify(doc, null, 2), 'utf8')

  process.stdout.write(
    `[audit-sample] wrote ${OUT_DIR}\n` +
      `  index.html  ${html.length} bytes\n` +
      `  styles.css  ${css.length} bytes\n` +
      `  scripts.js  ${js.length} bytes\n`
  )
}

main().catch((err) => {
  process.stderr.write(`[audit-sample] failed: ${(err as Error).stack ?? String(err)}\n`)
  process.exit(1)
})
