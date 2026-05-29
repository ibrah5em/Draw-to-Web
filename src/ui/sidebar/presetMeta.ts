/**
 * UI metadata for preset cards (L-SBR-02).
 *
 * The {@link presetsRegistry} (C7) only carries factory functions — the
 * Insert sidebar needs an icon, a human label, a category tab, and a
 * tooltip description per preset. Rather than extending the document-side
 * contract, we keep that display metadata here.
 *
 * Discovery is dynamic: `Object.keys(presetsRegistry)` drives the card
 * list, and {@link getPresetMeta} returns either the curated entry below
 * or a sensible default. That keeps the DoD satisfied — a new preset in
 * the registry surfaces a card with no UI changes, just without the
 * polish of a curated icon/category until someone adds an entry here.
 */

import {
  AppWindow,
  Box,
  CreditCard,
  Layout as LayoutIcon,
  LayoutGrid,
  type LucideIcon,
  Megaphone,
  Navigation,
  PanelBottom,
  PanelTop,
} from 'lucide-react'

import type { PresetId } from '@document/presets'

/** The three tabs the sidebar groups presets into. */
export type PresetCategory = 'sections' | 'components'

/** Display metadata for a single preset card. */
export interface PresetMeta {
  readonly category: PresetCategory
  readonly label: string
  readonly description: string
  readonly Icon: LucideIcon
}

/**
 * Curated metadata for every preset known at design time. Keyed by
 * {@link PresetId}; unmapped ids fall back to {@link defaultPresetMeta}.
 */
const PRESET_META: Readonly<Partial<Record<PresetId, PresetMeta>>> = {
  'nav-fixed': {
    category: 'sections',
    label: 'Nav',
    description: 'Fixed top navigation with brand + links.',
    Icon: Navigation,
  },
  'hero-centered': {
    category: 'sections',
    label: 'Hero (centered)',
    description: 'Centred heading, subtitle, and CTA row.',
    Icon: PanelTop,
  },
  'hero-split': {
    category: 'sections',
    label: 'Hero (split)',
    description: 'Two-column hero — copy on the left, media on the right.',
    Icon: LayoutIcon,
  },
  'cta-banner': {
    category: 'sections',
    label: 'CTA banner',
    description: 'Bold call-to-action band with a primary button.',
    Icon: Megaphone,
  },
  'footer-simple': {
    category: 'sections',
    label: 'Footer',
    description: 'Single-line footer with copyright + links.',
    Icon: PanelBottom,
  },
  'footer-columns': {
    category: 'sections',
    label: 'Footer (columns)',
    description: 'Multi-column footer for nav + contact + social.',
    Icon: AppWindow,
  },
  'cards-grid-3col': {
    category: 'components',
    label: 'Cards grid (3)',
    description: 'Three-column responsive grid of cards.',
    Icon: LayoutGrid,
  },
  'card-basic': {
    category: 'components',
    label: 'Card',
    description: 'Single card — icon + title + body + link.',
    Icon: CreditCard,
  },
}

/** Prettify a preset id (`hero-split` → `Hero split`) for fallback labels. */
function prettifyId(id: string): string {
  const spaced = id.replace(/-/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Fallback metadata for any preset id not present in {@link PRESET_META}. */
function defaultPresetMeta(id: string): PresetMeta {
  return {
    category: 'sections',
    label: prettifyId(id),
    description: `Insert "${id}".`,
    Icon: Box,
  }
}

/** Curated metadata for a preset id, or a safe default if it's not curated. */
export function getPresetMeta(id: PresetId): PresetMeta {
  return PRESET_META[id] ?? defaultPresetMeta(id)
}
