import { describe, expect, it } from 'bun:test'

import { ExtractCompleteRequestSchema, parseExtractSummaryText } from './extract-summary-proposal'

const EN_SOURCE =
  'This article explains how personal libraries help people find things they saved earlier without exact titles.'

const OK_SUMMARY =
  'This page explains how personal libraries help people find things they saved earlier, even without exact titles or keywords from the original page.'

describe('extract-summary-proposal', () => {
  it('text 超 12000 → 校验失败', () => {
    const over = ExtractCompleteRequestSchema.safeParse({
      url: 'https://example.com/long',
      text: 'x'.repeat(12_001)
    })
    expect(over.success).toBe(false)
  })

  it('解析 JSON summary', () => {
    const parsed = parseExtractSummaryText(JSON.stringify({ summary: OK_SUMMARY }), EN_SOURCE)
    expect(parsed?.summary).toBe(OK_SUMMARY)
  })

  it('过短 / 过长 → null', () => {
    expect(
      parseExtractSummaryText(
        JSON.stringify({ summary: 'too short summary text alone' }),
        EN_SOURCE
      )
    ).toBeNull()
    expect(
      parseExtractSummaryText(JSON.stringify({ summary: 'x'.repeat(601) }), EN_SOURCE)
    ).toBeNull()
  })

  it('含 markdown 标记 → null', () => {
    expect(
      parseExtractSummaryText(JSON.stringify({ summary: `# Heading\n${OK_SUMMARY}` }), EN_SOURCE)
    ).toBeNull()
    expect(
      parseExtractSummaryText(
        JSON.stringify({ summary: `- bullet list style ${OK_SUMMARY}` }),
        EN_SOURCE
      )
    ).toBeNull()
  })

  it('语言粗检：正文无 CJK 时摘要含 CJK → null；中文正文摘要无 CJK → null', () => {
    expect(
      parseExtractSummaryText(JSON.stringify({ summary: `${OK_SUMMARY} 还有中文` }), EN_SOURCE)
    ).toBeNull()

    const zhSource =
      '这篇文章讲个人图书馆如何帮人找回以前存下的东西，即使记不住准确标题也能靠印象找到。'.repeat(3)
    expect(parseExtractSummaryText(JSON.stringify({ summary: OK_SUMMARY }), zhSource)).toBeNull()
  })

  it('解析失败返回 null（handler 据此 422 且不 commit 扣费）', () => {
    expect(parseExtractSummaryText('{', EN_SOURCE)).toBeNull()
    expect(parseExtractSummaryText('{"summary":""}', EN_SOURCE)).toBeNull()
    expect(parseExtractSummaryText('', EN_SOURCE)).toBeNull()
  })
})
