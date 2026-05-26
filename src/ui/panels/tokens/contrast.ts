/**
 * Contrast helpers for the Tokens panel (L-TKN-03).
 *
 * `chroma-js` computes the WCAG contrast ratio of a color token against a
 * surface color. The panel surfaces a pass/fail badge vs the AA threshold.
 * Pure — no React, no store access.
 */

import chroma from 'chroma-js'

import type { ColorTokenValue, TokenDefinition } from '@document/types'

/** WCAG AA contrast threshold for normal-size text. */
export const AA_THRESHOLD = 4.5

export interface ContrastInfo {
  /** WCAG contrast ratio (1–21). */
  readonly ratio: number
  /** True when `ratio` meets WCAG AA for normal text. */
  readonly passesAA: boolean
}

/**
 * Contrast ratio between a foreground and background color, or `null` when
 * either value is not a parseable color (e.g. mid-edit).
 */
export function contrastInfo(foreground: string, background: string): ContrastInfo | null {
  if (!chroma.valid(foreground) || !chroma.valid(background)) return null
  const ratio = chroma.contrast(foreground, background)
  return { ratio, passesAA: ratio >= AA_THRESHOLD }
}

/**
 * Pick the surface color to measure tokens against, for the active theme.
 *
 * Prefers a conventionally-named background token (`bg-primary` / `bg` /
 * `background` / `surface`); falls back to the first color token, then
 * `null` when the registry has no colors.
 */
export function findSurfaceColor(
  colors: ReadonlyArray<TokenDefinition<ColorTokenValue>>,
  theme: 'light' | 'dark'
): string | null {
  for (const id of ['bg-primary', 'bg', 'background', 'surface']) {
    const match = colors.find((c) => c.id === id)
    if (match) return match.value[theme]
  }
  return colors[0]?.value[theme] ?? null
}
