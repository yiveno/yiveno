/**
 * 本机自定义配方存储（Probe Console localStorage）。
 * 扩展页有 localStorage；SW 不使用本模块。
 */

import { BUILTIN_PROBE_DATA_RECIPES } from './builtin-recipes'
import { parseProbeDataRecipe } from './recipe-ops'
import type { ProbeDataRecipe } from './types'

export const PROBE_CUSTOM_RECIPES_STORAGE_KEY = 'yiveno.probe.dataRecipes.v1'

function readRawList(): unknown[] {
  try {
    const raw = localStorage.getItem(PROBE_CUSTOM_RECIPES_STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 读取本机自定义配方（跳过损坏条目）。 */
export function loadCustomRecipes(): ProbeDataRecipe[] {
  const out: ProbeDataRecipe[] = []
  for (const item of readRawList()) {
    try {
      const recipe = parseProbeDataRecipe(item)
      if (recipe.source === 'builtin') {
        continue
      }
      out.push({ ...recipe, source: 'custom' })
    } catch {
      // 跳过坏条目
    }
  }
  return out
}

export function saveCustomRecipes(recipes: readonly ProbeDataRecipe[]): void {
  const cleaned = recipes
    .filter(recipe => recipe.source === 'custom')
    .map(recipe => ({ ...recipe, source: 'custom' as const }))
  localStorage.setItem(PROBE_CUSTOM_RECIPES_STORAGE_KEY, JSON.stringify(cleaned))
}

/** 写入或覆盖同 id 自定义配方；禁止覆盖 builtin id。 */
export function upsertCustomRecipe(recipe: ProbeDataRecipe): ProbeDataRecipe[] {
  if (BUILTIN_PROBE_DATA_RECIPES.some(builtin => builtin.id === recipe.id)) {
    throw new Error(`不可覆盖内置配方 id：${recipe.id}`)
  }
  const next = loadCustomRecipes().filter(item => item.id !== recipe.id)
  next.unshift({ ...recipe, source: 'custom', updatedAtIso: new Date().toISOString() })
  saveCustomRecipes(next)
  return next
}

export function deleteCustomRecipe(id: string): ProbeDataRecipe[] {
  const next = loadCustomRecipes().filter(item => item.id !== id)
  saveCustomRecipes(next)
  return next
}

/** 内置 + 本机自定义。 */
export function listAllRecipes(): ProbeDataRecipe[] {
  return [...BUILTIN_PROBE_DATA_RECIPES, ...loadCustomRecipes()]
}
