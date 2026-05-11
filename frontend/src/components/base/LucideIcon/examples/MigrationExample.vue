<!--
  从 Material Icons 迁移到 Lucide Icons 的示例
  展示如何平滑迁移
-->
<template>
  <div class="migration-example">
    <h2>图标迁移示例</h2>
    
    <section class="comparison-section">
      <div class="old-way">
        <h3>旧方式 (Material Icons)</h3>
        <div class="code-block">
          <pre><code>&lt;Icon name="icon-bookmark-Add" /&gt;
&lt;Icon name="icon-delete" /&gt;
&lt;Icon name="icon-favorite" /&gt;
&lt;Icon name="icon-alert" /&gt;</code></pre>
        </div>
      </div>
      
      <div class="arrow">→</div>
      
      <div class="new-way">
        <h3>新方式 (Lucide Icons)</h3>
        <div class="code-block">
          <pre><code>&lt;LucideIcon name="bookmark-plus" /&gt;
&lt;LucideIcon name="trash" /&gt;
&lt;LucideIcon name="star" /&gt;
&lt;LucideIcon name="alert-circle" /&gt;</code></pre>
        </div>
      </div>
    </section>
    
    <section class="visual-comparison">
      <h3>视觉对比</h3>
      <div class="comparison-grid">
        <div class="comparison-item">
          <div class="label">书签添加</div>
          <div class="icons">
            <div class="icon-box">
              <LucideIcon name="bookmark-plus" size="lg" />
              <span>Lucide</span>
            </div>
          </div>
        </div>
        
        <div class="comparison-item">
          <div class="label">删除</div>
          <div class="icons">
            <div class="icon-box">
              <LucideIcon name="trash" size="lg" />
              <span>Lucide</span>
            </div>
          </div>
        </div>
        
        <div class="comparison-item">
          <div class="label">收藏</div>
          <div class="icons">
            <div class="icon-box">
              <LucideIcon name="star" size="lg" />
              <span>Lucide</span>
            </div>
          </div>
        </div>
        
        <div class="comparison-item">
          <div class="label">警告</div>
          <div class="icons">
            <div class="icon-box">
              <LucideIcon name="alert-circle" size="lg" />
              <span>Lucide</span>
            </div>
          </div>
        </div>
      </div>
    </section>
    
    <section class="mapping-table">
      <h3>常用图标映射表</h3>
      <table>
        <thead>
          <tr>
            <th>Material Icon</th>
            <th>Lucide Icon</th>
            <th>预览</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="mapping in commonMappings" :key="mapping.old">
            <td><code>{{ mapping.old }}</code></td>
            <td><code>{{ mapping.new }}</code></td>
            <td>
              <LucideIcon :name="mapping.new" />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
    
    <section class="migration-tips">
      <h3>迁移建议</h3>
      <ul>
        <li>✅ 使用映射表快速查找对应的 Lucide 图标</li>
        <li>✅ 新功能优先使用 Lucide Icons</li>
        <li>✅ 逐步替换旧的 Material Icons</li>
        <li>✅ 保持图标风格的一致性</li>
        <li>✅ 利用按需导入减少打包体积</li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { LucideIcon } from '../index'

defineOptions({
  name: 'MigrationExample'
})

// 常用图标映射
const commonMappings = [
  { old: 'icon-add', new: 'plus' },
  { old: 'icon-delete', new: 'trash' },
  { old: 'icon-edit-bookmark', new: 'edit' },
  { old: 'icon-bookmark', new: 'bookmark' },
  { old: 'icon-bookmark-Add', new: 'bookmark-plus' },
  { old: 'icon-favorite', new: 'star' },
  { old: 'icon-folder', new: 'folder' },
  { old: 'icon-folder-add', new: 'folder-plus' },
  { old: 'icon-alert', new: 'alert-circle' },
  { old: 'icon-success', new: 'check-circle' },
  { old: 'icon-error', new: 'x-circle' },
  { old: 'icon-cloud-sync', new: 'refresh' }
]
</script>

<style scoped>
/* stylelint-disable declaration-property-value-disallowed-list -- 示例文件，用于演示组件用法 */
.migration-example {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

h2 {
  margin-bottom: 32px;
  font-size: 24px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

h3 {
  margin-bottom: 16px;
  font-size: 18px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
}

/* 对比区域 */
.comparison-section {
  display: grid;
  gap: 24px;
  grid-template-columns: 1fr auto 1fr;
  margin-bottom: 48px;
  padding: 24px;
  border-radius: 12px;
  background: var(--md-sys-color-surface-variant);
}

.arrow {
  display: flex;
  align-items: center;
  font-size: 32px;
  color: var(--md-sys-color-primary);
}

.code-block {
  padding: 16px;
  border-radius: 8px;
  background: var(--md-sys-color-surface);
  overflow-x: auto;
}

.code-block pre {
  margin: 0;
  font-family: Monaco, Menlo, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--md-sys-color-on-surface);
}

td {
  padding: 12px 16px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface-variant);
}

td code {
  padding: 2px 6px;
  border-radius: 4px;
  font-family: Monaco, Menlo, monospace;
  font-size: 13px;
  background: var(--md-sys-color-surface);
}

.code-block code {
  font-family: inherit;
}

/* 视觉对比 */
.visual-comparison {
  margin-bottom: 48px;
}

.comparison-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.comparison-item {
  padding: 16px;
  border-radius: 8px;
  background: var(--md-sys-color-surface-variant);
}

.comparison-item .label {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
}

.icons {
  display: flex;
  gap: 16px;
}

.icon-box {
  display: flex;
  flex-direction: column;
  flex: 1;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  background: var(--md-sys-color-surface);
}

.icon-box span {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

/* 映射表 */
.mapping-table {
  margin-bottom: 48px;
}

table {
  width: 100%;
  border-radius: 8px;
  background: var(--md-sys-color-surface-variant);
  overflow: hidden;
  border-collapse: collapse;
}

thead {
  background: var(--md-sys-color-surface-container-high);
}

th {
  padding: 12px 16px;
  font-weight: 500;
  text-align: left;
  color: var(--md-sys-color-on-surface);
}

/* 视觉对比 */
.migration-tips ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.migration-tips li {
  margin-bottom: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  color: var(--md-sys-color-on-surface-variant);
  background: var(--md-sys-color-surface-variant);
}
</style>
