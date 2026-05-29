<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted, ref } from "vue";
import { useBookmarkStore } from "@/stores/bookmarkStore";
import { favoriteAppService } from "@/application/bookmark/favorite-app-service";
import { logger } from "@/infrastructure/logging/logger";
import { LucideIcon, EmptyState } from "@/components";
import type { BookmarkNode } from "@/types";

defineOptions({
  name: "FavoriteSection",
});

const emit = defineEmits<{
  /** 点击书签 */
  (e: "bookmarkClick", bookmark: BookmarkNode): void;
  /** 移除收藏 */
  (e: "bookmarkRemove", bookmark: BookmarkNode): void;
  /** 分享收藏书签 */
  (e: "share", bookmarks: BookmarkNode[]): void;
  /** 数量更新 */
  (e: "countUpdate", count: number): void;
}>();

// ✅ 从 Pinia Store 派生数据，响应式更新
const bookmarkStore = useBookmarkStore();
const favorites = computed(() => bookmarkStore.favoriteBookmarks);
const faviconErrors = ref<Set<string>>(new Set());

// 组件挂载时立即发送数量
onMounted(() => {
  emit("countUpdate", favorites.value.length);
});

// 监听数量变化，自动更新
const stopWatch = watch(
  () => favorites.value.length,
  (newCount) => {
    emit("countUpdate", newCount);
  },
);

// 组件卸载时清理 watch
onUnmounted(() => {
  if (stopWatch) {
    stopWatch();
  }
});

/**
 * 获取 favicon URL
 */
const getFaviconUrl = (bookmark: BookmarkNode): string | undefined => {
  if (!bookmark.url || faviconErrors.value.has(bookmark.id)) {
    return undefined;
  }
  try {
    const domain = new URL(bookmark.url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return undefined;
  }
};

/**
 * 格式化收藏时间
 */
const formatFavoriteTime = (timestamp: number | undefined): string => {
  if (!timestamp) return "未知时间";

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "今天收藏";
  } else if (diffDays === 1) {
    return "昨天收藏";
  } else if (diffDays < 7) {
    return `${diffDays}天前收藏`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}周前收藏`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months}个月前收藏`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years}年前收藏`;
  }
};

/**
 * 格式化完整的收藏时间（用于 tooltip）
 */
const formatFullFavoriteTime = (timestamp: number | undefined): string => {
  if (!timestamp) return "未知时间";

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;
};

/**
 * 处理 favicon 加载错误
 */
const handleFaviconError = (bookmarkId: string) => {
  faviconErrors.value.add(bookmarkId);
};

// === 事件处理 ===

function handleClick(bookmark: BookmarkNode) {
  logger.info("FavoriteSection", "🔗 点击收藏书签:", bookmark.title);
  emit("bookmarkClick", bookmark);
}

async function handleRemove(bookmark: BookmarkNode) {
  logger.info("FavoriteSection", "🗑️ 移除收藏:", bookmark.title);

  const success = await favoriteAppService.removeFromFavorites(bookmark.id);
  if (success) {
    // ✅ 直接更新 store，UI 自动响应式更新
    bookmarkStore.updateNode(bookmark.id, { isFavorite: false });
    emit("bookmarkRemove", bookmark);
  }
}
</script>

<template>
  <!-- 收藏列表 -->
  <section class="favorite-section">
    <!-- 空状态 -->
    <EmptyState
      v-if="favorites.length === 0"
      icon="star"
      title="暂无收藏书签"
      :icon-size="32"
    />

    <!-- 收藏列表 -->
    <md-list v-else class="favorite-section__list">
      <md-list-item
        v-for="favorite in favorites"
        :key="favorite.id"
        type="button"
        :title="`${favorite.title}\n收藏时间：${formatFullFavoriteTime(favorite.favoritedAt)}`"
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
          <LucideIcon v-else name="bookmark" :size="32" />
        </div>
        <div slot="headline" class="headline-text">{{ favorite.title }}</div>
        <div slot="supporting-text" class="supporting-text">
          {{ formatFavoriteTime(favorite.favoritedAt) }}
        </div>
        <md-icon-button
          slot="end"
          title="取消收藏"
          @click.stop="handleRemove(favorite)"
        >
          <LucideIcon name="star" :size="16" fill="currentColor" />
        </md-icon-button>
      </md-list-item>
    </md-list>
  </section>
</template>

<style scoped >
.favorite-section {
  display: flex;
  flex-direction: column;
}

.favorite-section__list {
  max-height: 300px;
  border-radius: var(--radius-md);
  overflow: hidden auto;
}

/* 列表项添加分隔线 */
.favorite-section__list md-list-item {
  border-bottom: 1px solid var(--color-border);
}

/* 最后一项不显示分隔线 */
.favorite-section__list md-list-item:last-child {
  border-bottom: none;
}

/* 标题样式：单行显示，超出省略 */
.headline-text {
  display: block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 收藏时间样式：单行显示 */
.supporting-text {
  display: block;
  white-space: nowrap;
}

.favorite-favicon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 32px;
  height: 32px;
}

.favorite-favicon img {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
}
</style>
