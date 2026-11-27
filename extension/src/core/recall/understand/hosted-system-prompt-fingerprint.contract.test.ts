/**
 * 跨包契约：Worker hosted-system-prompts 指纹表 ↔ 扩展侧 builders。
 * 以相对路径实读 Worker 源文件；解析不到或断言失败即失败（禁止跳过）。
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { buildPortraitClusterSystemPrompt } from '@/core/portrait/portrait-cluster-prompt'
import { buildPortraitNarrativeSystemPrompt } from '@/core/portrait/portrait-narrative-prompt'
import { buildChitchatReplyMessages } from '@/core/recall/understand/build-chitchat-reply-prompt'
import { buildLlmFollowUpSystemPrompt } from '@/core/recall/understand/build-llm-follow-up-prompt'
import { buildLlmFramingSystemPrompt } from '@/core/recall/understand/build-llm-framing-prompt'
import { buildLlmNarrowExamplePolishSystemPrompt } from '@/core/recall/understand/build-llm-narrow-example-polish-prompt'
import { buildLlmParseClueMessages } from '@/core/recall/understand/build-llm-parse-prompt'

/** extension/src/core/recall/understand → 仓库根 → worker 指纹表。 */
const WORKER_FINGERPRINT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../worker/src/services/ai/hosted-system-prompts.ts'
)

type ParsedFingerprint = {
  name: string
  prefix: string
  anchors: string[]
}

/**
 * 解析 `const NAME: SystemFingerprint = { prefix, anchors }` 块。
 * 依赖 Worker 指纹表字面量形态稳定。
 */
function parseSystemFingerprints(source: string): ParsedFingerprint[] {
  const blockRe = /const\s+([A-Z_]+)\s*:\s*SystemFingerprint\s*=\s*\{([\s\S]*?)\n\}/g
  const results: ParsedFingerprint[] = []
  for (const match of source.matchAll(blockRe)) {
    const name = match[1]
    const body = match[2]
    if (!name || body == null) {
      throw new Error(`指纹块解析失败: ${match[0]?.slice(0, 80)}`)
    }
    const prefixMatch = body.match(/prefix:\s*((?:'[^']*')|(?:"[^"]*")|(?:`[^`]*`))/)
    if (!prefixMatch?.[1]) {
      // 多行 prefix：prefix:\n    '...' 或跨行拼接
      const multiPrefix = body.match(
        /prefix:\s*\n\s*((?:'[^']*')|(?:"[^"]*"))(?:\s*\+\s*((?:'[^']*')|(?:"[^"]*")))*/
      )
      if (!multiPrefix) {
        // 尝试 prefix: 后接多行单引号（本仓形态：prefix:\n    'long...'）
        const linePrefix = body.match(/prefix:\s*\n\s*'((?:\\'|[^'])*)'/)
        if (!linePrefix?.[1]) {
          throw new Error(`无法解析 prefix: ${name}`)
        }
        const anchors = parseAnchors(body)
        results.push({ name, prefix: unescapeJsString(linePrefix[1]), anchors })
        continue
      }
    }
    let prefixLiteral = prefixMatch?.[1]
    if (!prefixLiteral) {
      const linePrefix = body.match(/prefix:\s*\n\s*'((?:\\'|[^'])*)'/)
      if (!linePrefix?.[1]) {
        throw new Error(`无法解析 prefix: ${name}`)
      }
      prefixLiteral = `'${linePrefix[1]}'`
    }
    const prefix = evalStringLiteral(prefixLiteral)
    const anchors = parseAnchors(body)
    results.push({ name, prefix, anchors })
  }
  if (results.length === 0) {
    throw new Error('hosted-system-prompts 未解析到任何 SystemFingerprint')
  }
  return results
}

function parseAnchors(body: string): string[] {
  const anchorsMatch = body.match(/anchors:\s*\[([\s\S]*?)\]/)
  if (!anchorsMatch?.[1]) {
    throw new Error('无法解析 anchors 数组')
  }
  const itemRe = /'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)"/g
  const anchors: string[] = []
  for (const item of anchorsMatch[1].matchAll(itemRe)) {
    const raw = item[1] ?? item[2]
    if (raw == null) {
      continue
    }
    anchors.push(unescapeJsString(raw))
  }
  if (anchors.length === 0) {
    throw new Error('anchors 为空')
  }
  return anchors
}

function unescapeJsString(raw: string): string {
  return raw.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\')
}

function evalStringLiteral(literal: string): string {
  if (
    (literal.startsWith("'") && literal.endsWith("'")) ||
    (literal.startsWith('"') && literal.endsWith('"')) ||
    (literal.startsWith('`') && literal.endsWith('`'))
  ) {
    return unescapeJsString(literal.slice(1, -1))
  }
  throw new Error(`非字符串字面量: ${literal.slice(0, 40)}`)
}

function assertFingerprint(system: string, fp: ParsedFingerprint): void {
  expect(system.startsWith(fp.prefix), `${fp.name} prefix 不匹配`).toBe(true)
  for (const anchor of fp.anchors) {
    expect(system.includes(anchor), `${fp.name} 缺锚行: ${anchor.slice(0, 48)}`).toBe(true)
  }
}

describe('hosted-system-prompt 指纹跨包契约', () => {
  it('Worker 指纹表可达且六个 hosted kind 的 builder system 命中 prefix+anchors', () => {
    expect(
      existsSync(WORKER_FINGERPRINT_PATH),
      `Worker 指纹表不可达: ${WORKER_FINGERPRINT_PATH}`
    ).toBe(true)
    const source = readFileSync(WORKER_FINGERPRINT_PATH, 'utf8')
    const fingerprints = parseSystemFingerprints(source)
    const byName = new Map(fingerprints.map(fp => [fp.name, fp]))

    const required = [
      'NLU_PARSE',
      'NLU_CHITCHAT',
      'FRAMING_NLG',
      'FOLLOW_UP_NLG',
      'NARROW_POLISH',
      'PORTRAIT_NARRATIVE',
      'PORTRAIT_CLUSTER'
    ] as const
    for (const name of required) {
      expect(byName.has(name), `缺指纹常量 ${name}`).toBe(true)
    }

    // nlu · 解析
    assertFingerprint(
      buildLlmParseClueMessages('clue').find(m => m.role === 'system')?.content ?? '',
      byName.get('NLU_PARSE')!
    )
    // nlu · 闲聊（最小 fixture：intent=chitchat）
    assertFingerprint(
      buildChitchatReplyMessages('hello', { intent: 'chitchat' }).find(m => m.role === 'system')
        ?.content ?? '',
      byName.get('NLU_CHITCHAT')!
    )
    // framing / follow_up / narrow（system 无样例依赖）
    assertFingerprint(buildLlmFramingSystemPrompt(), byName.get('FRAMING_NLG')!)
    assertFingerprint(buildLlmFollowUpSystemPrompt(), byName.get('FOLLOW_UP_NLG')!)
    assertFingerprint(buildLlmNarrowExamplePolishSystemPrompt(), byName.get('NARROW_POLISH')!)
    // portrait（既有单测最小 locale=en）
    assertFingerprint(buildPortraitNarrativeSystemPrompt('en'), byName.get('PORTRAIT_NARRATIVE')!)
    assertFingerprint(buildPortraitClusterSystemPrompt(), byName.get('PORTRAIT_CLUSTER')!)
  })
})
