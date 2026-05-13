<template>
  <Dialog
    :show="show"
    title="添加书签"
    width="480px"
    @update:show="handleClose"
  >
    <div class="quick-add-content">
      <!-- 网站图标和信息预览 -->
      <div class="bookmark-preview">
        <div class="favicon">
          <img
            v-if="favIconUrl"
            :src="favIconUrl"
            alt="网站图标"
            @error="handleFaviconError"
          />
          <LucideIcon v-else name="bookmark" :size="24" />
        </div>
        <div class="info">
          <md-outlined-text-field
            label="名称"
            :value="bookmarkTitle"
            @input="handleTitleInput"
            @keydown="handleKeyDown"
          />
        </div>
      </div>

      <!-- AI 自动归纳开关 -->
      <div class="ai-auto-toggle">
        <label class="toggle-label">
          <input
            v-model="enableAIAuto"
            type="checkbox"
            class="toggle-checkbox"
          />
          <LucideIcon name="sparkles" :size="16" />
          <span>AI 自动归纳</span>
        </label>
      </div>

      <!-- 推荐文件夹 -->
      <div v-if="enableAIAuto && recommendations.length > 0" class="recommendations-section">
        <label class="label">
          <LucideIcon name="sparkles" :size="16" />
          推荐文件夹
        </label>
        <md-list class="recommendations-list">
          <md-list-item
            v-for="(rec, index) in recommendations"
            :key="rec.folderId"
            type="button"
            :class="{ selected: selectedFolderId === rec.folderId }"
            @click="selectRecommendation(rec)"
          >
            <template #start>
<LucideIcon
              
              :name="selectedFolderId === rec.folderId ? 'check-circle' : 'folder'"
              :size="18"
            />
</template>
            <template #headline>
<div  class="folder-path">{{ rec.folderPath }}</div>
</template>
            <template #supporting-text>
<div  class="recommendation-reason">{{ rec.reason }}</div>
</template>
            <template #end>
<div  class="score">{{ Math.round(rec.score * 100) }}%</div>
</template>
            <div v-if="index === 0" class="best-match-badge">最佳匹配</div>
          </md-list-item>
        </md-list>
      </div>

      <!-- 加载推荐中 -->
      <div v-else-if="enableAIAuto && isLoadingRecommendations" class="loading-recommendations">
        <LucideIcon name="loader-2" :size="16" class="spinning" />
        <span>正在分析最佳文件夹...</span>
      </div>

      <!-- 手动选择文件夹 -->
      <div v-if="!enableAIAuto" class="folder-selection">
        <label class="label">
          <LucideIcon name="folder" :size="16" />
          选择文件夹
        </label>
        <select v-model="selectedFolderId" class="folder-select">
          <option value="">选择文件夹</option>
          <option
            v-for="folder in folderOptions"
            :key="folder.value"
            :value="folder.value"
          >
            {{ folder.label }}
          </option>
        </select>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <md-text-button @click="handleClose">取消</md-text-button>
        <md-filled-button
          :disabled="!bookmarkTitle || !selectedFolderId"
          @click="handleConfirm"
        >
          完成
        </md-filled-button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, LucideIcon } from '@/components'
import { logger } from '@/infrastructure/logging/logger'
import { notificationService } from '@/application/notification/notification-service'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/list/list.js'
import '@material/web/list/list-item.js'

defineOptions({
  name: 'QuickAddBookmarkDialog'
})

interface Props {
  show: boolean
  title?: string
  url?: string
  favIconUrl?: string
  enableAI?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  title: '',
  url: '',
  favIconUrl: '',
  enableAI: true
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: [data: { title: string; url: string; folderId: string }]
}>()

interface FolderRecommendation {
  folderId: string
  folderName: string
  folderPath: string
  score: number
  bookmarkCount: number
  reason: string
}

// 书签信息
const bookmarkTitle = ref('')
const selectedFolderId = ref('')
const showFaviconError = ref(false)

// 文件夹列表
const folderOptions = ref<Array<{ label: string; value: string }>>([])

// 推荐相关
const recommendations = ref<FolderRecommendation[]>([])
const isLoadingRecommendations = ref(false)
const enableAIAuto = ref(true) // 默认开启 AI 自动归纳

// 监听 props 变化
watch(
  () => props.show,
  async newShow => {
    if (newShow) {
      // 重置状态
      const initialTitle = props.title || props.url || '未命名书签'
      bookmarkTitle.value = initialTitle
      recommendations.value = []
      selectedFolderId.value = ''

      logger.info('QuickAddBookmark', '对话框打开', {
        propsTitle: props.title,
        propsUrl: props.url,
        initialTitle,
        favIconUrl: props.favIconUrl
      })

      // 加载文件夹列表
      await loadFolders()

      // 获取向量推荐（仅在 AI 模式下）
      if (props.enableAI && props.title && props.url && enableAIAuto.value) {
        await getVectorRecommendations()
      }
    }
  }
)

/**
 * 加载所有文件夹
 */
async function loadFolders() {
  try {
    const response = await new Promise<{
      success: boolean
      tree?: chrome.bookmarks.BookmarkTreeNode[]
      error?: string
    }>((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'GET_BOOKMARK_TREE'
        },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(response || { success: false })
          }
        }
      )
    })

    if (!response.success || !response.tree) {
      throw new Error(response.error || '获取书签树失败')
    }

    const folders: Array<{ label: string; value: string }> = []

    // 递归遍历书签树，收集所有文件夹
    function traverse(nodes: chrome.bookmarks.BookmarkTreeNode[], prefix = '') {
      for (const node of nodes) {
        if (!node.url) {
          // 是文件夹
          const label = prefix ? `${prefix} > ${node.title}` : node.title
          folders.push({ label, value: node.id })

          if (node.children) {
            traverse(node.children, label)
          }
        }
      }
    }

    traverse(response.tree)

    folderOptions.value = folders

    // 默认选择书签栏（如果没有推荐）
    if (!selectedFolderId.value) {
      const bookmarksBar = folders.find(
        f => f.label === '书签栏' || f.label === 'Bookmarks Bar'
      )
      if (bookmarksBar) {
        selectedFolderId.value = bookmarksBar.value
      } else if (folders.length > 0) {
        selectedFolderId.value = folders[0].value
      }
    }
  } catch (error) {
    logger.error('QuickAddBookmark', '加载文件夹列表失败', error)
  }
}

/**
 * 获取向量相似度推荐
 */
async function getVectorRecommendations() {
  try {
    isLoadingRecommendations.value = true

    const response = await new Promise<{
      success: boolean
      recommendations?: FolderRecommendation[]
      error?: string
    }>((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'GET_FOLDER_RECOMMENDATIONS',
          data: {
            title: props.title,
            url: props.url,
            topK: 3,
            minScore: 0.3
          }
        },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(response || { success: false })
          }
        }
      )
    })

    if (response.success && response.recommendations) {
      recommendations.value = response.recommendations

      logger.info('QuickAddBookmark', '获取到向量推荐', {
        count: response.recommendations.length,
        topRecommendation: response.recommendations[0]?.folderPath
      })

      // 自动选中最佳推荐
      if (response.recommendations.length > 0) {
        selectedFolderId.value = response.recommendations[0].folderId
      }
    } else {
      logger.warn('QuickAddBookmark', '向量推荐失败', response.error)
    }
  } catch (error) {
    logger.error('QuickAddBookmark', '向量推荐失败', error)
  } finally {
    isLoadingRecommendations.value = false
  }
}

/**
 * 选择推荐的文件夹
 */
function selectRecommendation(rec: FolderRecommendation) {
  selectedFolderId.value = rec.folderId
  logger.info('QuickAddBookmark', '用户选择推荐文件夹', {
    folderId: rec.folderId,
    folderPath: rec.folderPath,
    score: rec.score
  })
}

/**
 * 处理标题输入
 */
function handleTitleInput(event: Event) {
  const target = event.target as HTMLInputElement
  bookmarkTitle.value = target.value
}

/**
 * 处理键盘事件
 */
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    handleConfirm()
  }
}

/**
 * 处理图标加载失败
 */
function handleFaviconError() {
  showFaviconError.value = true
}

/**
 * 确认添加
 */
function handleConfirm() {
  // ✅ 验证数据
  if (!bookmarkTitle.value || bookmarkTitle.value.trim() === '') {
    notificationService.notify('请填写书签名称', { level: 'warning' })
    return
  }

  if (!selectedFolderId.value) {
    notificationService.notify('请选择文件夹', { level: 'warning' })
    return
  }

  if (!props.url || props.url.trim() === '') {
    notificationService.notify('书签 URL 不能为空', { level: 'error' })
    return
  }

  logger.info('QuickAddBookmark', '用户确认添加书签', {
    title: bookmarkTitle.value,
    url: props.url,
    folderId: selectedFolderId.value
  })

  emit('confirm', {
    title: bookmarkTitle.value.trim(),
    url: props.url.trim(),
    folderId: selectedFolderId.value
  })

  handleClose()
}

/**
 * 关闭对话框
 */
function handleClose() {
  emit('update:show', false)
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

.quick-add-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
}

.bookmark-preview {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
}

.favicon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  overflow: hidden;
}

.favicon img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.info {
  flex: 1;
}

/* AI 自动归纳开关 */
.ai-auto-toggle {
  display: flex;
  align-items: center;
  margin-bottom: var(--spacing-3);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.toggle-checkbox {
  margin: 0;
  cursor: pointer;
}

/* 推荐文件夹区域 */
.recommendations-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.recommendations-list {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.folder-path {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.score {
  flex-shrink: 0;
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--color-primary);
  background: var(--color-primary-bg);
}

.recommendation-reason {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.best-match-badge {
  position: absolute;
  top: 8px;
  right: var(--spacing-3);
  z-index: 1;
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-on-primary);
  background: var(--color-primary);
  box-shadow: 0 2px 4px rgb(0 0 0 / 10%);
}

/* Material Web List 样式 */
.recommendations-list md-list {
  --md-list-container-color: transparent;
}

.recommendations-list md-list-item {
  --md-list-item-label-text-color: var(--md-sys-color-on-surface);
  --md-list-item-supporting-text-color: var(--md-sys-color-on-surface-variant);
  --md-list-item-container-shape: 0;
  --md-list-item-label-text-font: var(--font-family-base);
  --md-list-item-label-text-size: var(--md-sys-typescale-body-medium-size);
  --md-list-item-label-text-weight: 500;
  --md-list-item-supporting-text-font: var(--font-family-base);
  --md-list-item-supporting-text-size: var(--md-sys-typescale-body-small-size);
  --md-list-item-two-line-container-height: 72px;
  --md-list-item-hover-state-layer-color: var(--md-sys-color-on-surface);
  --md-list-item-hover-state-layer-opacity: 0.08;

  position: relative;
  border-bottom: 1px solid var(--color-border);
}

.recommendations-list md-list-item:last-child {
  border-bottom: none;
}

.recommendations-list md-list-item.selected {
  --md-list-item-container-color: var(--color-primary-bg);

  border-color: var(--color-primary);
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

/* 加载推荐中 */
.loading-recommendations {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.spinning {
  animation: spin 1s linear infinite;
}

/* 文件夹选择 */
.folder-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.label {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.folder-select {
  width: 100%;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  outline: none;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.folder-select:hover {
  border-color: var(--color-border-hover);
}

.folder-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-bg);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-2);
  padding: var(--spacing-4);
  border-top: 1px solid var(--color-border);
}
</style>

/* ✅ Material Web Text Field 样式 */
.info md-outlined-text-field {
  width: 100%;
}
