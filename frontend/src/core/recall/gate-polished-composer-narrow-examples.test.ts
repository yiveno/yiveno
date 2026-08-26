import { describe, expect, it } from 'vitest'

import {
  buildNarrowExampleCandidateCorpusLower,
  foldNarrowExampleIdentity,
  gatePolishedComposerNarrowExamples
} from '@/core/recall/gate-polished-composer-narrow-examples'

describe('foldNarrowExampleIdentity', () => {
  it('折叠大小写与分隔符', () => {
    expect(foldNarrowExampleIdentity('Eloquent JavaScript')).toBe('eloquentjavascript')
    expect(foldNarrowExampleIdentity('eloquentjavascript')).toBe('eloquentjavascript')
    expect(foldNarrowExampleIdentity('MDN')).toBe('mdn')
  })
})

describe('gatePolishedComposerNarrowExamples', () => {
  const corpus = buildNarrowExampleCandidateCorpusLower([
    'Eloquent JavaScript',
    'MDN Web Docs',
    'JavaScript history'
  ])

  it('接受同 identity 且语料中出现的展示形态', () => {
    expect(
      gatePolishedComposerNarrowExamples({
        selected: ['eloquentjavascript', 'mdn'],
        polished: ['Eloquent JavaScript', 'MDN'],
        candidateCorpusLower: corpus
      })
    ).toEqual(['Eloquent JavaScript', 'MDN'])
  })

  it('拒绝换词 / 造词，回退选定原词', () => {
    expect(
      gatePolishedComposerNarrowExamples({
        selected: ['history', 'mdn'],
        polished: ['developer', 'MDN Docs'],
        candidateCorpusLower: corpus
      })
    ).toEqual(['history', 'mdn'])
  })

  it('长度不一致整表回退', () => {
    expect(
      gatePolishedComposerNarrowExamples({
        selected: ['history', 'mdn'],
        polished: ['History'],
        candidateCorpusLower: corpus
      })
    ).toEqual(['history', 'mdn'])
  })

  it('仅大小写变化且不在语料中仍可接受', () => {
    expect(
      gatePolishedComposerNarrowExamples({
        selected: ['history'],
        polished: ['History'],
        candidateCorpusLower: 'unrelated corpus'
      })
    ).toEqual(['History'])
  })
})
