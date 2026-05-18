/**
 * Document Model — presets registry (C7).
 *
 * A preset is a pure factory that returns an `ElementNode` subtree
 * composed entirely of primitive nodes. Presets carry no special
 * behavior — they are just convenient defaults the UI can drop onto the
 * canvas. Adding a preset = adding a factory + a registry entry; no UI
 * changes required (rules/document-model.md).
 *
 * Factories share a single signature so the Insert sidebar (L-SBR-02)
 * and the `insertPreset` operation (C3) can call any preset uniformly.
 * The first positional arg is the per-preset args bag; the second is a
 * context providing dependency-injected helpers (id generation, mostly).
 *
 * Contract: C7 (see `docs/0.2.0v/plan.md` Section 6).
 */

import { nanoid } from 'nanoid'

import type { ElementId, ElementNode } from '../types'

import { cardBasic } from './card-basic'
import { cardsGrid3Col } from './cards-grid-3col'
import { ctaBanner } from './cta-banner'
import { footerColumns } from './footer-columns'
import { footerSimple } from './footer-simple'
import { heroCentered } from './hero-centered'
import { heroSplit } from './hero-split'
import { navFixed } from './nav-fixed'

/**
 * Dependency-injected helpers passed to every preset factory. Mostly
 * exists so tests can plug a deterministic id generator instead of
 * `nanoid`; production callers should use `defaultPresetContext()`.
 */
export interface PresetContext {
  /** Returns a fresh `ElementId`. Must be unique within the produced subtree. */
  readonly generateId: () => ElementId
}

/**
 * Per-preset args bag. Each preset documents the keys it understands;
 * unknown keys are ignored. The shape is intentionally loose so the
 * registry has a single uniform signature.
 */
export type PresetArgs = Readonly<Record<string, unknown>>

/** Uniform preset factory signature consumed by `presetsRegistry`. */
export type PresetFactory = (args: PresetArgs, ctx: PresetContext) => ElementNode

/**
 * Default `PresetContext` backed by `nanoid`. Stable across calls but
 * non-deterministic — tests should construct their own context with a
 * counter so snapshots are reproducible.
 */
export const defaultPresetContext = (): PresetContext => ({
  generateId: () => nanoid(8),
})

/**
 * The full preset registry. Keys are the stable preset ids consumed by
 * `insertPreset` operations and the Insert sidebar. Values are factory
 * functions.
 */
export const presetsRegistry: Readonly<Record<string, PresetFactory>> = Object.freeze({
  'hero-centered': heroCentered,
  'hero-split': heroSplit,
  'cards-grid-3col': cardsGrid3Col,
  'card-basic': cardBasic,
  'cta-banner': ctaBanner,
  'footer-simple': footerSimple,
  'footer-columns': footerColumns,
  'nav-fixed': navFixed,
})

/** String-literal union of every registered preset id. */
export type PresetId = keyof typeof presetsRegistry
