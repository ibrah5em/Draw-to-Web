/**
 * Canonical shared types for the Draw-to-Web pipeline.
 * Generator, SEO, and export modules import from here rather than defining their own.
 */

/** Active drawing tool selected in the Toolbar. 'select' means the pointer/move tool. */
export type ActiveTool = 'select' | 'rectangle' | 'text' | 'image' | 'button'

export type { CanvasElement, ElementType, ElementProps } from '../store/elementStore'

/**
 * CSS-property-named style values for a canvas element.
 * Used by the Properties Panel and layer serialisation.
 * The generator reads the same values via the ElementProps bag on CanvasElement.
 */
export interface ElementStyles {
  backgroundColor?: string
  color?: string
  fontSize?: number
  fontFamily?: string
  borderRadius?: number
  padding?: number
  borderWidth?: number
  borderColor?: string
}

/** Output produced by the code generator. */
export interface GeneratedOutput {
  html: string
  css: string
}

/** SEO metadata provided by the user at export time. */
export interface SEOConfig {
  title: string
  description: string
  ogImage?: string
  canonicalUrl?: string
  /** BCP-47 language tag, defaults to "en". */
  lang?: string
}

/** Accessibility and SEO summary produced by the SEO injector. */
export interface SEOReport {
  titleLength: number
  descriptionLength: number
  hasOgImage: boolean
  hasCanonical: boolean
  /** Number of <h1> elements found — should be exactly 1. */
  h1Count: number
  /** Number of <img> elements missing a non-empty alt attribute. */
  imagesMissingAlt: number
}

/** A single axe-core rule violation. */
export interface AccessibilityViolation {
  /** axe-core rule id (e.g. "image-alt"). */
  id: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
  description: string
  help: string
  helpUrl: string
  /** Count of nodes in the document that violate this rule. */
  nodes: number
}

/** Result of running the axe-core accessibility gate against generated HTML. */
export interface AccessibilityReport {
  /** False if any violation has impact "critical" or "serious" — blocks export. */
  passed: boolean
  violations: readonly AccessibilityViolation[]
  counts: Readonly<{ critical: number; serious: number; moderate: number; minor: number }>
}

/** Combined pre-export report shown to the user. */
export interface FullExportReport {
  seo: SEOReport
  accessibility: AccessibilityReport
  /** Actionable guidance strings — informational for SEO, blocking for a11y. */
  guidance: readonly string[]
}

/** Final result returned to the renderer after the full export pipeline completes. */
export interface ExportResult {
  success: boolean
  path?: string
  error?: string
  report?: FullExportReport
}
