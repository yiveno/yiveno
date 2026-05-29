/**
 * 键盘快捷键帮助
 *
 * 提供显示键盘快捷键帮助对话框的功能
 */
import { ref } from "vue";
import { useKeyboard } from "./useKeyboard";

/**
 * 快捷键信息
 */
export interface ShortcutInfo {
  /** 快捷键组合 */
  keys: string[];
  /** 描述 */
  description: string;
  /** 分类 */
  category?: string;
}

/**
 * 键盘帮助选项
 */
export interface UseKeyboardHelpOptions {
  /** 快捷键列表 */
  shortcuts: ShortcutInfo[];
  /** 是否自动注册 ? 快捷键来显示帮助（默认 true） */
  autoRegisterHelp?: boolean;
}

/**
 * 键盘快捷键帮助
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useKeyboardHelp } from '@/composables/useKeyboardHelp'
 * import KeyboardShortcutsHelp from '@/components/base/KeyboardShortcutsHelp/KeyboardShortcutsHelp.vue'
 *
 * const { showHelp, toggleHelp } = useKeyboardHelp({
 *   shortcuts: [
 *     { shortcut: 'Ctrl + S', description: '保存', group: '编辑' },
 *     { shortcut: 'Ctrl + F', description: '筛选', group: '导航' }
 *   ]
 * })
 * </script>
 *
 * <template>
 *   <KeyboardShortcutsHelp
 *     v-model:show="showHelp"
 *     :shortcuts="shortcuts"
 *   />
 * </template>
 * ```
 */
export function useKeyboardHelp(options: UseKeyboardHelpOptions) {
  const { shortcuts, autoRegisterHelp = true } = options;

  const showHelp = ref(false);

  function toggleHelp() {
    showHelp.value = !showHelp.value;
  }

  function openHelp() {
    showHelp.value = true;
  }

  function closeHelp() {
    showHelp.value = false;
  }

  // 自动注册 ? 快捷键
  if (autoRegisterHelp) {
    const { register } = useKeyboard();

    // Shift + ? 或 F1 - 显示快捷键帮助
    register({
      key: "?",
      shift: true,
      handler: toggleHelp,
      description: "显示快捷键帮助",
    });

    register({
      key: "f1",
      handler: toggleHelp,
      description: "显示快捷键帮助",
    });
  }

  return {
    showHelp,
    toggleHelp,
    openHelp,
    closeHelp,
    shortcuts,
  };
}

/**
 * 从 useKeyboard 的快捷键 Map 转换为 ShortcutInfo 数组
 */
export function convertToShortcutInfo(
  shortcutsMap: ReadonlyMap<string, { description?: string }>,
): ShortcutInfo[] {
  const shortcuts: ShortcutInfo[] = [];

  shortcutsMap.forEach((shortcut, key) => {
    shortcuts.push({
      keys: [key],
      description: shortcut.description || "",
    });
  });

  return shortcuts;
}
