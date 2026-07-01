/**
 * MCP server factory — registers the Draw-to-Web tools + resources on an
 * `McpServer` over a {@link Workspace}. Transport-agnostic so tests drive it
 * through an in-memory pair while `server.ts` wires it to stdio.
 *
 * Every tool is a THIN adapter: it resolves a document by id, builds an
 * existing operation (C3) — or calls the existing generate / a11y / export /
 * match / preset entry points — and returns the resulting state both as a
 * readable summary (content) and as machine-readable `structuredContent`
 * (matching the tool's `outputSchema`). No tree is mutated directly; no
 * validation, generation, or a11y logic is reimplemented.
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { nanoid } from 'nanoid'
import { z } from 'zod'

import type {
  AddTokenOp,
  InsertElementOp,
  InsertPresetOp,
  Operation,
  ReorderOp,
  UpdateNodeOp,
  UpdateNodeStyleOp,
  UpdateTokenOp,
  WrapInGroupOp,
} from '../src/document/operations'
import { validateDocument } from '../src/document/validation'
import { presetsRegistry } from '../src/document/presets'
import type { ColorTokenValue, ContainerNode, Document, TokenCategory } from '../src/document/types'
import { generate } from '../src/generator'
import { injectSEO, generateFullReport } from '../src/seo'
import { formatViolation } from '../src/seo/axeGate'
import { exportProject } from '../src/export'
import { buildLibraryDocumentById, findLayoutMatches, libraryPages } from '../src/match'
import { createPrimitive } from '../src/ui/sidebar/insertDrop'
import { cloneWithNewIds } from '../src/ui/canvas/clipboard'

import { fail, ok, type ToolResult } from './errors'
import { buildNode, validateGridPlacement, type NodeProps } from './nodeFactory'
import { buildDocumentState, documentTreeJson, summarizeDocument } from './perception'
import {
  a11yOutputShape,
  documentStateShape,
  exportOutputShape,
  matchOutputShape,
  previewOutputShape,
} from './schemas'
import { SessionError, Workspace } from './session'
import { containerColumns, findNode, findParent, treeHasH1 } from './tree'
import { elementTypeEnum, TEXT_TAGS, VOCABULARY } from './vocabulary'

/** Run a handler, converting a {@link SessionError} into a structured result. */
async function guard(run: () => Promise<ToolResult> | ToolResult): Promise<ToolResult> {
  try {
    return await run()
  } catch (err) {
    if (err instanceof SessionError) {
      return fail('Document not found', [
        {
          message: err.message,
          fix: 'Call create_document, apply_template, or load_document first.',
        },
      ])
    }
    throw err
  }
}

/** Token-editing categories an agent may set. */
const TOKEN_CATEGORIES = [
  'color',
  'spacing',
  'fontSize',
  'fontFamily',
  'lineHeight',
  'radius',
  'shadow',
] as const

/**
 * Build and configure an {@link McpServer} with the full Draw-to-Web toolset.
 *
 * @param workspace - The session store the tools operate on.
 * @returns The configured server, ready to `connect(transport)`.
 */
export function createServer(workspace: Workspace): McpServer {
  const server = new McpServer({ name: 'draw-to-web', version: '0.3.0' })

  /** Standard success: an action lead line + readable summary + structured state. */
  const state = (id: string, doc: Document, lead?: string): ToolResult =>
    ok(
      lead ? `${lead}\n\n${summarizeDocument(doc, id)}` : summarizeDocument(doc, id),
      buildDocumentState(doc, id)
    )

  /** Resolve a parent container or return a structured error. */
  const resolveParent = (doc: Document, parentId: string): ContainerNode | ToolResult => {
    const parent = findNode(doc.tree, parentId)
    if (!parent || parent.type !== 'container') {
      return fail('Invalid parent', [
        {
          message: `Element "${parentId}" is not a container; cannot insert into it.`,
          nodeId: parentId,
          fix: 'Target a container/section/group/card, or omit parentId to use the page root.',
        },
      ])
    }
    return parent
  }

  // === create_document ====================================================
  server.registerTool(
    'create_document',
    {
      title: 'Create document',
      description:
        'Create a new, empty document (a single page container) carrying the ' +
        'default token registry. Returns its id + state. A blank page has no ' +
        '<h1> yet, so add a heading before exporting.',
      inputSchema: { name: z.string().optional() },
      outputSchema: documentStateShape,
    },
    ({ name }) =>
      guard(() => {
        const { id, document } = workspace.create(name)
        return state(id, document, 'Created document.')
      })
  )

  // === insert_element =====================================================
  server.registerTool(
    'insert_element',
    {
      title: 'Insert element',
      description:
        'Insert one element via the existing insert operation. Pick a type from ' +
        'the vocabulary and an optional 1-based grid placement (gridColumnStart ' +
        '+ gridColumnSpan within the parent column count). Returns the resulting ' +
        'state, or a structured error (e.g. a second <h1>, bad grid span).',
      inputSchema: {
        documentId: z.string(),
        type: elementTypeEnum,
        parentId: z.string().optional(),
        index: z.number().int().min(0).optional(),
        gridColumnStart: z.number().int().optional(),
        gridColumnSpan: z.number().int().optional(),
        text: z.string().optional(),
        tag: z.enum(TEXT_TAGS).optional(),
        alt: z.string().optional(),
        href: z.string().optional(),
        iconName: z.string().optional(),
        items: z.array(z.string()).optional(),
        name: z.string().optional(),
      },
      outputSchema: documentStateShape,
    },
    (input) =>
      guard(() => {
        const doc = workspace.get(input.documentId)
        const parentId = input.parentId ?? doc.tree.id
        const parent = resolveParent(doc, parentId)
        if ('content' in parent) return parent // ToolResult error

        const columns = containerColumns(parent)
        const gridErr = validateGridPlacement(input.gridColumnStart, input.gridColumnSpan, columns)
        if (gridErr) return fail('Grid placement rejected', [gridErr], { parentColumns: columns })

        const node = buildNode(input.type, input as NodeProps, {
          pageHasH1: treeHasH1(doc.tree),
          breakpoint: 'base',
        })
        const op: InsertElementOp = { kind: 'insertElement', parentId, node, index: input.index }
        const result = workspace.applyOperation(input.documentId, op)
        if (!result.ok) {
          return fail(
            result.kind === 'validation'
              ? 'Insert rejected — would make the document invalid'
              : 'Insert rejected',
            result.errors,
            { documentId: input.documentId }
          )
        }
        return state(
          input.documentId,
          result.document,
          `Inserted ${input.type} #${node.id} into #${parentId}.`
        )
      })
  )

  // === batch_insert =======================================================
  server.registerTool(
    'batch_insert',
    {
      title: 'Batch insert',
      description:
        'Insert several elements into one parent in a single atomic call (all ' +
        'succeed or none are applied). Each element takes the same fields as ' +
        'insert_element. Ideal for building a whole section at once.',
      inputSchema: {
        documentId: z.string(),
        parentId: z.string().optional(),
        elements: z
          .array(
            z.object({
              type: elementTypeEnum,
              gridColumnStart: z.number().int().optional(),
              gridColumnSpan: z.number().int().optional(),
              text: z.string().optional(),
              tag: z.enum(TEXT_TAGS).optional(),
              alt: z.string().optional(),
              href: z.string().optional(),
              iconName: z.string().optional(),
              items: z.array(z.string()).optional(),
              name: z.string().optional(),
            })
          )
          .min(1),
      },
      outputSchema: documentStateShape,
    },
    (input) =>
      guard(() => {
        const doc = workspace.get(input.documentId)
        const parentId = input.parentId ?? doc.tree.id
        const parent = resolveParent(doc, parentId)
        if ('content' in parent) return parent
        const columns = containerColumns(parent)
        const pageHasH1 = treeHasH1(doc.tree)

        const ops: Operation[] = []
        for (const el of input.elements) {
          const gridErr = validateGridPlacement(el.gridColumnStart, el.gridColumnSpan, columns)
          if (gridErr) return fail('Grid placement rejected', [gridErr], { parentColumns: columns })
          const node = buildNode(el.type, el as NodeProps, { pageHasH1, breakpoint: 'base' })
          ops.push({ kind: 'insertElement', parentId, node } satisfies InsertElementOp)
        }
        const result = workspace.applyOperations(input.documentId, ops)
        if (!result.ok)
          return fail('Batch insert rejected', result.errors, { documentId: input.documentId })
        return state(
          input.documentId,
          result.document,
          `Inserted ${ops.length} elements into #${parentId}.`
        )
      })
  )

  // === insert_preset (reuse presetsRegistry via insertPreset op) ==========
  server.registerTool(
    'insert_preset',
    {
      title: 'Insert preset',
      description:
        'Insert a composed preset (hero, cards grid, nav, footer, …) via the ' +
        'existing insertPreset operation — materialises a whole primitive ' +
        'subtree in one step. See the dtw://presets resource for ids.',
      inputSchema: {
        documentId: z.string(),
        presetId: z.string(),
        parentId: z.string().optional(),
        index: z.number().int().min(0).optional(),
        presetArgs: z.record(z.string(), z.unknown()).optional(),
      },
      outputSchema: documentStateShape,
    },
    (input) =>
      guard(() => {
        if (!(input.presetId in presetsRegistry)) {
          return fail('Unknown preset', [
            {
              message: `No preset "${input.presetId}".`,
              fix: `Choose one of: ${Object.keys(presetsRegistry).join(', ')}.`,
            },
          ])
        }
        const doc = workspace.get(input.documentId)
        const parentId = input.parentId ?? doc.tree.id
        const op: InsertPresetOp = {
          kind: 'insertPreset',
          parentId,
          presetId: input.presetId,
          presetArgs: input.presetArgs,
          index: input.index,
        }
        const result = workspace.applyOperation(input.documentId, op)
        if (!result.ok)
          return fail('Insert preset rejected', result.errors, { documentId: input.documentId })
        return state(input.documentId, result.document, `Inserted preset ${input.presetId}.`)
      })
  )

  // === update_element =====================================================
  server.registerTool(
    'update_element',
    {
      title: 'Update element',
      description:
        'Update an element via the existing update operations: text, tag, alt, ' +
        'href, name, and/or grid placement (gridColumnStart + gridColumnSpan ' +
        'together). All changes apply atomically.',
      inputSchema: {
        documentId: z.string(),
        id: z.string(),
        text: z.string().optional(),
        tag: z.enum(TEXT_TAGS).optional(),
        alt: z.string().optional(),
        href: z.string().optional(),
        name: z.string().optional(),
        gridColumnStart: z.number().int().optional(),
        gridColumnSpan: z.number().int().optional(),
      },
      outputSchema: documentStateShape,
    },
    (input) =>
      guard(() => {
        const doc = workspace.get(input.documentId)
        const node = findNode(doc.tree, input.id)
        if (!node) {
          return fail('Unknown element', [
            {
              message: `No element with id "${input.id}".`,
              nodeId: input.id,
              fix: 'Read the document resource for valid ids.',
            },
          ])
        }
        const ops: Operation[] = []
        const applicable = (kinds: ReadonlyArray<string>, field: string): ToolResult | null =>
          kinds.includes(node.type)
            ? null
            : fail('Field not applicable', [
                {
                  message: `"${field}" cannot be set on a ${node.type} element.`,
                  nodeId: input.id,
                },
              ])

        if (input.text !== undefined) {
          const bad = applicable(['text', 'button', 'link'], 'text')
          if (bad) return bad
          ops.push({
            kind: 'updateNode',
            id: input.id,
            path: ['content'],
            value: input.text,
          } satisfies UpdateNodeOp)
        }
        if (input.tag !== undefined) {
          const bad = applicable(['text'], 'tag')
          if (bad) return bad
          ops.push({
            kind: 'updateNode',
            id: input.id,
            path: ['tag'],
            value: input.tag,
          } satisfies UpdateNodeOp)
        }
        if (input.alt !== undefined) {
          const bad = applicable(['image'], 'alt')
          if (bad) return bad
          ops.push({
            kind: 'updateNode',
            id: input.id,
            path: ['alt'],
            value: input.alt,
          } satisfies UpdateNodeOp)
        }
        if (input.href !== undefined) {
          const bad = applicable(['link'], 'href')
          if (bad) return bad
          ops.push({
            kind: 'updateNode',
            id: input.id,
            path: ['href'],
            value: input.href,
          } satisfies UpdateNodeOp)
        }
        if (input.name !== undefined) {
          ops.push({
            kind: 'updateNode',
            id: input.id,
            path: ['name'],
            value: input.name,
          } satisfies UpdateNodeOp)
        }
        if (input.gridColumnStart !== undefined || input.gridColumnSpan !== undefined) {
          if (input.gridColumnStart === undefined || input.gridColumnSpan === undefined) {
            return fail('Incomplete grid placement', [
              {
                message: 'Set both gridColumnStart and gridColumnSpan.',
                fix: 'Provide both values.',
              },
            ])
          }
          const parent = findParent(doc.tree, input.id)
          const columns = parent ? containerColumns(parent) : 12
          const gridErr = validateGridPlacement(
            input.gridColumnStart,
            input.gridColumnSpan,
            columns
          )
          if (gridErr) return fail('Grid placement rejected', [gridErr], { parentColumns: columns })
          ops.push({
            kind: 'updateNodeStyle',
            id: input.id,
            breakpoint: 'base',
            path: ['gridColumn'],
            value: `${input.gridColumnStart} / span ${input.gridColumnSpan}`,
          } satisfies UpdateNodeStyleOp)
        }
        if (ops.length === 0) {
          return fail('Nothing to update', [
            {
              message: 'No updatable fields were provided.',
              fix: 'Pass at least one of text/tag/alt/href/name/grid.',
            },
          ])
        }
        const result = workspace.applyOperations(input.documentId, ops)
        if (!result.ok)
          return fail('Update rejected', result.errors, { documentId: input.documentId })
        return state(input.documentId, result.document, `Updated #${input.id}.`)
      })
  )

  // === move_element =======================================================
  server.registerTool(
    'move_element',
    {
      title: 'Move element',
      description: 'Reorder or re-parent an element via the existing reorder operation.',
      inputSchema: {
        documentId: z.string(),
        id: z.string(),
        toIndex: z.number().int().min(0),
        toParentId: z.string().optional(),
      },
      outputSchema: documentStateShape,
    },
    (input) =>
      guard(() => {
        const op: ReorderOp = {
          kind: 'reorder',
          id: input.id,
          toIndex: input.toIndex,
          toParentId: input.toParentId,
        }
        const result = workspace.applyOperation(input.documentId, op)
        if (!result.ok)
          return fail('Move rejected', result.errors, { documentId: input.documentId })
        return state(input.documentId, result.document, `Moved #${input.id}.`)
      })
  )

  // === remove_element =====================================================
  server.registerTool(
    'remove_element',
    {
      title: 'Remove element',
      description:
        'Delete an element (and its subtree) via the existing delete operation. ' +
        'The page root cannot be deleted, and removing the only <h1> is rejected.',
      inputSchema: { documentId: z.string(), id: z.string() },
      outputSchema: documentStateShape,
    },
    (input) =>
      guard(() => {
        const result = workspace.applyOperation(input.documentId, {
          kind: 'deleteElement',
          id: input.id,
        })
        if (!result.ok)
          return fail('Remove rejected', result.errors, { documentId: input.documentId })
        return state(input.documentId, result.document, `Removed #${input.id}.`)
      })
  )

  // === duplicate_element (reuse cloneWithNewIds + insert op) ==============
  server.registerTool(
    'duplicate_element',
    {
      title: 'Duplicate element',
      description:
        'Deep-clone an element (fresh ids) and insert the copy right after the ' +
        'original, via the existing insert operation. The page root cannot be duplicated.',
      inputSchema: { documentId: z.string(), id: z.string() },
      outputSchema: documentStateShape,
    },
    (input) =>
      guard(() => {
        const doc = workspace.get(input.documentId)
        const node = findNode(doc.tree, input.id)
        if (!node) {
          return fail('Unknown element', [
            { message: `No element "${input.id}".`, nodeId: input.id },
          ])
        }
        const parent = findParent(doc.tree, input.id)
        if (!parent) {
          return fail('Cannot duplicate', [
            { message: 'The page root cannot be duplicated.', fix: 'Duplicate a child instead.' },
          ])
        }
        const index = parent.children.findIndex((c) => c.id === input.id)
        const clone = cloneWithNewIds(node)
        const op: InsertElementOp = {
          kind: 'insertElement',
          parentId: parent.id,
          node: clone,
          index: index + 1,
        }
        const result = workspace.applyOperation(input.documentId, op)
        if (!result.ok)
          return fail('Duplicate rejected', result.errors, { documentId: input.documentId })
        return state(input.documentId, result.document, `Duplicated #${input.id} → #${clone.id}.`)
      })
  )

  // === wrap_elements (reuse wrapInGroup op) ===============================
  server.registerTool(
    'wrap_elements',
    {
      title: 'Wrap elements in a group',
      description:
        'Wrap one or more sibling elements in a new container via the existing ' +
        'wrapInGroup operation. All targets must share a parent.',
      inputSchema: {
        documentId: z.string(),
        ids: z.array(z.string()).min(1),
        name: z.string().optional(),
      },
      outputSchema: documentStateShape,
    },
    (input) =>
      guard(() => {
        const container = createPrimitive('container', nanoid(8)) as ContainerNode
        const op: WrapInGroupOp = {
          kind: 'wrapInGroup',
          ids: input.ids,
          container: input.name ? { ...container, name: input.name } : container,
        }
        const result = workspace.applyOperation(input.documentId, op)
        if (!result.ok)
          return fail('Wrap rejected', result.errors, { documentId: input.documentId })
        return state(
          input.documentId,
          result.document,
          `Wrapped ${input.ids.length} element(s) in a group.`
        )
      })
  )

  // === set_tokens (reuse addToken / updateToken ops) ======================
  server.registerTool(
    'set_tokens',
    {
      title: 'Set design tokens',
      description:
        'Add or update design tokens via the existing token operations. Colors ' +
        'take light/dark; other categories take a single value. Existing ids are ' +
        'updated; new ids are added.',
      inputSchema: {
        documentId: z.string(),
        tokens: z
          .array(
            z.object({
              category: z.enum(TOKEN_CATEGORIES),
              id: z.string(),
              name: z.string().optional(),
              light: z.string().optional(),
              dark: z.string().optional(),
              value: z.string().optional(),
            })
          )
          .min(1),
      },
      outputSchema: documentStateShape,
    },
    (input) =>
      guard(() => {
        const doc = workspace.get(input.documentId)
        const ops: Operation[] = []
        for (const t of input.tokens) {
          const category = t.category as TokenCategory
          const list = doc.tokens[category] as ReadonlyArray<{ id: string }>
          const exists = list.some((d) => d.id === t.id)
          if (category === 'color') {
            const value: ColorTokenValue | undefined =
              t.light !== undefined || t.dark !== undefined
                ? { light: t.light ?? t.dark ?? '#000000', dark: t.dark ?? t.light ?? '#000000' }
                : undefined
            if (exists) {
              ops.push({
                kind: 'updateToken',
                category: 'color',
                id: t.id,
                name: t.name,
                value,
              } satisfies UpdateTokenOp)
            } else {
              if (!value) {
                return fail('Missing color value', [
                  {
                    message: `Color token "${t.id}" needs light/dark.`,
                    fix: 'Provide at least `light`.',
                  },
                ])
              }
              ops.push({
                kind: 'addToken',
                category: 'color',
                definition: { id: t.id, name: t.name ?? t.id, value },
              } satisfies AddTokenOp)
            }
          } else {
            if (exists) {
              ops.push({
                kind: 'updateToken',
                category,
                id: t.id,
                name: t.name,
                value: t.value,
              } satisfies UpdateTokenOp)
            } else {
              if (t.value === undefined) {
                return fail('Missing token value', [
                  {
                    message: `Token "${category}.${t.id}" needs a value.`,
                    fix: 'Provide `value`.',
                  },
                ])
              }
              ops.push({
                kind: 'addToken',
                category,
                definition: { id: t.id, name: t.name ?? t.id, value: t.value },
              } satisfies AddTokenOp)
            }
          }
        }
        const result = workspace.applyOperations(input.documentId, ops)
        if (!result.ok)
          return fail('Set tokens rejected', result.errors, { documentId: input.documentId })
        return state(input.documentId, result.document, `Set ${ops.length} token(s).`)
      })
  )

  // === set_seo (document-level field; editor commits a new doc) ===========
  server.registerTool(
    'set_seo',
    {
      title: 'Set SEO metadata',
      description:
        'Set page SEO fields (title, description, keywords, author, canonical, ' +
        'Open Graph). These are document-level fields with no tree operation, so ' +
        'this commits an updated document (validated).',
      inputSchema: {
        documentId: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        author: z.string().optional(),
        canonical: z.string().optional(),
        ogTitle: z.string().optional(),
        ogDescription: z.string().optional(),
        ogImage: z.string().optional(),
      },
      outputSchema: documentStateShape,
    },
    (input) =>
      guard(() => {
        const result = workspace.update(input.documentId, (draft) => {
          const seo = draft.seo
          if (input.title !== undefined) seo.title = input.title
          if (input.description !== undefined) seo.description = input.description
          if (input.keywords !== undefined) seo.keywords = input.keywords
          if (input.author !== undefined) seo.author = input.author
          if (input.canonical !== undefined) seo.canonical = input.canonical
          if (
            input.ogTitle !== undefined ||
            input.ogDescription !== undefined ||
            input.ogImage !== undefined
          ) {
            const og = { ...(seo.openGraph ?? {}) }
            if (input.ogTitle !== undefined) og.title = input.ogTitle
            if (input.ogDescription !== undefined) og.description = input.ogDescription
            if (input.ogImage !== undefined) og.imageUrl = input.ogImage
            seo.openGraph = og
          }
        })
        if (!result.ok)
          return fail('Set SEO rejected', result.errors, { documentId: input.documentId })
        return state(input.documentId, result.document, 'Updated SEO metadata.')
      })
  )

  // === set_runtime (document-level runtime flags) =========================
  server.registerTool(
    'set_runtime',
    {
      title: 'Set runtime flags',
      description:
        'Toggle opt-in output JS behaviours (theme toggle, scroll-spy, smooth ' +
        'scroll, mobile nav, nav-on-scroll, reveals, animation gating, terminal ' +
        'typing). All-false → JS-free output.',
      inputSchema: {
        documentId: z.string(),
        themeToggle: z.boolean().optional(),
        scrollSpy: z.boolean().optional(),
        smoothScroll: z.boolean().optional(),
        mobileNav: z.boolean().optional(),
        navOnScroll: z.boolean().optional(),
        reveals: z.boolean().optional(),
        animationGating: z.boolean().optional(),
        terminalTyping: z.boolean().optional(),
      },
      outputSchema: documentStateShape,
    },
    (input) =>
      guard(() => {
        const result = workspace.update(input.documentId, (draft) => {
          const flags = [
            'themeToggle',
            'scrollSpy',
            'smoothScroll',
            'mobileNav',
            'navOnScroll',
            'reveals',
            'animationGating',
            'terminalTyping',
          ] as const
          for (const f of flags) {
            const v = input[f]
            if (v !== undefined) draft.runtime[f] = v
          }
        })
        if (!result.ok)
          return fail('Set runtime rejected', result.errors, { documentId: input.documentId })
        return state(input.documentId, result.document, 'Updated runtime flags.')
      })
  )

  // === set_theme (document-level default theme) ===========================
  server.registerTool(
    'set_theme',
    {
      title: 'Set default theme',
      description: 'Set the document default theme (auto = follow OS, or pin light/dark).',
      inputSchema: { documentId: z.string(), defaultTheme: z.enum(['auto', 'light', 'dark']) },
      outputSchema: documentStateShape,
    },
    (input) =>
      guard(() => {
        const result = workspace.update(input.documentId, (draft) => {
          draft.settings.defaultTheme = input.defaultTheme
        })
        if (!result.ok)
          return fail('Set theme rejected', result.errors, { documentId: input.documentId })
        return state(
          input.documentId,
          result.document,
          `Set default theme to ${input.defaultTheme}.`
        )
      })
  )

  // === match_layout =======================================================
  server.registerTool(
    'match_layout',
    {
      title: 'Match layout',
      description:
        "Rank bundled templates against a document's structure (reuses the " +
        'layout matcher). Best-first; pick one to apply_template.',
      inputSchema: { documentId: z.string() },
      outputSchema: matchOutputShape,
    },
    ({ documentId }) =>
      guard(() => {
        const doc = workspace.get(documentId)
        const ranked = findLayoutMatches({ tree: doc.tree })
        const nameById = new Map(libraryPages.map((p) => [p.id, p.name]))
        const matches = ranked.map((m) => ({
          pageId: m.pageId,
          name: nameById.get(m.pageId) ?? m.pageId,
          score: m.score,
          breakdown: m.breakdown,
        }))
        const lines = ['Ranked template matches (best first):']
        for (const m of matches)
          lines.push(`  • ${m.pageId} (${m.name}) — ${Math.round(m.score * 100)}%`)
        return ok(lines.join('\n'), { documentId, matches })
      })
  )

  // === apply_template =====================================================
  server.registerTool(
    'apply_template',
    {
      title: 'Apply template',
      description: 'Build a fresh document from a bundled template and add it to the session.',
      inputSchema: { templateId: z.string(), name: z.string().optional() },
      outputSchema: documentStateShape,
    },
    (input) =>
      guard(() => {
        let document
        try {
          document = buildLibraryDocumentById(input.templateId)
        } catch {
          return fail('Unknown template', [
            {
              message: `No template "${input.templateId}".`,
              fix: `Choose one of: ${libraryPages.map((p) => p.id).join(', ')}.`,
            },
          ])
        }
        if (input.name) document = { ...document, meta: { ...document.meta, name: input.name } }
        const { id, document: stored } = workspace.register(document)
        return state(id, stored, `Applied template "${input.templateId}".`)
      })
  )

  // === run_a11y_check =====================================================
  server.registerTool(
    'run_a11y_check',
    {
      title: 'Run accessibility check',
      description:
        'Run the export axe-core gate (generate → inject SEO → axe) WITHOUT ' +
        'exporting. Returns violations + pass/fail and document validation errors.',
      inputSchema: { documentId: z.string() },
      outputSchema: a11yOutputShape,
    },
    ({ documentId }) =>
      guard(async () => {
        const doc = workspace.get(documentId)
        const generated = await generate(doc)
        const html = injectSEO(generated.html, doc.seo, doc.assets)
        const report = await generateFullReport(html, doc.seo)
        const a = report.accessibility
        const validation = validateDocument(doc)

        const lines = [
          `A11y gate: ${a.passed ? 'PASS' : 'FAIL'} (would ${a.passed ? 'allow' : 'block'} export)`,
          `Counts — critical: ${a.counts.critical}, serious: ${a.counts.serious}, moderate: ${a.counts.moderate}, minor: ${a.counts.minor}`,
        ]
        for (const v of a.violations) lines.push(`  • ${formatViolation(v)}`)
        if (validation.errors.length > 0) {
          lines.push('', 'Document validation errors (also block export):')
          for (const e of validation.errors)
            lines.push(`  • ${e.message}${e.fix ? ` — fix: ${e.fix}` : ''}`)
        }
        return ok(lines.join('\n'), {
          documentId,
          passed: a.passed,
          counts: a.counts,
          violations: a.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes,
            helpUrl: v.helpUrl,
          })),
          validationErrors: validation.errors.map((e) => ({
            message: e.message,
            nodeId: e.nodeId,
            fix: e.fix,
          })),
        })
      })
  )

  // === preview_html (dry-run; no disk write) ==============================
  server.registerTool(
    'preview_html',
    {
      title: 'Preview HTML',
      description:
        'Return the generated HTML/CSS/JS for a document without exporting ' +
        '(dry-run). Useful to inspect output before export_site.',
      inputSchema: { documentId: z.string() },
      outputSchema: previewOutputShape,
    },
    ({ documentId }) =>
      guard(async () => {
        const doc = workspace.get(documentId)
        const preview = await exportProject(doc, { dryRun: true })
        return ok(
          `HTML ${preview.html.length} bytes, CSS ${preview.css.length} bytes, JS ${preview.js.length} bytes.`,
          { documentId, html: preview.html, css: preview.css, js: preview.js }
        )
      })
  )

  // === export_site ========================================================
  server.registerTool(
    'export_site',
    {
      title: 'Export site',
      description:
        'Run the full export pipeline (validate → generate → SEO → axe gate → ' +
        'sitemap/robots → ZIP → save) and write the bundle to disk. Returns the path.',
      inputSchema: {
        documentId: z.string(),
        projectName: z.string().optional(),
        theme: z.enum(['auto', 'light', 'dark']).optional(),
      },
      outputSchema: exportOutputShape,
    },
    ({ documentId, projectName, theme }) =>
      guard(async () => {
        const doc = workspace.get(documentId)
        const result = await exportProject(doc, { projectName, theme })
        if (!result.success) {
          const fix =
            result.stage === 'a11y-gate'
              ? 'Run run_a11y_check and fix every critical/serious violation.'
              : result.stage === 'validate'
                ? 'Fix the document validation errors (read the document resource).'
                : 'Inspect the error and adjust the document.'
          return fail(
            `Export failed at stage "${result.stage}"`,
            [{ message: result.error, fix }],
            {
              stage: result.stage,
            }
          )
        }
        return ok(`Exported "${doc.meta.name}" → ${result.filePath}\nAccessibility gate: passed.`, {
          documentId,
          success: true,
          filePath: result.filePath,
          a11yPassed: true,
        })
      })
  )

  // === save_document / load_document ======================================
  server.registerTool(
    'save_document',
    {
      title: 'Save document',
      description: 'Persist a document to a .dtw file (defaults to the workspace dir).',
      inputSchema: { documentId: z.string(), filePath: z.string().optional() },
    },
    ({ documentId, filePath }) =>
      guard(() => ok(`Saved document to ${workspace.save(documentId, filePath)}`))
  )

  server.registerTool(
    'load_document',
    {
      title: 'Load document',
      description:
        'Load a .dtw file into the session (parse → migrate → validate). Returns its new id.',
      inputSchema: { filePath: z.string() },
      outputSchema: documentStateShape,
    },
    ({ filePath }) => {
      try {
        const { id, document } = workspace.load(filePath)
        return state(id, document, 'Loaded document.')
      } catch (err) {
        return fail('Load failed', [
          {
            message: err instanceof Error ? err.message : String(err),
            fix: 'Check the path and that the file is a valid .dtw document.',
          },
        ])
      }
    }
  )

  // === resources ==========================================================
  server.registerResource(
    'vocabulary',
    'dtw://vocabulary',
    {
      title: 'Element & grid vocabulary',
      description: 'Allowed types, grid, breakpoints, states, invariants.',
      mimeType: 'application/json',
    },
    (uri) => ({
      contents: [
        { uri: uri.href, mimeType: 'application/json', text: JSON.stringify(VOCABULARY, null, 2) },
      ],
    })
  )

  server.registerResource(
    'presets',
    'dtw://presets',
    {
      title: 'Available presets',
      description: 'Composed presets for insert_preset (id list).',
      mimeType: 'application/json',
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(Object.keys(presetsRegistry), null, 2),
        },
      ],
    })
  )

  server.registerResource(
    'templates',
    'dtw://templates',
    {
      title: 'Available templates',
      description: 'Bundled templates for apply_template.',
      mimeType: 'application/json',
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            libraryPages.map((p) => ({ id: p.id, name: p.name, description: p.description })),
            null,
            2
          ),
        },
      ],
    })
  )

  server.registerResource(
    'documents',
    'dtw://documents',
    {
      title: 'Open documents',
      description: 'Documents currently held in the session.',
      mimeType: 'application/json',
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(workspace.list(), null, 2),
        },
      ],
    })
  )

  server.registerResource(
    'document',
    new ResourceTemplate('dtw://document/{id}/tree', { list: undefined }),
    {
      title: 'Document tree (JSON)',
      description: 'Full document JSON for a given id.',
      mimeType: 'application/json',
    },
    (uri, variables) => {
      const id = String(variables.id)
      if (!workspace.has(id)) {
        return {
          contents: [
            { uri: uri.href, mimeType: 'text/plain', text: `No document with id "${id}".` },
          ],
        }
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: documentTreeJson(workspace.get(id)),
          },
        ],
      }
    }
  )

  return server
}
