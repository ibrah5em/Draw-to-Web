/**
 * JS emitter (I-GEN-15).
 *
 * Concatenates the runtime snippets enabled by `document.runtime` into a
 * single IIFE. Inputs come from `src/runtime/index.ts`'s registry; any
 * flag whose snippet has not been authored yet is silently skipped. When
 * **every** flag is `false` (or every enabled snippet is missing), the
 * emitter returns the empty string so the HTML composer omits the
 * `<script>` tag entirely — the DoD for I-GEN-15.
 *
 * Minification (`terser`) is a concern of the export pipeline, not this
 * function (I-GEN-16). The string returned here is human-readable.
 */

import type { Document, RuntimeFlags } from '../document/types'
import { RUNTIME_SNIPPETS } from '../runtime'

/** Stable order so the emitted output is deterministic regardless of object key order. */
const FLAG_ORDER: ReadonlyArray<keyof RuntimeFlags> = [
  'themeToggle',
  'scrollSpy',
  'smoothScroll',
  'mobileNav',
  'navOnScroll',
  'reveals',
  'animationGating',
  'terminalTyping',
]

/**
 * Returns the IIFE-wrapped runtime snippet bundle, or the empty string
 * when no enabled snippet contributes code. Caller decides whether to
 * emit a `<script>` tag.
 */
export function emitJs(doc: Document): string {
  const pieces: string[] = []
  for (const flag of FLAG_ORDER) {
    if (!doc.runtime[flag]) continue
    const code = RUNTIME_SNIPPETS[flag]
    if (code === undefined || code.length === 0) continue
    pieces.push(`  /* ${flag} */\n${indent(code, 2)}`)
  }
  if (pieces.length === 0) return ''
  return `(function () {\n${pieces.join('\n\n')}\n})();\n`
}

function indent(src: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return src
    .split('\n')
    .map((line) => (line.length === 0 ? line : pad + line))
    .join('\n')
}
