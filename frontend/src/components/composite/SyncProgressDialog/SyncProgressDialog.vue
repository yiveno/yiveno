<template>
  <Dialog :show="show" persistent :hide-close="!showActions">
    <template #title>
      <div class="dialog-title" :class="{ 'is-error': isError }">
        <LucideIcon
          :name="titleIcon"
          :class="{ spin: !isCompleted && !isError }"
          class="title-icon"
        />
        <span>{{ dialogTitle }}</span>
      </div>
    </template>

    <template #content>
      <!-- ✅ 错误状态 -->
      <div v-if="isError" class="error-content">
        <div class="error-icon">
          <LucideIcon name="alert-circle" :size="64" />
        </div>
        <div class="error-message">
          {{ progress.error?.message || '同步过程中发生错误' }}
        </div>
        <div v-if="progress.error?.type === 'timeout'" class="error-hint">
          <LucideIcon name="info" :size="20" />
          <span>可能原因：网络缓慢、书签数量过多、或浏览器资源不足</span>
        </div>
        <div v-if="progress.error?.retryCount" class="retry-count">
          已重试 {{ progress.error.retryCount }} 次
        </div>
      </div>

      <!-- ✅ 正常进度 -->
      <div v-else class="sync-progress-content">
        <!-- 阶段指示器 -->
        <div class="phase-indicators">
          <div
            v-for="phase in phases"
            :key="phase.key"
            class="phase-item"
            :class="{
              active: progress.phase === phase.key,
              completed: isPhaseCompleted(phase.key)
            }"
          >
            <div class="phase-icon">
              <LucideIcon
                :name="phase.icon"
                :class="{ spin: progress.phase === phase.key && !isCompleted }"
              />
            </div>
            <span class="phase-label">{{ phase.label }}</span>
          </div>
        </div>

        <!-- 进度条 -->
        <div class="progress-bar-container">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${progress.percentage}%` }"
            />
          </div>
          <div class="progress-percentage">
            {{ Math.round(progress.percentage) }}%
          </div>
        </div>

        <!-- 详细信息 -->
        <div class="progress-details">
          <div class="progress-message">
            {{ progress.message }}
          </div>
          <div class="progress-stats">
            <span v-if="progress.total > 0" class="stat-item">
              <LucideIcon name="file" :size="14" class="stat-icon" />
              {{ formatNumber(progress.current) }} /
              {{ formatNumber(progress.total) }}
            </span>
            <span
              v-if="
                progress.estimatedRemaining && progress.estimatedRemaining > 0
              "
              class="stat-item"
            >
              <LucideIcon name="clock" :size="14" class="stat-icon" />
              剩余约 {{ formatTime(progress.estimatedRemaining) }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <template v-if="showActions" #actions>
      <!-- ✅ 错误时的操作 -->
      <template v-if="isError">
        <md-filled-button
          v-if="progress.error?.canRetry"
          @click="emit('retry')"
        >
          <template #icon>
<md-icon >refresh</md-icon>
</template>
          重试
        </md-filled-button>
        <md-text-button @click="emit('force-close')">
          忽略并继续
        </md-text-button>
      </template>

      <!-- ✅ 完成时的操作 -->
      <md-filled-button v-else @click="emit('close')"> 关闭 </md-filled-button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, defineOptions } from 'vue'
import Dialog from '@/components/composite/Dialog/Dialog.vue'
import LucideIcon from '@/components/base/LucideIcon/LucideIcon.vue'
import type { SyncProgress, SyncPhase } from '@/types/sync-progress'
import { SYNC_PHASES, PHASE_TITLES, formatTime } from '@/types/sync-progress'
import { formatNumber } from '@/utils/i18n-helpers'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/icon/icon.js'

defineOptions({
  name: 'SyncProgressDialog'
})

interface Props {
  /** 是否显示对话框 */
  show: boolean
  /** 进度数据 */
  progress: SyncProgress
}

interface Emits {
  (e: 'close'): void
  (e: 'retry'): void
  (e: 'force-close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/**
 * 所有阶段
 */
const phases = computed(() => {
  // 只显示前4个阶段（不包括 'completed'）
  return SYNC_PHASES.slice(0, 4)
})

/**
 * 是否已完成
 */
const isCompleted = computed(() => {
  return props.progress.phase === 'completed'
})

/**
 * 是否处于错误状态
 */
const isError = computed(() => {
  return props.progress.phase === 'failed' || props.progress.phase === 'timeout'
})

/**
 * 对话框标题
 */
const dialogTitle = computed(() => {
  if (isCompleted.value) return '同步完成'
  if (isError.value) return PHASE_TITLES[props.progress.phase]
  return PHASE_TITLES[props.progress.phase] || '正在同步'
})

/**
 * 标题图标
 */
const titleIcon = computed(() => {
  if (isCompleted.value) return 'check-circle'
  if (isError.value) return 'alert-triangle'
  return 'refresh'
})

/**
 * 是否显示操作按钮
 */
const showActions = computed(() => {
  return isCompleted.value || isError.value
})

/**
 * 判断阶段是否已完成
 */
function isPhaseCompleted(phase: SyncPhase): boolean {
  const phaseOrder: SyncPhase[] = [
    'fetching',
    'converting',
    'writing',
    'indexing',
    'completed'
  ]
  const currentIndex = phaseOrder.indexOf(props.progress.phase)
  const checkIndex = phaseOrder.indexOf(phase)

  return checkIndex < currentIndex || props.progress.phase === 'completed'
}
</script>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.spin {
  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform;
  animation: spin 1s linear infinite;
}

.sync-progress-dialog {
  --dialog-width: 500px;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.title-icon {
  width: 20px;
  height: 20px;
  color: var(--primary-color);
}

.dialog-title.is-error .title-icon {
  color: var(--error-color);
}

/* 错误状态 */
.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-xl) 0;
}

.error-icon :deep(svg) {
  color: var(--error-color);
}

.error-message {
  font-size: var(--text-base);
  font-weight: 500;
  text-align: center;
  color: var(--text-color);
}

.error-hint {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  max-width: 400px;
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-warning-dark);
  background: var(--color-warning-light);
}

.error-hint :deep(svg) {
  flex-shrink: 0;
  margin-top: var(--spacing-1);
}

.retry-count {
  font-size: var(--text-sm);
  color: var(--text-color-secondary);
}

.sync-progress-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  padding: var(--spacing-sm) 0;
}

/* 阶段指示器 */
.phase-indicators {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--spacing-md);
}

.phase-indicators::before {
  position: absolute;
  top: 18px;
  right: 24px;
  left: 24px;
  z-index: 0;
  height: 2px;
  background: var(--border-color);
  content: '';
}

.phase-item {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.phase-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 36px;
  height: 36px;
  border: 2px solid var(--border-color);
  border-radius: 50%;
  background: var(--background-color);
  transition: all 0.3s ease;
}

.phase-item.active .phase-icon {
  border-color: var(--primary-color);
  background: var(--primary-color-light);
  box-shadow: 0 0 0 4px var(--primary-color-lighter);
}

.phase-item.completed .phase-icon {
  border-color: var(--success-color);
  background: var(--success-color);
}

.phase-icon :deep(svg) {
  color: var(--text-color-secondary);
}

.phase-item.active .phase-icon :deep(svg) {
  color: var(--primary-color);
}

.phase-item.completed .phase-icon :deep(svg) {
  color: var(--color-on-primary);
}

.phase-icon :deep(svg.spin) {
  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform;
  animation: spin 1s linear infinite;
}

.phase-label {
  font-size: var(--text-xs);
  white-space: nowrap;
  color: var(--text-color-secondary);
}

.phase-item.active .phase-label {
  font-weight: 500;
  color: var(--primary-color);
}

.phase-item.completed .phase-label {
  color: var(--success-color);
}

/* 进度条 */
.progress-bar-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.progress-bar {
  flex: 1;
  height: var(--spacing-3);
  border-radius: var(--radius-md);
  background: var(--border-color);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: var(--radius-md);
  background: linear-gradient(
    90deg,
    var(--primary-color),
    var(--primary-color-dark)
  );
  transition: width 0.3s ease;
}

.progress-percentage {
  min-width: 48px;
  font-size: var(--text-base);
  font-weight: 600;
  text-align: right;
  color: var(--text-color);
}

/* 详细信息 */
.progress-details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.progress-message {
  font-size: var(--text-sm);
  text-align: center;
  color: var(--text-color);
}

.progress-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-xl);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--text-sm);
  color: var(--text-color-secondary);
}

.stat-icon {
  flex-shrink: 0;
}
</style>
