/**
 * 加载合成 Clue 测试集（Stage 1 · 仅 harness）。
 * 纯 Zod + JSON import；无 node:fs（可进 tsconfig.app）。
 */

import { z } from 'zod'

import type { ClueChainCase, ClueChainCategory } from './types'
import clue20Expected from './fixtures/clue20_expected.json'
import clue50Phase1Fixed from './fixtures/clue50_phase1_fixed.json'

const CategorySchema = z.enum(['A', 'B', 'C', 'D'])

const ExpectedSchema = z.object({
  intent: z.enum(['recall', 'non_recall']),
  topic: z.string().nullable(),
  time: z.string().nullable(),
  time_certainty: z.enum(['high', 'medium', 'low']).nullable(),
  type: z.string().nullable(),
  entities: z.array(z.string()),
  behavior: z.string().nullable(),
  certainty: z.enum(['high', 'medium', 'low'])
})

const CaseSchema = z.object({
  id: z.string().min(1),
  category: CategorySchema,
  clue: z.string().min(1),
  expected: ExpectedSchema,
  difficulty: z.string(),
  note: z.string()
})

const CasesSchema = z.array(CaseSchema)

export const DEFAULT_CLUE_CHAIN_FIXTURE_FILES = [
  'clue20_expected.json',
  'clue50_phase1_fixed.json'
] as const

const FIXTURE_MODULES: Record<(typeof DEFAULT_CLUE_CHAIN_FIXTURE_FILES)[number], unknown> = {
  'clue20_expected.json': clue20Expected,
  'clue50_phase1_fixed.json': clue50Phase1Fixed
}

/** 解析并校验单文件用例数组（不改 JSON 原文；仅运行时校验）。 */
export function parseClueChainCasesJson(raw: unknown, label: string): ClueChainCase[] {
  const parsed = CasesSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`clue-chain fixture 无效（${label}）：${parsed.error.message}`)
  }
  return parsed.data.map(item => ({
    ...item,
    category: item.category as ClueChainCategory
  }))
}

/**
 * 加载默认（或指定）fixture。
 * `fixtureFiles` 返回逻辑名（非绝对路径），便于报告与 Node CLI 对照。
 */
export function loadClueChainCasesFromFixtures(
  fileNames: readonly string[] = DEFAULT_CLUE_CHAIN_FIXTURE_FILES
): { cases: ClueChainCase[]; fixtureFiles: string[] } {
  const cases: ClueChainCase[] = []
  const fixtureFiles: string[] = []
  for (const name of fileNames) {
    const mod = FIXTURE_MODULES[name as keyof typeof FIXTURE_MODULES]
    if (mod === undefined) {
      throw new Error(`clue-chain 未知 fixture：${name}`)
    }
    const batch = parseClueChainCasesJson(mod, name)
    cases.push(...batch)
    fixtureFiles.push(`extension/tests/eval/clue-chain/fixtures/${name}`)
  }
  const ids = new Set<string>()
  for (const item of cases) {
    if (ids.has(item.id)) {
      throw new Error(`clue-chain fixture id 重复：${item.id}`)
    }
    ids.add(item.id)
  }
  return { cases, fixtureFiles }
}
