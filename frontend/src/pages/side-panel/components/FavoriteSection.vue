<template>
  <!-- 收藏列表 -->
  <section v-if="favorites.length > 0" class="favorite-section">
    <md-list class="favorite-section__list">
      <md-list-item
        v-for="favorite in favorites"
        :key="favorite.id"
        type="button"
        @click="handleClick(favorite)"
      >
        <div slot="start" class="favorite-favicon">
          <img
            v-if="getFaviconUrl(favorite)"
            :src="getFaviconUrl(favorite)"
            alt="favicon"
            loading="lazy"
            @error="() => handleFaviconError(favorite.id)"
          />
          <LucideIcon v-else name="bookmark" :size="16" />
        </div>
        <div slot="headline">{{ favorite.title }}</div>
        <md-icon-button
          slot="end"
          title="取消收藏"
          @click.stop="handleRemove(favorite)"
        >
          <LucideIcon name="star" :size="16" />
        </md-icon-button>
      </md-list-item>
    </md-list>
  </section>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted, ref } from 'vue'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { favoriteAppService } from '@/application/bookmark/favorite-app-service'
import { logger } from '@/infrastructure/logging/logger'
import { LucideIcon } from '@/components'
import type { BookmarkNode } from '@/types'

// 导入 Material Web Components
import '@material/web/list/list.js'
import '@material/web/list/list-item.js'
import '@material/web/iconbutton/icon-button.js'

defineOptions({
  name: 'FavoriteSection'
})

const emit = defineEmits<{
  /** 点击书签 */
  'bookmark-click': [bookmark: BookmarkNode]
  /** 移除收藏 */
  'bookmark-remove': [bookmark: BookmarkNode]
  /** 分享收藏书签 */
  'share': [bookmarks: BookmarkNode[]]
  /** 数量更新 */
  'count-update': [count: number]
}>()

// ✅ 从 Pinia Store 派生数据，响应式更新
const bookmarkStore = useBookmarkStore()
const favorites = computed(() => bookmarkStore.favoriteBookmarks)
const faviconErrors = ref<Set<string>>(new Set())

// 组件挂载时立即发送数量
onMounted(() => {
  emit('count-update', favorites.value.length)
})

// 监听数量变化，自动更新
const stopWatch = watch(() => favorites.value.length, (newCount) => {
  emit('count-update', newCount)
})

// 组件卸载时清理 watch
onUnmounted(() => {
  if (stopWatch) {
    stopWatch()
  }
})

/**
 * 获取 favicon URL
 */
const getFaviconUrl = (bookmark: BookmarkNode): string | undefined => {
  if (!bookmark.url || faviconErrors.value.has(bookmark.id)) {
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

// === 事件处理 ===

function handleClick(bookmark: BookmarkNode) {
  logger.info('FavoriteSection', '🔗 点击收藏书签:', bookmark.title)
  emit('bookmark-click', bookmark)
}

async function handleRemove(bookmark: BookmarkNode) {
  logger.info('FavoriteSection', '🗑️ 移除收藏:', bookmark.title)

  const success = await favoriteAppService.removeFromFavorites(bookmark.id)
  if (success) {
    // ✅ 直接更新 store，UI 自动响应式更新
    bookmarkStore.updateNode(bookmark.id, { isFavorite: false })
    emit('bookmark-remove', bookmark)
  }
}
</script>

<style scoped lang="scss">
.favorite-section {
  display: flex;
  flex-direction: column;
}

.favorite-section__list {
  max-height: 300px;
  border-radius: var(--radius-md);
  overflow: hidden auto;
}

.favorite-favicon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 16px;
  height: 16px;
}

.favorite-favicon img {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-xs);
}
</style>
