/**
 * 加载合成 Clue 测试集（Stage 1 · 仅 harness）。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

import type { ClueChainCase, ClueChainCategory } from '@/core/recall/eval/clue-chain/types'

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

const here = dirname(fileURLToPath(import.meta.url))

/** 默认 fixture 目录（与本文件同树）。 */
export const CLUE_CHAIN_FIXTURES_DIR = resolve(here, 'fixtures')

export const DEFAULT_CLUE_CHAIN_FIXTURE_FILES = [
  'clue20_expected.json',
  'clue50_phase1_fixed.json'
] as const

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

/** 从磁盘读 fixture；`fileNames` 相对 fixtures 目录。 */
export function loadClueChainCasesFromFixtures(
  fileNames: readonly string[] = DEFAULT_CLUE_CHAIN_FIXTURE_FILES,
  fixturesDir: string = CLUE_CHAIN_FIXTURES_DIR
): { cases: ClueChainCase[]; fixtureFiles: string[] } {
  const cases: ClueChainCase[] = []
  const fixtureFiles: string[] = []
  for (const name of fileNames) {
    const path = resolve(fixturesDir, name)
    const text = readFileSync(path, 'utf8')
    const json: unknown = JSON.parse(text)
    const batch = parseClueChainCasesJson(json, name)
    cases.push(...batch)
    fixtureFiles.push(path)
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
