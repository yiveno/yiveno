/**
 * Probe Console Vue 入口（由 frontend DEV 页挂载）。
 */

export { default as ProbeConsole } from './ProbeConsole.vue'
export * from './probe-console-client'
export {
  BUILTIN_PROBE_DATA_RECIPES,
  compareSeedResultToRecipe,
  createCustomRecipeDraft,
  estimateCuratedCounts,
  estimateNoiseDivLayerCount,
  parseProbeDataRecipeJson,
  recipeToFormState,
  stringifyProbeDataRecipe,
  type ProbeDataRecipe,
  type ProbeRecipeCompareReport
} from '../recipe/index'
export { deleteCustomRecipe, listAllRecipes, upsertCustomRecipe } from '../recipe/recipe-storage'
