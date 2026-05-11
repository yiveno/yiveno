<!--
  LucideIcon 基础使用示例
  展示各种图标的使用方式
-->
<template>
  <div class="lucide-examples">
    <h2>LucideIcon 使用示例</h2>
    
    <!-- 基础图标 -->
    <section class="example-section">
      <h3>基础图标</h3>
      <div class="icon-grid">
        <div class="icon-item">
          <LucideIcon name="bookmark" />
          <span>bookmark</span>
        </div>
        <div class="icon-item">
          <LucideIcon name="star" />
          <span>star</span>
        </div>
        <div class="icon-item">
          <LucideIcon name="heart" />
          <span>heart</span>
        </div>
        <div class="icon-item">
          <LucideIcon name="folder" />
          <span>folder</span>
        </div>
      </div>
    </section>
    
    <!-- 尺寸变化 -->
    <section class="example-section">
      <h3>尺寸变化</h3>
      <div class="size-demo">
        <LucideIcon name="star" size="xs" />
        <LucideIcon name="star" size="sm" />
        <LucideIcon name="star" size="md" />
        <LucideIcon name="star" size="lg" />
        <LucideIcon name="star" size="xl" />
        <LucideIcon name="star" :size="48" />
      </div>
    </section>
    
    <!-- 颜色变化 -->
    <section class="example-section">
      <h3>颜色变化</h3>
      <div class="color-demo">
        <LucideIcon name="check-circle" color="success" />
        <LucideIcon name="alert-triangle" color="warning" />
        <LucideIcon name="x-circle" color="error" />
        <LucideIcon name="info" color="info" />
        <LucideIcon name="star" color="primary" />
      </div>
    </section>
    
    <!-- 动画效果 -->
    <section class="example-section">
      <h3>动画效果</h3>
      <div class="animation-demo">
        <LucideIcon name="loader" spin />
        <LucideIcon name="refresh" spin />
        <LucideIcon name="settings" spin />
      </div>
    </section>
    
    <!-- 变换效果 -->
    <section class="example-section">
      <h3>变换效果</h3>
      <div class="transform-demo">
        <LucideIcon name="arrow-right" />
        <LucideIcon name="arrow-right" flip-h />
        <LucideIcon name="arrow-right" :rotate="90" />
        <LucideIcon name="arrow-right" :rotate="180" />
        <LucideIcon name="arrow-right" :rotate="270" />
      </div>
    </section>
    
    <!-- 按钮中使用 -->
    <section class="example-section">
      <h3>按钮中使用</h3>
      <div class="button-demo">
        <button class="btn btn-primary">
          <LucideIcon name="plus" size="sm" />
          <span>添加</span>
        </button>
        <button class="btn btn-secondary">
          <LucideIcon name="edit" size="sm" />
          <span>编辑</span>
        </button>
        <button class="btn btn-danger">
          <LucideIcon name="trash" size="sm" />
          <span>删除</span>
        </button>
      </div>
    </section>
    
    <!-- 状态指示 -->
    <section class="example-section">
      <h3>状态指示</h3>
      <div class="status-demo">
        <div class="status-item status-success">
          <LucideIcon name="check-circle" />
          <span>同步成功</span>
        </div>
        <div class="status-item status-warning">
          <LucideIcon name="alert-triangle" />
          <span>需要注意</span>
        </div>
        <div class="status-item status-error">
          <LucideIcon name="x-circle" />
          <span>同步失败</span>
        </div>
        <div class="status-item status-info">
          <LucideIcon name="info" />
          <span>提示信息</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { LucideIcon } from '../index'

defineOptions({
  name: 'LucideIconExamples'
})
</script>

<style scoped>
/* stylelint-disable declaration-property-value-disallowed-list -- 示例文件，用于演示组件用法 */
.lucide-examples {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

h2 {
  margin-bottom: 24px;
  font-size: 24px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.example-section {
  margin-bottom: 48px;
}

.example-section h3 {
  margin-bottom: 16px;
  font-size: 18px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
}

/* 图标网格 */
.icon-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
}

.icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-radius: 8px;
  background: var(--md-sys-color-surface-variant);
  transition: all 0.2s;
}

.icon-item:hover {
  background: var(--md-sys-color-surface-container-high);
  opacity: 0.85;
}

.icon-item span {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

/* 尺寸演示 */
.size-demo {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 8px;
  background: var(--md-sys-color-surface-variant);
}

/* 颜色演示 */
.color-demo {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px;
  border-radius: 8px;
  background: var(--md-sys-color-surface-variant);
}

/* 动画演示 */
.animation-demo {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px;
  border-radius: 8px;
  background: var(--md-sys-color-surface-variant);
}

/* 变换演示 */
.transform-demo {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px;
  border-radius: 8px;
  background: var(--md-sys-color-surface-variant);
}

/* 按钮演示 */
.button-demo {
  display: flex;
  gap: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  color: var(--md-sys-color-on-primary);
  background: var(--md-sys-color-primary);
}

.btn-primary:hover {
  background: color-mix(in srgb, var(--md-sys-color-primary), rgb(0 0 0) 8%);
}

.btn-secondary {
  color: var(--md-sys-color-on-secondary);
  background: var(--md-sys-color-secondary);
}

.btn-secondary:hover {
  background: color-mix(in srgb, var(--md-sys-color-secondary), rgb(0 0 0) 8%);
}

.btn-danger {
  color: var(--md-sys-color-on-error);
  background: var(--md-sys-color-error);
}

.btn-danger:hover {
  background: color-mix(in srgb, var(--md-sys-color-error), rgb(0 0 0) 8%);
}

/* 状态演示 */
.status-demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
}

.status-success {
  color: var(--color-semantic-success);
  background: color-mix(in srgb, var(--color-semantic-success) 10%, transparent);
}

.status-warning {
  color: var(--color-semantic-warning);
  background: color-mix(in srgb, var(--color-semantic-warning) 10%, transparent);
}

.status-error {
  color: var(--md-sys-color-error);
  background: color-mix(in srgb, var(--md-sys-color-error) 10%, transparent);
}

.status-info {
  color: var(--color-semantic-info);
  background: color-mix(in srgb, var(--color-semantic-info) 10%, transparent);
}
</style>
