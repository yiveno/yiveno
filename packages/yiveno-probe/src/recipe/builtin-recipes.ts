/**
 * 内置测试数据配方（与历史一键预设对齐）。
 */

import { PROBE_DATA_RECIPE_VERSION, type ProbeDataRecipe } from './types'

/** 内置配方（不可被本机存储覆盖 id）。 */
export const BUILTIN_PROBE_DATA_RECIPES: readonly ProbeDataRecipe[] = [
  {
    version: PROBE_DATA_RECIPE_VERSION,
    id: 'quality',
    label: '约千条完整测试库（清空后写入）',
    hint: '三套手写精选 + 半仿真/无关干扰默认量；先清空再写入；精选会调 LLM 充实',
    source: 'builtin',
    seed: {
      replace: true,
      personas: ['researcher', 'creator', 'developer'],
      diversityBookmarkCount: 350,
      diversityExcerptCount: 150,
      noiseBookmarkCount: 400,
      noiseExcerptCount: 150,
      chromeBookmarkSync: 'all',
      enrichCurated: true
    }
  },
  {
    version: PROBE_DATA_RECIPE_VERSION,
    id: 'curated-clean',
    label: '仅手写精选（清空后写入）',
    hint: '只要手写精选书签/摘录；无批量随机条目；先清空；不调 LLM（快）',
    source: 'builtin',
    seed: {
      replace: true,
      personas: ['researcher', 'creator', 'developer'],
      diversityBookmarkCount: 0,
      diversityExcerptCount: 0,
      noiseBookmarkCount: 0,
      noiseExcerptCount: 0,
      chromeBookmarkSync: 'curated_only',
      enrichCurated: false
    }
  },
  {
    version: PROBE_DATA_RECIPE_VERSION,
    id: 'extended',
    label: '学生与知识工作者精选（清空后写入）',
    hint: 'student + knowledge_worker 手写精选 + 少量半仿真/干扰；先清空；不调 LLM',
    source: 'builtin',
    seed: {
      replace: true,
      personas: ['student', 'knowledge_worker'],
      diversityBookmarkCount: 120,
      diversityExcerptCount: 60,
      noiseBookmarkCount: 80,
      noiseExcerptCount: 40,
      chromeBookmarkSync: 'curated_only',
      enrichCurated: false
    }
  },
  {
    version: PROBE_DATA_RECIPE_VERSION,
    id: 'append-curated',
    label: '追加手写精选（不清空）',
    hint: '不清空现有库；只加当前勾选主题包的手写精选；可能与已有条目重复',
    source: 'builtin',
    seed: {
      replace: false,
      diversityBookmarkCount: 0,
      diversityExcerptCount: 0,
      noiseBookmarkCount: 0,
      noiseExcerptCount: 0,
      chromeBookmarkSync: 'curated_only',
      enrichCurated: false
    }
  }
]

export function getBuiltinRecipeById(id: string): ProbeDataRecipe | undefined {
  return BUILTIN_PROBE_DATA_RECIPES.find(recipe => recipe.id === id)
}
