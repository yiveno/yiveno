<!--
  SkeletonTree 树形骨架屏组件
  
  用于显示树形结构加载状态的骨架屏
  适用于书签树、文件夹树等场景
  
  特性：
  - 模拟真实树形结构的布局
  - 支持多层级缩进
  - 支持自定义节点数量、高度、间距
  - 符合 Material Design 3 规范
-->
<script setup lang="ts">
import { computed } from 'vue'
import Skeleton from './Skeleton.vue'
import type { SkeletonTreeProps } from './SkeletonTree.d'

defineOptions({ name: 'SkeletonTree' })

const props = withDefaults(defineProps<SkeletonTreeProps>(), {
  count: 5,
  nodeHeight: '36px',
  gap: 'sm',
  showIcon: true,
  iconSize: 20,
  showIndent: true,
  indentWidth: 24,
  animation: 'none'
})

/**
 * 生成树节点数组（包含随机层级）
 */
const nodes = computed(() => {
  const result: Array<{ index: number; level: number }> = []

  for (let i = 0; i < props.count; i++) {
    // 随机生成层级（0-2 层）
    // 第一个节点总是根节点（level 0）
    const level = i === 0 ? 0 : Math.floor(Math.random() * 3)
    result.push({ index: i, level })
  }

  return result
})

/**
 * 计算树容器样式
 */
const treeStyles = computed(() => {
  const gapMap = {
    none: '0',
    sm: 'var(--spacing-1)',
    md: 'var(--spacing-2)',
    lg: 'var(--spacing-3)'
  }

  return {
    gap: gapMap[props.gap]
  }
})

/**
 * 计算树节点样式
 */
const nodeStyles = computed(() => ({
  height: typeof props.nodeHeight === 'number' ? `${props.nodeHeight}px` : props.nodeHeight
}))

/**
 * 计算节点缩进样式
 */
const getNodeIndentStyle = (level: number) => {
  if (!props.showIndent) return {}

  return {
    paddingLeft: `${level * props.indentWidth}px`
  }
}
</script>

<template>
  <div class="skeleton-tree" :style="treeStyles">
    <div
      v-for="node in nodes"
      :key="node.index"
      class="skeleton-tree__node"
      :style="{ ...nodeStyles, ...getNodeIndentStyle(node.level) }"
    >
      <!-- 图标 -->
      <Skeleton
        v-if="showIcon"
        variant="circular"
        :width="iconSize"
        :height="iconSize"
        :animation="animation"
        class="skeleton-tree__icon"
      />

      <!-- 节点标题 -->
      <Skeleton
        variant="text"
        :width="`${40 + Math.random() * 40}%`"
        :animation="animation"
        class="skeleton-tree__title"
      />
    </div>
  </div>
</template>

<style scoped>
/* ========== 树容器 ========== */
.skeleton-tree {
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* ========== 树节点 ========== */
.skeleton-tree__node {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm); /* ✅ 与真实节点一致 */
  min-height: var(--item-height, 32px); /* ✅ 与真实节点一致 */
  padding: 0 var(--spacing-sm); /* ✅ 与真实节点一致 */

  /* 使用 Material Design 3 的 surface 颜色 */
  background-color: var(--md-sys-color-surface);

  /* 过渡动画（用于缩进变化） */
  transition: padding-left var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

/* ========== 图标 ========== */
.skeleton-tree__icon {
  flex-shrink: 0;
}

/* ========== 节点标题 ========== */
.skeleton-tree__title {
  flex: 1;

  /* 标题样式由 Skeleton 组件控制 */
}
</style>
