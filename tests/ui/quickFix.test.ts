import { describe, expect, it } from 'vitest'

import type { ValidationIssue } from '@document/validation'
import { hasQuickFix, quickFixFor } from '@ui/panels/validation/quickFix'

describe('quickFixFor (L-VAL-04)', () => {
  it('maps a missing-alt error to an updateNode setting alt=""', () => {
    const issue: ValidationIssue = {
      message: 'Image is missing the alt attribute. Use "" for decorative images.',
      nodeId: 'img1',
      fix: 'Add alt text describing the image.',
    }
    expect(quickFixFor(issue)).toEqual({
      kind: 'updateNode',
      id: 'img1',
      path: ['alt'],
      value: '',
    })
  })

  it('maps an extra <h1> to a demote-to-h2 op', () => {
    const issue: ValidationIssue = {
      message: 'More than one <h1> in the document.',
      nodeId: 'h1b',
      fix: 'Demote this heading to h2.',
    }
    expect(quickFixFor(issue)).toEqual({
      kind: 'updateNode',
      id: 'h1b',
      path: ['tag'],
      value: 'h2',
    })
  })

  it('maps a heading-level skip to the suggested level', () => {
    const issue: ValidationIssue = {
      message:
        'Heading level jumps from h2 to h4. Skipping levels breaks screen-reader navigation.',
      nodeId: 'h4',
      fix: 'Use h3 instead of h4.',
    }
    expect(quickFixFor(issue)).toEqual({
      kind: 'updateNode',
      id: 'h4',
      path: ['tag'],
      value: 'h3',
    })
  })

  it('returns null for issues with no safe automatic fix', () => {
    expect(quickFixFor({ message: 'Duplicate element id "x".', nodeId: 'x' })).toBeNull()
    expect(
      quickFixFor({ message: 'Unknown token reference "color.nope".', nodeId: 'y' })
    ).toBeNull()
    // No nodeId → not fixable.
    expect(quickFixFor({ message: 'Document is missing an <h1>.' })).toBeNull()
  })

  it('hasQuickFix agrees with quickFixFor', () => {
    expect(hasQuickFix({ message: 'Image is missing the alt attribute.', nodeId: 'i' })).toBe(true)
    expect(hasQuickFix({ message: 'Duplicate element id "x".', nodeId: 'x' })).toBe(false)
  })
})
