<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { LucideIcon } from '@/components'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import { logger } from '@/infrastructure/logging/logger'
import { onEvent } from '@/infrastructure/events/event-bus'
import { t } from '@/utils/i18n-helpers'
import { formatRecentVisitTime } from '@/utils/time-formatter'

defineOptions({
  name: 'RecentVisits'
})

const emit = defineEmits<{
  'bookmark-click': [bookmark: BookmarkRecord]
  'count-update': [count: number]
}>()

const recentVisits = ref<BookmarkRecord[]>([])
const faviconErrors = ref<Set<string>>(new Set())

const loadRecentVisits = async () => {
  try {
    recentVisits.value = await indexedDBManager.getRecentVisits(5)
    emit('count-update', recentVisits.value.length)
    logger.info('RecentVisits', '📊 加载最近访问', recentVisits.value.length)
  } catch (error) {
    logger.error('RecentVisits', '❌ 加载最近访问失败', error)
  }
}

/**
 * 获取 favicon URL
 */
const getFaviconUrl = (bookmark: BookmarkRecord): string | undefined => {
  if (faviconErrors.value.has(bookmark.id)) {
    return undefined
  }
  if (!bookmark.url) {
    return undefined
  }
  try {
    const domain = new URL(bookmark.url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
  } catch {
    return undefined
  }
}

/**
 * 处理 favicon 加载错误
 */
const handleFaviconError = (bookmarkId: string) => {
  faviconErrors.value.add(bookmarkId)
}

onMounted(loadRecentVisits)

// 监听书签访问事件，自动刷新列表
const unsubscribe = onEvent('bookmark:visited', () => {
  logger.debug('RecentVisits', '🔄 收到书签访问事件，刷新列表')
  loadRecentVisits()
})

onUnmounted(() => {
  unsubscribe()
  if (stopWatch) {
    stopWatch()
  }
})

// 监听数据变化，自动更新数量
const stopWatch = watch(() => recentVisits.value.length, (newCount) => {
  emit('count-update', newCount)
})

const handleClick = (bookmark: BookmarkRecord) => {
  logger.info('RecentVisits', '🔗 点击最近访问', bookmark.title)
  emit('bookmark-click', bookmark)
}

// 暴露方法供父组件调用
defineExpose({
  loadRecentVisits
})
</script>

<template>
  <div class="recent-visits">
    <div v-if="recentVisits.length === 0" class="empty-state">
      <LucideIcon name="clock" :size="20" />
      <span>{{ t('sidepanel_recent_empty') }}</span>
    </div>
    <md-list v-else class="recent-list">
      <md-list-item
        v-for="bookmark in recentVisits"
        :key="bookmark.id"
        type="button"
        @click="handleClick(bookmark)"
      >
        <div slot="start" class="recent-favicon">
          <img
            v-if="getFaviconUrl(bookmark)"
            :src="getFaviconUrl(bookmark)"
            alt="favicon"
            loading="lazy"
            @error="() => handleFaviconError(bookmark.id)"
          />
          <LucideIcon v-else name="bookmark" :size="16" />
        </div>
        <div slot="headline">{{ bookmark.title }}</div>
        <div slot="supporting-text">{{ formatRecentVisitTime(bookmark.lastVisited) }}</div>
      </md-list-item>
    </md-list>
  </div>
</template>

<style scoped>
.recent-visits {
  width: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-6) var(--spacing-4);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* Material Web List 样式 */
.recent-list {
  border-radius: var(--radius-md);
  overflow: hidden;
}

.recent-favicon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 16px;
  height: 16px;
}

.recent-favicon img {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-xs);
}
</style>
