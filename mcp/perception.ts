/**
 * The perception channel — how the agent "sees" a document it cannot render.
 *
 * `summarizeDocument` produces a compact, readable outline of the tree
 * (structure, element types, tags, grid placements) plus the live validation
 * state, so every mutating tool can return the resulting document and the
 * agent never edits blind. `documentTreeJson` backs the read resource.
 */

import { validateDocument } from '../src/document/validation'
import type { Document, ElementNode } from '../src/document/types'

import type { DocumentState, Issue, NodeDescriptor } from './schemas'

/** One-line descriptor for a node: type, tag/role, grid placement, content. */
function describeNode(node: ElementNode): string {
  const bits: string[] = [node.type]
  if (node.type === 'text') bits.push(node.tag)
  if (node.type === 'container') {
    const layout = node.layout.base
    bits.push(layout.mode === 'grid' ? `grid ${layout.gridTemplateColumns ?? ''}`.trim() : 'flex')
    if (node.semanticRole) bits.push(`<${node.semanticRole}>`)
  }
  const grid = node.style.base.gridColumn
  if (grid) bits.push(`col ${grid}`)

  let label = `[${bits.join(', ')}] #${node.id}`
  if (node.type === 'text' || node.type === 'button' || node.type === 'link') {
    const text = node.content.trim()
    if (text) label += ` "${text.length > 32 ? `${text.slice(0, 32)}…` : text}"`
  }
  if (node.type === 'image') label += ` alt=${JSON.stringify(node.alt)}`
  if (node.name) label += ` (${node.name})`
  return label
}

/** Recursively render the tree as an indented outline. */
function outline(node: ElementNode, depth: number, lines: string[]): void {
  lines.push(`${'  '.repeat(depth)}- ${describeNode(node)}`)
  if (node.type === 'container') {
    for (const child of node.children) outline(child, depth + 1, lines)
  }
}

/**
 * Build a readable, agent-facing summary of a document: header, tree outline,
 * and the current validation report (errors block export; warnings/infos are
 * advisory). Returned by every mutating tool so the agent sees the result.
 *
 * @param doc - The document to summarise.
 * @param id - The session id the document is held under.
 */
export function summarizeDocument(doc: Document, id: string): string {
  const lines: string[] = []
  lines.push(`Document "${doc.meta.name}" (id: ${id}) — schema v${doc.version}`)
  lines.push('Tree:')
  outline(doc.tree, 1, lines)

  const report = validateDocument(doc)
  const fmt = (issues: typeof report.errors): string =>
    issues
      .map(
        (i) =>
          `  • ${i.message}${i.nodeId ? ` [#${i.nodeId}]` : ''}${i.fix ? ` — fix: ${i.fix}` : ''}`
      )
      .join('\n')

  lines.push('')
  lines.push(
    `Validation: ${report.errors.length} error(s), ${report.warnings.length} warning(s), ${report.infos.length} info(s)`
  )
  if (report.errors.length > 0) lines.push('Errors (block export):', fmt(report.errors))
  if (report.warnings.length > 0) lines.push('Warnings:', fmt(report.warnings))
  return lines.join('\n')
}

/** Pretty-printed full document JSON for the read resource. */
export function documentTreeJson(doc: Document): string {
  return JSON.stringify(doc, null, 2)
}

/** Flatten a node into a descriptor (hierarchy via `parentId` + `depth`). */
function describe(node: ElementNode, parentId: string | undefined, depth: number): NodeDescriptor {
  const d: NodeDescriptor = { id: node.id, type: node.type, depth }
  if (parentId) d.parentId = parentId
  if (node.name) d.name = node.name
  if (node.type === 'text') d.tag = node.tag
  if (node.type === 'container' && node.semanticRole) d.semanticRole = node.semanticRole
  const grid = node.style.base.gridColumn
  if (grid) d.gridColumn = grid
  if (node.type === 'text' || node.type === 'button' || node.type === 'link') {
    if (node.content.trim()) d.content = node.content
  }
  return d
}

/** Walk the tree into a flat descriptor list, pre-order. */
function flatten(
  node: ElementNode,
  parentId: string | undefined,
  depth: number,
  out: NodeDescriptor[]
): void {
  out.push(describe(node, parentId, depth))
  if (node.type === 'container') {
    for (const child of node.children) flatten(child, node.id, depth + 1, out)
  }
}

/**
 * Build the machine-readable {@link DocumentState} returned as
 * `structuredContent` by every mutating tool: a flat node list plus the live
 * validation report. Pairs with {@link summarizeDocument} (the human view).
 */
export function buildDocumentState(doc: Document, id: string): DocumentState {
  const nodes: NodeDescriptor[] = []
  flatten(doc.tree, undefined, 0, nodes)
  const report = validateDocument(doc)
  const map = (
    issues: ReadonlyArray<{ message: string; nodeId?: string; fix?: string }>
  ): Issue[] => issues.map((i) => ({ message: i.message, nodeId: i.nodeId, fix: i.fix }))
  return {
    documentId: id,
    name: doc.meta.name,
    version: doc.version,
    nodeCount: nodes.length,
    nodes,
    validation: {
      errors: map(report.errors),
      warnings: map(report.warnings),
      infos: map(report.infos),
    },
  }
}
