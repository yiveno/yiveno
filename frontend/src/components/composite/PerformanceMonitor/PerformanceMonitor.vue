<script setup lang="ts">
import { ref } from 'vue'
import {
  usePerformanceMonitor,
  useMemoryManagement
} from '@/composables/useSimplePerformance'

const showMonitor = ref(true) // 简化：总是显示
const isExpanded = ref(false)

const { metrics } = usePerformanceMonitor('PerformanceMonitor')
const { memoryUsage, cleanup: cleanupMemory } = useMemoryManagement()

const optimizationsEnabled = ref(true)
const cacheSize = ref(0)

const toggleMonitor = () => {
  isExpanded.value = !isExpanded.value
}

const getMemoryClass = () => {
  if (memoryUsage.value.percentage > 80) return 'error'
  if (memoryUsage.value.percentage > 60) return 'warning'
  return 'success'
}

const cleanup = () => {
  cleanupMemory()
}

const toggleOptimizations = () => {
  optimizationsEnabled.value = !optimizationsEnabled.value
}
</script>

<template>
  <div v-if="showMonitor" class="performance-monitor">
    <div class="monitor-header">
      <h4>性能监控</h4>
      <md-icon-button @click="toggleMonitor">
        <LucideIcon :name="isExpanded ? 'chevron-up' : 'chevron-down'" :size="20" />
      </md-icon-button>
    </div>

    <div v-if="isExpanded" class="monitor-content">
      <div class="metric">
        <span class="label">内存使用:</span>
        <span class="value" :class="getMemoryClass()">
          {{ memoryUsage.percentage.toFixed(1) }}%
        </span>
      </div>

      <div class="metric">
        <span class="label">渲染时间:</span>
        <span class="value">{{ metrics.renderTime.toFixed(2) }}ms</span>
      </div>

      <div class="metric">
        <span class="label">更新时间:</span>
        <span class="value">{{ metrics.updateTime.toFixed(2) }}ms</span>
      </div>

      <div class="metric">
        <span class="label">缓存大小:</span>
        <span class="value">{{ cacheSize }}</span>
      </div>

      <div class="actions">
        <md-outlined-button @click="cleanup">清理缓存</md-outlined-button>
        <md-outlined-button @click="toggleOptimizations">
          {{ optimizationsEnabled ? '禁用' : '启用' }}优化
        </md-outlined-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.performance-monitor {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  min-width: 200px;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-2);
}

.monitor-header h4 {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

.monitor-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-xs);
}

.label {
  color: var(--color-text-secondary);
}

.value {
  font-weight: 500;
}

.value.success {
  color: var(--color-success);
}

.value.warning {
  color: var(--color-warning);
}

.value.error {
  color: var(--color-error);
}

.actions {
  display: flex;
  gap: var(--spacing-2);
  margin-top: var(--spacing-2);
}
</style>
