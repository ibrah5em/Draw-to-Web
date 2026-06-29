/**
 * Shared output schemas for machine-readable tool results.
 *
 * Every tool declares an `outputSchema` (built from these raw shapes) and
 * returns matching `structuredContent`, so MCP clients get parseable data
 * (ids, validation, a11y, bytes) instead of only prose. Error results set
 * `isError` and are exempt from these schemas.
 */

import { z } from 'zod'

/** A validation/operation issue, machine-readable. */
export const issueSchema = z.object({
  message: z.string(),
  nodeId: z.string().optional(),
  fix: z.string().optional(),
})
export type Issue = z.infer<typeof issueSchema>

/** A flat node descriptor; hierarchy is recoverable via `parentId` + `depth`. */
export const nodeDescriptorSchema = z.object({
  id: z.string(),
  type: z.string(),
  tag: z.string().optional(),
  name: z.string().optional(),
  semanticRole: z.string().optional(),
  gridColumn: z.string().optional(),
  content: z.string().optional(),
  parentId: z.string().optional(),
  depth: z.number(),
})
export type NodeDescriptor = z.infer<typeof nodeDescriptorSchema>

/** Raw shape (for `outputSchema`) describing a whole document's state. */
export const documentStateShape = {
  documentId: z.string(),
  name: z.string(),
  version: z.string(),
  nodeCount: z.number(),
  nodes: z.array(nodeDescriptorSchema),
  validation: z.object({
    errors: z.array(issueSchema),
    warnings: z.array(issueSchema),
    infos: z.array(issueSchema),
  }),
} as const
export const documentStateSchema = z.object(documentStateShape)
export type DocumentState = z.infer<typeof documentStateSchema>

/** Raw shape for the a11y check result. */
export const a11yOutputShape = {
  documentId: z.string(),
  passed: z.boolean(),
  counts: z.object({
    critical: z.number(),
    serious: z.number(),
    moderate: z.number(),
    minor: z.number(),
  }),
  violations: z.array(
    z.object({
      id: z.string(),
      impact: z.string(),
      help: z.string(),
      nodes: z.number(),
      helpUrl: z.string(),
    })
  ),
  validationErrors: z.array(issueSchema),
} as const

/** Raw shape for the export result. */
export const exportOutputShape = {
  documentId: z.string(),
  success: z.boolean(),
  filePath: z.string().optional(),
  stage: z.string().optional(),
  error: z.string().optional(),
  a11yPassed: z.boolean().optional(),
} as const

/** Raw shape for the dry-run HTML preview. */
export const previewOutputShape = {
  documentId: z.string(),
  html: z.string(),
  css: z.string(),
  js: z.string(),
} as const

/** Raw shape for match_layout. */
export const matchOutputShape = {
  documentId: z.string(),
  matches: z.array(
    z.object({
      pageId: z.string(),
      name: z.string(),
      score: z.number(),
      breakdown: z.object({
        sequence: z.number(),
        region: z.number(),
        content: z.number(),
      }),
    })
  ),
} as const
