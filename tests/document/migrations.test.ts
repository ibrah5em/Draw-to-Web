import { describe, expect, it } from 'vitest'

import { migrate } from '../../src/document/migrations'
import type { Document } from '../../src/document/types'

function validDoc(): Document {
  return {
    version: '0.2.0',
    meta: {
      name: 'M',
      createdAt: '2026-05-19T00:00:00.000Z',
      updatedAt: '2026-05-19T00:00:00.000Z',
    },
    tokens: {
      color: [],
      spacing: [],
      fontSize: [],
      fontFamily: [],
      lineHeight: [],
      radius: [],
      shadow: [],
    },
    tree: {
      type: 'container',
      id: 'r',
      layout: { base: { mode: 'flex' } },
      style: { base: {} },
      children: [{ type: 'text', id: 'h', tag: 'h1', content: 'A', style: { base: {} } }],
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
    settings: { contrastTarget: 'AA', defaultTheme: 'auto', gridVisible: false },
    assets: {},
  }
}

describe('migrate (I-DOC-07)', () => {
  it('no-ops when from === to', () => {
    const doc = validDoc()
    expect(migrate(doc, '0.2.0', '0.2.0')).toEqual(doc)
  })

  it('walks the 0.2.0 → 0.2.1 stub path and validates the result', () => {
    const doc = validDoc()
    const result = migrate(doc, '0.2.0', '0.2.1')
    expect(result).toEqual(doc)
  })

  it('throws a structured error for an unknown target version', () => {
    expect(() => migrate(validDoc(), '0.2.0', '9.9.9')).toThrow(
      /No migration path from "0.2.0" to "9.9.9"/
    )
  })

  it('throws for an unknown source version', () => {
    expect(() => migrate(validDoc(), '0.0.42', '0.2.0')).toThrow(/No migration path/)
  })

  it('rejects a structurally invalid document after the chain runs', () => {
    expect(() => migrate({ not: 'a document' }, '0.2.0', '0.2.0')).toThrow()
  })
})
