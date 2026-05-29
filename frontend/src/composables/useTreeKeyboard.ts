/**
 * 树形结构键盘导航
 *
 * 提供类似 VSCode 文件树的键盘导航体验
 */
import { type Ref, watch } from "vue";
import { useKeyboard } from "./useKeyboard";
import type { BookmarkNode } from "@/types/domain/bookmark";

/**
 * 树形导航选项
 */
export interface TreeKeyboardOptions {
  /** 当前选中的节点 ID */
  selectedId: Ref<string | null>;
  /** 所有可见的节点列表（扁平化） */
  visibleNodes: Ref<BookmarkNode[]>;
  /** 展开的文件夹 ID 集合 */
  expandedFolders: Ref<Set<string>>;
  /** 是否启用（默认 true） */
  enabled?: Ref<boolean>;
}

/**
 * 树形导航回调
 */
export interface TreeKeyboardCallbacks {
  /** 选中节点 */
  onSelect: (nodeId: string) => void;
  /** 展开/折叠文件夹 */
  onToggleFolder: (nodeId: string) => void;
  /** 打开书签 */
  onOpen: (nodeId: string) => void;
  /** 编辑节点 */
  onEdit?: (nodeId: string) => void;
  /** 删除节点 */
  onDelete?: (nodeId: string) => void;
  /** 复制节点 */
  onCopy?: (nodeId: string) => void;
}

/**
 * 树形结构键盘导航
 *
 * 提供完整的键盘导航体验：
 * - ↑/↓: 上下移动
 * - ←/→: 折叠/展开文件夹
 * - Enter: 打开书签或切换文件夹
 * - F2: 重命名
 * - Delete: 删除
 * - Ctrl+C: 复制
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { ref } from 'vue'
 * import { useTreeKeyboard } from '@/composables/useTreeKeyboard'
 *
 * const selectedId = ref<string | null>(null)
 * const visibleNodes = ref<BookmarkNode[]>([...])
 * const expandedFolders = ref(new Set<string>())
 *
 * useTreeKeyboard(
 *   {
 *     selectedId,
 *     visibleNodes,
 *     expandedFolders
 *   },
 *   {
 *     onSelect: (id) => { selectedId.value = id },
 *     onToggleFolder: (id) => { ... },
 *     onOpen: (id) => { ... }
 *   }
 * )
 * </script>
 * ```
 */
export function useTreeKeyboard(
  options: TreeKeyboardOptions,
  callbacks: TreeKeyboardCallbacks,
) {
  const { selectedId, visibleNodes, expandedFolders, enabled } = options;

  const { register } = useKeyboard({
    enabled,
  });

  /**
   * 获取当前选中节点的索引
   */
  function getSelectedIndex(): number {
    if (!selectedId.value) return -1;
    return visibleNodes.value.findIndex((node) => node.id === selectedId.value);
  }

  /**
   * 获取当前选中的节点
   */
  function getSelectedNode(): BookmarkNode | null {
    if (!selectedId.value) return null;
    return (
      visibleNodes.value.find((node) => node.id === selectedId.value) || null
    );
  }

  /**
   * 选中指定索引的节点
   */
  function selectByIndex(index: number) {
    if (index >= 0 && index < visibleNodes.value.length) {
      const node = visibleNodes.value[index];
      if (node) {
        callbacks.onSelect(node.id);
      }
    }
  }

  // ↑ - 向上移动
  register({
    key: "arrowup",
    handler: () => {
      const currentIndex = getSelectedIndex();
      if (currentIndex > 0) {
        selectByIndex(currentIndex - 1);
      }
    },
    description: "选择上一个节点",
  });

  // ↓ - 向下移动
  register({
    key: "arrowdown",
    handler: () => {
      const currentIndex = getSelectedIndex();
      if (currentIndex < visibleNodes.value.length - 1) {
        selectByIndex(currentIndex + 1);
      }
    },
    description: "选择下一个节点",
  });

  // ← - 折叠文件夹或移到父节点
  register({
    key: "arrowleft",
    handler: () => {
      const node = getSelectedNode();
      if (!node) return;

      if (node.type === "folder" && expandedFolders.value.has(node.id)) {
        // 如果是展开的文件夹，折叠它
        callbacks.onToggleFolder(node.id);
      } else if (node.parentId) {
        // 否则选中父节点
        callbacks.onSelect(node.parentId);
      }
    },
    description: "折叠文件夹或移到父节点",
  });

  // → - 展开文件夹或进入第一个子节点
  register({
    key: "arrowright",
    handler: () => {
      const node = getSelectedNode();
      if (!node || node.type !== "folder") return;

      if (!expandedFolders.value.has(node.id)) {
        // 如果是折叠的文件夹，展开它
        callbacks.onToggleFolder(node.id);
      } else {
        // 如果已展开，选中第一个子节点
        const currentIndex = getSelectedIndex();
        if (currentIndex < visibleNodes.value.length - 1) {
          selectByIndex(currentIndex + 1);
        }
      }
    },
    description: "展开文件夹或进入第一个子节点",
  });

  // Enter - 打开书签或切换文件夹
  register({
    key: "enter",
    handler: () => {
      const node = getSelectedNode();
      if (!node) return;

      if (node.type === "folder") {
        callbacks.onToggleFolder(node.id);
      } else {
        callbacks.onOpen(node.id);
      }
    },
    description: "打开书签或切换文件夹",
  });

  // Space - 切换文件夹（不打开书签）
  register({
    key: " ",
    handler: () => {
      const node = getSelectedNode();
      if (!node || node.type !== "folder") return;

      callbacks.onToggleFolder(node.id);
    },
    description: "切换文件夹展开/折叠",
  });

  // F2 - 重命名（如果提供了回调）
  if (callbacks.onEdit) {
    register({
      key: "f2",
      handler: () => {
        const node = getSelectedNode();
        if (node && callbacks.onEdit) {
          callbacks.onEdit(node.id);
        }
      },
      description: "重命名节点",
    });
  }

  // Delete - 删除（如果提供了回调）
  if (callbacks.onDelete) {
    register({
      key: "delete",
      handler: () => {
        const node = getSelectedNode();
        if (node && callbacks.onDelete) {
          callbacks.onDelete(node.id);
        }
      },
      description: "删除节点",
    });
  }

  // Ctrl/Cmd + C - 复制（如果提供了回调）
  if (callbacks.onCopy) {
    register({
      key: "c",
      ctrl: true,
      handler: () => {
        const node = getSelectedNode();
        if (node && callbacks.onCopy) {
          callbacks.onCopy(node.id);
        }
      },
      description: "复制节点",
    });
  }

  // Home - 跳到第一个节点
  register({
    key: "home",
    handler: () => {
      if (visibleNodes.value.length > 0) {
        selectByIndex(0);
      }
    },
    description: "跳到第一个节点",
  });

  // End - 跳到最后一个节点
  register({
    key: "end",
    handler: () => {
      if (visibleNodes.value.length > 0) {
        selectByIndex(visibleNodes.value.length - 1);
      }
    },
    description: "跳到最后一个节点",
  });

  // 确保选中的节点始终可见
  watch(selectedId, (newId) => {
    if (!newId) return;

    // 这里可以添加滚动到选中节点的逻辑
    // 例如使用 scrollIntoView
  });
}
