<script setup lang="ts">
defineOptions({
  name: 'SidePanelPage'
})
import { Accordion, AccordionItem, Dialog, AppHeader } from '@/components'
import BookmarkTree from '@/components/business/BookmarkTree/BookmarkTree.vue'
import GlobalSyncProgress from '@/components/business/GlobalSyncProgress/GlobalSyncProgress.vue'
import ShareDialog from '@/components/business/ShareDialog/ShareDialog.vue'
import BookmarkSearchInput from '@/components/business/BookmarkSearchInput/BookmarkSearchInput.vue'
import { FavoriteSection, RecentVisits } from './components'
import { t } from '@/utils/i18n-helpers'
import { useSidePanelPage } from './composables/useSidePanelPage'

const {
  bookmarkTree,
  treeSelectedDescCounts,
  isLoading,
  treeRefreshKey,
  searchQuery,
  recentCount,
  favoriteCount,
  showShareDialog,
  shareBookmarks,
  shareType,
  shareFolderName,
  showUpdatePrompt,
  pendingUpdateDetail,
  handleSearchComplete,
  handleSearchClear,
  openBookmark,
  handleBookmarkClick,
  handleFolderToggle,
  handleRecentClick,
  handleRecentRemove,
  handleFavoriteClick,
  handleFavoriteRemove,
  handleShareFavorites,
  handleFolderShare,
  handleBookmarkShare,
  handleShareComplete,
  handleBookmarkToggleFavorite,
  handleBookmarkOpenNewTab,
  handleBookmarkCopyUrl,
  handleTreeReady,
  confirmRefresh,
  postponeRefresh
} = useSidePanelPage()
</script>

<template>
  <!-- 📊 全局书签同步进度对话框 -->
  <GlobalSyncProgress />

  <!-- 📤 分享弹窗 -->
  <ShareDialog
    v-model:show="showShareDialog"
    :bookmarks="shareBookmarks"
    :share-type="shareType"
    v-bind="shareFolderName ? { folderName: shareFolderName } : {}"
    @share-complete="handleShareComplete"
  />

  <!-- 外部变更更新提示 -->
  <Dialog
    :show="showUpdatePrompt"
    :title="t('sidepanel_external_change_title')"
    icon="icon-sync-alert"
    @update:show="showUpdatePrompt = $event"
  >
    <div class="update-prompt-content">
      <p>{{ t('sidepanel_external_change_message') }}</p>
      <div v-if="pendingUpdateDetail" class="update-detail">
        <small>{{
          t('sidepanel_external_change_detail', [
            pendingUpdateDetail.eventType,
            pendingUpdateDetail.id
          ])
        }}</small>
      </div>
    </div>
    <template #actions>
      <md-text-button @click="postponeRefresh">{{ t('sidepanel_postpone') }}</md-text-button>
      <md-filled-button :disabled="isLoading" @click="confirmRefresh">
        {{ t('sidepanel_refresh_now') }}
      </md-filled-button>
    </template>
  </Dialog>

  <div class="side-panel-container">
    <!-- 顶部导航栏（侧边栏模式：隐藏 logo，避免与 Chrome 标题栏重复） -->
    <AppHeader
      :show-side-panel-toggle="false"
      :show-logo="false"
      :show-settings="false"
      :show-notification="true"
    />

    <!-- 搜索栏 -->
    <div class="search-section">
      <BookmarkSearchInput
        v-model:query="searchQuery"
        display-mode="full"
        mode="indexeddb"
        :limit="50"
        :enable-trait-filters="false"
        @result-click="openBookmark"
        @search-complete="handleSearchComplete"
        @search-clear="handleSearchClear"
      />
    </div>

    <!-- 百叶窗式折叠面板 -->
    <Accordion v-if="!searchQuery" :exclusive="true" default-expanded="tree">
      <!-- 最近访问 -->
      <AccordionItem id="recent" :title="t('sidepanel_recent_visits')" icon="icon-clock">
        <template #badge>
          <CountIndicator :count="recentCount" size="sm" variant="primary" />
        </template>
        <RecentVisits
          @bookmark-click="handleRecentClick"
          @bookmark-remove="handleRecentRemove"
          @count-update="recentCount = $event"
        />
      </AccordionItem>

      <!-- 收藏书签 -->
      <AccordionItem id="favorites" :title="t('sidepanel_favorites')" icon="icon-star">
        <template #badge>
          <CountIndicator :count="favoriteCount" size="sm" variant="primary" />
        </template>
        <FavoriteSection
          @bookmark-click="handleFavoriteClick"
          @bookmark-remove="handleFavoriteRemove"
          @share="handleShareFavorites"
        />
      </AccordionItem>

      <!-- 书签树 - 默认展开，可折叠 -->
      <AccordionItem id="tree" :title="t('sidepanel_bookmark_tree')" icon="icon-folder">
        <BookmarkTree
          :key="treeRefreshKey"
          :nodes="bookmarkTree"
          :selected-desc-counts="treeSelectedDescCounts"
          source="sidePanel"
          :loading="isLoading"
          height="auto"
          size="spacious"
          :searchable="false"
          :selectable="false"
          :editable="false"
          :show-toolbar="false"
          :accordion-mode="true"
          :show-favorite-button="true"
          :show-share-button="true"
          :show-open-new-tab-button="true"
          :show-copy-url-button="true"
          :show-bookmark-url="false"
          default-open-mode="current-tab"
          click-behavior="open"
          @ready="handleTreeReady"
          @node-click="handleBookmarkClick"
          @folder-toggle="handleFolderToggle"
          @bookmark-open-new-tab="handleBookmarkOpenNewTab"
          @bookmark-copy-url="handleBookmarkCopyUrl"
          @bookmark-toggle-favorite="handleBookmarkToggleFavorite"
          @folder-share="handleFolderShare"
          @bookmark-share="handleBookmarkShare"
        />
      </AccordionItem>
    </Accordion>
  </div>
</template>

<style scoped>
.ai-badge-inline {
  margin-right: var(--spacing-1-5);
}

md-circular-progress {
  --md-circular-progress-size: 20px;
  --md-circular-progress-active-indicator-width: 3px;
}

.loading-state md-circular-progress {
  --md-circular-progress-size: 32px;
  --md-circular-progress-active-indicator-width: 4px;
}
</style>

<style scoped>
@keyframes sync-pulse {
  0%,
  100% {
    opacity: 0.7;
  }

  50% {
    opacity: 1;
  }
}

.side-panel-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  color: var(--color-text-primary);
  background: var(--color-background);
  overflow: hidden;
}

/* 搜索区域固定高度 */
.search-section {
  flex-shrink: 0;
  padding: var(--spacing-3) var(--spacing-4) var(--spacing-3) var(--spacing-4);
}

/* Accordion 容器占据剩余空间 */
.side-panel-container :deep(.accordion) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  margin-right: var(--spacing-4);
  margin-left: var(--spacing-4);
  overflow: hidden;
}

/* AccordionItem 标题：固定高度 */
.side-panel-container :deep(.accordion-item) {
  flex-shrink: 0;
}

/* AccordionItem 内容区域：展开时占据所有剩余空间 */
.side-panel-container :deep(.accordion-content) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden auto;
}

/* BookmarkTree 容器：填充父容器，不设置滚动 */
.side-panel-container :deep(.bookmark-tree-wrapper) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* 头部样式 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.settings-btn {
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.settings-btn:hover {
  opacity: 1;
}

.close-btn {
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.close-btn:hover {
  opacity: 1;
}

.sync-indicator {
  display: inline-flex;
  align-items: center;
  margin-left: var(--spacing-sm);
  padding: var(--spacing-0-5) var(--spacing-1-5);
  border: 1px solid var(--color-success-border);
  border-radius: var(--radius-lg);
  background: var(--color-success-background);
}

.sync-icon {
  color: var(--color-success);

  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: opacity;
  animation: sync-pulse 2s infinite;
}

/* 收藏夹区域 */
.favorites-section {
  padding: 0 var(--spacing-4) var(--spacing-3) var(--spacing-4);
}

.recommendations-section {
  padding: 0 var(--spacing-4) var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
}

.recommendations-section :deep(.smart-recommendations) {
  padding: var(--spacing-sm) 0;
  border: none;
  background: transparent;
}

.recommendations-section :deep(.recommendations-title) {
  font-size: var(--text-base);
  color: var(--color-text-primary);
}

.recommendations-section :deep(.recommendation-item) {
  padding: var(--spacing-1-5) var(--spacing-sm);
  border-radius: var(--radius-sm);
}

.recommendations-section :deep(.recommendation-item:hover) {
  background: var(--color-background-hover);
}

.recommendations-section :deep(.bookmark-title) {
  font-size: var(--text-xs);
}

.recommendations-section :deep(.bookmark-meta) {
  font-size: var(--text-xs);
}

/* 书签树容器：不设置滚动，由 accordion-content 控制 */
.bookmark-tree {
  flex: 1;
  padding: var(--spacing-sm);
}

/* 搜索结果容器：不设置滚动，由 accordion-content 控制 */
.search-results {
  flex: 1;
  padding: var(--spacing-sm);
}

.search-items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0-5);
}

.search-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-sm) var(--spacing-3);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none; /* 禁止文本选择 */
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.search-item:hover {
  border-color: var(--color-border-hover);
  background: var(--color-surface-hover);
}

.search-item:active {
  background: var(--color-surface-active);

  /* 避免缩放引起视觉位移与重排 */
  box-shadow: 0 0 0 2px var(--color-primary-alpha-10) inset;
}

.search-item-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  width: 20px;
  height: 20px;
  user-select: none; /* 禁止图标选择 */
}

.search-item-icon img {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  user-select: none; /* 禁止图片选择 */
  pointer-events: none; /* 防止图片拖拽 */
}

.search-item-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0; /* 移除默认间距，由各元素的margin控制 */
  min-width: 0;
}

.search-item-title {
  margin-bottom: var(--spacing-0-5); /* 与URL的间距 */
  font-size: var(--text-base);
  font-weight: 600; /* 加粗书签名称 */
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-highlight {
  padding: 0 1px;
  border-radius: var(--radius-xs);
  font-weight: 600;
  color: var(--color-text-primary);
  background: var(--color-warning-alpha-20);
}

.search-item-path {
  margin-top: var(--spacing-0-5); /* 与其他元素保持一致的间距 */
  padding: var(--spacing-0-5) var(--spacing-1-5);
  border-left: 2px solid var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs); /* 增大字体提升可读性 */
  font-style: italic;
  white-space: nowrap;
  color: var(--color-text-secondary); /* 使用次级文本颜色，比三级更明显 */
  background: var(--color-surface-variant);
  opacity: 0.95; /* 稍微增加不透明度 */
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-item-url {
  margin: -1px calc(-1 * var(--spacing-1)) var(--spacing-0-5) calc(-1 * var(--spacing-1)); /* 添加底部间距与路径保持一致 */
  padding: 1px var(--spacing-1);
  border-radius: var(--radius-xs);
  outline: none; /* 移除focus时的边框 */
  font-size: var(--text-sm); /* 增大字体提升可读性 */
  text-decoration: none;
  white-space: nowrap; /* URL单行显示 */
  color: var(--color-primary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
  overflow: hidden; /* 隐藏超出部分 */
  text-overflow: ellipsis; /* 超出显示省略号 */
}

.search-item-url:hover {
  text-decoration: underline;
  color: var(--color-primary-400, var(--color-primary));
  background: var(--color-primary-alpha-10);
}

.search-item-url:focus {
  outline: none; /* 移除focus时的边框 */
  box-shadow: none; /* 移除可能的阴影 */
}

.search-item-url:visited {
  color: var(--color-primary); /* 访问后保持相同颜色 */
}

.search-item-url:active {
  color: var(--color-primary); /* 点击时保持相同颜色 */
  background: none; /* 移除点击时的背景 */
}

/* 加载和空状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-10) var(--spacing-5);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-16) var(--spacing-5);
  text-align: center;
}

.empty-state p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* 滚动条使用浏览器默认样式 */
</style>
