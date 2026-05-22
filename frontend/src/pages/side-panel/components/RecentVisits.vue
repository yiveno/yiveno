<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { LucideIcon, EmptyState } from '@/components'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import { logger } from '@/infrastructure/logging/logger'
import { onEvent } from '@/infrastructure/events/event-bus'
import { formatRecentVisitTime, formatFullDateTime } from '@/utils/time-formatter'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

defineOptions({
  name: 'RecentVisits'
})

const emit = defineEmits<{
  'bookmark-click': [bookmark: BookmarkRecord]
  'count-update': [count: number]
  'bookmark-remove': [bookmark: BookmarkRecord]
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
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
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

/**
 * 处理清除访问记录
 * @description 清除单条书签的访问记录（删除 lastVisited 和 visitCount 字段）
 */
const handleRemove = async (bookmark: BookmarkRecord) => {
  logger.info('RecentVisits', '🗑️ 清除访问记录', bookmark.title)
  
  try {
    // 获取完整的书签记录
    const existingBookmark = await indexedDBManager.getBookmarkById(bookmark.id)
    if (!existingBookmark) {
      logger.error('RecentVisits', '❌ 书签不存在', bookmark.id)
      return
    }
    
    // 创建新的书签对象，删除访问记录字段
    const updatedBookmark: BookmarkRecord = {
      ...existingBookmark
    }
    
    // 删除访问记录字段
    delete updatedBookmark.lastVisited
    delete updatedBookmark.visitCount
    
    // 直接调用 IndexedDBManager 更新
    await indexedDBManager.updateBookmark(updatedBookmark)
    
    // 从列表中移除
    recentVisits.value = recentVisits.value.filter(b => b.id !== bookmark.id)
    
    // 更新数量
    emit('count-update', recentVisits.value.length)
    
    // 通知父组件
    emit('bookmark-remove', bookmark)
    
    logger.debug('RecentVisits', '✅ 访问记录已清除')
  } catch (error) {
    logger.error('RecentVisits', '❌ 清除访问记录失败', error)
  }
}

// 暴露方法供父组件调用
defineExpose({
  loadRecentVisits
})
</script>

<template>
  <div class="recent-visits">
    <!-- 空状态 -->
    <EmptyState
      v-if="recentVisits.length === 0"
      icon="clock"
      title="暂无最近访问"
      :icon-size="32"
    />
    
    <!-- 最近访问列表 -->
    <md-list v-else class="recent-list">
      <md-list-item
        v-for="bookmark in recentVisits"
        :key="bookmark.id"
        type="button"
        class="recent-list-item"
        :title="`${bookmark.title}\n${formatFullDateTime(bookmark.lastVisited)}`"
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
          <LucideIcon v-else name="bookmark" :size="32" />
        </div>
        
        <div slot="headline" class="headline-text">{{ bookmark.title }}</div>
        <div slot="supporting-text" class="supporting-text">{{ formatRecentVisitTime(bookmark.lastVisited) }}</div>
        
        <md-icon-button
          slot="end"
          class="remove-button"
          title="清除访问记录"
          @click.stop="handleRemove(bookmark)"
        >
          <LucideIcon name="x" :size="16" />
        </md-icon-button>
      </md-list-item>
    </md-list>
  </div>
</template>

<style scoped>
.recent-visits {
  width: 100%;
}

/* Material Web List 样式 */
.recent-list {
  border-radius: var(--radius-md);
  overflow: hidden;
}

/* 列表项样式 */
.recent-list-item {
  position: relative;
  border-bottom: 1px solid var(--color-border);
}

/* 最后一项不显示分隔线 */
.recent-list-item:last-child {
  border-bottom: none;
}

/* 清除按钮：默认隐藏 */
.recent-list-item .remove-button {
  opacity: 0;
  transition: opacity var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

/* hover 时显示清除按钮 */
.recent-list-item:hover .remove-button {
  opacity: 1;
}

/* 标题样式：单行显示，超出省略 */
.headline-text {
  display: block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 时间样式：单行显示 */
.supporting-text {
  display: block;
  white-space: nowrap;
}

.recent-favicon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 32px;
  height: 32px;
}

.recent-favicon img {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
}
</style>
