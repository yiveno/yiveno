<script setup lang="ts">
import { computed, ref } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import type { BookmarkNode } from "@/types";
import TreeNode from "./TreeNode.vue";

interface Props {
  chunk: {
    parentId: string;
    items: BookmarkNode[];
  };
  level: number;
  expandedFolders: Set<string>;
  selectedNodes: Set<string>;
  selectedDescCounts?: Map<string, number> | undefined;
  searchQuery: string;
  highlightMatches: boolean;
  config: Record<string, unknown>;
  strictOrder: boolean;
  activeId?: string | null | undefined;
  focusedId?: string | null | undefined;
  loadingMoreFolders: Set<string>;
  size: "compact" | "comfortable" | "spacious";
}

const props = defineProps<Props>();

const containerRef = ref<HTMLElement | null>(null);

const itemHeightMap: Record<"compact" | "comfortable" | "spacious", number> = {
  compact: 30,
  comfortable: 36,
  spacious: 44,
};

const items = computed(() => props.chunk.items);

const virtualizer = useVirtualizer(
  computed(() => ({
    count: items.value.length,
    getScrollElement: () => containerRef.value,
    estimateSize: () => itemHeightMap[props.size],
    overscan: 20,
  })),
);

const totalHeight = computed(() => virtualizer.value.getTotalSize());

const virtualRows = computed(() => {
  const rows: Array<{
    id: string;
    node?: BookmarkNode;
    start: number;
    size: number;
  }> = [];
  const virtualItems = virtualizer.value.getVirtualItems();
  for (const item of virtualItems) {
    const node = items.value[item.index];
    if (!node) continue;
    rows.push({
      id: `${props.chunk.parentId}-${node.id}-chunk-${item.index}`,
      node,
      start: item.start,
      size: item.size,
    });
  }
  return rows;
});
</script>

<template>
  <div ref="containerRef" class="virtual-folder-list">
    <div class="virtual-spacer" :style="{ height: `${totalHeight}px` }">
      <div
        v-for="row in virtualRows"
        :key="row.id"
        class="virtual-item"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${row.size}px`,
          transform: `translateY(${row.start}px)`,
        }"
      >
        <TreeNode
          v-if="row.node"
          :node="row.node"
          :level="level + 1"
          :expanded-folders="expandedFolders"
          :selected-nodes="selectedNodes"
          :selected-desc-counts="selectedDescCounts"
          :search-query="searchQuery"
          :highlight-matches="highlightMatches"
          :config="config"
          :is-virtual-mode="true"
          :strict-order="strictOrder"
          :active-id="activeId"
          :focused-id="focusedId"
          :loading-more-folders="loadingMoreFolders"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.virtual-folder-list {
  position: relative;
  max-height: calc(var(--item-height, 36px) * 400);
  overflow-y: auto;
}

.virtual-spacer {
  position: relative;
  width: 100%;
}
</style>
