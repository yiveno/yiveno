<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { QuickAddBookmarkDialog } from '@/components'
import { logger } from '@/infrastructure/logging/logger'
import { message } from '@/application/message/message-service'
import { settingsAppService } from '@/application/settings/settings-app-service'

defineOptions({
  name: 'GlobalQuickAddBookmark'
})

const showDialog = ref(false)
const bookmarkData = ref({
  title: '',
  url: '',
  favIconUrl: ''
})

/**
 * 监听来自 background 的消息
 */
onMounted(() => {
  chrome.runtime.onMessage.addListener((runtimeMessage, _sender, sendResponse) => {
    if (runtimeMessage.type === 'SHOW_ADD_BOOKMARK_DIALOG') {
      const data = runtimeMessage.data || {}

      // ✅ 验证接收到的数据
      logger.info('GlobalQuickAddBookmark', '接收到添加书签请求', data)

      void (async () => {
        if (!data.url || data.url.trim() === '') {
          logger.error('GlobalQuickAddBookmark', 'URL 为空，无法显示对话框')
          message.error('无法添加书签：URL 为空')
          sendResponse({ success: false, error: 'URL is empty' })
          return
        }

        const aiAutoBookmark = await settingsAppService.getSetting<boolean>('aiAutoBookmark')
        const aiAutoEnabled = aiAutoBookmark !== false

        if (aiAutoEnabled) {
          try {
            const response = await chrome.runtime.sendMessage({
              type: 'AUTO_ADD_BOOKMARK',
              data: {
                title: data.title || data.url || '未命名书签',
                url: data.url,
                favIconUrl: data.favIconUrl || ''
              }
            })

            if (response?.success) {
              message.success(`已自动添加到「${response.folderPath || '书签栏'}」`)
              sendResponse({ success: true, autoAdded: true, ...response })
              return
            }

            throw new Error(response?.error || '自动添加失败')
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            message.error(`自动添加失败：${errorMessage}`)
            sendResponse({ success: false, error: errorMessage })
            return
          }
        }

        showDialog.value = true
        bookmarkData.value = {
          title: data.title || data.url || '未命名书签',
          url: data.url,
          favIconUrl: data.favIconUrl || ''
        }
        sendResponse({ success: true })
      })()
      return true
    }

    return false
  })
})

/**
 * 确认添加书签
 */
async function handleConfirm(data: { title: string; url: string; folderId: string }) {
  try {
    // ✅ 验证数据（重要：防止创建文件夹而不是书签）
    if (!data.url || data.url.trim() === '') {
      logger.error('GlobalQuickAddBookmark', 'URL 为空，无法添加书签', data)
      message.error('书签 URL 不能为空')
      return
    }

    if (!data.title || data.title.trim() === '') {
      logger.warn('GlobalQuickAddBookmark', '标题为空，使用 URL 作为标题')
      data.title = data.url
    }

    logger.info('GlobalQuickAddBookmark', '准备添加书签', {
      title: data.title,
      url: data.url,
      folderId: data.folderId
    })

    // 发送消息到 background 创建书签
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_BOOKMARK',
      data: {
        title: data.title.trim(),
        url: data.url.trim(), // ✅ 确保 URL 不为空
        parentId: data.folderId
      }
    })

    if (response?.success) {
      logger.info('GlobalQuickAddBookmark', '✅ 书签添加成功', response.bookmark)
      message.success('已添加到书签')
      showDialog.value = false
    } else {
      throw new Error(response?.error || '添加失败')
    }
  } catch (error) {
    logger.error('GlobalQuickAddBookmark', '添加书签失败', error)
    message.error('添加书签失败，请稍后重试')
  }
}

/**
 * 关闭对话框
 */
function handleClose() {
  showDialog.value = false
}
</script>

<template>
  <QuickAddBookmarkDialog
    :show="showDialog"
    :title="bookmarkData.title"
    :url="bookmarkData.url"
    :fav-icon-url="bookmarkData.favIconUrl"
    :enable-a-i="true"
    @update:show="handleClose"
    @confirm="handleConfirm"
  />
</template>

<style scoped>
/* 无需额外样式，所有样式在 QuickAddBookmarkDialog 组件中 */
</style>
