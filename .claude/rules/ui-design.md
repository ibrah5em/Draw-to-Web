# UI Design Rules

## Theme

This app uses a VS Code Dark theme. All UI must follow it.

## Design Tokens

All colors, spacing, fonts, and dimensions MUST come from
src/renderer/styles/tokens.css CSS variables.
Never hardcode color values, font sizes, or spacing.

## Required Variables

- Backgrounds: var(--bg-base), var(--bg-surface), var(--bg-input),
  var(--bg-hover), var(--bg-active)
- Text: var(--text-primary), var(--text-secondary)
- Border: var(--border)
- Accent: var(--accent)
- Icons: var(--icon), var(--icon-active)
- Spacing: var(--sp-1) through var(--sp-8)
- Fonts: var(--font), var(--font-mono)
- Sizes: var(--text-xs), var(--text-sm), var(--text-md), var(--text-lg)

## Component Patterns

- Use CSS Modules (.module.css) for all components
- Panel headers: uppercase, letter-spacing 1px,
  font-size var(--text-xs), color var(--text-secondary)
- Inputs: bg var(--bg-input), border var(--border),
  focus border var(--accent)
- Buttons: hover var(--bg-hover), active var(--bg-active)
- Icons: lucide-react library, default 20px
- Transitions: hover 120ms ease, layout 200ms ease

## Layout

- Activity bar: 48px wide, left side
- Sidebar: 240px wide, collapsible
- Properties panel: 280px wide, right side
- Status bar: 22px, bottom, bg #007acc

## Rules

- Zero hardcoded colors in components
- Every new component must import and use tokens.css variables
- Match existing component patterns in the codebase
