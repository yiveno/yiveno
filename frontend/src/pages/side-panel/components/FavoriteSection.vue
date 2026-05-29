<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { favoriteAppService } from '@/application/bookmark/favorite-app-service'
import { LucideIcon, EmptyState, Button } from '@/components'
import type { BookmarkNode } from '@/types'

defineOptions({ name: 'FavoriteSection' })

const emit = defineEmits<{
  (e: 'bookmarkClick', bookmark: BookmarkNode): void
  (e: 'bookmarkRemove', bookmark: BookmarkNode): void
  (e: 'share', bookmarks: BookmarkNode[]): void
}>()

const bookmarkStore = useBookmarkStore()
const favorites = computed(() => bookmarkStore.favoriteBookmarks)
const faviconErrors = ref(new Set<string>())

const getFaviconUrl = (bookmark: BookmarkNode): string | undefined => {
  if (!bookmark.url || faviconErrors.value.has(bookmark.id)) return
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=32`
  } catch {
    return
  }
}

const formatFavoriteTime = (ts: number | undefined): string => {
  if (!ts) return '未知时间'
  const diffDays = Math.floor((Date.now() - ts) / 86400000)
  if (diffDays === 0) return '今天收藏'
  if (diffDays === 1) return '昨天收藏'
  if (diffDays < 7) return `${diffDays}天前收藏`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前收藏`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前收藏`
  return `${Math.floor(diffDays / 365)}年前收藏`
}

const formatFullTime = (ts: number | undefined): string => {
  if (!ts) return '未知时间'
  const d = new Date(ts)
  return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function handleClick(bookmark: BookmarkNode) {
  emit('bookmarkClick', bookmark)
}

async function handleRemove(bookmark: BookmarkNode) {
  const ok = await favoriteAppService.removeFromFavorites(bookmark.id)
  if (ok) {
    bookmarkStore.updateNode(bookmark.id, { isFavorite: false })
    emit('bookmarkRemove', bookmark)
  }
}
</script>

<template>
  <section class="favorite-section">
    <EmptyState v-if="favorites.length === 0" icon="star" title="暂无收藏书签" ::icon-size="32" />
    <md-list v-else class="list">
      <md-list-item
        v-for="f in favorites"
        :key="f.id"
        type="button"
        :title="`${f.title}\n收藏时间：${formatFullTime(f.favoritedAt)}`"
        @click="handleClick(f)"
      >
        <div slot="start" class="favicon">
          <img
            v-if="getFaviconUrl(f)"
            :src="getFaviconUrl(f)"
            alt=""
            loading="lazy"
            @error="faviconErrors.add(f.id)"
          />
          <LucideIcon v-else name="bookmark" :size="32" />
        </div>
        <div slot="headline" class="headline">{{ f.title }}</div>
        <div slot="supporting-text" class="sub">{{ formatFavoriteTime(f.favoritedAt) }}</div>
        <Button slot="end" variant="icon" title="取消收藏" @click.stop="handleRemove(f)">
          <LucideIcon name="star" :size="16" fill="currentColor" />
        </Button>
      </md-list-item>
    </md-list>
  </section>
</template>

<style scoped>
.favorite-section {
  display: flex;
  flex-direction: column;
}

.list {
  max-height: 300px;
  border-radius: var(--radius-md);
  overflow: hidden auto;
}

.list :deep(md-list-item) {
  border-bottom: 1px solid var(--color-border);
}

.list :deep(md-list-item:last-child) {
  border-bottom: none;
}

.headline {
  display: block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub {
  display: block;
  white-space: nowrap;
}

.favicon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 32px;
  height: 32px;
}

.favicon img {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
}
</style>
