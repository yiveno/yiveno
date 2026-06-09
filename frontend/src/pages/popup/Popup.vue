<!--
  Popup 弹出页根组件
  - 提供常用操作入口：侧边栏开关、设置打开、搜索与快捷提示；
  - 通过组合式 API 管理状态，避免在模板内写复杂逻辑；
  - 遵循扩展 CSP：所有脚本为模块化引入，无内联脚本。
-->
<script setup lang="ts">
import { computed } from 'vue'
import GlobalSyncProgress from '@/components/business/GlobalSyncProgress/GlobalSyncProgress.vue'
import BookmarkSearchInput from '@/components/business/BookmarkSearchInput/BookmarkSearchInput.vue'
import { AppHeader, AnimatedNumber, LucideIcon, Card, Button } from '@/components'
import { t } from '@/utils/i18n-helpers'
import { usePopupPage } from './composables/usePopupPage'
import { usePopupStoreIndexedDB } from '@/stores/popup-store-indexeddb'
import { useTraitDataStore } from '@/stores/trait-data-store'
import type { PopupIssueType } from './types'

defineOptions({ name: 'PopupPage' })

const {
  isLoadingTraitOverview,
  isStoresReady,
  handleIssueRowClick,
  openManagementWithFilter,
  openManualOrganizePage,
  openSettings,
  openSidePanel
} = usePopupPage()

const popupStore = usePopupStoreIndexedDB()
const traitStore = useTraitDataStore()

if (!traitStore.isInitialized) {
  traitStore.initialize()
}

const stats = computed(() => popupStore.stats)
const traitOverview = computed(() => traitStore.statistics)

interface StatItem {
  labelKey: string
  value: number
  valueClass: string
}

const statItems = computed<StatItem[]>(() => [
  {
    labelKey: 'popup_stat_total',
    value: stats.value.bookmarks,
    valueClass: 'popup-stat-value--primary'
  },
  {
    labelKey: 'popup_stat_today_added',
    value: stats.value.todayAdded,
    valueClass: 'popup-stat-value--secondary'
  },
  {
    labelKey: 'popup_stat_recently_opened',
    value: stats.value.recentlyOpened,
    valueClass: 'popup-stat-value--secondary'
  }
])

interface IssueCardDef {
  kind: PopupIssueType
  filterKey: PopupIssueType | 'dead'
  variant: 'warning' | 'danger'
  icon: string
  labelKey: string
  tooltipKey: string
  count: number
  countClass: string
}

const issueCards = computed<IssueCardDef[]>(() => [
  {
    kind: 'duplicate',
    filterKey: 'duplicate',
    variant: 'warning',
    icon: 'copy',
    labelKey: 'popup_issue_duplicate',
    tooltipKey: 'popup_issue_delete_tooltip_duplicate',
    count: traitOverview.value.duplicate,
    countClass: 'issue-card-count--warning'
  },
  {
    kind: 'invalid',
    filterKey: 'dead',
    variant: 'danger',
    icon: 'unlink',
    labelKey: 'popup_issue_invalid',
    tooltipKey: 'popup_issue_delete_tooltip_invalid',
    count: traitOverview.value.invalid,
    countClass: 'issue-card-count--danger'
  }
])

interface ActionCardDef {
  icon: string
  labelKey: string
  handler: () => void
}

const actionCards = computed<ActionCardDef[]>(() => [
  { icon: 'folder-open', labelKey: 'popup_action_organize', handler: openManualOrganizePage },
  { icon: 'settings', labelKey: 'popup_action_settings', handler: openSettings }
])
</script>

<template>
  <GlobalSyncProgress />

  <div class="popup-container">
    <AppHeader
      :show-name="false"
      :back-tooltip="t('popup_open_sidepanel')"
      :show-settings="false"
      :show-notification="true"
      @back="openSidePanel"
    />

    <div v-if="!isStoresReady" class="loading-container">
      <md-circular-progress indeterminate></md-circular-progress>
      <p class="loading-text" data-testid="popup-loading-text">{{ t('popup_initializing') }}</p>
    </div>

    <div v-else class="main-container">
      <!-- 书签搜索 -->
      <section class="search-section">
        <div class="search-wrapper">
          <BookmarkSearchInput
            display-mode="full"
            mode="indexeddb"
            result-display="dropdown"
            :show-stats="true"
            :show-result-count="true"
            :max-dropdown-results="50"
            :quick-filters="{ enabled: false, position: 'none', filters: [] }"
            :limit="50"
          />
        </div>
      </section>

      <!-- 书签概览（三列统计） -->
      <section class="overview-section">
        <div class="popup-list-panel">
          <md-list class="popup-mwc-list popup-stat-list">
            <md-list-item
              v-for="item in statItems"
              :key="item.labelKey"
              type="text"
              class="popup-stat-item"
            >
              <div slot="headline" class="popup-stat-stack">
                <span class="popup-stat-label">{{ t(item.labelKey) }}</span>
                <span :class="['popup-stat-value', item.valueClass]">
                  <AnimatedNumber :value="item.value" />
                </span>
              </div>
            </md-list-item>
          </md-list>
        </div>
      </section>

      <md-divider class="popup-section-divider"></md-divider>

      <!-- 需要关注 -->
      <section class="issues-section">
        <div class="issues-grid">
          <Card
            v-for="card in issueCards"
            :key="card.kind"
            :variant="card.variant"
            :padding="false"
            :borderless="false"
            clickable
            class="issue-card"
            @click="handleIssueRowClick(card.kind, $event)"
            @keydown.enter.prevent="openManagementWithFilter(card.filterKey)"
            @keydown.space.prevent="openManagementWithFilter(card.filterKey)"
          >
            <div class="issue-card-content">
              <div class="issue-card-header">
                <span class="issue-card-title">
                  <LucideIcon :name="card.icon" :size="18" />
                  <span>{{ t(card.labelKey) }}</span>
                </span>
                <Button
                  v-if="card.count > 0"
                  variant="icon"
                  class="issue-action"
                  icon="trash-2"
                  :icon-size="16"
                  :title="t(card.tooltipKey)"
                  :aria-label="t(card.tooltipKey)"
                  @click.stop="openManagementWithFilter(card.filterKey)"
                />
              </div>
              <div :class="['issue-card-count', card.countClass]">
                <template v-if="!isLoadingTraitOverview">
                  <AnimatedNumber :value="card.count" />
                </template>
                <md-circular-progress v-else indeterminate></md-circular-progress>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <md-divider class="popup-section-divider"></md-divider>

      <!-- 快捷操作 -->
      <section class="actions-section">
        <div class="actions-grid">
          <Card
            v-for="card in actionCards"
            :key="card.labelKey"
            variant="elevated"
            :padding="false"
            :borderless="false"
            clickable
            class="action-card"
            @click="card.handler"
          >
            <div class="action-card-content">
              <div class="action-card-icon">
                <LucideIcon :name="card.icon" :size="20" />
              </div>
              <span class="action-card-label">{{ t(card.labelKey) }}</span>
            </div>
          </Card>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* ===== 全局尺寸重置 ===== */

/* Popup 作为 Chrome 扩展弹窗，需要设置固定宽高，否则窗口塌陷 */
.popup-container {
  display: flex;
  flex-direction: column;
  width: 420px;
  min-height: 550px;
  max-height: 600px;
  background: var(--md-sys-color-surface);
  overflow: hidden;
}

.loading-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-4);
}

.loading-text {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.main-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  overflow-y: auto;
}

/* ===== 节间距 ===== */
.search-section,
.overview-section,
.issues-section,
.actions-section {
  padding-bottom: 0;
}

/* ===== 统计列表 ===== */
.popup-stat-list md-list-item {
  flex: 1;
  text-align: center;
}

.popup-stat-stack {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  width: 100%;
  text-align: center;
}

.popup-stat-label {
  font-size: var(--text-xs);
  font-weight: var(--font-normal);
  color: var(--color-text-secondary);
}

.popup-stat-value {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.popup-stat-value--primary {
  color: var(--color-primary);
}

.popup-stat-value--secondary {
  color: var(--color-text-primary);
}

.popup-section-divider {
  margin: 0 calc(-1 * var(--spacing-3));
}

/* ===== 网格布局 ===== */
.issues-grid,
.actions-grid {
  display: grid;
  gap: var(--spacing-3);
  grid-template-columns: repeat(2, 1fr);
}

/* ===== Issue 卡片 ===== */
.issue-card {
  min-height: 100px;
}

.issue-card-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
}

.issue-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.issue-card-title {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.issue-card-count {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.issue-card-count--warning {
  color: var(--color-warning);
}

.issue-card-count--danger {
  color: var(--color-error);
}

.issue-action {
  flex-shrink: 0;
  color: var(--color-text-secondary);
  transition: color var(--transition-fast);
}

.issue-action:hover {
  color: var(--color-error);
}

:deep(.issue-card-count md-circular-progress) {
  --md-circular-progress-size: 48px;
  --md-circular-progress-active-indicator-width: 5px;
}

/* ===== 快捷操作卡片 ===== */
.action-card {
  min-height: 80px;
}

.action-card-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
}

.action-card-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  transition: all var(--transition-fast);
}

.action-card:hover .action-card-icon {
  background: color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.action-card-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  text-align: center;
  color: var(--color-text-primary);
}

/* ===== MWC 覆盖 ===== */

/* ===== 统计列表三列并排 ===== */
.popup-stat-list {
  display: grid;
  gap: var(--spacing-2);
  grid-template-columns: repeat(3, 1fr);
}

.popup-stat-item {
  --md-list-item-one-line-container-height: auto;

  height: auto;
  min-height: 0;
}

.popup-mwc-list md-list-item {
  --md-list-item-container-shape: var(--radius-sm);

  box-shadow: none;
}

.popup-mwc-list md-list-item:hover,
.popup-mwc-list md-list-item:active {
  box-shadow: none;
}
</style>
