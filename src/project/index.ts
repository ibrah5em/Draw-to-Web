import type { CanvasElement, ElementType } from '../store/elementStore'

/** On-disk schema for .dtw files. */
export interface ProjectFile {
  /** Format version — bumped on breaking schema changes. */
  version: 1
  elements: CanvasElement[]
}

const VALID_TYPES: ReadonlySet<ElementType> = new Set(['rectangle', 'text', 'image', 'button'])

function isCanvasElement(value: unknown): value is CanvasElement {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.type === 'string' &&
    VALID_TYPES.has(v.type as ElementType) &&
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    typeof v.width === 'number' &&
    typeof v.height === 'number' &&
    typeof v.props === 'object' &&
    v.props !== null
  )
}

/** Serializes the current element list into a JSON string for the .dtw file. */
export function serializeProject(elements: CanvasElement[]): string {
  const payload: ProjectFile = { version: 1, elements }
  return JSON.stringify(payload, null, 2)
}

/**
 * Parses and validates a .dtw file. Returns null if the payload is malformed —
 * callers should surface a user-facing error in that case.
 */
export function deserializeProject(json: string): ProjectFile | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as Record<string, unknown>
  if (obj.version !== 1) return null
  if (!Array.isArray(obj.elements)) return null
  if (!obj.elements.every(isCanvasElement)) return null
  return { version: 1, elements: obj.elements as CanvasElement[] }
}
