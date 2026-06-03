<script setup lang="ts">
import { reactive, watch, onUnmounted, ref, nextTick, computed, onMounted } from 'vue'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import type { ShareDialogProps, ShareDialogEmits } from './ShareDialog.d'
import { Dialog, LucideIcon, Tooltip, Loading, Button } from '@/components'
import { MdInput } from '@/components/base/Input'
import AsyncSearchSelect from '@/components/base/AsyncSearchSelect/AsyncSearchSelect.vue'
import type { SelectOption, AsyncSearchSelectInstance } from '@/components/base/AsyncSearchSelect'
import { shareService } from '@/application/share/share-service'
import { posterService } from '@/application/share/poster-service'
import { message } from '@/application/message/message-service'
import { logger } from '@/infrastructure/logging/logger'
import { useSupabaseAuth } from '@/composables/useSupabaseAuth'
import { trpc } from '@/services/trpc'

defineOptions({ name: 'ShareDialog' })

const props = defineProps<ShareDialogProps>()
const emit = defineEmits<ShareDialogEmits>()

// 获取用户信息和认证状态
const { user, session, isAuthenticated, initialize, setupAuthListener } = useSupabaseAuth()

// 初始化认证状态
onMounted(async () => {
  await initialize()
  setupAuthListener()
})

// 焦点管理
const previousActiveElement = ref<HTMLElement | null>(null)

// 用户搜索选择器 ref
const userSearchSelectRef = ref<AsyncSearchSelectInstance | null>(null)

// 获取用户名（优先使用用户设置的昵称，其次使用 user_metadata.name，最后使用 email 的前缀）
const userName = computed(() => {
  if (!user.value) return '我'

  if (user.value.user_metadata?.nickname) {
    return user.value.user_metadata.nickname
  }

  if (user.value.user_metadata?.full_name) {
    return user.value.user_metadata.full_name
  }

  if (user.value.user_metadata?.name) {
    return user.value.user_metadata.name
  }

  if (user.value.email) {
    return user.value.email.split('@')[0]
  }

  return '我'
})

// 计算默认标题
const defaultTitle = computed(() => {
  if (props.shareType === 'folder' && props.folderName) {
    return `${props.folderName}的分享书签`
  }
  return `${userName.value}的分享书签`
})

// 获取当前使用的标题（用户输入 or 默认）
const currentTitle = computed(() => {
  return state.customTitle.trim() || defaultTitle.value
})

// 组件状态
const state = reactive({
  // 分享方式：link（生成链接）、direct（直接发送）、poster（生成海报）
  shareType: 'link' as 'link' | 'direct' | 'poster',

  // 通用字段
  customTitle: '', // 用户自定义标题
  description: '', // 分享描述
  showDescription: false, // 是否显示描述输入框（默认关闭）
  isSharing: false, // 是否正在分享中
  showUsername: true, // 是否显示用户名（默认显示）

  // 海报分享相关
  selectedTheme: 'dark' as 'dark' | 'light',
  posterPreview: null as string | null,
  isGenerating: false,
  currentGenerationId: 0, // 用于取消未完成的生成任务

  // 直接分享相关
  selectedUserIds: [] as string[], // 已选择的用户 ID
  message: '', // 留言

  // 错误和消息
  error: null as string | null,
  srMessage: '' // 屏幕阅读器消息
})

// Tab 索引映射
const shareTypeToIndex: Record<'link' | 'direct' | 'poster', number> = {
  link: 0,
  direct: 1,
  poster: 2
}

const indexToShareType: Record<number, 'link' | 'direct' | 'poster'> = {
  0: 'link',
  1: 'direct',
  2: 'poster'
}

// 当前激活的 tab 索引
const activeTabIndex = computed(() => shareTypeToIndex[state.shareType])

// 前往登录页面
const handleGoToLogin = () => {
  // 从环境变量读取官网 URL
  const websiteUrl = import.meta.env.VITE_WEBSITE_URL || 'https://ottersage.com'
  // 打开官网登录页面
  window.open(`${websiteUrl}/login`, '_blank')
}

// Material Web Tabs 事件类型定义
interface MdTabsChangeEvent extends Event {
  detail?: {
    activeTabIndex?: number
  }
  target: EventTarget & {
    activeTabIndex?: number
  }
}

// 切换分享方式（通过 Tab 索引）
const handleTabChange = (event: Event) => {
  const customEvent = event as MdTabsChangeEvent
  // Material Web tabs 的 change 事件可能在 detail 中，也可能直接在 target 上
  const index = customEvent.detail?.activeTabIndex ?? customEvent.target.activeTabIndex

  if (index === undefined) {
    logger.warn('ShareDialog', 'Tab change event 没有 activeTabIndex', customEvent)
    return
  }

  const type = indexToShareType[index]
  if (!type) {
    logger.warn('ShareDialog', '无效的 Tab 索引', { index })
    return
  }

  logger.info('ShareDialog', 'Tab 切换', { index, type })
  state.shareType = type

  // 切换到海报分享时，生成海报
  if (type === 'poster') {
    void generatePoster()
  }

  // 切换到其他方式时，清空海报
  if (type !== 'poster') {
    state.posterPreview = null
    state.error = null
  }
}

// 用户搜索（异步）
const handleUserSearch = async (query: string) => {
  if (!session.value?.access_token) {
    message.error('未登录，无法搜索用户')
    return
  }

  try {
    // 设置 loading 状态
    userSearchSelectRef.value?.setLoading(true)

    const result = await trpc.share.searchUsers.query({
      query,
      accessToken: session.value.access_token
    })

    if (result.success) {
      // 转换为 SelectOption 格式
      const options: SelectOption[] = result.data.map(userData => ({
        value: userData.id,
        label: userData.name || userData.email || userData.id,
        description: userData.email,
        avatar: userData.avatar_url, // 添加头像 URL
        raw: userData
      }))

      // 设置搜索结果（无论是否为空，都是正常业务状态，不显示错误通知）
      userSearchSelectRef.value?.setOptions(options)
    }
  } catch (error) {
    // 捕获所有错误，但不显示通知（搜索失败是正常情况，用户会看到空状态）
    logger.error('ShareDialog', '搜索用户失败', error)
    // 设置空结果，让用户看到空状态组件
    userSearchSelectRef.value?.setOptions([])
  }
}

// 处理用户选择变化（来自 AsyncSearchSelect）
const handleUserSelectionChange = (selectedIds: string[]) => {
  state.selectedUserIds = selectedIds
  logger.info('ShareDialog', '用户选择变化', { count: selectedIds.length })
}

// 处理显示用户名开关变化
const handleShowUsernameChange = (event: Event) => {
  const target = event.target as HTMLInputElement & { selected: boolean }
  state.showUsername = target.selected

  // 如果在海报模式，重新生成海报
  if (state.shareType === 'poster') {
    void generatePoster()
  }
}

// 生成海报（防抖 + 取消未完成任务）
// 注意：海报不包含二维码，只用于社交媒体展示
const generatePoster = useDebounceFn(async () => {
  if (props.bookmarks.length === 0) {
    state.posterPreview = null
    state.error = '没有可分享的书签'
    state.isGenerating = false
    return
  }

  if (props.bookmarks.length > 500) {
    state.posterPreview = null
    state.error = '书签数量超出限制（最多 500 个），请减少选择的书签数量'
    state.isGenerating = false
    return
  }

  // 生成新的任务 ID
  const generationId = ++state.currentGenerationId
  state.isGenerating = true
  state.error = null

  try {
    // 生成海报（不包含二维码）
    const posterDataUrl = await posterService.generatePoster({
      bookmarks: props.bookmarks.map(b => {
        const bookmark: { title: string; url: string; description?: string } = {
          title: b.title,
          url: b.url || ''
        }
        if (typeof b.description === 'string') {
          bookmark.description = b.description
        }
        return bookmark
      }),
      theme: state.selectedTheme,
      title: currentTitle.value,
      shareUrl: '', // 不生成二维码
      showUsername: state.showUsername,
      username: userName.value
    })

    // 检查任务是否已被取消
    if (generationId !== state.currentGenerationId) {
      logger.debug('ShareDialog', '海报生成任务已取消', { generationId })
      return
    }

    state.posterPreview = posterDataUrl
    state.error = null
    logger.info('ShareDialog', '海报生成成功', {
      bookmarkCount: props.bookmarks.length,
      theme: state.selectedTheme,
      generationId
    })
  } catch (error) {
    if (generationId === state.currentGenerationId) {
      logger.error('ShareDialog', '海报生成失败', error)
      state.error = error instanceof Error ? error.message : '海报生成失败，请重试'
      state.posterPreview = null
    }
  } finally {
    if (generationId === state.currentGenerationId) {
      state.isGenerating = false
    }
  }
}, 300)

// 标题变化（防抖）
const handleTitleChange = useDebounceFn(() => {
  if (state.shareType === 'poster') {
    void generatePoster()
  }
}, 500)

// 描述输入（实时限制字数）
const handleDescriptionInput = () => {
  // 直接检查 state.description 的长度并截断
  if (state.description.length > 1000) {
    state.description = state.description.slice(0, 1000)
  }
}

// 处理显示描述开关变化
const handleShowDescriptionChange = (event: Event) => {
  const target = event.target as HTMLInputElement & { selected: boolean }
  state.showDescription = target.selected

  // 如果关闭描述，清空描述内容
  if (!state.showDescription) {
    state.description = ''
  }
}

// 重试
const handleRetry = () => {
  void generatePoster()
}

// 复制图片
const handleCopyImage = async () => {
  if (!state.posterPreview) return

  try {
    const response = await fetch(state.posterPreview)
    const blob = await response.blob()

    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob
      })
    ])

    const successText = '图片已复制到剪贴板'
    message.success(successText)
    // eslint-disable-next-line require-atomic-updates -- state.srMessage 在 await 期间不会被其他代码修改
    state.srMessage = successText
    logger.info('ShareDialog', '图片复制成功')
  } catch (error) {
    const errorText = '图片复制失败，请尝试下载'
    logger.error('ShareDialog', '图片复制失败', error)
    message.error(errorText)
    // eslint-disable-next-line require-atomic-updates -- state.srMessage 在 await 期间不会被其他代码修改
    state.srMessage = errorText
  }
}

// 下载图片
const handleDownloadImage = () => {
  if (!state.posterPreview) return

  try {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
    const filename = `bookmarks-share-${timestamp}.png`

    shareService.downloadImage(state.posterPreview, filename)
    const successText = '图片下载已开始'
    message.success(successText)
    state.srMessage = successText
    logger.info('ShareDialog', '图片下载成功', { filename })
  } catch (error) {
    const errorText = '图片下载失败，请重试'
    logger.error('ShareDialog', '图片下载失败', error)
    message.error(errorText)
    state.srMessage = errorText
  }
}

// 创建链接分享
const handleCreateLinkShare = async () => {
  if (!session.value?.access_token) {
    message.error('未登录，无法创建分享')
    return
  }

  state.isSharing = true

  try {
    const result = await trpc.share.createLinkShare.mutate({
      title: currentTitle.value,
      description: state.description.trim() || undefined,
      bookmarks: props.bookmarks.map(b => ({
        title: b.title,
        url: b.url || '',
        description: typeof b.description === 'string' ? b.description : undefined
      })),
      showUsername: state.showUsername,
      accessToken: session.value.access_token
    })

    if (result.success) {

      try {
        await navigator.clipboard.writeText(result.data.shareUrl)
      } catch {
        // 忽略剪贴板错误，继续显示成功消息
      }

      const successText = '分享链接已生成并复制到剪贴板'
      message.success(successText)
      // eslint-disable-next-line require-atomic-updates -- state.srMessage 在 await 期间不会被其他代码修改
      state.srMessage = successText
      logger.info('ShareDialog', '链接分享创建成功', {
        shareId: result.data.shareId,
        shortCode: result.data.shortCode,
        shareUrl: result.data.shareUrl
      })

      // 在新标签页打开分享链接
      const shareUrl = result.data.shareUrl
      if (typeof chrome !== 'undefined' && chrome?.tabs?.create) {
        chrome.tabs.create({ url: shareUrl })
      } else {
        window.open(shareUrl, '_blank', 'noopener,noreferrer')
      }

      // 触发分享完成事件
      emit('shareComplete')
    }
  } catch (error) {
    const errorText = error instanceof Error ? error.message : '创建分享失败，请重试'
    logger.error('ShareDialog', '创建链接分享失败', error)
    message.error(errorText)
    // eslint-disable-next-line require-atomic-updates -- state.srMessage 在 await 期间不会被其他代码修改
    state.srMessage = errorText
  } finally {
    // eslint-disable-next-line require-atomic-updates -- state.isSharing 在 await 期间不会被其他代码修改
    state.isSharing = false
  }
}

// 创建直接分享
const handleCreateDirectShare = async () => {
  if (!session.value?.access_token) {
    message.error('未登录，无法创建分享')
    return
  }

  if (state.selectedUserIds.length === 0) {
    message.error('请至少选择一个用户')
    return
  }

  state.isSharing = true

  try {
    const result = await trpc.share.createDirectShare.mutate({
      title: currentTitle.value,
      description: state.description.trim() || undefined,
      bookmarks: props.bookmarks.map(b => ({
        title: b.title,
        url: b.url || '',
        description: typeof b.description === 'string' ? b.description : undefined
      })),
      recipientIds: state.selectedUserIds,
      message: state.message.trim() || undefined,
      showUsername: state.showUsername,
      accessToken: session.value.access_token
    })

    if (result.success) {
      const successMessage = `已成功发送给 ${result.data.recipientCount} 个用户`
      message.success(successMessage)
      // eslint-disable-next-line require-atomic-updates -- state.srMessage 在 await 期间不会被其他代码修改
      state.srMessage = successMessage
      logger.info('ShareDialog', '直接分享创建成功', {
        shareId: result.data.shareId,
        recipientCount: result.data.recipientCount
      })

      // 触发分享完成事件
      emit('shareComplete')

      // 关闭对话框
      emit('update:show', false)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '发送分享失败，请重试'
    logger.error('ShareDialog', '创建直接分享失败', error)
    message.error(errorMessage)
    // eslint-disable-next-line require-atomic-updates -- state.srMessage 在 await 期间不会被其他代码修改
    state.srMessage = errorMessage
  } finally {
    // eslint-disable-next-line require-atomic-updates -- state.isSharing 在 await 期间不会被其他代码修改
    state.isSharing = false
  }
}

// 键盘导航：ESC 键关闭弹窗
useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.show) {
    emit('update:show', false)
  }
})

// 焦点管理：弹窗打开时保存当前焦点，关闭时恢复
const manageFocus = async (show: boolean) => {
  if (show) {
    previousActiveElement.value = document.activeElement as HTMLElement

    await nextTick()
    const firstFocusable = document.querySelector(
      '.share-dialog-content button, .share-dialog-content [tabindex="0"]'
    ) as HTMLElement
    if (firstFocusable) {
      firstFocusable.focus()
    }
  } else {
    if (previousActiveElement.value) {
      previousActiveElement.value.focus()
      previousActiveElement.value = null
    }
  }
}

// 监听弹窗显示状态
watch(
  () => props.show,
  show => {
    if (show) {
      // 弹窗打开时初始化
      state.customTitle = defaultTitle.value
      state.description = ''
      state.showDescription = false
      state.shareType = 'link'
      state.selectedUserIds = []
      state.message = ''

      // 清空用户搜索选择器
      userSearchSelectRef.value?.clearSelection()

      void manageFocus(true)
    } else {
      // 弹窗关闭时清理状态
      state.currentGenerationId++
      state.posterPreview = null
      state.error = null
      state.isGenerating = false
      state.customTitle = ''
      state.description = ''
      state.showDescription = false
      state.selectedUserIds = []
      state.message = ''

      // 清空用户搜索选择器
      userSearchSelectRef.value?.clearSelection()

      void manageFocus(false)
    }
  }
)

// 组件卸载时取消未完成的任务
onUnmounted(() => {
  state.currentGenerationId++
})
</script>

<template>
  <Dialog
    :show="show"
    title="分享书签"
    icon="icon-share"
    max-width="720px"
    @update:show="$emit('update:show', $event)"
  >
    <template #header-actions>
      <Button
        variant="icon"
        title="关闭"
        aria-label="关闭分享对话框"
        @click="$emit('update:show', false)"
      >
        <LucideIcon name="x" :size="20" />
      </Button>
    </template>
    <!-- 屏幕阅读器消息区域（视觉上隐藏） -->
    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ state.srMessage }}
    </div>

    <div class="share-dialog-content">
      <!-- 未登录提示 -->
      <div v-if="!isAuthenticated" class="login-prompt">
        <LucideIcon name="lock" :size="48" class="login-prompt__icon" />
        <h3 class="login-prompt__title">需要登录才能分享</h3>
        <p class="login-prompt__description">登录后可以生成分享链接或直接发送给其他用户</p>
        <Button variant="filled" @click="handleGoToLogin">
          <LucideIcon slot="icon" name="log-in" :size="18" />
          前往登录
        </Button>
      </div>

      <!-- 已登录：分享功能 -->
      <template v-else>
        <!-- 标题输入 -->
        <div class="title-input-section">
          <MdInput
            v-model="state.customTitle"
            label="分享标题"
            variant="outlined"
            size="md"
            @input="handleTitleChange"
          />
        </div>

        <!-- 书签数量提示 -->
        <div
          class="share-info-section"
          :class="{ 'share-info-section--warning': bookmarks.length > 500 }"
        >
          <div class="bookmark-count-info">
            <LucideIcon
              :name="bookmarks.length > 500 ? 'alert-triangle' : 'bookmark'"
              :size="18"
              class="bookmark-icon"
            />
            <span class="bookmark-count-text">
              将分享 {{ bookmarks.length }} 个书签
              <span v-if="bookmarks.length > 500" class="bookmark-count-warning-text">
                （超出限制，最多 500 个）
              </span>
            </span>
          </div>
        </div>

        <!-- 分享选项（两个开关） -->
        <div class="share-options">
          <!-- 显示用户名开关 -->
          <div class="option-item">
            <md-switch
              class="option-switch"
              :selected="state.showUsername"
              @change="handleShowUsernameChange"
            />
            <label class="option-label" @click="state.showUsername = !state.showUsername">
              显示用户名
            </label>
            <Tooltip placement="top" :delay="300" offset="sm">
              <Button variant="icon" class="option-tip" aria-label="显示用户名说明">
                <LucideIcon name="info" :size="16" />
              </Button>
              <template #content>
                <div class="tip-content">
                  <div class="tip-title">显示用户名</div>
                  <div class="tip-text">
                    开启后，分享页面将显示你的用户名（{{ userName }}）。<br />
                    关闭后，分享页面将不显示任何用户信息，保持匿名。
                  </div>
                </div>
              </template>
            </Tooltip>
          </div>

          <!-- 添加描述开关 -->
          <div class="option-item">
            <md-switch
              class="option-switch"
              :selected="state.showDescription"
              @change="handleShowDescriptionChange"
            />
            <label class="option-label" @click="state.showDescription = !state.showDescription">
              添加描述
            </label>
            <Tooltip placement="top" :delay="300" offset="sm">
              <Button variant="icon" class="option-tip" aria-label="添加描述说明">
                <LucideIcon name="info" :size="16" />
              </Button>
              <template #content>
                <div class="tip-content">
                  <div class="tip-title">添加分享描述</div>
                  <div class="tip-text">
                    为这次分享添加详细说明，帮助接收者更好地了解这些书签的用途和价值。<br />
                    <br />
                    • 最多 1000 字符<br />
                    • 支持换行<br />
                    • 可选填写，不填写则不显示
                  </div>
                </div>
              </template>
            </Tooltip>
          </div>
        </div>

        <!-- 描述输入框（仅在开关开启时显示） -->
        <div v-if="state.showDescription" class="description-input-section">
          <MdInput
            v-model="state.description"
            label="分享描述"
            variant="outlined"
            size="md"
            type="textarea"
            :rows="3"
            placeholder="介绍一下这些书签的用途、特点等..."
            @input="handleDescriptionInput"
          />
          <div
            class="char-count"
            :class="{ 'char-count-warning': state.description.length > 1000 }"
          >
            {{ state.description.length }}/1000
          </div>
        </div>

        <!-- 分享方式选择 -->
        <md-tabs :active-tab-index="activeTabIndex" @change="handleTabChange">
          <md-primary-tab aria-label="分享链接">
            <LucideIcon slot="icon" name="link" :size="18" />
            分享链接
          </md-primary-tab>
          <md-primary-tab aria-label="直接发送给用户">
            <LucideIcon slot="icon" name="send" :size="18" />
            发送给用户
          </md-primary-tab>
          <md-primary-tab aria-label="生成海报">
            <LucideIcon slot="icon" name="image" :size="18" />
            生成海报
          </md-primary-tab>
        </md-tabs>

        <!-- 直接分享：用户搜索 -->
        <div v-if="state.shareType === 'direct'" class="user-search-section">
          <!-- 书签数量超限提示 -->
          <div v-if="bookmarks.length > 500" class="error-hint">
            <LucideIcon name="alert-circle" :size="16" />
            <span>书签数量超出限制（{{ bookmarks.length }}/500），请减少选择的书签数量</span>
          </div>

          <!-- 用户搜索选择器 -->
          <AsyncSearchSelect
            ref="userSearchSelectRef"
            label="搜索用户"
            placeholder="输入用户名或邮箱"
            :multiple="true"
            empty-text="未找到匹配的用户"
            @search="handleUserSearch"
            @change="handleUserSelectionChange"
          />

          <!-- 留言输入 -->
          <MdInput
            v-model="state.message"
            label="留言（可选）"
            variant="outlined"
            size="md"
            type="textarea"
            :rows="2"
            placeholder="给接收者留言..."
            :maxlength="500"
          />
        </div>

        <!-- 链接分享：生成按钮和使用说明 -->
        <template v-if="state.shareType === 'link'">
          <div class="link-share-section">
            <!-- 生成链接按钮 -->
            <div class="generate-link-container">
              <Button
                variant="filled"
                :disabled="state.isSharing || bookmarks.length === 0 || bookmarks.length > 500"
                class="generate-link-button"
                @click="handleCreateLinkShare"
              >
                <Loading v-if="state.isSharing" slot="icon" size="xs" />
                <LucideIcon v-else slot="icon" name="link" :size="18" />
                {{ state.isSharing ? '生成中...' : '生成分享链接' }}
              </Button>
              <div v-if="bookmarks.length > 500" class="error-hint">
                <LucideIcon name="alert-circle" :size="16" />
                <span>书签数量超出限制，请选择不超过 500 个书签</span>
              </div>
            </div>

            <!-- 使用说明 -->
            <div class="usage-hint">
              <div class="usage-hint-header">
                <LucideIcon name="info" :size="20" class="usage-hint-icon" />
                <span class="usage-hint-title">如何使用分享链接</span>
              </div>
              <ol class="usage-hint-steps">
                <li>点击上方按钮生成分享链接</li>
                <li>链接会自动复制到剪贴板</li>
                <li>将链接发送给朋友</li>
                <li>朋友打开链接即可查看并导入书签</li>
              </ol>
            </div>
          </div>
        </template>

        <!-- 海报分享：海报预览 -->
        <template v-if="state.shareType === 'poster'">
          <!-- 海报预览 -->
          <div class="poster-preview" role="region" aria-label="海报预览区域">
            <div
              v-if="state.isGenerating"
              class="preview-loading"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <Loading size="lg" text="正在生成海报..." />
              <md-linear-progress indeterminate class="poster-progress" />
            </div>
            <div v-else-if="state.error" class="preview-error" role="alert" aria-live="assertive">
              <LucideIcon name="alert-circle" :size="48" aria-hidden="true" />
              <span>{{ state.error }}</span>
              <Button variant="outlined" aria-label="重新生成海报" @click="handleRetry">
                重试
              </Button>
            </div>
            <img
              v-else-if="state.posterPreview"
              :src="state.posterPreview"
              alt="分享海报预览，包含书签列表"
              class="preview-image"
              role="img"
            />
          </div>
        </template>
      </template>
    </div>

    <template #actions>
      <!-- 未登录时不显示操作按钮 -->
      <template v-if="isAuthenticated">
        <!-- 海报分享的操作按钮 -->
        <template v-if="state.shareType === 'poster'">
          <Button
            variant="text"
            :disabled="!state.posterPreview || state.isGenerating"
            aria-label="复制海报图片到剪贴板"
            @click="handleCopyImage"
          >
            <LucideIcon slot="icon" name="copy" :size="18" />
            复制图片
          </Button>
          <Button
            variant="filled"
            :disabled="!state.posterPreview || state.isGenerating"
            aria-label="下载海报图片"
            @click="handleDownloadImage"
          >
            <LucideIcon slot="icon" name="download" :size="18" />
            下载图片
          </Button>
        </template>

        <!-- 直接分享的操作按钮 -->
        <template v-else-if="state.shareType === 'direct'">
          <Button
            variant="filled"
            :disabled="
              state.selectedUserIds.length === 0 || state.isSharing || bookmarks.length > 500
            "
            aria-label="发送分享给选中的用户"
            @click="handleCreateDirectShare"
          >
            <Loading v-if="state.isSharing" slot="icon" size="xs" />
            <LucideIcon v-else slot="icon" name="send" :size="18" />
            {{ state.isSharing ? '发送中...' : '发送分享' }}
          </Button>
        </template>
      </template>
    </template>
  </Dialog>
</template>

<style scoped>
/* 屏幕阅读器专用（视觉上隐藏） */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border-width: 0;
  white-space: nowrap;
  overflow: hidden;
  clip-path: inset(50%);
}

.share-dialog-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  min-height: 400px;
}

/* 登录提示 */
.login-prompt {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-4);
  min-height: 400px;
  padding: var(--spacing-8);
  text-align: center;
}

.login-prompt__icon {
  color: var(--md-sys-color-primary);
}

.login-prompt__title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.login-prompt__description {
  max-width: 400px;
  margin: 0;
  font-size: var(--text-base);
  color: var(--color-text-secondary);
}

/* 链接分享区域 */
.link-share-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
  padding: var(--spacing-4) 0;
}

/* 生成链接容器 */
.generate-link-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-6) var(--spacing-4);
}

.generate-link-button {
  --Button-container-height: 48px;
  --md-filled-button-label-text-size: var(--text-base);

  min-width: 200px;
}

/* 错误提示 */
.error-hint {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  max-width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  text-align: center;
  color: var(--md-sys-color-on-error-container);
  background: var(--md-sys-color-error-container);
}

.error-hint svg {
  flex-shrink: 0;
}

/* 使用说明 */
.usage-hint {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--md-sys-color-surface-container-low);
}

.usage-hint-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.usage-hint-icon {
  flex-shrink: 0;
  color: var(--md-sys-color-primary);
}

.usage-hint-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.usage-hint-steps {
  margin: 0;
  padding-left: var(--spacing-5);
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.usage-hint-steps li {
  margin-bottom: var(--spacing-2);
}

.usage-hint-steps li:last-child {
  margin-bottom: 0;
}

.share-link-input-wrapper {
  width: 100%;
}

/* 标题输入 */
.title-input-section {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

/* 书签数量信息区域 */
.share-info-section {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-md);
  background: var(--md-sys-color-surface-container-low);
  transition: all 0.2s ease;
}

.share-info-section--warning {
  border: 1px solid var(--md-sys-color-error);
  background: color-mix(
    in srgb,
    var(--md-sys-color-error-container) 20%,
    var(--md-sys-color-surface-container-low)
  );
}

.bookmark-count-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.bookmark-icon {
  flex-shrink: 0;
  color: var(--md-sys-color-primary);
}

.share-info-section--warning .bookmark-icon {
  color: var(--md-sys-color-error);
}

.bookmark-count-text {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.bookmark-count-warning-text {
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-error);
}

/* 描述输入 */
.description-input-section {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.char-count {
  align-self: flex-end;
  padding-right: var(--spacing-2);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.char-count-warning {
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-error);
}

/* 分享选项（两个开关横排） */
.share-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-6);
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-md);
  background: var(--md-sys-color-surface-container-low);
}

.option-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.option-switch {
  --md-switch-track-width: 36px;
  --md-switch-track-height: 20px;
  --md-switch-handle-width: 16px;
  --md-switch-handle-height: 16px;
}

.option-label {
  font-size: var(--text-sm);
  white-space: nowrap;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.option-tip {
  --md-icon-button-icon-size: 16px;
  --md-icon-button-state-layer-height: 28px;
  --md-icon-button-state-layer-width: 28px;

  margin-left: -4px; /* 缩小与文案的间距 */
  color: var(--color-text-tertiary);
}

/* Tooltip 内容样式 */
.tip-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.tip-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-inverse-on-surface);
}

.tip-text {
  font-size: var(--text-xs);
  line-height: 1.6;
  color: var(--md-sys-color-inverse-on-surface);
  opacity: 0.9;
}

.toggle-label {
  font-size: var(--text-sm);
  white-space: nowrap;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

/* Material Web Tabs 样式配置 */
md-tabs {
  width: 100%;
}

/* 移除默认焦点边框，使用 Material 的焦点样式 */
md-primary-tab {
  outline: none;
}

/* Material Design 焦点状态 */
md-primary-tab:focus-visible {
  border-radius: var(--radius-sm);
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 2px;
}

/* 确保 Tab 图标正确显示 */
md-primary-tab [slot='icon'] {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 用户搜索区域 */
.user-search-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

/* 海报预览 */
.poster-preview {
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}

.preview-loading,
.preview-error {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-3);
  color: var(--color-text-secondary);
}

/* 线性进度条样式 */
.poster-progress {
  --md-linear-progress-track-height: 4px;
  --md-linear-progress-track-shape: 2px;
  --md-linear-progress-active-indicator-height: 4px;

  width: 100%;
  max-width: 300px;
  margin-top: var(--spacing-2);
}

.preview-image {
  max-width: 100%;
  max-height: 500px;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}
</style>
