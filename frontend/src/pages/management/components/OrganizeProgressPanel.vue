<script setup lang="ts">
import { computed } from 'vue'
import { LucideIcon } from '@/components'
import {
  buildOrganizeStepViewModels,
  computeOrganizeOverallProgress,
  type OrganizeProgress,
  type OrganizeStageKey,
  type OrganizeStageUnit
} from '@/core/bookmark/organize-progress'
import { t } from '@/utils/i18n-helpers'

defineOptions({ name: 'OrganizeProgressPanel' })

const props = defineProps<{
  progress: OrganizeProgress
}>()

const stepTitleKeys: Record<OrganizeStageKey, string> = {
  load_bookmarks: 'management_organize_step_load_title',
  index_bookmarks: 'management_organize_step_index_title',
  ai_organize: 'management_organize_step_ai_title',
  complete: 'management_organize_step_preview_title'
}

const steps = computed(() => buildOrganizeStepViewModels(props.progress))

const overallPercent = computed(() =>
  Math.round(computeOrganizeOverallProgress(props.progress) * 100)
)

function formatUnitCount(current: number, total: number, unit: OrganizeStageUnit): string {
  if (unit === 'none' || total <= 0) return ''
  if (unit === 'batches') {
    return t('management_organize_detail_batches', [String(current), String(total)])
  }
  return t('management_organize_detail_bookmarks', [String(current), String(total)])
}

function getStepDetail(step: (typeof steps.value)[number]): string {
  if (step.status !== 'active') return ''

  if (step.key === 'complete') {
    return t('management_organize_detail_preview')
  }

  const primary = formatUnitCount(step.stageCurrent, step.stageTotal, step.stageUnit)
  const secondary = formatUnitCount(step.detailCurrent, step.detailTotal, step.detailUnit)

  if (step.key === 'ai_organize' && primary && secondary) {
    return `${primary} · ${secondary}`
  }

  if (step.key === 'load_bookmarks') {
    if (props.progress.bookmarkCount > 0) {
      return t('management_organize_detail_loaded', String(props.progress.bookmarkCount))
    }
    return t('management_organize_detail_loading')
  }

  return primary || secondary
}
</script>

<template>
  <div class="organize-progress-panel">
    <div class="organize-progress-panel__overall">
      <div class="organize-progress-panel__overall-header">
        <span class="organize-progress-panel__overall-label">
          {{ t('management_organize_overall_label') }}
        </span>
        <span class="organize-progress-panel__overall-percent">{{ overallPercent }}%</span>
      </div>
      <md-linear-progress :value="overallPercent / 100" />
    </div>

    <ol class="organize-progress-panel__steps">
      <li
        v-for="step in steps"
        :key="step.key"
        class="organize-progress-step"
        :class="{
          'organize-progress-step--active': step.status === 'active',
          'organize-progress-step--completed': step.status === 'completed'
        }"
      >
        <div class="organize-progress-step__header">
          <span class="organize-progress-step__indicator" aria-hidden="true">
            <LucideIcon
              v-if="step.status === 'completed'"
              name="check"
              class="organize-progress-step__icon organize-progress-step__icon--done"
            />
            <span
              v-else-if="step.status === 'active'"
              class="organize-progress-step__dot organize-progress-step__dot--active"
            />
            <span v-else class="organize-progress-step__dot" />
          </span>
          <div class="organize-progress-step__text">
            <div class="organize-progress-step__title">
              <span class="organize-progress-step__index">{{ step.stepIndex }}</span>
              {{ t(stepTitleKeys[step.key]) }}
            </div>
            <div v-if="getStepDetail(step)" class="organize-progress-step__detail">
              {{ getStepDetail(step) }}
            </div>
          </div>
        </div>
        <md-linear-progress
          v-if="step.status === 'active' && step.stageUnit !== 'none'"
          class="organize-progress-step__bar"
          :indeterminate="step.stageProgress <= 0 && step.stageCurrent <= 0"
          :value="step.stageProgress"
        />
      </li>
    </ol>
  </div>
</template>

<style scoped>
.organize-progress-panel {
  padding: var(--spacing-4);
}

.organize-progress-panel__overall {
  margin-bottom: var(--spacing-4);
}

.organize-progress-panel__overall-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-2);
}

.organize-progress-panel__overall-label {
  font-size: var(--md-sys-typescale-body-medium-size);
  color: var(--color-text-secondary);
}

.organize-progress-panel__overall-percent {
  font-family: var(--font-family-mono);
  font-size: var(--md-sys-typescale-body-small-size);
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-primary);
}

.organize-progress-panel__steps {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.organize-progress-step {
  padding: var(--spacing-3);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-outline) 24%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--md-sys-color-surface) 96%, transparent);
}

.organize-progress-step--active {
  border-color: color-mix(in srgb, var(--md-sys-color-primary) 40%, transparent);
  background: color-mix(in srgb, var(--md-sys-color-primary) 6%, transparent);
}

.organize-progress-step--completed {
  border-color: color-mix(in srgb, var(--color-semantic-success) 30%, transparent);
}

.organize-progress-step__header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
}

.organize-progress-step__indicator {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.organize-progress-step__icon--done {
  color: var(--color-semantic-success);
}

.organize-progress-step__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 24%, transparent);
}

.organize-progress-step__dot--active {
  background: var(--md-sys-color-primary);
}

.organize-progress-step__text {
  flex: 1;
  min-width: 0;
}

.organize-progress-step__title {
  font-size: var(--md-sys-typescale-body-large-size);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.organize-progress-step__index {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 18px;
  height: 18px;
  margin-right: var(--spacing-2);
  border-radius: 50%;
  font-size: var(--md-sys-typescale-label-small-size);
  color: var(--md-sys-color-on-primary);
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 40%, transparent);
}

.organize-progress-step--active .organize-progress-step__index {
  background: var(--md-sys-color-primary);
}

.organize-progress-step--completed .organize-progress-step__index {
  background: var(--color-semantic-success);
}

.organize-progress-step__detail {
  margin-top: var(--spacing-1);
  font-size: var(--md-sys-typescale-body-small-size);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.organize-progress-step__bar {
  margin-top: var(--spacing-3);
}
</style>
