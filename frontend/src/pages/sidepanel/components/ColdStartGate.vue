<script setup lang="ts">
/**
 * Side Panel 冷启动全屏门禁：分阶段真实进度（import → rules → AI 尽力）。
 * 与可跳过的 Getting Started 分离；文案占位可后续微调。
 */
import { computed } from 'vue'
import AppLinearProgress from '@/infrastructure/ui/AppLinearProgress.vue'
import {
  getColdStartOverallPercent,
  type ColdStartPipelineState,
  type ColdStartStage
} from '@/core/memory/cold-start-pipeline-state'
import { t } from '@/infrastructure/i18n/t'

defineOptions({ name: 'ColdStartGate' })

const props = defineProps<{
  state: ColdStartPipelineState
}>()

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
  <div class="cold-start-gate" role="status" aria-live="polite">
    <div class="cold-start-gate__panel">
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
    </div>
  </div>
</template>

<style scoped>
.cold-start-gate {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  background: color-mix(in srgb, var(--surface) 92%, var(--on-surface));
}

.cold-start-gate__panel {
  display: grid;
  gap: var(--space-sm);
  width: min(100%, 22rem);
  min-width: 0;
}

.cold-start-gate__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--on-surface-muted);
}

.cold-start-gate__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 650;
  line-height: 1.3;
  color: var(--on-surface);
}

.cold-start-gate__body {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--on-surface-muted);
}

.cold-start-gate__detail {
  margin: 0;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: var(--on-surface);
}

.cold-start-gate__bar {
  margin-top: var(--space-2xs);
}

.cold-start-gate__percent {
  margin: 0;
  font-size: 0.75rem;
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
  font-size: 0.75rem;
  color: var(--on-surface-muted);
  opacity: 0.55;
}

.cold-start-gate__step--active {
  font-weight: 600;
  color: var(--accent);
  opacity: 1;
}

.cold-start-gate__step--done {
  opacity: 0.85;
  color: var(--on-surface);
}
</style>
