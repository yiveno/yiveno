import { describe, expect, it } from 'vitest'

import { BUILTIN_PROBE_DATA_RECIPES } from './builtin-recipes'
import {
  compareSeedResultToRecipe,
  createCustomRecipeDraft,
  estimateCuratedCounts,
  estimateNoiseDivLayerCount,
  parseProbeDataRecipeJson,
  recipeToFormState,
  stringifyProbeDataRecipe
} from './recipe-ops'

describe('probe data recipe', () => {
  it('内置约千条完整测试库预设可序列化再解析', () => {
    const quality = BUILTIN_PROBE_DATA_RECIPES.find(r => r.id === 'quality')
    expect(quality).toBeDefined()
    const roundTrip = parseProbeDataRecipeJson(stringifyProbeDataRecipe(quality!))
    expect(roundTrip.id).toBe('quality')
    expect(roundTrip.seed.diversityBookmarkCount).toBe(350)
    expect(roundTrip.source).toBe('builtin')
  })

  it('recipeToFormState 铺表单', () => {
    const curated = BUILTIN_PROBE_DATA_RECIPES.find(r => r.id === 'curated-clean')!
    const form = recipeToFormState(curated)
    expect(form.replace).toBe(true)
    expect(form.noiseBookmarkCount).toBe(0)
    expect(form.chromeBookmarkSync).toBe('curated_only')
    expect(form.personas).toEqual(['researcher', 'creator', 'developer'])
  })

  it('estimateCuratedCounts 对质量三画像为正', () => {
    const counts = estimateCuratedCounts(['researcher', 'creator', 'developer'])
    expect(counts.bookmarks).toBeGreaterThan(10)
    expect(counts.excerpts).toBeGreaterThan(5)
    expect(counts.keys.length).toBe(counts.bookmarks + counts.excerpts)
  })

  it('compareSeedResultToRecipe 全匹配为 ok', () => {
    const recipe = BUILTIN_PROBE_DATA_RECIPES.find(r => r.id === 'curated-clean')!
    const curated = estimateCuratedCounts(['researcher', 'creator', 'developer'])
    const report = compareSeedResultToRecipe(recipe, {
      persona: ['researcher', 'creator', 'developer'],
      bookmarkCount: curated.bookmarks,
      excerptCount: curated.excerpts,
      diversityBookmarkCount: 0,
      diversityExcerptCount: 0,
      noiseBookmarkCount: 0,
      noiseExcerptCount: 0,
      chromeBookmarkSync: 'curated_only',
      probeKeys: curated.keys
    })
    expect(report.ok).toBe(true)
  })

  it('compareSeedResultToRecipe 量级偏离则失败', () => {
    const recipe = BUILTIN_PROBE_DATA_RECIPES.find(r => r.id === 'extended')!
    const report = compareSeedResultToRecipe(recipe, {
      persona: ['student', 'knowledge_worker'],
      bookmarkCount: 1,
      excerptCount: 1,
      diversityBookmarkCount: 1,
      diversityExcerptCount: 1,
      noiseBookmarkCount: 1,
      noiseExcerptCount: 1,
      chromeBookmarkSync: 'curated_only',
      probeKeys: []
    })
    expect(report.ok).toBe(false)
    expect(report.rows.some(row => !row.ok && row.field === 'diversityBookmarkCount')).toBe(true)
  })

  it('createCustomRecipeDraft + noiseDiv 估计', () => {
    const draft = createCustomRecipeDraft({
      id: 'my-lab',
      label: '实验室',
      form: {
        personas: ['developer'],
        replace: false,
        diversityBookmarkCount: 10,
        diversityExcerptCount: 5,
        noiseBookmarkCount: 3,
        noiseExcerptCount: 2,
        chromeBookmarkSync: 'curated_only',
        enrichCurated: false,
        fillerSeed: 20260906
      }
    })
    expect(draft.source).toBe('custom')
    expect(estimateNoiseDivLayerCount(draft.seed)).toBe(20)
  })
})
