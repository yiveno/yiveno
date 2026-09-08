/**
 * 一键预设 = 内置配方的薄封装（兼容旧 Console API）。
 */

import { BUILTIN_PROBE_DATA_RECIPES } from '../recipe/builtin-recipes'
import type { ProbeSeedPayload } from './seed-payload'

export type { ProbeSeedPayload } from './seed-payload'

export type ProbeSeedPreset = {
  id: string
  label: string
  hint: string
  payload: ProbeSeedPayload
}

/** 一键生成档（由内置配方派生）。 */
export const PROBE_SEED_PRESETS: readonly ProbeSeedPreset[] = BUILTIN_PROBE_DATA_RECIPES.map(
  recipe => ({
    id: recipe.id,
    label: `一键·${recipe.label}`,
    hint: recipe.hint,
    payload: { ...recipe.seed }
  })
)
