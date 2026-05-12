import type { SemanticElement } from '../engine'
import type { GeneratedOutput } from '../shared/types'
import { emitHtml } from './htmlEmitter'
import { emitCss } from './cssEmitter'

export type { GeneratedOutput }

/**
 * Traverses the semantic element tree and emits a complete HTML document + CSS stylesheet.
 * Generated output contains no JavaScript. Layout uses CSS Grid/Flexbox only.
 * Deterministic: identical input always produces identical output.
 * @param elements - Semantic element tree produced by the inference engine
 */
export function generate(elements: SemanticElement[]): GeneratedOutput {
  const bodyContent = emitHtml(elements)
  const css = emitCss(elements)

  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '    <link rel="stylesheet" href="styles.css" />',
    '  </head>',
    '  <body>',
    '    <div class="dtw-canvas">',
    bodyContent
      .split('\n')
      .map((line) => `      ${line}`)
      .join('\n'),
    '    </div>',
    '  </body>',
    '</html>',
  ].join('\n')

  return { html, css }
}
