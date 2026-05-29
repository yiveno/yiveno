<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { LucideIcon, EmptyState } from '@/components'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import { logger } from '@/infrastructure/logging/logger'
import { onEvent } from '@/infrastructure/events/event-bus'
import { formatRecentVisitTime, formatFullDateTime } from '@/utils/time-formatter'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

defineOptions({ name: 'RecentVisits' })

const emit = defineEmits<{
  (e: 'bookmarkClick', bookmark: BookmarkRecord): void
  (e: 'countUpdate', count: number): void
  (e: 'bookmarkRemove', bookmark: BookmarkRecord): void
}>()

const recentVisits = ref<BookmarkRecord[]>([])
const faviconErrors = ref(new Set<string>())

async function load() {
  try {
    recentVisits.value = await indexedDBManager.getRecentVisits(5)
  } catch (error) {
    logger.error('RecentVisits', '加载失败', error)
  }
}

const getFaviconUrl = (b: BookmarkRecord) => {
  if (faviconErrors.value.has(b.id) || !b.url) return
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(b.url).hostname}&sz=32`
  } catch {
    return
  }
}

onMounted(load)
const unsub = onEvent('bookmark:visited', () => load())
watch(
  () => recentVisits.value.length,
  n => emit('countUpdate', n),
  { immediate: true }
)
onUnmounted(() => unsub())

function handleClick(b: BookmarkRecord) {
  emit('bookmarkClick', b)
}

async function handleRemove(b: BookmarkRecord) {
  try {
    const existing = await indexedDBManager.getBookmarkById(b.id)
    if (!existing) return
    const updated = { ...existing }
    delete updated.lastVisited
    delete updated.visitCount
    await indexedDBManager.updateBookmark(updated)
    recentVisits.value = recentVisits.value.filter(v => v.id !== b.id)
    emit('bookmarkRemove', b)
  } catch (error) {
    logger.error('RecentVisits', '清除失败', error)
  }
}

defineExpose({ loadRecentVisits: load })
</script>

<template>
  <div class="recent-visits">
    <EmptyState
      v-if="recentVisits.length === 0"
      icon="clock"
      title="暂无最近访问"
      :icon-size="32"
    />
    <md-list v-else class="list">
      <md-list-item
        v-for="b in recentVisits"
        :key="b.id"
        type="button"
        class="item"
        :title="`${b.title}\n${formatFullDateTime(b.lastVisited)}`"
        @click="handleClick(b)"
      >
        <div slot="start" class="favicon">
          <img
            v-if="getFaviconUrl(b)"
            :src="getFaviconUrl(b)"
            alt=""
            loading="lazy"
            @error="faviconErrors.add(b.id)"
          />
          <LucideIcon v-else name="bookmark" :size="32" />
        </div>
        <div slot="headline" class="headline">{{ b.title }}</div>
        <div slot="supporting-text" class="sub">{{ formatRecentVisitTime(b.lastVisited) }}</div>
        <md-icon-button
          slot="end"
          class="rm-btn"
          title="清除访问记录"
          @click.stop="handleRemove(b)"
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

.list {
  border-radius: var(--radius-md);
  overflow: hidden;
}

.item {
  border-bottom: 1px solid var(--color-border);
}

.item:last-child {
  border-bottom: none;
}

.item .rm-btn {
  opacity: 0;
  transition: opacity 0.2s;
}

.item:hover .rm-btn {
  opacity: 1;
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
