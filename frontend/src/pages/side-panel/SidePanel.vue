<script setup lang="ts">
defineOptions({ name: 'SidePanelPage' })

import { Accordion, AccordionItem, Dialog, AppHeader, Button } from '@/components'
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
  <GlobalSyncProgress />

  <ShareDialog
    v-model:show="showShareDialog"
    :bookmarks="shareBookmarks"
    :share-type="shareType"
    v-bind="shareFolderName ? { folderName: shareFolderName } : {}"
    @share-complete="handleShareComplete"
  />

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
      <Button variant="text" @click="postponeRefresh">{{ t('sidepanel_postpone') }}</Button>
      <Button variant="filled" :disabled="isLoading" @click="confirmRefresh">
        {{ t('sidepanel_refresh_now') }}
      </Button>
    </template>
  </Dialog>

  <div class="side-panel-container">
    <AppHeader
      :show-side-panel-toggle="false"
      :show-logo="false"
      :show-settings="false"
      :show-notification="true"
    />

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

    <Accordion v-if="!searchQuery" :exclusive="true" default-expanded="tree">
      <AccordionItem id="recent" :title="t('sidepanel_recent_visits')" icon="icon-clock">
        <template #badge>
          <span class="count-badge">{{ recentCount }}</span>
        </template>
        <RecentVisits
          @bookmark-click="handleRecentClick"
          @bookmark-remove="handleRecentRemove"
          @count-update="recentCount = $event"
        />
      </AccordionItem>

      <AccordionItem id="favorites" :title="t('sidepanel_favorites')" icon="icon-star">
        <template #badge>
          <span class="count-badge">{{ favoriteCount }}</span>
        </template>
        <FavoriteSection
          @bookmark-click="handleFavoriteClick"
          @bookmark-remove="handleFavoriteRemove"
          @share="handleShareFavorites"
        />
      </AccordionItem>

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
.side-panel-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  color: var(--color-text-primary);
  background: var(--color-background);
  overflow: hidden;
}

.search-section {
  flex-shrink: 0;
  padding: var(--spacing-3) var(--spacing-4) var(--spacing-3);
}

.side-panel-container :deep(.accordion) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  margin: 0 var(--spacing-4);
  overflow: hidden;
}

.side-panel-container :deep(.accordion-item) {
  flex-shrink: 0;
}

.side-panel-container :deep(.accordion-content) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden auto;
}

.side-panel-container :deep(.bookmark-tree-wrapper) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.count-badge {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-body-small);
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.01em;
  color: var(--color-on-primary);
  background: var(--color-primary);
}

.update-prompt-content p {
  margin: 0 0 var(--spacing-2);
}

.update-detail {
  margin-top: var(--spacing-2);
}
</style>
