<script setup lang="ts">
/**
 * Side Panel 冷启动全屏门禁：分阶段真实进度（library align → rules → AI 尽力）。
 * 书签 bulk 用户主进度在 Getting Started；本门禁 import 步为等待/对齐，非二次导入课。
 * P1-18：停滞可跳过、读失败可重试（不重启 pipeline）。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppLinearProgress from '@/infrastructure/ui/AppLinearProgress.vue'
import {
  getColdStartOverallPercent,
  type ColdStartPipelineState,
  type ColdStartStage
} from '@/core/memory/cold-start-pipeline-state'
import { t } from '@/infrastructure/i18n/t'
import { setColdStartGateOutsideInert } from '@/pages/sidepanel/cold-start-gate-outside-inert'

defineOptions({ name: 'ColdStartGate' })

const props = defineProps<{
  state: ColdStartPipelineState
  /** 可见 ≥30s 且无进展 */
  stalled?: boolean
  /** 连续读状态失败 */
  readFailed?: boolean
}>()

const emit = defineEmits<{
  skip: []
  retry: []
}>()

/** Gate 根：inert 排除锚点 */
const gateRootRef = ref<HTMLElement | null>(null)
/** 面板焦点落点（无可聚焦控件时） */
const panelRef = ref<HTMLElement | null>(null)

onMounted(() => {
  setColdStartGateOutsideInert(gateRootRef.value, true)
  panelRef.value?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  setColdStartGateOutsideInert(gateRootRef.value, false)
})

const percent = computed(() => getColdStartOverallPercent(props.state))

const stageTitleKey = computed(() => {
  const stage: ColdStartStage = props.state.stage
  switch (stage) {
    case 'import':
      return 'cold_start_stage_import_title'
    case 'rules':
      return 'cold_start_stage_rules_title'
    case 'ai':
      return 'cold_start_stage_ai_title'
    case 'done':
      return 'cold_start_stage_done_title'
    default:
      return 'cold_start_stage_idle_title'
  }
})

const stageBodyKey = computed(() => {
  const stage: ColdStartStage = props.state.stage
  switch (stage) {
    case 'import':
      return 'cold_start_stage_import_body'
    case 'rules':
      return 'cold_start_stage_rules_body'
    case 'ai':
      return 'cold_start_stage_ai_body'
    case 'done':
      return 'cold_start_stage_done_body'
    default:
      return 'cold_start_stage_idle_body'
  }
})

const detailLine = computed(() => {
  const s = props.state
  if (s.stage === 'import') {
    if (s.importTotalCount && s.importTotalCount > 0) {
      return t('cold_start_detail_import', [
        String(s.importImportedCount),
        String(s.importTotalCount)
      ])
    }
    return t('cold_start_detail_import_indeterminate')
  }
  if (s.stage === 'rules' && s.rulesScanned > 0) {
    return t('cold_start_detail_rules', [String(s.rulesScanned), String(s.rulesUpdated)])
  }
  if (s.stage === 'ai') {
    if (s.aiEmbedAttempted > 0) {
      return t('cold_start_detail_ai', [
        String(s.aiEmbedWritten),
        String(s.aiEmbedAttempted),
        String(s.aiLlmEnqueued)
      ])
    }
    if (s.aiLlmEnqueued > 0) {
      return t('cold_start_detail_enrichment', [String(s.aiLlmEnqueued)])
    }
    return t('cold_start_detail_ai_indeterminate')
  }
  return ''
})
</script>

<template>
  <div ref="gateRootRef" class="cold-start-gate" role="status" aria-live="polite">
    <div ref="panelRef" class="cold-start-gate__panel" tabindex="-1">
      <p class="cold-start-gate__eyebrow">{{ t('cold_start_eyebrow') }}</p>
      <h1 class="cold-start-gate__title">{{ t(stageTitleKey) }}</h1>
      <p class="cold-start-gate__body">{{ t(stageBodyKey) }}</p>
      <p v-if="detailLine" class="cold-start-gate__detail">{{ detailLine }}</p>
      <AppLinearProgress
        class="cold-start-gate__bar"
        :value="percent / 100"
        :aria-label="t('cold_start_progress_aria')"
      />
      <p class="cold-start-gate__percent">{{ percent }}%</p>
      <ol class="cold-start-gate__steps" aria-hidden="true">
        <li
          class="cold-start-gate__step"
          :class="{
            'cold-start-gate__step--active': state.stage === 'import',
            'cold-start-gate__step--done':
              state.stage === 'rules' || state.stage === 'ai' || state.stage === 'done'
          }"
        >
          {{ t('cold_start_step_import') }}
        </li>
        <li
          class="cold-start-gate__step"
          :class="{
            'cold-start-gate__step--active': state.stage === 'rules',
            'cold-start-gate__step--done': state.stage === 'ai' || state.stage === 'done'
          }"
        >
          {{ t('cold_start_step_rules') }}
        </li>
        <li
          class="cold-start-gate__step"
          :class="{
            'cold-start-gate__step--active': state.stage === 'ai',
            'cold-start-gate__step--done': state.stage === 'done'
          }"
        >
          {{ t('cold_start_step_ai') }}
        </li>
      </ol>
      <p v-if="readFailed" class="cold-start-gate__error" role="alert">
        {{ t('cold_start_gate_read_failed') }}
      </p>
      <div v-if="readFailed || stalled" class="cold-start-gate__actions">
        <AppButton
          v-if="readFailed"
          type="button"
          variant="tonal"
          :title="t('cold_start_gate_retry')"
          :aria-label="t('cold_start_gate_retry')"
          @click="emit('retry')"
        >
          {{ t('cold_start_gate_retry') }}
        </AppButton>
        <AppButton
          v-else-if="stalled"
          type="button"
          variant="text"
          :title="t('cold_start_gate_skip')"
          :aria-label="t('cold_start_gate_skip')"
          @click="emit('skip')"
        >
          {{ t('cold_start_gate_skip') }}
        </AppButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cold-start-gate {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-lg);
  background: color-mix(in srgb, var(--surface) 92%, var(--on-surface));
}

.cold-start-gate__panel {
  display: grid;
  gap: var(--space-sm);
  width: min(100%, 22rem);
  min-width: 0;
}

/* 程序聚焦落点：保留 tabindex/-focus，不显示浏览器默认蓝框 */
.cold-start-gate__panel:focus {
  outline: none;
}

.cold-start-gate__eyebrow {
  margin: 0;
  font-size: var(--text-caption);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--on-surface-muted);
}

.cold-start-gate__title {
  margin: 0;
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
  line-height: var(--leading-tight);
  color: var(--on-surface);
}

.cold-start-gate__body {
  margin: 0;
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
  color: var(--on-surface-muted);
}

.cold-start-gate__detail {
  margin: 0;
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
  color: var(--on-surface);
}

.cold-start-gate__bar {
  margin-top: var(--space-2xs);
}

.cold-start-gate__percent {
  margin: 0;
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
  color: var(--on-surface-muted);
}

.cold-start-gate__steps {
  display: grid;
  gap: var(--space-2xs);
  margin: var(--space-sm) 0 0;
  padding: 0;
  list-style: none;
}

.cold-start-gate__step {
  font-size: var(--text-caption);
  color: var(--on-surface-muted);
  opacity: 0.55;
}

.cold-start-gate__step--active {
  font-weight: var(--font-weight-semibold);
  color: var(--accent);
  opacity: 1;
}

.cold-start-gate__step--done {
  color: var(--on-surface);
  opacity: 0.85;
}

.cold-start-gate__error {
  margin: var(--space-2xs) 0 0;
  font-size: var(--text-body);
  line-height: var(--leading-snug);
  color: var(--error, var(--on-surface));
}

.cold-start-gate__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2xs);
  margin-top: var(--space-2xs);
}
</style>
