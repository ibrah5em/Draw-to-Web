/**
 * Canonical shared types for the Draw-to-Web pipeline.
 * Generator, SEO, and export modules import from here rather than defining their own.
 */

export type { CanvasElement, ElementType } from '../store/elementStore'
export type { SemanticElement, SemanticTag } from '../engine'

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

/** Final result returned to the renderer after the full export pipeline completes. */
export interface ExportResult {
  success: boolean
  path?: string
  error?: string
  report?: SEOReport
}
