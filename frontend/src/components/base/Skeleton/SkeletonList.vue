<!--
  SkeletonList 列表骨架屏组件
  
  用于显示列表加载状态的骨架屏
  适用于通知列表、搜索结果列表、书签列表等场景
  
  特性：
  - 模拟真实列表项的布局结构
  - 支持自定义项数量、高度、间距
  - 支持显示/隐藏头像、次要文本、操作按钮
  - 符合 Material Design 3 规范
-->
<script setup lang="ts">
import { computed } from 'vue'
import Skeleton from './Skeleton.vue'
import type { SkeletonListProps } from './SkeletonList.d'

defineOptions({ name: 'SkeletonList' })

const props = withDefaults(defineProps<SkeletonListProps>(), {
  count: 3,
  itemHeight: '56px', // ✅ 改为 56px，与通知列表一致
  gap: 'none', // ✅ 改为 none，因为使用 border-bottom 分隔
  showAvatar: true,
  avatarSize: 32, // ✅ 改为 32，与通知列表一致
  showSecondary: true,
  showActions: false,
  animation: 'pulse'
})

/**
 * 生成骨架屏项数组
 */
const items = computed(() => Array.from({ length: props.count }, (_, i) => i))

/**
 * 计算列表容器样式
 */
const listStyles = computed(() => {
  const gapMap = {
    none: '0',
    sm: 'var(--spacing-2)',
    md: 'var(--spacing-3)',
    lg: 'var(--spacing-4)'
  }

  return {
    gap: gapMap[props.gap]
  }
})

/**
 * 计算列表项样式
 */
const itemStyles = computed(() => ({
  height: typeof props.itemHeight === 'number' ? `${props.itemHeight}px` : props.itemHeight
}))
</script>

<template>
  <div class="skeleton-list" :style="listStyles">
    <div v-for="index in items" :key="index" class="skeleton-list__item" :style="itemStyles">
      <!-- 头像/图标 -->
      <Skeleton
        v-if="showAvatar"
        variant="circular"
        :width="avatarSize"
        :height="avatarSize"
        :animation="animation"
        class="skeleton-list__avatar"
      />

      <!-- 内容区域 -->
      <div class="skeleton-list__content">
        <!-- 标题行（包含标题和时间） -->
        <div class="skeleton-list__header">
          <!-- 主标题 -->
          <Skeleton
            variant="text"
            :width="`${50 + Math.random() * 20}%`"
            :animation="animation"
            class="skeleton-list__title"
          />

          <!-- 时间标签 -->
          <Skeleton
            variant="text"
            width="60px"
            :animation="animation"
            class="skeleton-list__time"
          />
        </div>

        <!-- 次要文本（副标题/消息内容） -->
        <Skeleton
          v-if="showSecondary"
          variant="text"
          :width="`${70 + Math.random() * 20}%`"
          :animation="animation"
          class="skeleton-list__secondary"
        />
      </div>

      <!-- 操作按钮区域 -->
      <div v-if="showActions" class="skeleton-list__actions">
        <Skeleton
          variant="circular"
          :width="24"
          :height="24"
          :animation="animation"
          class="skeleton-list__action-btn"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ========== 列表容器 ========== */
.skeleton-list {
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* ========== 列表项 ========== */
.skeleton-list__item {
  display: flex;
  align-items: center; /* ✅ 改为 center，与通知列表一致 */
  gap: var(--spacing-sm); /* ✅ 改为 sm，与通知列表一致 */
  min-height: 56px; /* ✅ 设置最小高度，与通知列表一致 */
  padding: var(--spacing-2) var(--spacing-sm); /* ✅ 调整内边距，与通知列表一致 */

  /* ✅ 移除 border-radius，添加底部边框，与真实数据一致 */
  border-bottom: 1px solid var(--color-border-subtle);

  /* 使用 Material Design 3 的 surface 颜色 */
  background-color: var(--md-sys-color-surface);
}

/* ✅ 最后一项不显示底部边框 */
.skeleton-list__item:last-child {
  border-bottom: none;
}

/* ========== 头像/图标 ========== */
.skeleton-list__avatar {
  flex-shrink: 0;
}

/* ========== 内容区域 ========== */
.skeleton-list__content {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--spacing-0-5); /* ✅ 改为 spacing-0-5，与通知列表一致 */
  min-width: 0; /* 防止内容溢出 */
}

/* ✅ 标题行（标题 + 时间） */
.skeleton-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-2);
}

.skeleton-list__title {
  /* 主标题样式由 Skeleton 组件控制 */
}

/* ✅ 时间标签 */
.skeleton-list__time {
  flex-shrink: 0;
}

.skeleton-list__secondary {
  /* 次要文本样式由 Skeleton 组件控制 */
}

/* ========== 操作按钮区域 ========== */
.skeleton-list__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--spacing-2);
}

.skeleton-list__action-btn {
  /* 操作按钮样式由 Skeleton 组件控制 */
}
</style>
