import { describe, expect, it } from 'bun:test'

import {
  EXTRACT_SUMMARY_MAX_CHARS,
  EXTRACT_SUMMARY_MIN_CHARS,
  ExtractCompleteRequestSchema,
  parseExtractSummaryText
} from './extract-summary-proposal'

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

  it('过短 → null', () => {
    expect(
      parseExtractSummaryText(
        JSON.stringify({ summary: 'too short summary text alone' }),
        EN_SOURCE
      )
    ).toBeNull()
  })

  it('JSON summary 超 600 字 → 截断到 <=600 且 >=80', () => {
    const longBody =
      'This page explains personal libraries for finding saved pages without exact titles. '.repeat(
        12
      )
    expect(longBody.length).toBeGreaterThan(EXTRACT_SUMMARY_MAX_CHARS)
    const parsed = parseExtractSummaryText(JSON.stringify({ summary: longBody }), EN_SOURCE)
    expect(parsed).not.toBeNull()
    expect(parsed!.summary.length).toBeLessThanOrEqual(EXTRACT_SUMMARY_MAX_CHARS)
    expect(parsed!.summary.length).toBeGreaterThanOrEqual(EXTRACT_SUMMARY_MIN_CHARS)
  })

  it('含 markdown 标记 → 归一化后通过', () => {
    const withHeading = parseExtractSummaryText(
      JSON.stringify({ summary: `# Heading\n${OK_SUMMARY}` }),
      EN_SOURCE
    )
    expect(withHeading).not.toBeNull()
    expect(withHeading!.summary).not.toMatch(/[#*`]/)
    expect(withHeading!.summary.startsWith('Heading')).toBe(true)

    const withBullet = parseExtractSummaryText(
      JSON.stringify({ summary: `- bullet list style ${OK_SUMMARY}` }),
      EN_SOURCE
    )
    expect(withBullet).not.toBeNull()
    expect(withBullet!.summary).not.toMatch(/[#*`]/)
    expect(withBullet!.summary.startsWith('bullet')).toBe(true)

    const withMarks = parseExtractSummaryText(
      JSON.stringify({ summary: `**Bold** and \`code\` ${OK_SUMMARY}` }),
      EN_SOURCE
    )
    expect(withMarks).not.toBeNull()
    expect(withMarks!.summary).not.toMatch(/[#*`]/)
    expect(withMarks!.summary).toContain('Bold')
    expect(withMarks!.summary).toContain('code')
  })

  it('JSON 外带 prose 可回收', () => {
    const wrapped = `Here is the JSON:\n${JSON.stringify({ summary: OK_SUMMARY })}\nThanks.`
    const parsed = parseExtractSummaryText(wrapped, EN_SOURCE)
    expect(parsed?.summary).toBe(OK_SUMMARY)
  })

  it('代码围栏 JSON 可回收', () => {
    const fenced = `\`\`\`json\n${JSON.stringify({ summary: OK_SUMMARY })}\n\`\`\``
    const parsed = parseExtractSummaryText(fenced, EN_SOURCE)
    expect(parsed?.summary).toBe(OK_SUMMARY)
  })

  it('JSON 轻微损坏但 summary 字段可回收', () => {
    // 缺闭合花括号；summary 字符串本身完整
    const damaged = `{"summary": "${OK_SUMMARY}"`
    const parsed = parseExtractSummaryText(damaged, EN_SOURCE)
    expect(parsed?.summary).toBe(OK_SUMMARY)
  })

  it('语言粗检：正文无 CJK 时摘要含 CJK → null；中文正文摘要无 CJK → null', () => {
    expect(
      parseExtractSummaryText(JSON.stringify({ summary: `${OK_SUMMARY} 还有中文` }), EN_SOURCE)
    ).toBeNull()

    const zhSource =
      '这篇文章讲个人图书馆如何帮人找回以前存下的东西，即使记不住准确标题也能靠印象找到。'.repeat(3)
    expect(parseExtractSummaryText(JSON.stringify({ summary: OK_SUMMARY }), zhSource)).toBeNull()
  })

  it('无 summary / 空文本 → null', () => {
    expect(parseExtractSummaryText('{', EN_SOURCE)).toBeNull()
    expect(parseExtractSummaryText('{"summary":""}', EN_SOURCE)).toBeNull()
    expect(parseExtractSummaryText('', EN_SOURCE)).toBeNull()
  })
})
