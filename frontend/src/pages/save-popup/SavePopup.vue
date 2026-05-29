<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import BookmarkTree from '@/components/business/BookmarkTree/BookmarkTree.vue'
import { Input, Loading, Accordion, AccordionItem, Button } from '@/components'
import { LucideIcon } from '@/components/base/LucideIcon'

import { logger } from '@/infrastructure/logging/logger'
import { message } from '@/application/message/message-service'
import type { BookmarkNode } from '@/types'

defineOptions({
  name: 'SavePopup'
})

// 书签信息
const bookmarkTitle = ref('')
const bookmarkUrl = ref('')
const favIconUrl = ref('')
const selectedFolderId = ref('')

// 重复书签检测
const duplicateCheck = ref<{
  exists: boolean
  existingBookmarks: Array<{
    title: string
    url?: string
    pathString?: string
    folderPath?: string
  }>
} | null>(null)
const isCheckingDuplicate = ref(false)

// 书签树数据
const bookmarkTree = ref<BookmarkNode[]>([])
const isLoading = ref(false)
const bookmarkTreeRef = ref<InstanceType<typeof BookmarkTree> | null>(null)

// 过滤掉根节点（id: '0'），只显示其子节点（书签栏和其他书签文件夹）
// 同时过滤掉所有书签节点，只显示文件夹
const folderTree = computed(() => {
  if (bookmarkTree.value.length === 0) return []

  // Chrome 书签树的根节点是 id 为 '0' 的虚拟节点
  // 我们需要显示它的子节点：书签栏（id: '1'）和其他书签（id: '2'）
  const rootNode = bookmarkTree.value.find(node => node.id === '0')
  if (rootNode && rootNode.children) {
    // 递归过滤，只保留文件夹（没有 url 的节点）
    function filterFoldersOnly(nodes: BookmarkNode[]): BookmarkNode[] {
      return nodes
        .filter(node => !node.url) // 只保留文件夹
        .map(node => ({
          ...node,
          children: node.children ? filterFoldersOnly(node.children) : undefined
        }))
    }
    return filterFoldersOnly(rootNode.children)
  }

  // 如果没有找到根节点，返回原始数据（降级处理）
  return bookmarkTree.value
})

onMounted(async () => {
  // 从 URL 参数获取书签信息
  const params = new URLSearchParams(window.location.search)
  const title = params.get('title') || ''
  const url = params.get('url') || ''
  const favicon = params.get('favIconUrl') || ''

  bookmarkTitle.value = title || url || '未命名书签'
  bookmarkUrl.value = url
  favIconUrl.value = favicon

  logger.info('SavePopup', '弹窗启动', { title, url, favicon })

  // 检测URL是否重复
  if (url) {
    await checkDuplicateUrl(url)
  }

  // 加载书签树
  await loadBookmarkTree()
})

/**
 * 检测URL是否重复
 */
async function checkDuplicateUrl(url: string) {
  try {
    isCheckingDuplicate.value = true
    const response = await chrome.runtime.sendMessage({
      type: 'CHECK_DUPLICATE_BOOKMARK',
      data: { url }
    })

    if (response?.exists) {
      duplicateCheck.value = response
      logger.info('SavePopup', '检测到重复URL', response)
    }
  } catch (error) {
    logger.error('SavePopup', '检测重复URL失败', error)
  } finally {
    isCheckingDuplicate.value = false
  }
}

/**
 * 加载书签树
 */
async function loadBookmarkTree() {
  try {
    isLoading.value = true
    const treeResponse = await new Promise<{
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

    if (!treeResponse.success || !treeResponse.tree) {
      throw new Error(treeResponse.error || '获取书签树失败')
    }

    // 转换为 BookmarkNode 格式
    function convertToBookmarkNode(node: chrome.bookmarks.BookmarkTreeNode): BookmarkNode {
      return {
        id: node.id,
        title: node.title || '',
        url: node.url || undefined,
        parentId: node.parentId || undefined,
        index: node.index,
        dateAdded: node.dateAdded,
        dateGroupModified: node.dateGroupModified,
        children: node.children?.map(convertToBookmarkNode),
        unmodifiable: node.unmodifiable
      }
    }

    bookmarkTree.value = treeResponse.tree.map(convertToBookmarkNode)

    // 默认选择书签栏（id: '1'）
    const bookmarkBar = folderTree.value.find(node => node.id === '1')
    if (bookmarkBar) {
      selectedFolderId.value = bookmarkBar.id
    } else if (folderTree.value.length > 0 && folderTree.value[0]) {
      // 如果书签栏不存在，降级到第一个文件夹
      selectedFolderId.value = folderTree.value[0].id
    }

    // 默认展开书签栏（id 为 '1' 的节点）
    await nextTick()
    if (bookmarkTreeRef.value) {
      bookmarkTreeRef.value.expandFolderById('1')
      // 选中书签栏
      if (bookmarkBar) {
        bookmarkTreeRef.value.selectNodeById('1')
      }
    }
  } catch (error) {
    logger.error('SavePopup', '加载书签树失败', error)
    message.error('加载文件夹列表失败')
  } finally {
    isLoading.value = false
  }
}

/**
 * 确认添加
 */
async function handleConfirm() {
  if (!bookmarkTitle.value || bookmarkTitle.value.trim() === '') {
    message.warning('请填写书签名称')
    return
  }

  if (!selectedFolderId.value) {
    message.warning('请选择文件夹')
    return
  }

  if (!bookmarkUrl.value || bookmarkUrl.value.trim() === '') {
    message.error('书签 URL 不能为空')
    return
  }

  logger.info('SavePopup', '用户确认添加书签', {
    title: bookmarkTitle.value,
    url: bookmarkUrl.value,
    folderId: selectedFolderId.value
  })

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_BOOKMARK',
      data: {
        title: bookmarkTitle.value.trim(),
        url: bookmarkUrl.value.trim(),
        parentId: selectedFolderId.value
      }
    })

    if (response?.success) {
      // 获取文件夹路径
      const folderPath = getFolderPath(selectedFolderId.value)
      message.success(`已添加到书签：${folderPath}`)
      logger.info('SavePopup', '✅ 书签添加成功', { folderPath })
      // 延迟关闭窗口，让用户能看到成功提示
      setTimeout(() => {
        window.close()
      }, 2000)
    } else {
      message.error(response?.error || '添加失败')
    }
  } catch (error) {
    logger.error('SavePopup', '添加书签失败', error)
    message.error('添加书签失败，请稍后重试')
  }
}

/**
 * 获取文件夹的完整路径
 */
function getFolderPath(folderId: string): string {
  const findPath = (node: BookmarkNode, targetId: string, currentPath: string[]): string | null => {
    if (node.id === targetId) {
      return [...currentPath, node.title].join(' / ')
    }
    if (node.children) {
      for (const child of node.children) {
        const result = findPath(child, targetId, [...currentPath, node.title])
        if (result) return result
      }
    }
    return null
  }

  for (const node of bookmarkTree.value) {
    const path = findPath(node, folderId, [])
    if (path) return path
  }
  return '未知位置'
}

/**
 * 取消添加
 */
function handleCancel() {
  logger.info('SavePopup', '用户取消添加书签')
  window.close()
}
</script>

<template>
  <div class="save-popup-container">
    <div class="form-field">
      <Input
        v-model="bookmarkTitle"
        label="书签标题"
        placeholder="输入书签标题"
        @keydown.enter="handleConfirm"
      />
    </div>

    <!-- 重复URL提示 -->
    <div v-if="duplicateCheck?.exists" class="duplicate-section">
      <Accordion :default-expanded="[]">
        <AccordionItem
          id="duplicate-warning"
          :title="`已存在${duplicateCheck.existingBookmarks.length}个重复书签`"
          icon="alert-triangle"
        >
          <div class="duplicate-content">
            <md-list class="duplicate-list">
              <md-list-item
                v-for="(bookmark, index) in duplicateCheck.existingBookmarks"
                :key="index"
                type="button"
                class="duplicate-list-item"
              >
                <div slot="start" class="duplicate-icon">
                  <LucideIcon name="bookmark" :size="32" />
                </div>

                <div slot="headline" class="headline-text">
                  {{ bookmark.title }}
                </div>
                <div slot="supporting-text" class="supporting-text">
                  {{ bookmark.folderPath || bookmark.pathString || '未知位置' }}
                </div>
              </md-list-item>
            </md-list>
          </div>
        </AccordionItem>
      </Accordion>
    </div>

    <!-- 文件夹选择 -->
    <div class="folder-section">
      <div v-if="isLoading" class="loading-state">
        <Loading size="sm" />
      </div>
      <div v-else class="folder-tree-container">
        <BookmarkTree
          ref="bookmarkTreeRef"
          :nodes="folderTree"
          :loading="isLoading"
          :selectable="'single'"
          :show-toolbar="false"
          :show-favorite-button="false"
          :show-edit-button="false"
          :show-delete-button="false"
          :show-add-button="false"
          :show-open-new-tab-button="false"
          :show-copy-url-button="false"
          :show-share-button="false"
          :show-more-button="false"
          :show-bookmark-url="false"
          size="compact"
          height="200px"
          @ready="() => logger.info('SavePopup', 'BookmarkTree ready')"
          @node-select="
            (nodeId: string, _node: BookmarkNode, _selected: boolean) => (selectedFolderId = nodeId)
          "
        />
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="actions">
      <Button variant="text" @click="handleCancel">取消</Button>
      <Button
        variant="filled"
        :disabled="!bookmarkTitle || !selectedFolderId || isCheckingDuplicate"
        @click="handleConfirm"
      >
        {{ duplicateCheck?.exists ? '仍然添加' : '完成' }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
.save-popup-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
  min-height: 100vh;
  padding: var(--spacing-6);
  font-family: var(--md-sys-typescale-body-large-font);
  color: var(--md-sys-color-on-background);
  background: var(--md-sys-color-background);
}

.form-field {
  display: flex;
  flex-direction: column;
}

.duplicate-section {
  margin-bottom: var(--md-sys-spacing-medium);
}

.duplicate-content {
  padding: var(--md-sys-spacing-medium);
}

.duplicate-list {
  border-radius: var(--radius-md);
  overflow: hidden;
}

.duplicate-list-item {
  position: relative;
  border-bottom: 1px solid var(--color-border);
}

.duplicate-list-item:last-child {
  border-bottom: none;
}

.duplicate-icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: var(--spacing-8);
  height: var(--spacing-8);
}

.headline-text {
  display: block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.supporting-text {
  display: block;
  white-space: nowrap;
}

.folder-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.loading-state {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  color: var(--md-sys-color-on-surface-variant);
}

.folder-tree-container {
  border: 1px solid var(--md-sys-color-outline);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-3);
}

/* BookmarkTree 容器样式 */
:deep(.folder-tree-container .bookmark-tree-wrapper) {
  max-height: 200px;
  padding: var(--spacing-2);
  overflow-y: auto;
}
</style>
