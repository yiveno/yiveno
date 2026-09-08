/**
 * 配方纯函数：解析 / 序列化 / 表单互转 / 种库结果对照。
 */

import { DEFAULT_PROBE_FILLER_SEED } from '../corpus/prng'
import { resolveProbeCorpora } from '../corpus/index'
import type { RecallProbePersonaId } from '../corpus/types'
import type { ProbeSeedPayload } from '../presets/seed-payload'
import {
  PROBE_DATA_RECIPE_VERSION,
  type ProbeDataRecipe,
  type ProbeRecipeCompareReport,
  type ProbeRecipeCompareRow,
  type ProbeRecipeFormState,
  type ProbeSeedResultCounts
} from './types'

const PERSONA_IDS: readonly RecallProbePersonaId[] = [
  'researcher',
  'creator',
  'developer',
  'student',
  'knowledge_worker'
]

function isPersonaId(value: unknown): value is RecallProbePersonaId {
  return typeof value === 'string' && (PERSONA_IDS as readonly string[]).includes(value)
}

function asNonNegInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return Math.max(0, Math.floor(value))
}

/** 从表单状态组装配方 seed。 */
export function formStateToSeedPayload(form: ProbeRecipeFormState): ProbeSeedPayload {
  return {
    replace: form.replace,
    personas: [...form.personas],
    diversityBookmarkCount: form.diversityBookmarkCount,
    diversityExcerptCount: form.diversityExcerptCount,
    noiseBookmarkCount: form.noiseBookmarkCount,
    noiseExcerptCount: form.noiseExcerptCount,
    chromeBookmarkSync: form.chromeBookmarkSync,
    enrichCurated: form.enrichCurated,
    fillerSeed: form.fillerSeed
  }
}

/** 把配方 seed 铺到表单（缺省字段给安全默认）。 */
export function recipeToFormState(recipe: ProbeDataRecipe): ProbeRecipeFormState {
  const seed = recipe.seed
  const personas = (seed.personas ?? ['researcher', 'creator', 'developer']).filter(isPersonaId)
  return {
    personas: personas.length > 0 ? personas : ['researcher', 'creator', 'developer'],
    replace: seed.replace === true,
    diversityBookmarkCount: asNonNegInt(seed.diversityBookmarkCount, 0),
    diversityExcerptCount: asNonNegInt(seed.diversityExcerptCount, 0),
    noiseBookmarkCount: asNonNegInt(seed.noiseBookmarkCount, 0),
    noiseExcerptCount: asNonNegInt(seed.noiseExcerptCount, 0),
    chromeBookmarkSync: seed.chromeBookmarkSync === 'all' ? 'all' : 'curated_only',
    enrichCurated: seed.enrichCurated === true,
    fillerSeed: asNonNegInt(seed.fillerSeed, DEFAULT_PROBE_FILLER_SEED)
  }
}

/** 估计精选条数（按当前语料包；可选 curatedKeys 过滤期望）。 */
export function estimateCuratedCounts(
  personas: readonly RecallProbePersonaId[],
  curatedKeys?: readonly string[]
): { bookmarks: number; excerpts: number; keys: string[] } {
  const corpora = resolveProbeCorpora(personas)
  const keySet = curatedKeys && curatedKeys.length > 0 ? new Set(curatedKeys) : null
  const keys: string[] = []
  let bookmarks = 0
  let excerpts = 0
  for (const corpus of corpora) {
    for (const bm of corpus.bookmarks) {
      if (keySet && !keySet.has(bm.key)) {
        continue
      }
      bookmarks += 1
      keys.push(bm.key)
    }
    for (const ex of corpus.excerpts) {
      if (keySet && !keySet.has(ex.key)) {
        continue
      }
      excerpts += 1
      keys.push(ex.key)
    }
  }
  return { bookmarks, excerpts, keys }
}

/** 估计噪声+多样性层总量（与 purge 分类口径近似）。 */
export function estimateNoiseDivLayerCount(seed: ProbeSeedPayload): number {
  return (
    asNonNegInt(seed.diversityBookmarkCount, 0) +
    asNonNegInt(seed.diversityExcerptCount, 0) +
    asNonNegInt(seed.noiseBookmarkCount, 0) +
    asNonNegInt(seed.noiseExcerptCount, 0)
  )
}

function pushRow(
  rows: ProbeRecipeCompareRow[],
  field: string,
  expected: string | number,
  actual: string | number
): void {
  rows.push({
    field,
    expected,
    actual,
    ok: expected === actual
  })
}

/**
 * 对照种库响应与配方期望（diversity/noise/画像/chrome；精选条数按语料估计）。
 */
export function compareSeedResultToRecipe(
  recipe: ProbeDataRecipe,
  result: ProbeSeedResultCounts
): ProbeRecipeCompareReport {
  const form = recipeToFormState(recipe)
  const curated = estimateCuratedCounts(form.personas, recipe.curatedKeys)
  const rows: ProbeRecipeCompareRow[] = []

  pushRow(rows, 'personas', form.personas.join(','), result.persona.join(','))
  pushRow(
    rows,
    'diversityBookmarkCount',
    form.diversityBookmarkCount,
    result.diversityBookmarkCount
  )
  pushRow(rows, 'diversityExcerptCount', form.diversityExcerptCount, result.diversityExcerptCount)
  pushRow(rows, 'noiseBookmarkCount', form.noiseBookmarkCount, result.noiseBookmarkCount)
  pushRow(rows, 'noiseExcerptCount', form.noiseExcerptCount, result.noiseExcerptCount)
  pushRow(rows, 'chromeBookmarkSync', form.chromeBookmarkSync, result.chromeBookmarkSync)
  pushRow(rows, 'curatedBookmarks(est)', curated.bookmarks, result.bookmarkCount)
  pushRow(rows, 'curatedExcerpts(est)', curated.excerpts, result.excerptCount)

  if (recipe.curatedKeys && recipe.curatedKeys.length > 0) {
    const missing = recipe.curatedKeys.filter(key => !result.probeKeys.includes(key))
    pushRow(rows, 'curatedKeysMissing', 0, missing.length)
  }

  return {
    recipeId: recipe.id,
    recipeLabel: recipe.label,
    ok: rows.every(row => row.ok),
    rows
  }
}

/** 从当前表单创建自定义配方草稿。 */
export function createCustomRecipeDraft(input: {
  id: string
  label: string
  hint?: string
  form: ProbeRecipeFormState
  curatedKeys?: string[]
  notes?: string
}): ProbeDataRecipe {
  const now = new Date().toISOString()
  const recipe: ProbeDataRecipe = {
    version: PROBE_DATA_RECIPE_VERSION,
    id: input.id.trim() || `custom-${Date.now()}`,
    label: input.label.trim() || '未命名配方',
    hint: input.hint?.trim() || '本机自定义配方',
    source: 'custom',
    seed: formStateToSeedPayload(input.form),
    updatedAtIso: now
  }
  if (input.curatedKeys && input.curatedKeys.length > 0) {
    recipe.curatedKeys = [...input.curatedKeys]
  }
  if (input.notes && input.notes.trim().length > 0) {
    recipe.notes = input.notes.trim()
  }
  return recipe
}

/** 解析 JSON 配方（严格 version=1）。 */
export function parseProbeDataRecipe(raw: unknown): ProbeDataRecipe {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('配方须为 JSON 对象')
  }
  const value = raw as Record<string, unknown>
  if (value.version !== PROBE_DATA_RECIPE_VERSION) {
    throw new Error(`不支持的配方 version：${String(value.version)}`)
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error('配方缺少 id')
  }
  if (typeof value.label !== 'string' || value.label.length === 0) {
    throw new Error('配方缺少 label')
  }
  if (value.seed === null || typeof value.seed !== 'object') {
    throw new Error('配方缺少 seed')
  }
  const seedRaw = value.seed as Record<string, unknown>
  const personasRaw = seedRaw.personas
  const personas: RecallProbePersonaId[] = Array.isArray(personasRaw)
    ? personasRaw.filter(isPersonaId)
    : ['researcher', 'creator', 'developer']

  const seed: ProbeSeedPayload = {
    replace: seedRaw.replace === true,
    personas: personas.length > 0 ? personas : ['researcher', 'creator', 'developer'],
    diversityBookmarkCount: asNonNegInt(seedRaw.diversityBookmarkCount, 0),
    diversityExcerptCount: asNonNegInt(seedRaw.diversityExcerptCount, 0),
    noiseBookmarkCount: asNonNegInt(seedRaw.noiseBookmarkCount, 0),
    noiseExcerptCount: asNonNegInt(seedRaw.noiseExcerptCount, 0),
    chromeBookmarkSync: seedRaw.chromeBookmarkSync === 'all' ? 'all' : 'curated_only',
    enrichCurated: seedRaw.enrichCurated === true,
    fillerSeed: asNonNegInt(seedRaw.fillerSeed, DEFAULT_PROBE_FILLER_SEED)
  }

  const recipe: ProbeDataRecipe = {
    version: PROBE_DATA_RECIPE_VERSION,
    id: value.id,
    label: value.label,
    hint: typeof value.hint === 'string' ? value.hint : '',
    source: value.source === 'builtin' ? 'builtin' : 'custom',
    seed
  }

  if (Array.isArray(value.curatedKeys)) {
    recipe.curatedKeys = value.curatedKeys.filter(
      (key): key is string => typeof key === 'string' && key.length > 0
    )
  }
  if (typeof value.notes === 'string' && value.notes.length > 0) {
    recipe.notes = value.notes
  }
  if (typeof value.updatedAtIso === 'string') {
    recipe.updatedAtIso = value.updatedAtIso
  }
  return recipe
}

export function stringifyProbeDataRecipe(recipe: ProbeDataRecipe): string {
  return `${JSON.stringify(recipe, null, 2)}\n`
}

export function parseProbeDataRecipeJson(text: string): ProbeDataRecipe {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('配方 JSON 解析失败')
  }
  return parseProbeDataRecipe(parsed)
}
