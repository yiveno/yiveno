<!--
智能书签推荐组件

职责：
- 基于用户使用模式生成个性化书签推荐
- 支持多种推荐类型（高频、最近、相似、上下文等）
- 提供推荐反馈机制以优化推荐质量

数据流：
SmartRecommendationEngine → 推荐列表 → UI 展示 → 用户交互 → 反馈记录
-->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Chip, LucideIcon, Loading, Button } from '@/components'
import {
  type RecommendationOptions,
  type SmartRecommendation,
  getSmartRecommendationEngine
} from '@/application/bookmark/recommendation-app-service'

import { logger } from '@/infrastructure/logging/logger'

// Props
interface Props {
  maxRecommendations?: number
  showDebugInfo?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxRecommendations: 5,
  showDebugInfo: false
})

// Emits
const emit = defineEmits<{
  bookmarkClick: [bookmark: SmartRecommendation, event: MouseEvent]
  recommendationUpdate: [recommendations: SmartRecommendation[]]
  recommendationFeedback: [recommendationId: string, feedback: 'accepted' | 'rejected' | 'clicked']
}>()

// 响应式状态
const recommendations = ref<SmartRecommendation[]>([])
const isLoading = ref(true)
const isRefreshing = ref(false)
const isLoadingMore = ref(false)
const hasMoreRecommendations = ref(false)
const recommendationEngine = getSmartRecommendationEngine()

// ✅ Favicon状态管理
const faviconLoaded = ref<Record<string, boolean>>({})
const faviconError = ref<Record<string, boolean>>({})

// 计算属性已移除，按需使用 props.showDebugInfo

// 生命周期
onMounted(async () => {
  await loadRecommendations()
})

async function loadRecommendations() {
  try {
    isLoading.value = true
    logger.info('SmartRecommendation', '🧠 开始加载智能推荐...')

    // 构建推荐选项
    const options: RecommendationOptions = {
      maxResults: props.maxRecommendations,
      minConfidence: 0.2, // 降低门槛以获得更多推荐
      includeRecentOnly: false,
      contextWeight: 0.3,
      diversityFactor: 0.25,
      userContext: await getCurrentUserContext()
    }

    // 使用智能推荐引擎获取推荐
    const newRecommendations = await recommendationEngine.generateRecommendations(options)

    recommendations.value = newRecommendations
    hasMoreRecommendations.value = newRecommendations.length >= props.maxRecommendations

    // ✅ 初始化favicon状态
    initializeFaviconState(newRecommendations)

    emit('recommendationUpdate', newRecommendations)

    logger.info(
      'Component',
      '✅ [SmartRecommendation] 加载完成: ${newRecommendations.length}个智能推荐'
    )
    if (props.showDebugInfo) {
      logger.info('📊 推荐详情:', newRecommendations)
    }
  } catch (error) {
    logger.error('Component', '❌ [SmartRecommendation] 加载推荐失败:', error)
    recommendations.value = []
  } finally {
    isLoading.value = false
  }
}

/**
 * 刷新推荐
 */
async function refreshRecommendations() {
  if (isRefreshing.value) return

  isRefreshing.value = true
  try {
    await loadRecommendations()
  } finally {
    isRefreshing.value = false // eslint-disable-line require-atomic-updates
  }
}

async function loadMoreRecommendations() {
  if (isLoadingMore.value) return

  isLoadingMore.value = true
  try {
    logger.info('Component', '🔄 [SmartRecommendation] 加载更多推荐...')

    // 构建选项（更大的范围）
    const options: RecommendationOptions = {
      maxResults: props.maxRecommendations * 2, // 获取更多结果
      minConfidence: 0.1, // 进一步降低门槛
      includeRecentOnly: false,
      contextWeight: 0.2,
      diversityFactor: 0.3, // 增加多样性
      userContext: await getCurrentUserContext()
    }

    const moreRecommendations = await recommendationEngine.generateRecommendations(options)

    // 添加新的推荐（去重）
    const existingIds = new Set(recommendations.value.map(r => r.id))
    const newOnes = moreRecommendations.filter(r => !existingIds.has(r.id))

    recommendations.value = [...recommendations.value, ...newOnes].slice(
      0,
      props.maxRecommendations * 3
    )
    hasMoreRecommendations.value = newOnes.length > 0

    logger.info('Component', '✅ [SmartRecommendation] 新增${newOnes.length}个推荐')
  } catch (error) {
    logger.error('Component', '❌ [SmartRecommendation] 加载更多推荐失败:', error)
  } finally {
    isLoadingMore.value = false // eslint-disable-line require-atomic-updates
  }
}
/**
 * 获取当前用户上下文
 */
async function getCurrentUserContext() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })
    const now = new Date()

    return {
      currentTime: Date.now(),
      currentHour: now.getHours(),
      currentDayOfWeek: now.getDay(),
      currentUrl: tab?.url,
      currentDomain: tab?.url ? new URL(tab.url).hostname : undefined
    }
  } catch (error) {
    logger.warn('⚠️ [SmartRecommendation] 获取用户上下文失败:', error)
    return {
      currentTime: Date.now(),
      currentHour: new Date().getHours(),
      currentDayOfWeek: new Date().getDay()
    }
  }
}

async function openBookmark(bookmark: SmartRecommendation, event: MouseEvent) {
  if (!bookmark.url) return

  try {
    const inNewTab = event.ctrlKey || event.metaKey || event.button === 1

    if (inNewTab) {
      await chrome.tabs.create({ url: bookmark.url })
    } else {
      await chrome.tabs.update({ url: bookmark.url })
    }

    // 跟踪推荐点击并记录反馈
    trackRecommendationClick(bookmark)
    recordRecommendationFeedback(bookmark.id, 'clicked')

    emit('bookmarkClick', bookmark, event)
    logger.info(
      'SmartRecommendation',
      `🔗 打开书签: ${bookmark.title} (${bookmark.recommendationType})`
    )
  } catch (error) {
    logger.error('Component', 'SmartRecommendation', '❌ 打开书签失败', error)
  }
}

function trackRecommendationClick(bookmark: SmartRecommendation) {
  const trackingData = {
    bookmarkId: bookmark.id,
    title: bookmark.title,
    url: bookmark.url,
    domain: bookmark.domain,
    recommendationType: bookmark.recommendationType,
    recommendationScore: bookmark.recommendationScore,
    confidence: bookmark.confidence,
    visitCount: bookmark.visitCount,
    recentVisitCount: bookmark.recentVisitCount,
    contextScore: bookmark.contextScore,
    timePatternScore: bookmark.timePatternScore,
    frequencyScore: bookmark.frequencyScore,
    similarityScore: bookmark.similarityScore,
    reasons: bookmark.recommendationReason.map(r => ({
      type: r.type,
      description: r.description,
      weight: r.weight
    })),
    timestamp: Date.now()
  }
  logger.info('SmartRecommendation', '📊 点击跟踪', trackingData)
}

function recordRecommendationFeedback(
  recommendationId: string,
  feedback: 'accepted' | 'rejected' | 'clicked'
) {
  // 记录到推荐引擎
  recommendationEngine.recordRecommendationFeedback(recommendationId, feedback)

  // 发出事件供父组件监听
  emit('recommendationFeedback', recommendationId, feedback)

  logger.info('SmartRecommendation', `📝 记录反馈: ${recommendationId} -> ${feedback}`)
}

// eslint-disable-next-line complexity -- 推荐原因判断逻辑需要多个条件分支，拆分会降低可读性
function getRecommendationReason(bookmark: SmartRecommendation): string {
  // 优先使用智能推荐引擎提供的推荐类型
  switch (bookmark.recommendationType) {
    case 'frequent':
      return '高频使用'
    case 'recent':
      return '最近访问'
    case 'similar':
      return '相似内容'
    case 'contextual':
      return '相关推荐'
    case 'temporal':
      return '时间匹配'
    case 'trending':
      return '热门趋势'
    case 'seasonal':
      return '季节推荐'
    default:
      break
  }

  // 备用逻辑：基于具体推荐原因
  if (bookmark.recommendationReason.length > 0) {
    const topReason = bookmark.recommendationReason[0]
    if (topReason) {
      return topReason.description
    }
  }

  // 最后的备用逻辑
  const score = bookmark.recommendationScore || 0
  const visitCount = bookmark.visitCount || 0

  if (visitCount > 10) return '常用书签'
  if (bookmark.recentVisitCount && bookmark.recentVisitCount > 0) return '最近使用'
  if (score > 50) return '高分推荐'
  if (bookmark.contextScore > 40) return '上下文相关'

  return '智能推荐'
}

function getReasonBadgeVariant(bookmark: SmartRecommendation): 'outlined' | 'soft' {
  const type = bookmark.recommendationType

  switch (type) {
    case 'frequent':
    case 'contextual':
      return 'soft'
    case 'recent':
    case 'temporal':
      return 'outlined'
    case 'similar':
    case 'trending':
    case 'seasonal':
      return 'soft'
    default:
      // 基于置信度决定
      return bookmark.confidence > 0.7 ? 'soft' : 'outlined'
  }
}

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname

    // 跳过chrome://favicon/，直接使用更可靠的方式
    // 原因：某些网站的favicon无法通过chrome://favicon/加载，会产生控制台错误

    // 方案1: 使用Google的favicon服务 (更稳定)
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
  } catch {
    return chrome.runtime?.getURL
      ? chrome.runtime.getURL('images/icon16.png')
      : '/favicon-16x16.png'
  }
}

/**
 * 处理图标加载错误 - ✅ 优化版 (简化错误处理)
 */
function handleFaviconError(event: Event, url: string) {
  const img = event.target as HTMLImageElement
  const bookmarkId = findBookmarkIdByUrl(url)

  if (bookmarkId) {
    faviconError.value[bookmarkId] = true
    faviconLoaded.value[bookmarkId] = false
  }

  // 如果Google favicon服务也失败了，尝试直接从域名获取
  if (!img.src.includes('/favicon.ico')) {
    try {
      const domain = new URL(url).hostname
      img.src = `https://${domain}/favicon.ico`
      return
    } catch {
      // 忽略错误，继续使用默认图标
    }
  }

  // 最后使用默认图标
  img.src = chrome.runtime?.getURL
    ? chrome.runtime.getURL('images/icon16.png')
    : '/favicon-16x16.png'
}

/**
 * 处理图标加载成功 - ✅ 新增
 */
function handleFaviconLoad(event: Event) {
  const img = event.target as HTMLImageElement
  // 从data属性或通过parent找到对应的书签
  const bookmarkElement = img.closest('.recommendation-item')
  if (bookmarkElement) {
    const bookmarkTitle = bookmarkElement.querySelector('.bookmark-title')?.textContent
    const bookmark = recommendations.value.find(b => b.title === bookmarkTitle)
    if (bookmark) {
      faviconLoaded.value[bookmark.id] = true
      faviconError.value[bookmark.id] = false
    }
  }
}

/**
 * 根据URL查找书签ID
 */
function findBookmarkIdByUrl(url: string): string | null {
  const bookmark = recommendations.value.find(b => b.url === url)
  return bookmark ? bookmark.id : null
}

/**
 * 初始化favicon状态 - ✅ 新增
 */
function initializeFaviconState(bookmarks: SmartRecommendation[]) {
  // 清理旧状态
  faviconLoaded.value = {}
  faviconError.value = {}

  // 为每个书签初始化状态
  bookmarks.forEach(bookmark => {
    faviconLoaded.value[bookmark.id] = false
    faviconError.value[bookmark.id] = false
  })
}

/**
 * 提取域名
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'Unknown'
  }
}

function showContextMenu(bookmark: SmartRecommendation) {
  logger.info('SmartRecommendation', '🖱️ 右键菜单', {
    id: bookmark.id,
    title: bookmark.title,
    type: bookmark.recommendationType,
    score: bookmark.recommendationScore,
    confidence: bookmark.confidence,
    reasons: bookmark.recommendationReason
  })

  // TODO: 实现智能推荐专属的右键菜单
  // 可以包括：
  // - 移除推荐
  // - 标记为不感兴趣
  // - 查看推荐详情
  // - 反馈推荐准确性
}

// 暴露方法给父组件
defineExpose({
  refreshRecommendations,
  loadMoreRecommendations
})
</script>

<template>
  <div v-if="recommendations.length > 0" class="smart-recommendations">
    <!-- 标题栏 -->
    <div class="recommendations-header">
      <div class="header-content">
        <LucideIcon name="sparkles" class="recommendation-icon" />
        <h3 class="recommendations-title">为您推荐</h3>
        <Chip variant="soft" size="sm">
          {{ recommendations.length }}
        </Chip>
      </div>
      <div class="header-actions">
        <Button
          variant="icon"
          :disabled="isRefreshing"
          class="refresh-button"
          title="刷新推荐"
          @click="refreshRecommendations"
        >
          <LucideIcon name="refresh-cw" :size="20" :class="{ 'icon-spin': isRefreshing }" />
        </Button>
      </div>
    </div>

    <!-- 推荐列表 -->
    <md-list class="recommendations-list">
      <md-list-item
        v-for="bookmark in recommendations"
        :key="bookmark.id"
        type="button"
        class="recommendation-item no-select"
        @click="openBookmark(bookmark, $event)"
        @contextmenu.prevent="showContextMenu(bookmark)"
      >
        <div slot="start" class="bookmark-favicon">
          <img
            :src="getFaviconUrl(bookmark.url!)"
            :alt="bookmark.title"
            class="favicon-image"
            :class="{ 'favicon-loading': !faviconLoaded[bookmark.id] }"
            @error="handleFaviconError($event, bookmark.url!)"
            @load="handleFaviconLoad"
          />
          <div v-if="faviconError[bookmark.id]" class="favicon-fallback">
            <LucideIcon name="link" :size="12" />
          </div>
        </div>
        <div slot="headline" class="bookmark-title" :title="bookmark.title">
          {{ bookmark.title }}
        </div>
        <div slot="supporting-text" class="bookmark-meta">
          <span class="bookmark-domain">
            {{ extractDomain(bookmark.url!) }}
          </span>
          <span v-if="showDebugInfo" class="recommendation-score">
            评分: {{ bookmark.recommendationScore?.toFixed(1) }}
          </span>
        </div>
        <div slot="end" class="recommendation-reason">
          <Chip :variant="getReasonBadgeVariant(bookmark)" size="sm">
            {{ getRecommendationReason(bookmark) }}
          </Chip>
        </div>

        <!-- 使用指示器 -->
        <div v-if="bookmark.visitCount && bookmark.visitCount > 0" class="usage-indicator">
          <div
            class="usage-bar"
            :style="{
              width: `${Math.min((bookmark.visitCount || 0) * 5, 100)}%`
            }"
            :title="`访问${bookmark.visitCount}次，置信度${(bookmark.confidence * 100).toFixed(1)}%`"
          ></div>
        </div>
      </md-list-item>
    </md-list>

    <!-- 更多推荐按钮 -->
    <div v-if="hasMoreRecommendations" class="recommendations-footer">
      <Button
        variant="outlined"
        :disabled="isLoadingMore"
        class="load-more-button"
        @click="loadMoreRecommendations"
      >
        查看更多推荐
      </Button>
    </div>
  </div>

  <!-- 空状态 -->
  <div v-else-if="!isLoading" class="recommendations-empty">
    <LucideIcon name="sparkles" class="empty-icon" />
    <p class="empty-text">暂无推荐书签</p>
    <p class="empty-hint">多使用书签，我们将为您提供个性化推荐</p>
  </div>

  <!-- 加载状态 -->
  <div v-else class="recommendations-loading">
    <Loading size="lg" text="正在分析您的书签使用模式..." />
  </div>
</template>

<style scoped>
@keyframes favicon-pulse {
  0%,
  100% {
    opacity: 0.6;
  }

  50% {
    opacity: 0.3;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.smart-recommendations {
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--spacing-sm);
  background: var(--color-surface);
}

.recommendations-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.recommendation-icon {
  color: var(--color-warning);
}

.recommendations-title {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.test-button,
.refresh-button {
  min-width: auto;
  padding: var(--spacing-1);
}

.test-button {
  color: var(--color-primary);
}

.recommendations-list {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.recommendation-item {
  position: relative;
  overflow: hidden;
}

.bookmark-favicon {
  position: relative;
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 16px;
  height: 16px;
}

.favicon-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-xs);
  transition: opacity var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.favicon-image.favicon-loading {
  opacity: 0.6;

  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: opacity;
  animation: favicon-pulse 1.5s ease-in-out infinite;
}

.favicon-fallback {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  color: var(--color-text-secondary);
  background: var(--color-background-soft);
}

.bookmark-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bookmark-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.bookmark-domain {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recommendation-score {
  padding: 1px var(--spacing-1);
  border-radius: var(--radius-sm);
  font-family: monospace;
  background: var(--color-background-muted);
}

.recommendation-reason {
  flex-shrink: 0;
}

.usage-indicator {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--color-background-muted);
}

.usage-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-success), var(--color-warning));
  transition: width var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard);
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
  --md-list-item-two-line-container-height: 64px;
  --md-list-item-hover-state-layer-color: var(--md-sys-color-on-surface);
  --md-list-item-hover-state-layer-opacity: 0.08;

  border-bottom: 1px solid var(--color-border);
}

.recommendations-list md-list-item:last-child {
  border-bottom: none;
}

.recommendations-footer {
  margin-top: var(--spacing-3);
  text-align: center;
}

.load-more-button {
  width: 100%;
}

.recommendations-empty {
  padding: var(--spacing-8) var(--spacing-4);
  text-align: center;
  color: var(--color-text-secondary);
}

.empty-icon {
  margin-bottom: var(--spacing-sm);
  opacity: 0.5;
}

/* 旋转动画 */
.icon-spin {
  animation: spin 1s linear infinite;
}

.empty-text {
  margin: 0 0 4px;
  font-weight: 500;
}

.empty-hint {
  margin: 0;
  font-size: var(--text-xs);
  opacity: 0.7;
}

.recommendations-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-6) var(--spacing-4);
  text-align: center;
}
</style>
