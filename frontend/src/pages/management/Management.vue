<script setup lang="ts">
import {
  AppHeader,
  BookmarkSearchInput,
  Card,
  Dialog,
  LucideIcon,
  AnimatedNumber,
  Button
} from '@/components'
import { Loading } from '@/components/base/Loading'
import GlobalSyncProgress from '@/components/business/GlobalSyncProgress/GlobalSyncProgress.vue'
import BookmarkTree from '@/components/business/BookmarkTree/BookmarkTree.vue'
import { useManagementPage } from './composables/useManagementPage'
import { t } from '@/utils/i18n-helpers'

defineOptions({
  name: 'ManagementPage'
})

const {
  dialogStore,
  bookmarkManagementStore,
  traitFilterStore,
  getProposalPanelTitle,
  getProposalPanelIcon,
  originalTree,
  newProposalTree,
  isPageLoading,
  loadingMessage,
  originalExpandedFolders,
  proposalExpandedFolders,
  showApplyConfirmDialog,
  diffResult,
  isOrganizing,
  organizeProgress,
  showOrganizeProgress,
  leftTreeData,
  rightTreeData,
  leftExpandAll,
  rightExpandAll,
  isLeftPanelCollapsed,
  leftPanelWidthVar,
  leftPanelGapVar,
  rightTreeSelectedDescCounts,
  rightSelectedIds,
  rightSelectAllState,
  selectedCounts,
  applyButtonTooltip,
  clearSelectionTooltip,
  deleteButtonTooltip,
  applyConfirmTitle,
  applyConfirmIcon,
  estimatedRemainingTime,
  MSG_CANCEL_EDIT,
  editFormErrors,
  folderEditFormErrors,
  isEditingBookmark,
  isEditingFolder,
  isDeletingFolder,
  isConfirmDeleteDialogOpen,
  deleteFolderBookmarkCount,
  isEditDirty,
  isEditFolderDirty,
  handleLeftSearch,
  handleLeftSearchClear,
  handleRightSearch,
  handleRightSearchClear,
  onEditBookmarkTitleInput,
  onEditBookmarkUrlInput,
  onEditFolderTitleInput,
  handleLeftTreeReady,
  handleRightNodeEdit,
  handleRightNodeDelete,
  toggleLeftPanel,
  toggleLeftExpandAll,
  toggleRightExpandAll,
  onRightSelectionChange,
  toggleRightSelectAll,
  clearRightSelection,
  handleBookmarkCopyUrl,
  handleBookmarkOpenNewTab,
  getDiffOperationsByType,
  getOperationIcon,
  getOperationTypeText,
  handleApplyClick,
  confirmApplyChanges,
  handleAutoOrganize,
  confirmEditBookmark,
  confirmEditFolder,
  confirmDeleteFolder,
  handleBookmarkMove,
  handleBulkDelete
} = useManagementPage()
</script>

<template>
  <div class="management-page app-container">
    <div v-if="isPageLoading" class="page-overlay">
      <div class="overlay-loading">
        <Loading size="xl" :text="loadingMessage" />
      </div>
    </div>
    <GlobalSyncProgress />

    <Dialog
      :show="showOrganizeProgress"
      :title="t('management_ai_organize_bookmarks')"
      persistent
      max-width="500px"
    >
      <div class="trait-scan-progress">
        <div class="progress-info">
          <div class="progress-message">{{ organizeProgress.stageName }}</div>
          <div class="progress-stats">
            {{ organizeProgress.processedBookmarks }} /
            {{ organizeProgress.totalBookmarks }}
          </div>
        </div>
        <md-linear-progress
          :value="
            organizeProgress.totalBookmarks > 0
              ? organizeProgress.processedBookmarks / organizeProgress.totalBookmarks
              : 0
          "
        ></md-linear-progress>
      </div>
    </Dialog>
    <!-- 📝 应用更改确认对话框 -->
    <Dialog
      :show="showApplyConfirmDialog"
      :title="applyConfirmTitle"
      :icon="applyConfirmIcon"
      persistent
      :enter-to-confirm="true"
      max-width="600px"
      @update:show="showApplyConfirmDialog = $event"
      @confirm="confirmApplyChanges"
    >
      <div class="apply-confirm-dialog">
        <!-- AI 生成标记 -->
        <div v-if="bookmarkManagementStore.isAIGenerated" class="ai-badge">
          <LucideIcon name="sparkles" color="primary" />
          <span>{{ t('management_ai_generated_badge') }}</span>
        </div>

        <!-- 统计信息 -->
        <div class="statistics-section">
          <h3 class="section-title">{{ t('management_changes_overview') }}</h3>
          <div class="statistics-grid">
            <div class="stat-item">
              <span class="stat-label">{{ t('management_new_folders') }}</span>
              <span class="stat-value">{{ diffResult?.statistics.newFolders || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('management_new_bookmarks') }}</span>
              <span class="stat-value">{{ diffResult?.statistics.newBookmarks || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('management_moved') }}</span>
              <span class="stat-value">{{ diffResult?.statistics.move || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('management_edited') }}</span>
              <span class="stat-value">{{ diffResult?.statistics.edit || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('management_deleted') }}</span>
              <span class="stat-value error">{{ diffResult?.statistics.delete || 0 }}</span>
            </div>
            <div class="stat-item total">
              <span class="stat-label">{{ t('management_total') }}</span>
              <span class="stat-value">{{ diffResult?.statistics.total || 0 }}</span>
            </div>
          </div>
        </div>

        <!-- 详细列表（仅在操作数 < 100 时显示完整列表，100-500 显示汇总，>500 只显示统计） -->
        <div v-if="diffResult" class="details-section">
          <div v-if="diffResult.statistics.total < 100" class="detailed-list">
            <h3 class="section-title">
              {{ t('management_detailed_operations') }}
            </h3>
            <div class="operations-list">
              <div
                v-for="(op, index) in diffResult.operations.slice(0, 100)"
                :key="index"
                class="operation-item"
              >
                <LucideIcon :name="getOperationIcon(op.type)" />
                <span class="operation-type">{{ getOperationTypeText(op.type) }}</span>
                <span class="operation-title">{{ op.title }}</span>
              </div>
            </div>
          </div>
          <div v-else-if="diffResult.statistics.total < 500" class="grouped-summary">
            <h3 class="section-title">{{ t('management_grouped_summary') }}</h3>
            <details v-if="diffResult.statistics.create > 0" class="summary-group" open>
              <summary>
                <LucideIcon name="plus" color="success" />
                <span>{{
                  t('management_create_nodes', String(diffResult.statistics.create))
                }}</span>
              </summary>
              <div class="group-items">
                <div
                  v-for="(op, index) in getDiffOperationsByType('create').slice(0, 50)"
                  :key="index"
                  class="group-item"
                >
                  {{ op.isFolder ? '📁' : '📄' }} {{ op.title }}
                </div>
                <div v-if="getDiffOperationsByType('create').length > 50" class="more-items">
                  {{
                    t(
                      'management_more_items',
                      String(getDiffOperationsByType('create').length - 50)
                    )
                  }}
                </div>
              </div>
            </details>
            <details v-if="diffResult.statistics.move > 0" class="summary-group">
              <summary>
                <LucideIcon name="refresh" color="primary" />
                <span>{{ t('management_move_nodes', String(diffResult.statistics.move)) }}</span>
              </summary>
              <div class="group-items">
                <div
                  v-for="(op, index) in getDiffOperationsByType('move').slice(0, 50)"
                  :key="index"
                  class="group-item"
                >
                  {{ op.title }}
                </div>
                <div v-if="getDiffOperationsByType('move').length > 50" class="more-items">
                  {{
                    t('management_more_items', String(getDiffOperationsByType('move').length - 50))
                  }}
                </div>
              </div>
            </details>
            <details v-if="diffResult.statistics.edit > 0" class="summary-group">
              <summary>
                <LucideIcon name="edit" color="warning" />
                <span>{{ t('management_edit_nodes', String(diffResult.statistics.edit)) }}</span>
              </summary>
              <div class="group-items">
                <div
                  v-for="(op, index) in getDiffOperationsByType('edit').slice(0, 50)"
                  :key="index"
                  class="group-item"
                >
                  {{ op.title }}
                </div>
                <div v-if="getDiffOperationsByType('edit').length > 50" class="more-items">
                  {{
                    t('management_more_items', String(getDiffOperationsByType('edit').length - 50))
                  }}
                </div>
              </div>
            </details>
            <details v-if="diffResult.statistics.delete > 0" class="summary-group">
              <summary>
                <LucideIcon name="trash" color="error" />
                <span>{{
                  t('management_delete_nodes', String(diffResult.statistics.delete))
                }}</span>
              </summary>
              <div class="group-items">
                <div
                  v-for="(op, index) in getDiffOperationsByType('delete').slice(0, 50)"
                  :key="index"
                  class="group-item"
                >
                  {{ op.title }}
                </div>
                <div v-if="getDiffOperationsByType('delete').length > 50" class="more-items">
                  {{
                    t(
                      'management_more_items',
                      String(getDiffOperationsByType('delete').length - 50)
                    )
                  }}
                </div>
              </div>
            </details>
          </div>
          <div v-else class="large-operation-warning">
            <LucideIcon name="alert-triangle" color="warning" :size="48" />
            <h3>{{ t('management_large_operation_warning') }}</h3>
            <p
              v-html="t('management_large_operation_desc', String(diffResult.statistics.total))"
            ></p>
            <p class="warning-text">
              {{ t('management_large_operation_warning_text') }}
            </p>
          </div>
        </div>
      </div>

      <template #actions>
        <Button variant="text" @click="showApplyConfirmDialog = false">
          {{ t('common_cancel') }}
        </Button>
        <Button variant="filled" @click="confirmApplyChanges">
          {{ t('common_apply') }}
        </Button>
      </template>
    </Dialog>
    <!-- 📈 应用更改进度对话框 -->
    <Dialog
      :show="bookmarkManagementStore.applyProgress.isApplying"
      :title="t('management_applying_changes')"
      persistent
      :close-on-overlay="false"
      :esc-to-close="false"
      max-width="500px"
    >
      <div class="apply-progress">
        <div class="progress-info">
          <div class="progress-message">
            {{ bookmarkManagementStore.applyProgress.currentOperation }}
          </div>
          <div class="progress-stats">
            {{ bookmarkManagementStore.applyProgress.currentIndex }} /
            {{ bookmarkManagementStore.applyProgress.totalOperations }}
          </div>
        </div>
        <md-linear-progress
          :value="bookmarkManagementStore.applyProgress.percentage / 100"
        ></md-linear-progress>
        <div class="progress-tip">
          {{ t('management_estimated_time', estimatedRemainingTime) }}
        </div>
      </div>
    </Dialog>
    <AppHeader :show-side-panel-toggle="false" />
    <main class="main-content">
      <div class="management-container">
        <div
          class="management-row"
          :style="{
            '--left-panel-width': leftPanelWidthVar,
            '--left-panel-gap': leftPanelGapVar
          }"
        >
          <!-- Left Panel -->
          <div
            class="panel-col left-panel"
            :class="{ 'left-panel--collapsed': isLeftPanelCollapsed }"
          >
            <Card class="panel-card" elevation="medium">
              <template #header>
                <div class="panel-header">
                  <div class="panel-title-section">
                    <LucideIcon name="folder" color="primary" />
                    <span class="panel-title">{{ t('management_my_bookmarks') }}</span>
                  </div>
                  <div class="panel-title-section">
                    <BookmarkSearchInput
                      mode="memory"
                      :data="originalTree"
                      :debounce="300"
                      @search-complete="handleLeftSearch"
                      @search-clear="handleLeftSearchClear"
                    />

                    <Button
                      variant="icon"
                      :title="
                        leftExpandAll ? t('management_collapse_all') : t('management_expand_all')
                      "
                      :disabled="isPageLoading"
                      @click="toggleLeftExpandAll"
                    >
                      <span
                        class="expand-toggle-icon"
                        :class="{
                          expanded: leftExpandAll,
                          expanding: isPageLoading
                        }"
                      >
                        <LucideIcon :name="leftExpandAll ? 'chevrons-up' : 'chevrons-down'" />
                      </span>
                    </Button>
                  </div>
                </div>
              </template>

              <div class="panel-content">
                <BookmarkTree
                  ref="leftTreeRef"
                  :nodes="leftTreeData"
                  source="management"
                  height="100%"
                  size="spacious"
                  :loading="isPageLoading"
                  :editable="false"
                  :show-toolbar="false"
                  :highlight-matches="false"
                  :initial-expanded="Array.from(originalExpandedFolders)"
                  :virtual="true"
                  :selectable="false"
                  :show-favorite-button="false"
                  :show-edit-button="false"
                  :show-delete-button="false"
                  :show-add-button="false"
                  :show-open-new-tab-button="false"
                  :show-copy-url-button="false"
                  :show-share-button="false"
                  :show-more-button="false"
                  @ready="handleLeftTreeReady"
                />
              </div>
            </Card>
          </div>

          <!-- Middle Divider - 可点击切换左侧面板收起/展开 -->
          <div class="panel-col divider-col">
            <div class="panel-divider" @click="toggleLeftPanel">
              <Button
                variant="icon"
                :title="isLeftPanelCollapsed ? '展开左侧面板' : '收起左侧面板'"
                class="panel-toggle-btn"
              >
                <LucideIcon
                  :name="isLeftPanelCollapsed ? 'chevrons-right' : 'chevrons-left'"
                  :size="24"
                />
              </Button>
            </div>
          </div>

          <!-- Right Panel -->
          <div class="panel-col right-panel">
            <Card
              class="panel-card right-panel-card"
              elevation="medium"
              :footer-visible="true"
              footer-transition="card-footer-slide"
            >
              <template #header>
                <div class="panel-header">
                  <div class="panel-title-section">
                    <LucideIcon :name="getProposalPanelIcon()" />
                    <span class="panel-title">{{ getProposalPanelTitle() }}</span>
                  </div>
                  <div class="panel-title-section">
                    <div class="panel-actions">
                      <!-- ✅ 使用包装元素解决禁用状态下 tooltip 不显示的问题 -->
                      <span class="btn-wrapper" :title="applyButtonTooltip">
                        <Button
                          variant="filled"
                          :disabled="isPageLoading || !bookmarkManagementStore.hasUnsavedChanges"
                          @click="handleApplyClick"
                        >
                          <LucideIcon slot="icon" name="check" />
                          {{ t('management_apply') }}
                        </Button>
                      </span>
                      <div class="panel-actions-divider"></div>
                      <Button
                        variant="filled"
                        :disabled="isPageLoading || isOrganizing"
                        @click="handleAutoOrganize"
                      >
                        <LucideIcon slot="icon" name="sparkles" :spin="isOrganizing" />
                        {{
                          isOrganizing ? t('management_organizing') : t('management_ai_organize')
                        }}
                      </Button>
                      <div class="panel-actions-divider"></div>
                      <BookmarkSearchInput
                        mode="memory"
                        :data="newProposalTree.children"
                        :debounce="300"
                        :enable-trait-filters="true"
                        :sync-with-store="true"
                        @search-complete="handleRightSearch"
                        @search-clear="handleRightSearchClear"
                      />
                      <Button
                        variant="icon"
                        :title="
                          rightExpandAll ? t('management_collapse_all') : t('management_expand_all')
                        "
                        :disabled="isPageLoading"
                        @click="toggleRightExpandAll"
                      >
                        <span
                          class="expand-toggle-icon"
                          :class="{
                            expanded: rightExpandAll
                          }"
                        >
                          <LucideIcon :name="rightExpandAll ? 'chevrons-up' : 'chevrons-down'" />
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              </template>

              <div class="panel-content">
                <!-- 特征筛选面板已移至 BookmarkSearchInput 组件 -->
                <BookmarkTree
                  ref="rightTreeRef"
                  :nodes="rightTreeData"
                  :selected-desc-counts="rightTreeSelectedDescCounts"
                  height="100%"
                  size="spacious"
                  :editable="true"
                  :show-toolbar="true"
                  :draggable="true"
                  selectable="multiple"
                  :show-selection-checkbox="true"
                  :toolbar-expand-collapse="false"
                  :highlight-matches="false"
                  :initial-expanded="Array.from(proposalExpandedFolders)"
                  :virtual="true"
                  :show-favorite-button="false"
                  :show-edit-button="true"
                  :show-delete-button="true"
                  :show-add-button="false"
                  :show-open-new-tab-button="true"
                  :show-copy-url-button="true"
                  @desc-counts-updated="rightTreeSelectedDescCounts = $event"
                  @request-clear-filters="traitFilterStore.clearFilters()"
                  @node-edit="handleRightNodeEdit"
                  @node-delete="handleRightNodeDelete"
                  @selection-change="onRightSelectionChange"
                  @bookmark-open-new-tab="handleBookmarkOpenNewTab"
                  @bookmark-copy-url="handleBookmarkCopyUrl"
                  @bookmark-move="handleBookmarkMove"
                />
              </div>
              <template #footer>
                <!-- 右侧面板内底部批量操作条（始终显示） -->
                <div class="bulk-delete-in-panel">
                  <div class="selection-summary">
                    <md-checkbox
                      :checked="rightSelectAllState.checked"
                      :indeterminate="rightSelectAllState.indeterminate"
                      class="select-all-checkbox"
                      @change="toggleRightSelectAll"
                    ></md-checkbox>
                    <!-- ✅ 全选时文案变化 -->
                    <span class="text">{{
                      rightSelectAllState.checked && !rightSelectAllState.indeterminate
                        ? t('management_all_selected')
                        : t('management_selected')
                    }}</span>
                    <span class="count"><AnimatedNumber :value="selectedCounts.bookmarks" /></span>
                    <span class="text">{{ t('management_bookmarks_count') }}</span>
                    <span class="gap"></span>
                    <span class="count"><AnimatedNumber :value="selectedCounts.folders" /></span>
                    <span class="text">{{ t('management_folders_count') }}</span>
                  </div>
                  <div class="bulk-actions">
                    <!-- ✅ 清除选择按钮包装器 -->
                    <span class="btn-wrapper" :title="clearSelectionTooltip">
                      <Button
                        variant="text"
                        class="clear-selection"
                        :disabled="rightSelectedIds.length === 0"
                        @click="clearRightSelection"
                      >
                        {{ t('management_clear_selection', String(rightSelectedIds.length)) }}
                      </Button>
                    </span>
                    <!-- ✅ 删除按钮包装器 -->
                    <span class="btn-wrapper" :title="deleteButtonTooltip">
                      <Button
                        variant="filled"
                        class="bulk-delete-btn error-button"
                        :disabled="selectedCounts.bookmarks === 0 && selectedCounts.folders === 0"
                        @click="handleBulkDelete"
                      >
                        <LucideIcon slot="icon" name="trash" />
                        {{ t('common_delete') }}
                      </Button>
                    </span>
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </div>
      </div>
    </main>
    <!-- Edit Bookmark Dialog -->
    <Dialog
      :show="dialogStore.editBookmarkDialog.isOpen"
      :title="t('management_edit_bookmark')"
      icon="icon-edit-bookmark"
      :persistent="true"
      :esc-to-close="true"
      :enter-to-confirm="true"
      :enable-cancel-guard="true"
      :cancel-confirm-text="MSG_CANCEL_EDIT"
      max-width="500px"
      min-width="500px"
      @update:show="
        (v: boolean) =>
          v
            ? dialogStore.openEditBookmarkDialog(dialogStore.editBookmarkDialog.bookmark!)
            : dialogStore.closeEditBookmarkDialog()
      "
      @confirm="confirmEditBookmark"
    >
      <div class="edit-form">
        <md-outlined-text-field
          class="form-field"
          :label="t('management_bookmark_title')"
          :value="dialogStore.editBookmarkDialog.title"
          :error="!!editFormErrors.title"
          :error-text="editFormErrors.title"
          @input="onEditBookmarkTitleInput"
        />
        <md-outlined-text-field
          class="form-field"
          :label="t('management_bookmark_url')"
          type="url"
          :value="dialogStore.editBookmarkDialog.url"
          :error="!!editFormErrors.url"
          :error-text="editFormErrors.url"
          @input="onEditBookmarkUrlInput"
        />
      </div>
      <template #actions>
        <Button variant="text" @click="dialogStore.closeEditBookmarkDialog()">
          {{ t('common_cancel') }}
        </Button>
        <Button
          variant="filled"
          :disabled="!isEditDirty"
          :loading="isEditingBookmark"
          @click="confirmEditBookmark"
        >
          {{ t('management_update') }}
        </Button>
      </template>
    </Dialog>

    <!-- Edit Folder Dialog -->
    <Dialog
      :show="dialogStore.editFolderDialog.isOpen"
      :title="t('management_edit_folder')"
      icon="icon-folder-edit"
      :persistent="true"
      :esc-to-close="true"
      :enter-to-confirm="true"
      :enable-cancel-guard="true"
      :cancel-confirm-text="MSG_CANCEL_EDIT"
      max-width="500px"
      min-width="500px"
      @update:show="
        (v: boolean) =>
          v
            ? dialogStore.openEditFolderDialog(dialogStore.editFolderDialog.folder!)
            : dialogStore.closeEditFolderDialog()
      "
      @confirm="confirmEditFolder"
    >
      <div class="edit-form">
        <md-outlined-text-field
          class="form-field"
          :label="t('management_folder_title')"
          :value="dialogStore.editFolderDialog.title"
          :error="!!folderEditFormErrors.title"
          :error-text="folderEditFormErrors.title"
          @input="onEditFolderTitleInput"
        />
      </div>
      <template #actions>
        <Button variant="text" @click="dialogStore.closeEditFolderDialog()">
          {{ t('common_cancel') }}
        </Button>
        <Button
          variant="filled"
          :disabled="!isEditFolderDirty"
          :loading="isEditingFolder"
          @click="confirmEditFolder"
        >
          {{ t('management_update') }}
        </Button>
      </template>
    </Dialog>

    <!-- Delete Folder Confirm Dialog -->
    <Dialog
      :show="isConfirmDeleteDialogOpen"
      :esc-to-close="true"
      :enter-to-confirm="true"
      :title="t('management_confirm_delete')"
      icon="icon-delete"
      :persistent="true"
      max-width="480px"
      min-width="480px"
      @update:show="(v: boolean) => (isConfirmDeleteDialogOpen = v)"
      @confirm="confirmDeleteFolder"
    >
      <div class="confirm-content">
        {{ t('management_delete_folder_confirm', String(deleteFolderBookmarkCount)) }}
      </div>
      <template #actions>
        <Button variant="text" @click="isConfirmDeleteDialogOpen = false">
          {{ t('common_cancel') }}
        </Button>
        <Button
          variant="tonal"
          class="error-button"
          :loading="isDeletingFolder"
          @click="confirmDeleteFolder"
        >
          {{ t('management_confirm_delete') }}
        </Button>
      </template>
    </Dialog>
  </div>
</template>

<!-- 无 scoped：Material 根节点 token + 管理页主栅格（此前误写在 style 外导致未生效） -->

<style scoped>
md-tabs {
  width: 100%;
  margin-bottom: var(--spacing-4);
}

/* 特征扫描进度对话框样式 */
.trait-scan-progress {
  padding: var(--spacing-4);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-3);
}

.progress-message {
  font-size: var(--font-size-body-medium);
  color: var(--color-text-primary);
}

.progress-stats {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-body-small);
  color: var(--color-text-secondary);
}

/* 应用更改对话框样式 */
.apply-confirm-dialog {
  max-height: 60vh;
  padding: var(--spacing-4);
  overflow-y: auto;
}

.ai-badge {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-4);
  padding: var(--spacing-3);
  border-left: 4px solid var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-body-medium);
  font-weight: 500;
  color: var(--color-primary);
  background: var(--color-primary-surface);
}

.statistics-section {
  margin-bottom: var(--spacing-4);
}

.section-title {
  margin-bottom: var(--spacing-3);
  font-size: var(--font-size-body-large);
  font-weight: 600;
  color: var(--color-text-primary);
}

.statistics-grid {
  display: grid;
  gap: var(--spacing-3);
  grid-template-columns: repeat(3, 1fr);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}

.stat-item.total {
  background: var(--color-primary-surface-strong);
}

.stat-label {
  font-size: var(--font-size-body-small);
  color: var(--color-text-secondary);
}

.stat-value {
  font-size: var(--font-size-heading-small);
  font-weight: 700;
  color: var(--color-text-primary);
}

.stat-value.error {
  color: var(--color-error);
}

.details-section {
  margin-top: var(--spacing-4);
}

.operations-list {
  max-height: 300px;
  padding: var(--spacing-2);
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-md);
  overflow-y: auto;
}

.operation-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  border-bottom: 1px solid var(--color-outline-variant);
}

.operation-item:last-child {
  border-bottom: none;
}

.operation-type {
  min-width: 48px;
  font-size: var(--font-size-body-small);
  font-weight: 500;
}

.operation-title {
  flex: 1;
  font-size: var(--font-size-body-small);
  white-space: nowrap;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.grouped-summary {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.summary-group {
  padding: var(--spacing-3);
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-md);
}

.summary-group summary {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-body-medium);
  font-weight: 500;
  cursor: pointer;
  list-style: none;
}

.summary-group summary::-webkit-details-marker {
  display: none;
}

.group-items {
  max-height: 200px;
  margin-top: var(--spacing-3);
  padding-left: var(--spacing-6);
  overflow-y: auto;
}

.group-item {
  padding: var(--spacing-1) 0;
  font-size: var(--font-size-body-small);
  color: var(--color-text-secondary);
}

.more-items {
  padding: var(--spacing-2) 0;
  font-size: var(--font-size-body-small);
  font-style: italic;
  color: var(--color-text-tertiary);
}

.large-operation-warning {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-6);
  text-align: center;
}

.large-operation-warning h3 {
  font-size: var(--font-size-heading-medium);
  font-weight: 600;
  color: var(--color-warning);
}

.large-operation-warning p {
  margin: 0;
  font-size: var(--font-size-body-medium);
  color: var(--color-text-secondary);
}

/* 警告文本 - 高特异性覆盖父元素样式 */
.large-operation-warning .warning-text,
p.warning-text {
  font-weight: 500;
  color: var(--color-warning);
}

.apply-progress {
  padding: var(--spacing-4);
}

.progress-tip {
  margin-top: var(--spacing-3);
  font-size: var(--font-size-body-small);
  text-align: center;
  color: var(--color-text-secondary);
}

.ai-status-right {
  margin-left: var(--spacing-3);
}

.mt-sm {
  margin-top: var(--spacing-2);
}

.expand-toggle-icon {
  display: inline-flex;
  transition:
    transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    opacity var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.expand-toggle-icon.expanded {
  transform: rotate(180deg);
}

.expand-toggle-icon.expanding {
  opacity: 0.85;
}

.bulk-delete-in-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--color-surface);
}

/* 选择统计：避免数字变化导致文本整体"抖动" */
.selection-summary {
  display: inline-flex;
  align-items: center; /* 让 Checkbox 与文字垂直居中对齐 */
  gap: var(--spacing-2);

  /* 消除模板空白带来的字符间距 */
  font-size: 0;
  font-weight: 600;

  /* ✅ 强化：防止点击时文本被选中（多浏览器兼容） */
  user-select: none;
}

.select-all-checkbox {
  /* ✅ 确保点击事件不穿透到文本 */
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  margin: calc(var(--spacing-2) * -1);

  /* ✅ 增加点击区域，减少误触文本 */
  padding: var(--spacing-2);
}

.selection-summary .text {
  font-size: 1rem; /* 恢复正常字号 */
}

.selection-summary .count {
  display: inline-block;

  /* 至少两位宽度（按字符单位），右对齐以保持文案稳定 */
  min-width: 3ch;

  /* 移除外边距，由显式 gap 控制空隙 */
  margin: 0;
  font-size: 1rem; /* 恢复正常字号 */
  font-weight: 800;
  text-align: center;

  /* 使用等宽数字和固定宽度避免横向位移 */
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}

.selection-summary .gap {
  display: inline-block;
  width: var(--spacing-2-5);
  height: 1em;
}

.bulk-delete-btn {
  border: 1px solid var(--color-error);
  color: var(--color-text-on-primary);
  background: var(--color-error);
}

/* disabled: 降低容器对比度但标签/icon 仍清晰可读 */
.bulk-delete-btn:disabled {
  --md-filled-button-container-color: var(--color-error-container);
  --md-filled-button-label-text-color: var(--md-sys-color-on-error-container);
  --Button-icon-color: var(--md-sys-color-on-error-container);

  border-color: transparent;
  opacity: 1;
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.clear-selection {
  color: var(--color-text-secondary);
}

.app-container {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

/* 使用 Overlay 组件自身的全屏蒙版，已通过 props 统一透明度与模糊 */

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-6);
}

.loading-text {
  font-size: 1.2rem;
  font-weight: 500;
}

.loading-subtitle {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.main-content {
  flex: 1;
  overflow: hidden;
}

.panel-col {
  display: flex;
  flex-direction: column;
  height: 100%;

  /* 允许子项在 Flex 布局中收缩，从而使内部产生滚动 */
  min-height: 0;
}

.panel-card {
  display: flex;
  flex-direction: column;
  flex: 1;

  /* 允许内容区域计算高度并滚动 */
  min-height: 0;
  transition: background-color var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
  overflow: hidden;
}

/* 左侧面板收起/展开动画 */
.left-panel {
  transition: opacity var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard);
  overflow: hidden;
}

.left-panel--collapsed {
  opacity: 0;
}

.left-panel--collapsed .panel-card {
  pointer-events: none;
}

/* 左右面板等宽（列宽由 .management-row 的 grid 控制） */
.panel-col:first-child .panel-card {
  flex: 1;
  background: var(--color-bg-primary);
}

/* 右侧卡片：弱化背景，突出内容 */
.right-panel-card {
  flex: 1;
  background: var(--color-bg-secondary);
  overflow: hidden;
}

.panel-header {
  position: relative; /* 作为浮层定位参照 */
  display: flex;
  flex-wrap: nowrap; /* 防止按钮换行 */
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-4);
  width: 100%;
  overflow: visible; /* 放行浮层 */
}

.panel-title-section {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

/* 标题区域：可以灵活缩小 */
.panel-title-section:first-child {
  flex: 1 1 auto;
  min-width: 0; /* 允许文字缩略 */
}

/* 按钮区域：保持固定宽度 */
.panel-title-section:last-child {
  flex: 0 0 auto;
}

.panel-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--spacing-2);
}

.panel-title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel-stats {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.stats-separator {
  margin: 0 var(--spacing-1);
}

.stats-change {
  margin-left: var(--spacing-sm);
  font-weight: 500;
}

.stats-increase {
  color: var(--color-success);
}

.stats-decrease {
  color: var(--color-error);
}

.panel-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0; /* 允许内部子元素计算高度，避免超出无法滚动 */

  /* 使左右面板内容可滚动（包含 legend 和树） */
  overflow-y: auto;
}

/* 中间分隔区样式 - Material Design 3 */
.divider-col {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  min-width: 40px;
  padding: 0;
}

.panel-divider {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  cursor: pointer;
  transition: background-color var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
}

.panel-divider::before {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1px;
  height: 30%;
  background: var(--md-sys-color-outline-variant);
  opacity: 0.4;
  transform: translate(-50%, -50%);
  transition:
    height var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard),
    opacity var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
  content: '';
}

.panel-divider:hover::before {
  opacity: 0.6;
}

.panel-divider:hover {
  background: var(--md-sys-color-surface-variant);
}

.panel-toggle-btn {
  --md-icon-button-icon-size: 20px;

  position: relative;
  z-index: 1;
}

/* 右侧面板操作区的分隔符 */
.panel-actions-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  opacity: 0.5;
}

/* ✅ 按钮包装器：用于在禁用状态下显示 tooltip */
.btn-wrapper {
  display: inline-flex;

  /* 确保 wrapper 不影响布局 */
  line-height: 0;
}

/* 优化"应用"按钮样式 */
.panel-actions .btn:first-child {
  padding-right: var(--spacing-3);
  padding-left: var(--spacing-3);
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-4);
  height: 100%;
  color: var(--color-text-secondary);
}

.edit-form md-outlined-text-field,
.add-item-form md-outlined-text-field {
  width: 100%;
}

.edit-form,
.add-item-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
}

.form-fields {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  overflow: hidden;
}

.semantic-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}

.semantic-input {
  flex: 1;
  min-width: 160px;
}

.semantic-topk {
  width: 120px;
}

.semantic-minsim {
  width: 140px;
}

.semantic-loading {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-1-5) 0;
}

.semantic-loading-text {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.semantic-results {
  display: grid;
  gap: var(--spacing-1-5);
  grid-template-columns: 1fr;
  padding: var(--spacing-sm) 0;
}

.semantic-item {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.semantic-item:hover {
  background: var(--color-surface-hover);
}

.semantic-title {
  font-weight: 500;
}

.semantic-url {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.semantic-score {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

/* 局部：底部批量操作条入场/出场动画（出现：自下而上；消失：向下） */
.card-footer-slide-enter-active,
.card-footer-slide-leave-active {
  transition:
    transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    opacity var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
  will-change: transform, opacity;
}

.card-footer-slide-enter-from {
  opacity: 0;
  transform: translateY(var(--spacing-4));
}

.card-footer-slide-leave-to {
  opacity: 0;
  transform: translateY(var(--spacing-4));
}

.control-btn--icon {
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: 50%;
}

.control-btn--icon .btn__icon {
  margin: 0;
}
</style>

<style>
/* Material 根节点 token + 管理页主栅格 */
md-linear-progress {
  --md-linear-progress-track-height: 8px;

  width: 100%;
}

button,
md-filled-tonal-button,
button.md-button--icon {
  --md-sys-color-primary: var(--md-sys-color-primary);
  --md-sys-color-on-primary: var(--md-sys-color-on-primary);
}

.error-button {
  --md-sys-color-primary: var(--md-sys-color-error);
  --md-sys-color-on-primary: var(--md-sys-color-on-error);
}

/* 左右面板等宽，中间为弹性间距（随视口缩放） */
.management-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.management-row {
  display: grid;
  flex: 1;
  align-items: stretch;
  gap: var(--left-panel-gap, clamp(var(--spacing-3), 3vw, var(--spacing-10)));
  grid-template-columns: var(--left-panel-width, minmax(0, 1fr)) auto minmax(0, 1fr);
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  transition:
    grid-template-columns var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard),
    gap var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard);
}

.management-row > .panel-col {
  min-width: 0;
}

/* 页面 Overlay 样式 */
.page-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--color-scrim-012);
  backdrop-filter: blur(4px);
}
</style>
