<script setup lang="ts">
/**
 * DEV-only 测试工作台：写入测试数据 + 清理 + 批量探针跑分。
 * 禁止冒充 §5.9。
 */

import { computed, onMounted, onUnmounted, ref } from 'vue'

import { RECALL_PROBE_PERSONA_ORDER, type RecallProbePersonaId } from '../corpus/index'
import { DEFAULT_PROBE_FILLER_SEED } from '../corpus/prng'
import {
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
import { deleteCustomRecipe, listAllRecipes, upsertCustomRecipe } from '../recipe/recipe-storage'
import type { ProbeSeedPayload } from '../presets/seed-payload'
import {
  probeCleanup,
  probeDiffRuns,
  probeGetBatchProgress,
  probeGetRun,
  probeListRuns,
  probeRunBatch,
  probeSeedRecall,
  type ProbeBatchProgressView,
  type ProbeBatchReportView,
  type ProbeCleanupPayload,
  type ProbeDiffRow,
  type ProbeRunHistorySummary
} from './probe-console-client'

defineOptions({ name: 'ProbeConsole' })

const PERSONA_ORDER = RECALL_PROBE_PERSONA_ORDER

const busy = ref(false)
const statusLine = ref('就绪')
const lastProbeKeys = ref<string[]>([])

const seedPersonas = ref<string[]>(['researcher', 'creator', 'developer'])
const seedReplace = ref(false)
const diversityBookmarkCount = ref(80)
const diversityExcerptCount = ref(40)
const noiseBookmarkCount = ref(40)
const noiseExcerptCount = ref(20)
/** 每画像混淆组数；Console 缺省 2 */
const clusterBookmarkCount = ref(2)
const clusterExcerptCount = ref(2)
const chromeBookmarkSync = ref<'all' | 'curated_only'>('all')
const enrichCurated = ref(false)
const fillerSeed = ref(DEFAULT_PROBE_FILLER_SEED)

const recipeCatalog = ref<ProbeDataRecipe[]>([...BUILTIN_PROBE_DATA_RECIPES])
const selectedRecipeId = ref('curated-clean')
const recipeSaveLabel = ref('')
const recipeSaveId = ref('')
const recipeJsonText = ref('')
const lastRecipeCompare = ref<ProbeRecipeCompareReport | null>(null)
const activeRecipeLabel = ref('')
const showJsonPanel = ref(false)

/** 清理选项 */
const cleanNoiseOrDiversity = ref(true)
const cleanCuratedProbe = ref(false)
const cleanAllMemory = ref(false)
const cleanTypes = ref<'all' | 'bookmark' | 'text_excerpt'>('all')
const cleanRemoveProbeFolder = ref(true)
const cleanWipeChromeChildren = ref(false)

/** 批量探针跑分区 */
const runBusy = ref(false)
const runProgress = ref<ProbeBatchProgressView | null>(null)
const lastRunReport = ref<ProbeBatchReportView | null>(null)
const lastRunId = ref('')
const runHistory = ref<ProbeRunHistorySummary[]>([])
const diffBeforeRunId = ref('')
const diffAfterRunId = ref('')
const lastDiffRows = ref<ProbeDiffRow[]>([])
let progressPollTimer: ReturnType<typeof setInterval> | null = null

const selectedRecipe = computed(() =>
  recipeCatalog.value.find(recipe => recipe.id === selectedRecipeId.value)
)

const runAggregateLine = computed(() => {
  const agg = lastRunReport.value?.aggregates
  if (!agg) {
    return ''
  }
  const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`
  const clueTypeBits = Object.entries(agg.byClueType ?? {})
    .map(([type, stats]) => {
      const judged = stats.top1 + stats.in_topk + stats.miss
      const rate = judged === 0 ? 0 : stats.top1 / judged
      return `${type} ${pct(rate)}`
    })
    .join(' · ')
  const clusterBit =
    agg.clusters && agg.clusters.total > 0
      ? ` · cluster anyHit ${pct(agg.clusters.anyHitRate)} preferredTop1 ${pct(agg.clusters.preferredTop1Rate)}`
      : ''
  const negBit =
    agg.negatives && agg.negatives.total > 0
      ? ` · neg FP ${pct(agg.negatives.falsePositiveRate)} (n=${agg.negatives.total})`
      : ''
  const clueBit = clueTypeBits ? ` · byType[${clueTypeBits}]` : ''
  return `top1 ${pct(agg.top1Rate)} · in-top3 ${pct(agg.inTop3Rate)} · miss ${pct(agg.missRate)} · unmapped ${agg.unmappedCount} · p50 ${Math.round(agg.latencyMs.p50)}ms · p95 ${Math.round(agg.latencyMs.p95)}ms · n=${agg.total}${clueBit}${clusterBit}${negBit}`
})

const recipeEstimate = computed(() => {
  const personas = seedPersonas.value.filter((id): id is RecallProbePersonaId =>
    PERSONA_ORDER.includes(id as RecallProbePersonaId)
  )
  const curated = estimateCuratedCounts(
    personas.length > 0 ? personas : ['researcher', 'creator', 'developer']
  )
  const noiseDiv = estimateNoiseDivLayerCount({
    diversityBookmarkCount: diversityBookmarkCount.value,
    diversityExcerptCount: diversityExcerptCount.value,
    noiseBookmarkCount: noiseBookmarkCount.value,
    noiseExcerptCount: noiseExcerptCount.value
  })
  return {
    curatedBookmarks: curated.bookmarks,
    curatedExcerpts: curated.excerpts,
    curatedKeys: curated.keys.length,
    noiseDiv
  }
})

function currentFormState() {
  return {
    personas: seedPersonas.value.filter((id): id is RecallProbePersonaId =>
      PERSONA_ORDER.includes(id as RecallProbePersonaId)
    ),
    replace: seedReplace.value,
    diversityBookmarkCount: diversityBookmarkCount.value,
    diversityExcerptCount: diversityExcerptCount.value,
    noiseBookmarkCount: noiseBookmarkCount.value,
    noiseExcerptCount: noiseExcerptCount.value,
    clusterBookmarkCount: clusterBookmarkCount.value,
    clusterExcerptCount: clusterExcerptCount.value,
    chromeBookmarkSync: chromeBookmarkSync.value,
    enrichCurated: enrichCurated.value,
    fillerSeed: fillerSeed.value
  }
}

function applyFormState(form: ReturnType<typeof currentFormState>): void {
  seedPersonas.value = [...form.personas]
  seedReplace.value = form.replace
  diversityBookmarkCount.value = form.diversityBookmarkCount
  diversityExcerptCount.value = form.diversityExcerptCount
  noiseBookmarkCount.value = form.noiseBookmarkCount
  noiseExcerptCount.value = form.noiseExcerptCount
  clusterBookmarkCount.value = form.clusterBookmarkCount
  clusterExcerptCount.value = form.clusterExcerptCount
  chromeBookmarkSync.value = form.chromeBookmarkSync
  enrichCurated.value = form.enrichCurated
  fillerSeed.value = form.fillerSeed
}

function setStatus(text: string): void {
  statusLine.value = text
}

function refreshRecipeCatalog(): void {
  try {
    recipeCatalog.value = listAllRecipes()
  } catch {
    recipeCatalog.value = [...BUILTIN_PROBE_DATA_RECIPES]
  }
}

function findRecipe(id: string): ProbeDataRecipe | undefined {
  return recipeCatalog.value.find(recipe => recipe.id === id)
}

function loadRecipeToForm(recipe: ProbeDataRecipe): void {
  applyFormState(recipeToFormState(recipe))
  selectedRecipeId.value = recipe.id
  activeRecipeLabel.value = recipe.label
  recipeJsonText.value = stringifyProbeDataRecipe(recipe)
  lastRecipeCompare.value = null
  setStatus(`已载入「${recipe.label}」`)
}

function onSelectRecipe(): void {
  const recipe = findRecipe(selectedRecipeId.value)
  if (!recipe) {
    setStatus('未找到预设')
    return
  }
  loadRecipeToForm(recipe)
}

async function runSelectedRecipe(): Promise<void> {
  const recipe = findRecipe(selectedRecipeId.value)
  if (!recipe) {
    setStatus('未找到预设')
    return
  }
  loadRecipeToForm(recipe)
  const personasOverride =
    recipe.id === 'append-curated' ? (seedPersonas.value as RecallProbePersonaId[]) : undefined
  const payload = {
    ...recipe.seed,
    ...(personasOverride !== undefined ? { personas: personasOverride } : {}),
    fillerSeed: fillerSeed.value,
    recipeId: recipe.id
  }
  await runSeedWithPayload(payload, {
    label: recipe.label,
    recipe
  })
}

function saveFormAsRecipe(): void {
  const label = recipeSaveLabel.value.trim() || `自定义 ${new Date().toLocaleString()}`
  const id =
    recipeSaveId.value.trim() ||
    `custom-${label
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
      .slice(0, 40)}-${Date.now()}`
  try {
    const draft = createCustomRecipeDraft({
      id,
      label,
      hint: '本机保存的测试数据预设',
      form: currentFormState()
    })
    upsertCustomRecipe(draft)
    refreshRecipeCatalog()
    selectedRecipeId.value = draft.id
    recipeJsonText.value = stringifyProbeDataRecipe(draft)
    recipeSaveLabel.value = ''
    recipeSaveId.value = ''
    setStatus(`已保存「${draft.label}」`)
  } catch (error) {
    setStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

function deleteSelectedCustomRecipe(): void {
  const recipe = findRecipe(selectedRecipeId.value)
  if (!recipe || recipe.source !== 'custom') {
    setStatus('只能删除本机自定义预设')
    return
  }
  deleteCustomRecipe(recipe.id)
  refreshRecipeCatalog()
  selectedRecipeId.value = 'curated-clean'
  const builtin = findRecipe('curated-clean')
  if (builtin) {
    loadRecipeToForm(builtin)
  }
  setStatus(`已删除预设 ${recipe.id}`)
}

function exportSelectedRecipe(): void {
  const recipe = findRecipe(selectedRecipeId.value)
  if (!recipe) {
    setStatus('未找到预设')
    return
  }
  recipeJsonText.value = stringifyProbeDataRecipe(recipe)
  showJsonPanel.value = true
  setStatus(`已导出「${recipe.label}」`)
}

function importRecipeFromJson(): void {
  try {
    const recipe = parseProbeDataRecipeJson(recipeJsonText.value)
    if (recipe.source === 'builtin' || BUILTIN_PROBE_DATA_RECIPES.some(b => b.id === recipe.id)) {
      loadRecipeToForm(recipe)
      setStatus(`已载入只读预设「${recipe.label}」`)
      return
    }
    const saved = upsertCustomRecipe({ ...recipe, source: 'custom' })
    refreshRecipeCatalog()
    const latest = saved[0]
    if (latest) {
      loadRecipeToForm(latest)
    }
    setStatus(`已导入并保存「${recipe.label}」`)
  } catch (error) {
    setStatus(`导入失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

function togglePersona(id: string): void {
  if (seedPersonas.value.includes(id)) {
    seedPersonas.value = seedPersonas.value.filter(p => p !== id)
  } else {
    seedPersonas.value = [...seedPersonas.value, id]
  }
}

async function runSeedWithPayload(
  partial: Partial<ProbeSeedPayload>,
  options: {
    label: string
    recipe?: ProbeDataRecipe
  }
): Promise<void> {
  if (seedPersonas.value.length === 0 && !partial.personas) {
    setStatus('至少选一个精选主题包')
    return
  }

  const payload: Partial<ProbeSeedPayload> = {
    ...partial,
    personas: (partial.personas ?? seedPersonas.value) as NonNullable<ProbeSeedPayload['personas']>,
    recipeId: partial.recipeId ?? options.recipe?.id ?? selectedRecipeId.value
  }

  busy.value = true
  setStatus(`写入中：${options.label}…`)
  try {
    const res = await probeSeedRecall(payload)
    if (!res.ok) {
      setStatus(`写入失败：${res.errorCode} ${res.error ?? ''}`)
      lastRecipeCompare.value = null
      return
    }
    lastProbeKeys.value = res.probeKeys.slice(0, 40)
    if (options.recipe) {
      lastRecipeCompare.value = compareSeedResultToRecipe(options.recipe, {
        persona: res.persona,
        bookmarkCount: res.bookmarkCount,
        excerptCount: res.excerptCount,
        diversityBookmarkCount: res.diversityBookmarkCount,
        diversityExcerptCount: res.diversityExcerptCount,
        noiseBookmarkCount: res.noiseBookmarkCount,
        noiseExcerptCount: res.noiseExcerptCount,
        chromeBookmarkSync: res.chromeBookmarkSync,
        probeKeys: res.probeKeys
      })
      activeRecipeLabel.value = options.recipe.label
    } else {
      lastRecipeCompare.value = null
    }
    const compareHint =
      lastRecipeCompare.value === null
        ? ''
        : lastRecipeCompare.value.ok
          ? ' · 对照✓'
          : ' · 对照有偏差'
    const replaceHint = payload.replace === true ? ' · 已先清空' : ''
    setStatus(
      `${options.label}完成 · 书签 ${res.bookmarkCount} · 摘录 ${res.excerptCount} · 半仿真 ${res.diversityBookmarkCount}/${res.diversityExcerptCount} · 干扰 ${res.noiseBookmarkCount}/${res.noiseExcerptCount} · 混淆组 ${res.clusterBookmarkCount ?? 0}/${res.clusterExcerptCount ?? 0} · 精选键 ${res.probeKeys.length} · 映射 ${res.mappedCount}${compareHint}${replaceHint}`
    )
  } finally {
    busy.value = false
  }
}

async function runCustomSeed(): Promise<void> {
  await runSeedWithPayload(
    {
      replace: seedReplace.value,
      personas: seedPersonas.value as NonNullable<ProbeSeedPayload['personas']>,
      diversityBookmarkCount: diversityBookmarkCount.value,
      diversityExcerptCount: diversityExcerptCount.value,
      noiseBookmarkCount: noiseBookmarkCount.value,
      noiseExcerptCount: noiseExcerptCount.value,
      clusterBookmarkCount: clusterBookmarkCount.value,
      clusterExcerptCount: clusterExcerptCount.value,
      chromeBookmarkSync: chromeBookmarkSync.value,
      enrichCurated: enrichCurated.value,
      fillerSeed: fillerSeed.value
    },
    {
      label: '按参数写入'
    }
  )
}

function reshuffleFillerSeed(): void {
  fillerSeed.value = (Date.now() ^ (Math.floor(Math.random() * 0xffff_ffff) >>> 0)) >>> 0
  setStatus(`已换随机种子 ${fillerSeed.value}`)
}

function currentCleanupPayload(): ProbeCleanupPayload {
  return {
    noiseOrDiversity: cleanNoiseOrDiversity.value,
    curatedProbe: cleanCuratedProbe.value,
    allMemory: cleanAllMemory.value,
    types: cleanTypes.value,
    removeProbeFolder: cleanRemoveProbeFolder.value,
    wipeChromeBookmarkChildren: cleanWipeChromeChildren.value
  }
}

async function runCleanupWithPayload(payload: ProbeCleanupPayload, label: string): Promise<void> {
  if (!payload.allMemory && !payload.noiseOrDiversity && !payload.curatedProbe) {
    setStatus('至少选一类：半仿真与干扰、手写精选测试条目，或整库')
    return
  }
  busy.value = true
  setStatus(`清理中：${label}…`)
  try {
    const res = await probeCleanup(payload)
    if (!res.ok) {
      setStatus(`清理失败：${res.errorCode} ${res.error ?? ''}`)
      return
    }
    setStatus(
      `${label}完成 · 已删书签 ${res.purgedBookmarkCount} · 已删摘录 ${res.purgedExcerptCount} · 保留 ${res.keptCount} · 移除种库主题文件夹 ${res.removedChromeProbeFolder} · 清空书签栏子树 ${res.wipedChromeFolders}`
    )
  } finally {
    busy.value = false
  }
}

async function runCleanupCustom(): Promise<void> {
  await runCleanupWithPayload(currentCleanupPayload(), '按选项清理')
}

async function runCleanupNoise(): Promise<void> {
  cleanNoiseOrDiversity.value = true
  cleanCuratedProbe.value = false
  cleanAllMemory.value = false
  cleanRemoveProbeFolder.value = true
  cleanWipeChromeChildren.value = false
  await runCleanupWithPayload(currentCleanupPayload(), '清除半仿真与干扰')
}

async function runCleanupAllProbe(): Promise<void> {
  cleanNoiseOrDiversity.value = true
  cleanCuratedProbe.value = true
  cleanAllMemory.value = false
  cleanRemoveProbeFolder.value = true
  cleanWipeChromeChildren.value = false
  await runCleanupWithPayload(currentCleanupPayload(), '清除全部测试条目')
}

async function runCleanupAllMemory(): Promise<void> {
  cleanNoiseOrDiversity.value = false
  cleanCuratedProbe.value = false
  cleanAllMemory.value = true
  cleanRemoveProbeFolder.value = false
  cleanWipeChromeChildren.value = true
  await runCleanupWithPayload(currentCleanupPayload(), '清空整库')
}

function stopProgressPoll(): void {
  if (progressPollTimer !== null) {
    clearInterval(progressPollTimer)
    progressPollTimer = null
  }
}

function startProgressPoll(): void {
  stopProgressPoll()
  progressPollTimer = setInterval(() => {
    void (async () => {
      const res = await probeGetBatchProgress()
      if (res.ok) {
        runProgress.value = res.progress
      }
    })()
  }, 300)
}

async function refreshRunHistory(): Promise<void> {
  const res = await probeListRuns()
  if (!res.ok) {
    setStatus(`读取运行历史失败：${res.errorCode} ${res.error ?? ''}`)
    return
  }
  runHistory.value = res.runs
  if (!diffBeforeRunId.value && res.runs[1]) {
    diffBeforeRunId.value = res.runs[1].runId
  }
  if (!diffAfterRunId.value && res.runs[0]) {
    diffAfterRunId.value = res.runs[0].runId
  }
}

async function runProbeBatchFromForm(): Promise<void> {
  if (busy.value || runBusy.value) {
    return
  }
  runBusy.value = true
  lastDiffRows.value = []
  setStatus('批量探针运行中…')
  startProgressPoll()
  try {
    const personas = seedPersonas.value.filter((id): id is RecallProbePersonaId =>
      PERSONA_ORDER.includes(id as RecallProbePersonaId)
    )
    const res = await probeRunBatch({
      recipeId: selectedRecipeId.value || 'adhoc',
      fillerSeed: fillerSeed.value,
      personas: personas.length > 0 ? personas : undefined,
      diversityBookmarkCount: diversityBookmarkCount.value,
      diversityExcerptCount: diversityExcerptCount.value,
      clusterBookmarkCount: clusterBookmarkCount.value,
      clusterExcerptCount: clusterExcerptCount.value,
      includeNegatives: true
    })
    if (!res.ok) {
      setStatus(`批量探针失败：${res.errorCode} ${res.error ?? ''}`)
      return
    }
    lastRunId.value = res.runId
    lastRunReport.value = res.report
    diffAfterRunId.value = res.runId
    await refreshRunHistory()
    setStatus(`批量探针完成 · ${runAggregateLine.value} · ${res.runId}`)
  } finally {
    stopProgressPoll()
    const progressRes = await probeGetBatchProgress()
    if (progressRes.ok) {
      runProgress.value = progressRes.progress
    }
    runBusy.value = false
  }
}

async function loadHistoryRun(runId: string): Promise<void> {
  const res = await probeGetRun(runId)
  if (!res.ok) {
    setStatus(`读取运行失败：${res.errorCode} ${res.error ?? ''}`)
    return
  }
  lastRunId.value = res.runId
  lastRunReport.value = res.report
  setStatus(`已载入运行 ${res.runId}`)
}

async function runSelectedDiff(): Promise<void> {
  if (!diffBeforeRunId.value || !diffAfterRunId.value) {
    setStatus('请选择两次运行再 diff')
    return
  }
  if (diffBeforeRunId.value === diffAfterRunId.value) {
    setStatus('diff 需要两个不同的运行 id')
    return
  }
  const res = await probeDiffRuns(diffBeforeRunId.value, diffAfterRunId.value)
  if (!res.ok) {
    setStatus(`diff 失败：${res.errorCode} ${res.error ?? ''}`)
    return
  }
  lastDiffRows.value = res.rows
  setStatus(`已对比 ${res.beforeRunId} → ${res.afterRunId}`)
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

function formatDelta(delta: number, metric: string): string {
  const isRate = metric.endsWith('Rate')
  if (isRate) {
    const sign = delta > 0 ? '+' : ''
    return `${sign}${(delta * 100).toFixed(1)}pp`
  }
  const sign = delta > 0 ? '+' : ''
  return `${sign}${Number.isInteger(delta) ? delta : delta.toFixed(1)}`
}

onMounted(() => {
  refreshRecipeCatalog()
  const initial = findRecipe(selectedRecipeId.value)
  if (initial) {
    loadRecipeToForm(initial)
    setStatus('就绪 · 可写入、清理或运行探针')
  }
  void refreshRunHistory()
})

onUnmounted(() => {
  stopProgressPoll()
})
</script>

<template>
  <main class="pc">
    <header class="pc-header">
      <p class="pc-eyebrow">DEV ONLY · not shipped to CWS</p>
      <h1 class="pc-title">Yiveno 测试工作台</h1>
      <p class="pc-sub">写入、清理与批量探针跑分。禁止用探针结果冒充 §5.9。</p>
      <p class="pc-status" aria-live="polite">{{ statusLine }}</p>
    </header>

    <section class="pc-card" aria-labelledby="pc-seed">
      <h2 id="pc-seed">写入测试数据</h2>

      <label class="pc-field">
        <span>预设</span>
        <div class="pc-row">
          <select v-model="selectedRecipeId" class="pc-input" @change="onSelectRecipe">
            <option v-for="recipe in recipeCatalog" :key="recipe.id" :value="recipe.id">
              {{ recipe.source === 'builtin' ? '[内置]' : '[本机]' }} {{ recipe.label }}
            </option>
          </select>
          <button type="button" class="pc-btn" :disabled="busy" @click="runSelectedRecipe">
            按预设写入
          </button>
        </div>
      </label>

      <p class="pc-estimate">
        预计：手写精选书签 ≈{{ recipeEstimate.curatedBookmarks }} · 摘录 ≈{{
          recipeEstimate.curatedExcerpts
        }}
        · 精选键 {{ recipeEstimate.curatedKeys }} · 半仿真与干扰合计 ≈{{ recipeEstimate.noiseDiv }}
        <template v-if="selectedRecipe?.hint"> · {{ selectedRecipe.hint }}</template>
      </p>

      <details class="pc-details">
        <summary>参数（可改后「按参数写入」或保存为预设）</summary>

        <fieldset class="pc-fieldset">
          <legend>手写精选主题包</legend>
          <label v-for="id in PERSONA_ORDER" :key="id" class="pc-check">
            <input
              type="checkbox"
              :checked="seedPersonas.includes(id)"
              @change="togglePersona(id)"
            />
            {{ id }}
          </label>
        </fieldset>

        <div class="pc-counts">
          <label>
            半仿真书签
            <input v-model.number="diversityBookmarkCount" type="number" min="0" max="12000" />
          </label>
          <label>
            半仿真摘录
            <input v-model.number="diversityExcerptCount" type="number" min="0" max="8000" />
          </label>
          <label>
            无关干扰书签
            <input v-model.number="noiseBookmarkCount" type="number" min="0" max="15000" />
          </label>
          <label>
            无关干扰摘录
            <input v-model.number="noiseExcerptCount" type="number" min="0" max="8000" />
          </label>
          <label>
            混淆组书签（每画像组数）
            <input v-model.number="clusterBookmarkCount" type="number" min="0" max="200" />
          </label>
          <label>
            混淆组摘录（每画像组数）
            <input v-model.number="clusterExcerptCount" type="number" min="0" max="200" />
          </label>
        </div>

        <div class="pc-row">
          <label class="pc-inline">
            Chrome 书签同步
            <select v-model="chromeBookmarkSync" class="pc-input narrow">
              <option value="curated_only">仅手写精选</option>
              <option value="all">精选 + 半仿真/干扰</option>
            </select>
          </label>
          <label class="pc-check">
            <input v-model="enrichCurated" type="checkbox" />
            用 LLM 充实精选（耗配额）
          </label>
          <label class="pc-check danger">
            <input v-model="seedReplace" type="checkbox" />
            先清空当前库再写入
          </label>
        </div>

        <div class="pc-row">
          <label class="pc-inline">
            半仿真/干扰随机种子
            <input
              v-model.number="fillerSeed"
              class="pc-input narrow"
              type="number"
              min="0"
              max="4294967295"
              title="仅影响半仿真与无关干扰条目；同值可复现"
            />
          </label>
          <button type="button" class="pc-btn ghost" :disabled="busy" @click="reshuffleFillerSeed">
            换随机种子
          </button>
        </div>

        <div class="pc-actions">
          <button type="button" class="pc-btn" :disabled="busy" @click="runCustomSeed">
            按参数写入
          </button>
        </div>

        <div class="pc-row">
          <input v-model="recipeSaveLabel" class="pc-input" placeholder="保存显示名" />
          <input v-model="recipeSaveId" class="pc-input narrow" placeholder="id 可选" />
          <button type="button" class="pc-btn ghost" :disabled="busy" @click="saveFormAsRecipe">
            保存预设
          </button>
          <button
            type="button"
            class="pc-btn ghost"
            :disabled="busy"
            @click="deleteSelectedCustomRecipe"
          >
            删本机预设
          </button>
        </div>
      </details>

      <details class="pc-details" :open="showJsonPanel">
        <summary>导入 / 导出 JSON</summary>
        <div class="pc-actions">
          <button type="button" class="pc-btn ghost" @click="exportSelectedRecipe">导出当前</button>
          <button type="button" class="pc-btn ghost" @click="importRecipeFromJson">
            导入并保存
          </button>
        </div>
        <textarea
          v-model="recipeJsonText"
          class="pc-textarea"
          rows="8"
          spellcheck="false"
          placeholder="预设 JSON"
        />
      </details>

      <div v-if="lastRecipeCompare" class="pc-result" :data-ok="lastRecipeCompare.ok ? '1' : '0'">
        <strong>对照 {{ lastRecipeCompare.ok ? '通过' : '有偏差' }}</strong>
        · {{ lastRecipeCompare.recipeLabel || activeRecipeLabel }}
        <ul class="pc-list">
          <li v-for="row in lastRecipeCompare.rows" :key="row.field">
            <span :class="row.ok ? 'pc-muted' : 'pc-warn'">{{ row.ok ? '✓' : '✗' }}</span>
            {{ row.field }}：期望 {{ row.expected }} / 实际 {{ row.actual }}
          </li>
        </ul>
      </div>

      <p v-if="lastProbeKeys.length" class="pc-keys">精选键：{{ lastProbeKeys.join(', ') }}</p>
    </section>

    <section class="pc-card" aria-labelledby="pc-run">
      <h2 id="pc-run">运行探针</h2>
      <p class="pc-hint">
        数据驱动：精选全部 clues + 已种库 diversity / cluster 消歧与集合线索 +
        负例；entry=omnibox；k=3。原 11 条 Omnibox smoke 仍经 SW 调试 API 保留。
      </p>

      <div class="pc-actions">
        <button
          type="button"
          class="pc-btn"
          :disabled="busy || runBusy"
          @click="runProbeBatchFromForm"
        >
          运行探针
        </button>
        <button
          type="button"
          class="pc-btn ghost"
          :disabled="busy || runBusy"
          @click="refreshRunHistory"
        >
          刷新历史
        </button>
      </div>

      <p v-if="runProgress" class="pc-progress" aria-live="polite">
        进度 {{ runProgress.phase }} · {{ runProgress.current }}/{{ runProgress.total }}
        <template v-if="runProgress.lastClue"> · {{ runProgress.lastClue }}</template>
        <template v-if="runProgress.error"> · {{ runProgress.error }}</template>
      </p>

      <p v-if="lastRunReport" class="pc-estimate">
        最近运行 {{ lastRunId }} · {{ runAggregateLine }}
      </p>

      <div v-if="lastRunReport" class="pc-table-wrap">
        <table class="pc-table">
          <thead>
            <tr>
              <th>判定</th>
              <th>线索</th>
              <th>期望 key</th>
              <th>实际 top1</th>
              <th>来源</th>
              <th>ms</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in lastRunReport.cases" :key="row.caseId" :data-verdict="row.verdict">
              <td>{{ row.verdict }}</td>
              <td class="pc-clip" :title="row.clue">
                {{ row.clue
                }}<template v-if="row.clusterId">
                  <span class="pc-muted"> · {{ row.clusterId }}</span>
                </template>
              </td>
              <td class="pc-mono">{{ row.expectedKey || '—' }}</td>
              <td class="pc-clip" :title="row.actualTop1Title ?? ''">
                {{ row.actualTop1Title ?? '—' }}
              </td>
              <td>{{ row.source }}/{{ row.persona }}</td>
              <td>{{ row.latencyMs }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <details class="pc-details" open>
        <summary>历史与 diff</summary>
        <ul v-if="runHistory.length" class="pc-list">
          <li v-for="run in runHistory" :key="run.runId">
            <button type="button" class="pc-link" @click="loadHistoryRun(run.runId)">
              {{ run.runId }}
            </button>
            · top1 {{ formatRate(run.top1Rate) }} · in3 {{ formatRate(run.inTop3Rate) }} · miss
            {{ formatRate(run.missRate) }} · n={{ run.total }}
          </li>
        </ul>
        <p v-else class="pc-hint">尚无运行记录</p>

        <div class="pc-row">
          <label class="pc-inline">
            较早
            <select v-model="diffBeforeRunId" class="pc-input">
              <option value="">—</option>
              <option v-for="run in runHistory" :key="`b-${run.runId}`" :value="run.runId">
                {{ run.runId }}
              </option>
            </select>
          </label>
          <label class="pc-inline">
            较晚
            <select v-model="diffAfterRunId" class="pc-input">
              <option value="">—</option>
              <option v-for="run in runHistory" :key="`a-${run.runId}`" :value="run.runId">
                {{ run.runId }}
              </option>
            </select>
          </label>
          <button type="button" class="pc-btn ghost" :disabled="runBusy" @click="runSelectedDiff">
            对比指标
          </button>
        </div>

        <ul v-if="lastDiffRows.length" class="pc-list">
          <li v-for="row in lastDiffRows" :key="row.metric">
            <span class="pc-mono">{{ row.metric }}</span
            >：{{ row.before }} → {{ row.after }}（{{ formatDelta(row.delta, row.metric) }}）
          </li>
        </ul>
      </details>
    </section>

    <section class="pc-card" aria-labelledby="pc-clean">
      <h2 id="pc-clean">清理</h2>
      <p class="pc-hint">按类别删除测试数据；「清空整库」会 soft-delete 当前账号下全部 Memory。</p>

      <div class="pc-chips">
        <button type="button" class="pc-chip" :disabled="busy" @click="runCleanupNoise">
          清除半仿真与干扰
        </button>
        <button type="button" class="pc-chip" :disabled="busy" @click="runCleanupAllProbe">
          清除全部测试条目
        </button>
        <button type="button" class="pc-chip danger" :disabled="busy" @click="runCleanupAllMemory">
          清空整库
        </button>
      </div>

      <details class="pc-details" open>
        <summary>选项</summary>
        <fieldset class="pc-fieldset">
          <legend>删除范围</legend>
          <label class="pc-check">
            <input v-model="cleanNoiseOrDiversity" type="checkbox" :disabled="cleanAllMemory" />
            半仿真与无关干扰条目
          </label>
          <label class="pc-check">
            <input v-model="cleanCuratedProbe" type="checkbox" :disabled="cleanAllMemory" />
            手写精选测试条目（语料 URL / 种库主题文件夹）
          </label>
          <label class="pc-check danger">
            <input v-model="cleanAllMemory" type="checkbox" />
            当前库全部 Memory
          </label>
        </fieldset>

        <div class="pc-row">
          <label class="pc-inline">
            类型
            <select v-model="cleanTypes" class="pc-input narrow">
              <option value="all">全部</option>
              <option value="bookmark">仅书签</option>
              <option value="text_excerpt">仅摘录</option>
            </select>
          </label>
        </div>

        <fieldset class="pc-fieldset">
          <legend>Chrome</legend>
          <label class="pc-check">
            <input
              v-model="cleanRemoveProbeFolder"
              type="checkbox"
              :disabled="cleanWipeChromeChildren"
            />
            移除种库主题文件夹（Research / Dev docs 等；含旧 Yiveno Probe）
          </label>
          <label class="pc-check danger">
            <input v-model="cleanWipeChromeChildren" type="checkbox" />
            清空书签栏全部子树
          </label>
        </fieldset>

        <div class="pc-actions">
          <button type="button" class="pc-btn" :disabled="busy" @click="runCleanupCustom">
            按选项清理
          </button>
        </div>
      </details>
    </section>
  </main>
</template>

<style scoped>
.pc {
  box-sizing: border-box;
  max-width: 920px;
  margin: 0 auto;
  padding: 28px 20px 56px;
  color: var(--on-surface, #1a1a1a);
  font:
    14px/1.45 system-ui,
    sans-serif;
}

.pc-eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #b45309;
}

.pc-title {
  margin: 0 0 6px;
  font-size: 24px;
  line-height: 1.2;
}

.pc-sub {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--on-surface-muted, #5c5c5c);
}

.pc-status {
  margin: 0 0 20px;
  padding: 8px 10px;
  border-radius: 6px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  background: #f3f4f6;
}

.pc-card {
  padding: 16px 16px 18px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
}

.pc-card h2 {
  margin: 0 0 12px;
  font-size: 15px;
}

.pc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.pc-chip {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  font: inherit;
  font-size: 12px;
  color: #111;
  background: #fff;
  cursor: pointer;
}

.pc-chip.active {
  border-color: #111;
  color: #fff;
  background: #111;
}

.pc-chip.danger {
  border-color: #b91c1c;
  color: #b91c1c;
}

.pc-chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pc-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: #6b7280;
}

.pc-card + .pc-card {
  margin-top: 14px;
}

.pc-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #6b7280;
}

.pc-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.pc-input,
.pc-textarea {
  flex: 1;
  box-sizing: border-box;
  min-width: 120px;
  padding: 7px 9px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #111;
  font: inherit;
}

.pc-input.narrow {
  flex: 0 0 120px;
  min-width: 100px;
}

.pc-btn {
  padding: 7px 14px;
  border: 1px solid #111;
  border-radius: 6px;
  color: #fff;
  background: #111;
  cursor: pointer;
  font: inherit;
}

.pc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pc-btn.ghost {
  color: #111;
  background: #fff;
}

.pc-estimate {
  margin: 0 0 10px;
  font-size: 12px;
  color: #6b7280;
}

.pc-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  font-size: 13px;
}

.pc-check.danger {
  margin-bottom: 12px;
  color: #b91c1c;
}

.pc-details {
  margin: 10px 0;
  padding: 8px 0;
  border-top: 1px solid #f3f4f6;
}

.pc-details summary {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
}

.pc-fieldset {
  margin: 10px 0;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.pc-counts {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 8px 0;
}

.pc-counts label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
}

.pc-counts input {
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font: inherit;
}

.pc-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}

.pc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0;
}

.pc-textarea {
  width: 100%;
  margin-top: 8px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.pc-result {
  margin-top: 12px;
  padding: 10px;
  border-radius: 8px;
  font-size: 13px;
  background: #f9fafb;
}

.pc-result[data-ok='1'] {
  color: #047857;
}

.pc-result[data-ok='0'] {
  color: #b91c1c;
}

.pc-list {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.pc-list li {
  padding: 2px 0;
  font-size: 12px;
}

.pc-muted {
  margin-right: 4px;
  color: #9ca3af;
}

.pc-warn {
  margin-right: 4px;
  font-weight: 600;
  color: #b45309;
}

.pc-keys {
  margin: 10px 0 0;
  padding: 8px;
  border-radius: 6px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #4b5563;
  background: #f3f4f6;
  word-break: break-all;
}

.pc-progress {
  margin: 0 0 10px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: #374151;
}

.pc-table-wrap {
  max-height: 360px;
  margin: 10px 0;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.pc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.pc-table th,
.pc-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #f3f4f6;
  text-align: left;
  vertical-align: top;
}

.pc-table th {
  position: sticky;
  top: 0;
  background: #f9fafb;
  font-weight: 600;
}

.pc-table tr[data-verdict='miss'],
.pc-table tr[data-verdict='unmapped'],
.pc-table tr[data-verdict='error'] {
  background: #fff7ed;
}

.pc-clip {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pc-mono {
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

.pc-link {
  padding: 0;
  border: 0;
  color: #1d4ed8;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
}
</style>
