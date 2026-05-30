import { afterEach, describe, expect, it } from 'vitest'

import { useDocumentStore } from '@store/documentStore'
import { useHistoryStore } from '@store/historyStore'
import { applyImportedTokens, parseTokens, serializeTokens } from '@ui/panels/tokens/tokenIO'

import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

afterEach(() => {
  useDocumentStore.getState().reset()
  useHistoryStore.getState().clear()
})

describe('token import/export (L-TKN-05)', () => {
  it('serialize → parse round-trips the registry', () => {
    const tokens = PORTFOLIO_DOCUMENT.tokens
    const json = serializeTokens(tokens)
    const back = parseTokens(json)
    expect(back).toEqual(tokens)
  })

  it('parseTokens rejects malformed JSON', () => {
    expect(() => parseTokens('{ not json')).toThrow(/valid JSON/)
  })

  it('parseTokens rejects a structurally invalid registry', () => {
    // Missing the required category arrays.
    expect(() => parseTokens(JSON.stringify({ color: 'nope' }))).toThrow()
  })

  it('applyImportedTokens replaces the document registry through Zod', () => {
    const imported = parseTokens(serializeTokens(PORTFOLIO_DOCUMENT.tokens))
    applyImportedTokens(imported)
    expect(useDocumentStore.getState().document.tokens).toEqual(PORTFOLIO_DOCUMENT.tokens)
    expect(useDocumentStore.getState().isDirty).toBe(true)
  })
})
