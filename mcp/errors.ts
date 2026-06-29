/**
 * Tool result helpers — readable success + structured, recoverable errors.
 *
 * Errors are returned as tool results with `isError: true` (NOT thrown), so an
 * MCP client receives a normal, parseable result describing what was rejected,
 * why, and how to fix it — the agent can recover without a protocol failure.
 */

import type { MutationIssue } from './mutate'

/**
 * Minimal shape of an MCP tool result (text content + optional error flag).
 * Arrays are mutable to satisfy the SDK's `CallToolResult` handler return type.
 */
export interface ToolResult {
  // Index signature mirrors the SDK's `CallToolResult` so handler returns are
  // structurally assignable.
  [key: string]: unknown
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

/**
 * A successful tool result carrying the agent-facing text (usually a summary)
 * plus optional machine-readable `structuredContent` matching the tool's
 * declared `outputSchema`.
 */
export function ok(text: string, structuredContent?: Record<string, unknown>): ToolResult {
  const result: ToolResult = { content: [{ type: 'text', text }] }
  if (structuredContent !== undefined) result.structuredContent = structuredContent
  return result
}

/**
 * A structured, recoverable error result. Renders a title, each issue with its
 * fix, and a machine-readable JSON block so the agent can branch on it.
 *
 * @param title - What was rejected (one line).
 * @param issues - The specific problems + fixes.
 * @param extra - Optional extra structured fields (e.g. `{ documentId }`).
 */
export function fail(
  title: string,
  issues: ReadonlyArray<MutationIssue>,
  extra: Record<string, unknown> = {}
): ToolResult {
  const lines = [title]
  for (const i of issues) {
    lines.push(`  • ${i.message}${i.nodeId ? ` [#${i.nodeId}]` : ''}`)
    if (i.fix) lines.push(`    fix: ${i.fix}`)
  }
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify({ error: title, issues, ...extra }, null, 2))
  lines.push('```')
  return { content: [{ type: 'text', text: lines.join('\n') }], isError: true }
}
