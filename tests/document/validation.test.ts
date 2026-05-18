import { describe, expect, it } from 'vitest'

import { validateDocument } from '../../src/document/validation'
import type { Document, ElementNode } from '../../src/document/types'

function baseDocument(overrides?: {
  tree?: ElementNode
  tokens?: Document['tokens']
  contrastTarget?: 'AA' | 'AAA'
}): Document {
  return {
    version: '0.2.0',
    meta: {
      name: 'T',
      createdAt: '2026-05-19T00:00:00.000Z',
      updatedAt: '2026-05-19T00:00:00.000Z',
    },
    tokens: overrides?.tokens ?? {
      color: [
        { id: 'fg', name: 'Foreground', value: { light: '#111111', dark: '#eeeeee' } },
        { id: 'bg', name: 'Background', value: { light: '#ffffff', dark: '#0a0a0a' } },
      ],
      spacing: [],
      fontSize: [],
      fontFamily: [],
      lineHeight: [],
      radius: [],
      shadow: [],
    },
    tree: overrides?.tree ?? {
      type: 'container',
      id: 'root',
      layout: { base: { mode: 'flex' } },
      style: { base: { background: [{ kind: 'solid', color: 'color.bg' }] } },
      children: [
        {
          type: 'text',
          id: 'h1',
          tag: 'h1',
          content: 'Title',
          style: { base: { typography: { color: 'color.fg' } } },
        },
        {
          type: 'image',
          id: 'img',
          alt: '',
          externalUrl: 'https://x/y.png',
          style: { base: {} },
        },
      ],
    },
    seo: {
      title: 't',
      description: 'd',
      lang: 'en',
      viewport: 'width=device-width, initial-scale=1',
      charset: 'utf-8',
    },
    runtime: {
      themeToggle: false,
      scrollSpy: false,
      smoothScroll: false,
      mobileNav: false,
      navOnScroll: false,
      reveals: false,
      animationGating: false,
      terminalTyping: false,
    },
    variables: {},
    settings: {
      contrastTarget: overrides?.contrastTarget ?? 'AA',
      defaultTheme: 'auto',
      gridVisible: false,
    },
    assets: {},
  }
}

describe('validateDocument (C8)', () => {
  it('the baseline document produces no errors', () => {
    const report = validateDocument(baseDocument())
    expect(report.errors).toEqual([])
  })

  describe('headings', () => {
    it('flags missing h1', () => {
      const doc = baseDocument({
        tree: {
          type: 'container',
          id: 'root',
          layout: { base: { mode: 'flex' } },
          style: { base: {} },
          children: [{ type: 'text', id: 'h2', tag: 'h2', content: 'sub', style: { base: {} } }],
        },
      })
      const report = validateDocument(doc)
      expect(report.errors.some((e) => e.message.includes('missing an <h1>'))).toBe(true)
    })

    it('flags multiple h1s', () => {
      const doc = baseDocument({
        tree: {
          type: 'container',
          id: 'root',
          layout: { base: { mode: 'flex' } },
          style: { base: {} },
          children: [
            { type: 'text', id: 'a', tag: 'h1', content: 'A', style: { base: {} } },
            { type: 'text', id: 'b', tag: 'h1', content: 'B', style: { base: {} } },
          ],
        },
      })
      const report = validateDocument(doc)
      expect(report.errors.some((e) => e.nodeId === 'b' && /More than one/.test(e.message))).toBe(
        true
      )
    })

    it('warns on a heading-level skip', () => {
      const doc = baseDocument({
        tree: {
          type: 'container',
          id: 'root',
          layout: { base: { mode: 'flex' } },
          style: { base: {} },
          children: [
            { type: 'text', id: 'h1', tag: 'h1', content: 'A', style: { base: {} } },
            { type: 'text', id: 'h4', tag: 'h4', content: 'B', style: { base: {} } },
          ],
        },
      })
      const report = validateDocument(doc)
      expect(
        report.warnings.some((w) => w.nodeId === 'h4' && /jumps from h1 to h4/.test(w.message))
      ).toBe(true)
    })
  })

  it('errors on duplicate ids', () => {
    const doc = baseDocument({
      tree: {
        type: 'container',
        id: 'root',
        layout: { base: { mode: 'flex' } },
        style: { base: {} },
        children: [
          { type: 'text', id: 'dup', tag: 'h1', content: 'A', style: { base: {} } },
          { type: 'text', id: 'dup', tag: 'p', content: 'B', style: { base: {} } },
        ],
      },
    })
    const report = validateDocument(doc)
    expect(report.errors.some((e) => /Duplicate element id "dup"/.test(e.message))).toBe(true)
  })

  it('errors on a broken token reference', () => {
    const doc = baseDocument({
      tree: {
        type: 'container',
        id: 'root',
        layout: { base: { mode: 'flex' } },
        style: { base: { background: [{ kind: 'solid', color: 'color.missing' }] } },
        children: [{ type: 'text', id: 'h1', tag: 'h1', content: 'A', style: { base: {} } }],
      },
    })
    const report = validateDocument(doc)
    expect(
      report.errors.some((e) => /Unknown token reference "color.missing"/.test(e.message))
    ).toBe(true)
  })

  it('reports unused tokens as info', () => {
    const doc = baseDocument({
      tokens: {
        color: [
          { id: 'fg', name: 'fg', value: { light: '#000', dark: '#fff' } },
          { id: 'bg', name: 'bg', value: { light: '#fff', dark: '#000' } },
          { id: 'orphan', name: 'orphan', value: { light: '#abc', dark: '#abc' } },
        ],
        spacing: [],
        fontSize: [],
        fontFamily: [],
        lineHeight: [],
        radius: [],
        shadow: [],
      },
    })
    const report = validateDocument(doc)
    expect(report.infos.some((i) => /color\.orphan/.test(i.message))).toBe(true)
  })

  describe('contrast', () => {
    it('warns when AA fails', () => {
      const doc = baseDocument({
        tokens: {
          color: [
            // Very low contrast: light grey on white.
            { id: 'fg', name: 'fg', value: { light: '#dddddd', dark: '#222222' } },
            { id: 'bg', name: 'bg', value: { light: '#ffffff', dark: '#0a0a0a' } },
          ],
          spacing: [],
          fontSize: [],
          fontFamily: [],
          lineHeight: [],
          radius: [],
          shadow: [],
        },
      })
      const report = validateDocument(doc)
      expect(report.warnings.some((w) => /contrast/i.test(w.message))).toBe(true)
    })

    it('passes AA with a high-contrast pair', () => {
      const report = validateDocument(baseDocument())
      expect(report.warnings.filter((w) => /contrast/i.test(w.message))).toEqual([])
    })

    it('AAA mode flags pairs that AA would accept', () => {
      // Mid-grey on white: ~ 5:1 (AA pass, AAA fail).
      const doc = baseDocument({
        contrastTarget: 'AAA',
        tokens: {
          color: [
            { id: 'fg', name: 'fg', value: { light: '#767676', dark: '#a0a0a0' } },
            { id: 'bg', name: 'bg', value: { light: '#ffffff', dark: '#000000' } },
          ],
          spacing: [],
          fontSize: [],
          fontFamily: [],
          lineHeight: [],
          radius: [],
          shadow: [],
        },
      })
      const report = validateDocument(doc)
      expect(report.warnings.some((w) => /WCAG AAA/.test(w.message))).toBe(true)
    })
  })
})
