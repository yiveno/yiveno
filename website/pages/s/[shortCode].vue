<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

interface SharedBookmark {
  title: string
  url: string
  description?: string
}

interface SharedPageData {
  title: string
  user_id: string
  bookmark_count: number
  share_type?: 'link' | 'direct'
  sender?: {
    name?: string
    email?: string
    avatar_url?: string
  }
  description?: string
  show_username?: boolean
  profiles?: {
    name?: string
    email?: string
  }
  created_at?: string
}

// 联合类型，包含所有可能的响应属性
interface ExtensionMessageResponse {
  user?: {
    id: string
  }
  installed?: boolean
  success?: boolean
  imported?: number
  failed?: number
  folderName?: string
  error?: string
}

// 获取路由参数
const route = useRoute()
const shortCode = computed(() => route.params.shortCode as string)

// 状态
const isLoading = ref(true)
const error = ref<string | null>(null)
const shareData = ref<SharedPageData | null>(null)
const bookmarks = ref<SharedBookmark[]>([])
const selectedBookmarks = ref<Set<number>>(new Set())
const isExtensionInstalled = ref(false)
const isOwnShare = ref(false) // 是否是自己的分享
const currentUserId = ref<string | null>(null) // 当前登录用户 ID

// 导入相关状态
const isImporting = ref(false)
const importProgress = ref({ current: 0, total: 0 })

// 移动端检测
const isMobile = ref(false)

// 扩展链接
const extensionLink =
  'https://chrome.google.com/webstore/detail/acuitybookmarks/gdjcmpenmogdikhnnaebmddhmdgbfcgl'

// ✅ 扩展 ID：从环境变量读取（本地开发时为空，生产环境使用固定 ID）
const config = useRuntimeConfig()
const EXTENSION_ID = config.public.extensionId || '' // 本地开发时为空字符串

// 检测是否为移动设备
const checkMobile = () => {
  if (typeof window === 'undefined') return false

  const userAgent = navigator.userAgent.toLowerCase()
  const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'mobile', 'webos']
  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword))

  const isMobileWidth = window.innerWidth < 768
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  return isMobileUA || (isMobileWidth && hasTouchScreen)
}

// 加载分享数据
const loadShareData = async () => {
  isLoading.value = true
  error.value = null

  try {
    // 从环境变量获取 API URL
    const apiBaseUrl = config.public.apiBaseUrl || 'https://api.acuitybookmarks.com'

    console.log('🔧 API Base URL:', apiBaseUrl)

    // 调用后端 API 获取分享数据
    const response = await fetch(
      `${apiBaseUrl}/trpc/share.getShareByCode?batch=1&input=${encodeURIComponent(
        JSON.stringify({ 0: { shortCode: shortCode.value } })
      )}`
    )

    if (!response.ok) {
      throw new Error('获取分享数据失败')
    }

    const data = await response.json()

    if (!data[0]?.result?.data) {
      throw new Error('分享不存在或已过期')
    }

    // ✅ 修复：后端返回的数据结构是 data[0].result.data.data（多了一层 data）
    const result = data[0].result.data.data
    shareData.value = result.share
    bookmarks.value = result.bookmarks

    console.log('✅ 分享数据加载成功', {
      title: shareData.value?.title,
      bookmarkCount: bookmarks.value.length,
      userId: shareData.value?.user_id
    })

    // 检查是否是自己的分享
    await checkIfOwnShare()

    // 默认全选所有书签（仅当扩展已安装）
    // ⚠️ 临时移除 !isOwnShare 限制，用于测试分享流程
    if (isExtensionInstalled.value) {
      bookmarks.value.forEach((_, index) => {
        selectedBookmarks.value.add(index)
      })
    }
  } catch (err) {
    console.error('加载分享数据失败:', err)
    error.value = err instanceof Error ? err.message : '加载失败，请重试'
  } finally {
    isLoading.value = false
  }
}

// 检查是否是自己的分享
const checkIfOwnShare = async () => {
  try {
    // 从扩展获取当前登录用户信息
    // @ts-expect-error - chrome runtime API
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      // ✅ 修复：使用统一的消息发送方式
      const sendMessageToExtension = (
        message: Record<string, unknown>,
        callback: (response: ExtensionMessageResponse) => void
      ) => {
        if (EXTENSION_ID) {
          // @ts-expect-error - chrome runtime API
          chrome.runtime.sendMessage(EXTENSION_ID, message, callback)
        } else {
          // @ts-expect-error - chrome runtime API
          chrome.runtime.sendMessage(message, callback)
        }
      }

      sendMessageToExtension({ type: 'GET_CURRENT_USER' }, (response: ExtensionMessageResponse) => {
        // @ts-expect-error - chrome runtime API
        if (!chrome.runtime.lastError && response && response.user) {
          currentUserId.value = response.user.id
          console.log('📍 当前用户 ID:', currentUserId.value)

          // 比对用户 ID
          if (shareData.value && shareData.value.user_id === currentUserId.value) {
            isOwnShare.value = true
            console.log('⚠️ 这是您自己的分享，不能导入')
          }
        }
      })
    }
  } catch (ownerCheckError) {
    console.error('检查分享所有者失败:', ownerCheckError)
  }
}

// 检测扩展是否安装
const checkExtension = async () => {
  try {
    console.log('🔍 开始检测扩展是否安装...')

    // 使用 chrome.runtime.sendMessage 检测扩展
    // @ts-expect-error - chrome API 在网页环境中可用（通过 externally_connectable）
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      console.log('✅ chrome.runtime.sendMessage 可用')

      // ✅ 修复：本地开发时不指定 extensionId，让扩展通过 externally_connectable 自动接收
      const sendMessageToExtension = (
        message: Record<string, unknown>,
        callback: (response: ExtensionMessageResponse) => void
      ) => {
        if (EXTENSION_ID) {
          // 生产环境：指定扩展 ID
          console.log('📍 使用固定扩展 ID:', EXTENSION_ID)
          // @ts-expect-error - chrome runtime API
          chrome.runtime.sendMessage(EXTENSION_ID, message, callback)
        } else {
          // 本地开发：不指定 ID，让扩展自动接收（通过 externally_connectable）
          console.log('📍 本地开发模式：不指定扩展 ID')
          // @ts-expect-error - chrome runtime API
          chrome.runtime.sendMessage(message, callback)
        }
      }

      // 发送 ping 消息到扩展
      sendMessageToExtension(
        { type: 'CHECK_EXTENSION_INSTALLED' },
        (response: ExtensionMessageResponse) => {
          // @ts-expect-error - chrome runtime API
          if (chrome.runtime.lastError) {
            // @ts-expect-error - chrome runtime API
            console.log('❌ 扩展未安装或未响应:', chrome.runtime.lastError.message)
            isExtensionInstalled.value = false
          } else if (response && response.installed) {
            console.log('✅ 检测到 AcuityBookmarks 扩展', response)
            isExtensionInstalled.value = true

            // 默认全选所有书签
            bookmarks.value.forEach((_, index) => {
              selectedBookmarks.value.add(index)
            })
          } else {
            console.log('❌ 扩展响应异常:', response)
            isExtensionInstalled.value = false
          }
        }
      )
    } else {
      console.log('❌ chrome.runtime.sendMessage 不可用')
      isExtensionInstalled.value = false
    }
  } catch (extensionError) {
    console.error('检测扩展失败:', extensionError)
    isExtensionInstalled.value = false
  }
}

// 切换书签选择
const toggleBookmark = (index: number) => {
  // ⚠️ 临时移除 isOwnShare 限制，用于测试分享流程
  if (!isExtensionInstalled.value) return

  if (selectedBookmarks.value.has(index)) {
    selectedBookmarks.value.delete(index)
  } else {
    selectedBookmarks.value.add(index)
  }
}

// 全选/取消全选
const toggleSelectAll = () => {
  if (selectedBookmarks.value.size === bookmarks.value.length) {
    selectedBookmarks.value.clear()
  } else {
    bookmarks.value.forEach((_, index) => {
      selectedBookmarks.value.add(index)
    })
  }
}

// 导入选中的书签
const importSelected = async () => {
  if (selectedBookmarks.value.size === 0) return

  const bookmarksToImport = Array.from(selectedBookmarks.value)
    .map(index => bookmarks.value[index])
    .filter((b): b is SharedBookmark => b !== undefined)

  isImporting.value = true
  importProgress.value = { current: 0, total: bookmarksToImport.length }

  try {
    console.log('📤 开始导入书签到扩展...', {
      count: bookmarksToImport.length
    })

    // 使用 chrome.runtime.sendMessage 发送导入请求
    // @ts-expect-error - chrome runtime API
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      // ✅ 修复：使用统一的消息发送方式
      const sendMessageToExtension = (
        message: Record<string, unknown>,
        callback: (response: ExtensionMessageResponse) => void
      ) => {
        if (EXTENSION_ID) {
          // @ts-expect-error - chrome runtime API
          chrome.runtime.sendMessage(EXTENSION_ID, message, callback)
        } else {
          // @ts-expect-error - chrome runtime API
          chrome.runtime.sendMessage(message, callback)
        }
      }

      sendMessageToExtension(
        {
          type: 'IMPORT_SHARED_BOOKMARKS',
          data: {
            bookmarks: bookmarksToImport.map(b => ({
              title: b.title,
              url: b.url,
              description: b.description
            })),
            shareTitle: shareData.value?.title || '分享的书签' // ✅ 传递分享标题
          }
        },
        (response: ExtensionMessageResponse) => {
          // @ts-expect-error - chrome runtime API
          if (chrome.runtime.lastError) {
            // @ts-expect-error - chrome runtime API
            console.error('❌ 导入失败:', chrome.runtime.lastError.message)
            // @ts-expect-error - chrome runtime API
            alert(`❌ 导入失败：${chrome.runtime.lastError.message}`)
            isImporting.value = false
            return
          }

          if (response && response.success) {
            console.log('✅ 导入成功', response)
            alert(
              `✅ 成功导入 ${response.imported} 个书签到文件夹「${response.folderName}」！${
                (response.failed ?? 0) > 0 ? `\n失败 ${response.failed} 个` : ''
              }`
            )
            selectedBookmarks.value.clear()
          } else {
            console.error('❌ 导入失败:', response)
            alert(`❌ 导入失败：${response.error || '未知错误'}`)
          }

          isImporting.value = false
        }
      )
    } else {
      throw new Error('chrome.runtime.sendMessage 不可用')
    }
  } catch (importError) {
    console.error('导入失败:', importError)
    alert(
      `❌ 导入失败：${importError instanceof Error ? importError.message : String(importError)}`
    )
    isImporting.value = false
  }
}

// 获取 favicon URL
const getFaviconUrl = (url: string): string => {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ''
  }
}

// 处理图标加载错误
const handleIconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// 格式化日期 - 显示精确时间（年月日时分秒）
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// 复制分享链接（移动端）
const copyShareLink = async () => {
  try {
    const currentUrl = window.location.href
    await navigator.clipboard.writeText(currentUrl)
    alert('✅ 链接已复制到剪贴板')
  } catch (copyError) {
    console.error('复制链接失败:', copyError)
    alert('❌ 复制失败，请手动复制链接')
  }
}

// 使用系统分享 API（移动端）
const shareToFriends = async () => {
  if (!shareData.value) return

  try {
    if (navigator.share) {
      await navigator.share({
        title: shareData.value.title,
        text: `${shareData.value.title} - 分享了 ${shareData.value.bookmark_count} 个书签`,
        url: window.location.href
      })
      console.log('✅ 分享成功')
    } else {
      await copyShareLink()
    }
  } catch (shareError) {
    if ((shareError as Error).name !== 'AbortError') {
      console.error('分享失败:', shareError)
      alert('❌ 分享失败，请重试')
    }
  }
}

// 页面加载时执行
onMounted(async () => {
  isMobile.value = checkMobile()
  console.log('📱 移动端检测结果:', isMobile.value)

  if (!isMobile.value) {
    await checkExtension()
  }

  await loadShareData()
})

// SEO
useSeoMeta({
  title: computed(() => `${shareData.value?.title || '分享的书签'} - AcuityBookmarks`),
  description: computed(() => `查看分享的 ${shareData.value?.bookmark_count || 0} 个书签`),
  robots: 'noindex, nofollow'
})
</script>

<template>
  <div class="share-landing-page">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-container" role="status" aria-live="polite">
      <div class="loading-spinner" aria-hidden="true"></div>
      <p class="loading-text">正在加载分享内容...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-container" role="alert" aria-live="assertive">
      <div class="error-icon" aria-hidden="true">⚠️</div>
      <h2 class="error-title">无法加载分享内容</h2>
      <p class="error-message">{{ error }}</p>
      <button class="retry-button" aria-label="重新加载分享内容" @click="loadShareData">
        重试
      </button>
    </div>

    <!-- 分享内容 -->
    <div v-else-if="shareData" class="share-content">
      <!-- 头部 -->
      <header class="share-header">
        <div class="container">
          <!-- 直接分享：显示发送者信息 -->
          <div v-if="shareData.share_type === 'direct' && shareData.sender" class="sender-info">
            <div class="sender-avatar">
              <img
                v-if="shareData.sender.avatar_url"
                :src="shareData.sender.avatar_url"
                :alt="shareData.sender.name || shareData.sender.email"
              />
              <div v-else class="sender-avatar-placeholder">
                {{
                  ((shareData.sender.name || shareData.sender.email || '?')[0] ?? '?').toUpperCase()
                }}
              </div>
            </div>
            <div class="sender-text">
              <span class="sender-name">{{ shareData.sender.name || shareData.sender.email }}</span>
              <span class="sender-action">分享给你</span>
            </div>
          </div>

          <h1 class="share-title">{{ shareData.title }}</h1>

          <!-- 分享描述 -->
          <p v-if="shareData.description" class="share-description">
            {{ shareData.description }}
          </p>

          <!-- 分享元信息 -->
          <p class="share-meta">
            <!-- ✅ 根据 show_username 字段决定是否显示分享者名称（仅链接分享） -->
            <span
              v-if="
                shareData.share_type === 'link' &&
                shareData.show_username &&
                (shareData.profiles?.name || shareData.profiles?.email)
              "
              class="share-author"
            >
              {{ shareData.profiles?.name || shareData.profiles?.email }}
            </span>
            <span
              v-if="
                shareData.share_type === 'link' &&
                shareData.show_username &&
                (shareData.profiles?.name || shareData.profiles?.email)
              "
            >
              ·
            </span>
            <span v-if="shareData.bookmark_count"
              >分享了 {{ shareData.bookmark_count }} 个书签</span
            >
            <span v-if="shareData.created_at" class="share-time">
              · {{ formatDate(shareData.created_at) }}
            </span>
          </p>
        </div>
      </header>

      <!-- 扩展检测提示 -->
      <div
        v-if="!isExtensionInstalled && !isMobile"
        class="extension-prompt"
        role="region"
        aria-label="扩展安装提示"
      >
        <div class="container">
          <div class="prompt-content">
            <div class="prompt-icon" aria-hidden="true">🚀</div>
            <div class="prompt-text">
              <h3>安装 AcuityBookmarks 扩展</h3>
              <p>安装扩展后，您可以一键导入这些书签到您的 Chrome 浏览器</p>
            </div>
            <a
              :href="extensionLink"
              target="_blank"
              rel="noopener noreferrer"
              class="install-button"
              aria-label="在新标签页中打开 Chrome 网上应用店安装 AcuityBookmarks 扩展"
            >
              前往 Chrome 商店安装
            </a>
          </div>
          <div class="install-steps">
            <div class="step">
              <span class="step-number">1</span>
              <span class="step-text">点击上方按钮前往 Chrome 网上应用店</span>
            </div>
            <div class="step">
              <span class="step-number">2</span>
              <span class="step-text">点击"添加至 Chrome"按钮安装扩展</span>
            </div>
            <div class="step">
              <span class="step-number">3</span>
              <span class="step-text">安装完成后刷新本页面，即可导入书签</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 自己的分享提示 -->
      <!-- ⚠️ 临时禁用：用于测试分享流程 -->
      <!--
      <div
        v-if="isExtensionInstalled && isOwnShare && !isMobile"
        class="own-share-prompt"
        role="region"
        aria-label="自己的分享提示"
      >
        <div class="container">
          <div class="prompt-content">
            <div class="prompt-icon" aria-hidden="true">ℹ️</div>
            <div class="prompt-text">
              <h3>这是您自己的分享</h3>
              <p>您不能导入自己分享的书签，这些书签已经在您的浏览器中了</p>
            </div>
          </div>
        </div>
      </div>
      -->

      <!-- 移动端提示 -->
      <div v-if="isMobile" class="mobile-prompt" role="region" aria-label="移动端使用提示">
        <div class="container">
          <div class="prompt-content">
            <div class="prompt-icon" aria-hidden="true">💻</div>
            <div class="prompt-text">
              <h3>请在电脑上打开</h3>
              <p>要导入这些书签，请在电脑浏览器中打开此链接并安装 AcuityBookmarks 扩展</p>
            </div>
            <div class="mobile-actions">
              <button
                class="action-button secondary"
                aria-label="复制分享链接到剪贴板"
                @click="copyShareLink"
              >
                📋 复制链接
              </button>
              <button
                class="action-button primary"
                aria-label="使用系统分享功能分享给朋友"
                @click="shareToFriends"
              >
                🔗 分享给朋友
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 书签列表 -->
      <div class="bookmarks-section">
        <div class="container">
          <div class="bookmarks-header">
            <h2 class="bookmarks-title">书签列表</h2>
            <!-- ⚠️ 临时移除 !isOwnShare 限制，用于测试分享流程 -->
            <div v-if="isExtensionInstalled && !isMobile" class="bookmarks-actions">
              <!-- 全选/取消全选 -->
              <button
                class="action-button secondary"
                :disabled="isImporting"
                @click="toggleSelectAll"
              >
                {{ selectedBookmarks.size === bookmarks.length ? '取消全选' : '全选' }}
              </button>

              <!-- 导入按钮 -->
              <button
                class="action-button primary"
                :disabled="selectedBookmarks.size === 0 || isImporting"
                :aria-label="
                  isImporting
                    ? `正在导入，进度 ${importProgress.current} / ${importProgress.total}`
                    : `导入选中的 ${selectedBookmarks.size} 个书签`
                "
                :aria-busy="isImporting"
                @click="importSelected"
              >
                <span v-if="isImporting">
                  导入中... ({{ importProgress.current }}/{{ importProgress.total }})
                </span>
                <span v-else> 导入选中 ({{ selectedBookmarks.size }}) </span>
              </button>
            </div>
          </div>

          <!-- 导入进度播报（屏幕阅读器） -->
          <div
            v-if="isImporting"
            class="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            正在导入书签，进度 {{ importProgress.current }} / {{ importProgress.total }}
          </div>

          <div class="bookmarks-list" role="list" :aria-label="`共 ${bookmarks.length} 个书签`">
            <div
              v-for="(bookmark, index) in bookmarks"
              :key="index"
              class="bookmark-item"
              :class="{
                selected: selectedBookmarks.has(index),
                'mobile-item': isMobile
              }"
              role="listitem"
              :aria-label="`书签：${bookmark.title}`"
              @click="isMobile ? undefined : toggleBookmark(index)"
            >
              <!-- ⚠️ 临时移除 !isOwnShare 限制，用于测试分享流程 -->
              <div v-if="isExtensionInstalled && !isMobile" class="bookmark-checkbox">
                <input
                  type="checkbox"
                  :checked="selectedBookmarks.has(index)"
                  :aria-label="`选择书签：${bookmark.title}`"
                  @click.stop="toggleBookmark(index)"
                />
              </div>
              <div class="bookmark-icon" aria-hidden="true">
                <img
                  v-if="bookmark.url"
                  :src="getFaviconUrl(bookmark.url)"
                  :alt="bookmark.title"
                  @error="handleIconError"
                />
                <span v-else class="default-icon">🔖</span>
              </div>
              <div class="bookmark-content">
                <h3 class="bookmark-title">{{ bookmark.title }}</h3>
                <a
                  v-if="bookmark.url"
                  :href="bookmark.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="bookmark-url"
                  :aria-label="`打开链接：${bookmark.url}`"
                  @click.stop
                >
                  {{ bookmark.url }}
                </a>
                <p v-if="bookmark.description" class="bookmark-description">
                  {{ bookmark.description }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-container">
      <div class="empty-icon">📭</div>
      <h2 class="empty-title">没有找到分享内容</h2>
      <p class="empty-message">请检查分享链接是否正确</p>
    </div>
  </div>
</template>

<style scoped>
/* 复用 share.vue 的样式 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border-width: 0;
}

.share-landing-page {
  min-height: 100vh;
  background: var(--md-sys-color-background);
  color: var(--md-sys-color-on-background);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.loading-container,
.error-container,
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  text-align: center;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid color-mix(in srgb, white 10%, transparent);
  border-top-color: var(--md-sys-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  margin-top: 1rem;
  font-size: 1.125rem;
  color: var(--md-sys-color-on-surface-variant);
}

.error-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.error-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.error-message {
  font-size: 1rem;
  color: var(--md-sys-color-on-surface-variant);
  margin-bottom: 1.5rem;
}

.retry-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.retry-button:hover {
  opacity: 0.9;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.empty-message {
  font-size: 1rem;
  color: var(--md-sys-color-on-surface-variant);
}

.share-header {
  padding: 3rem 0 2rem;
  border-bottom: 1px solid color-mix(in srgb, white 10%, transparent);
}

/* 发送者信息（直接分享） */
.sender-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: color-mix(in srgb, var(--md-sys-color-primary-container) 30%, transparent);
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
}

.sender-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--md-sys-color-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
}

.sender-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sender-avatar-placeholder {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--md-sys-color-on-primary-container);
}

.sender-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sender-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.sender-action {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface-variant);
}

.share-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.share-description {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--md-sys-color-on-surface-variant);
  margin-bottom: 0.75rem;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.share-meta {
  font-size: 1rem;
  color: var(--md-sys-color-on-surface-variant);
}

.share-author {
  font-weight: 600;
  color: var(--md-sys-color-primary);
}

.share-time {
  opacity: 0.7;
}

.extension-prompt {
  padding: 2rem 0;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent),
    color-mix(in srgb, var(--md-sys-color-primary) 5%, transparent)
  );
  border-bottom: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
}

.mobile-prompt {
  padding: 2rem 0;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, #3b82f6 10%, transparent),
    color-mix(in srgb, #3b82f6 5%, transparent)
  );
  border-bottom: 1px solid color-mix(in srgb, #3b82f6 20%, transparent);
}

.own-share-prompt {
  padding: 2rem 0;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, #f59e0b 10%, transparent),
    color-mix(in srgb, #f59e0b 5%, transparent)
  );
  border-bottom: 1px solid color-mix(in srgb, #f59e0b 20%, transparent);
}

.mobile-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.action-button {
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mobile-actions .action-button {
  flex: 1;
  min-width: 140px;
}

.prompt-content {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, white 5%, transparent);
}

.prompt-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.prompt-text {
  flex: 1;
}

.prompt-text h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.prompt-text p {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface-variant);
}

.install-button {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 1rem;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity 0.2s;
}

.install-button:hover {
  opacity: 0.9;
}

.install-steps {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.step {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  background: color-mix(in srgb, white 3%, transparent);
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 0.875rem;
  font-weight: 600;
  flex-shrink: 0;
}

.step-text {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface);
  line-height: 1.5;
}

.bookmarks-section {
  padding: 3rem 0;
}

.bookmarks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.bookmarks-title {
  font-size: 1.5rem;
  font-weight: 600;
}

.bookmarks-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.action-button.primary {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.action-button.secondary {
  background: rgb(255 255 255 / 10%);
  color: var(--md-sys-color-on-background);
}

.action-button:not(:disabled):hover {
  opacity: 0.9;
}

.bookmarks-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.bookmark-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  background: rgb(255 255 255 / 5%);
  border: 1px solid transparent;
  transition: all 0.2s;
  cursor: pointer;
}

.bookmark-item.mobile-item {
  cursor: default;
}

.bookmark-item:hover {
  background: rgb(255 255 255 / 8%);
  border-color: rgb(131 213 197 / 30%);
}

.bookmark-item.mobile-item:hover {
  background: rgb(255 255 255 / 5%);
  border-color: transparent;
}

.bookmark-item.own-share-item {
  cursor: default;
  opacity: 0.8;
}

.bookmark-item.own-share-item:hover {
  background: rgb(255 255 255 / 5%);
  border-color: transparent;
}

.bookmark-item.selected {
  background: rgb(131 213 197 / 10%);
  border-color: var(--md-sys-color-primary);
}

.bookmark-checkbox {
  flex-shrink: 0;
  padding-top: 0.25rem;
}

.bookmark-checkbox input[type='checkbox'] {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
}

.bookmark-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  background: rgb(255 255 255 / 10%);
}

.bookmark-icon img {
  width: 24px;
  height: 24px;
  border-radius: 0.25rem;
}

.default-icon {
  font-size: 1.25rem;
}

.bookmark-content {
  flex: 1;
  min-width: 0;
}

.bookmark-title {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bookmark-url {
  display: block;
  font-size: 0.875rem;
  color: var(--md-sys-color-primary);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0.25rem;
}

.bookmark-url:hover {
  text-decoration: underline;
}

.bookmark-description {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (width <= 768px) {
  .share-title {
    font-size: 1.5rem;
  }

  .prompt-content {
    flex-direction: column;
    text-align: center;
  }

  .install-steps {
    text-align: left;
  }

  .bookmarks-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .bookmarks-actions {
    width: 100%;
    flex-direction: column;
  }

  .action-button {
    flex: 1;
    width: 100%;
  }

  .mobile-actions {
    width: 100%;
  }

  .mobile-actions .action-button {
    min-width: auto;
  }
}
</style>
