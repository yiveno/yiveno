/**
 * 主题与配色同步 Composable
 *
 * 职责：
 * - 监听主题变化事件（mitt 事件总线）
 * - 监听配色预设变化事件
 * - 监听 chrome.storage 变化（跨页面同步）
 * - 将亮/暗主题与 `data-color-preset` 应用到当前文档根节点
 *
 * 使用场景：
 * - 在 popup、sidepanel、management、settings 等页面中使用
 * - 确保各页面与存储中的主题、配色预设一致
 */

import { onMounted, onUnmounted } from "vue";
import {
  normalizeColorPresetId,
  type ColorPresetId,
} from "@acuity-bookmarks/design-tokens/color-presets";
import { logger } from "@/infrastructure/logging/logger";
import { onEvent } from "@/infrastructure/events/event-bus";
import type { ThemeMode } from "@/infrastructure/global-state/global-state-manager";
import { globalStateManager } from "@/infrastructure/global-state/global-state-manager";

/**
 * 应用主题到页面
 * @param theme 主题模式（仅处理亮/暗；system 由调用方解析后再传入）
 */
function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;

  if (theme === "dark") {
    root.style.colorScheme = "dark";
    root.setAttribute("data-theme", "dark");
  } else if (theme === "light") {
    root.style.colorScheme = "light";
    root.setAttribute("data-theme", "light");
  }

  logger.debug("useThemeSync", "主题已应用", { theme });
}

/**
 * 将配色预设同步到 `document.documentElement`。
 * `default` 时移除属性，与 CSS `:root:not([data-color-preset])` 一致。
 */
export function applyColorPresetToDocument(preset: ColorPresetId): void {
  const root = document.documentElement;
  const id = normalizeColorPresetId(preset);
  if (id === "default") {
    root.removeAttribute("data-color-preset");
  } else {
    root.setAttribute("data-color-preset", id);
  }
  logger.debug("useThemeSync", "配色预设已应用到 DOM", { preset: id });
}

/**
 * 主题与配色同步 Composable
 *
 * @param pageName 页面名称（用于日志）
 */
export function useThemeSync(pageName: string): void {
  let storageListener:
    | ((
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: string,
      ) => void)
    | null = null;

  onMounted(() => {
    logger.info("useThemeSync", `${pageName} 页面开始监听主题与配色变化`);

    void (async () => {
      try {
        await globalStateManager.initialize();
        applyColorPresetToDocument(globalStateManager.getColorPreset());
      } catch (error) {
        logger.warn(
          "useThemeSync",
          `${pageName} 初始化配色预设到 DOM 失败`,
          error,
        );
      }
    })();

    const unsubscribeThemeChanged = onEvent("theme:changed", (data) => {
      logger.info("useThemeSync", `${pageName} 收到主题变化事件`, data);
      const payload = data as { theme?: "light" | "dark" };
      if (payload.theme) {
        applyTheme(payload.theme);
      }
    });

    const unsubscribeColorPresetChanged = onEvent(
      "colorPreset:changed",
      (data) => {
        logger.info("useThemeSync", `${pageName} 收到配色预设变化事件`, data);
        applyColorPresetToDocument(data.preset);
      },
    );

    storageListener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === "local" && changes.theme) {
        const newTheme = changes.theme.newValue as ThemeMode;
        logger.info(
          "useThemeSync",
          `${pageName} 检测到 chrome.storage 主题变化`,
          {
            oldValue: changes.theme.oldValue,
            newValue: newTheme,
          },
        );

        if (newTheme === "dark" || newTheme === "light") {
          applyTheme(newTheme);
        }
      }

      if (
        (areaName === "local" || areaName === "sync") &&
        changes.colorPreset
      ) {
        const raw = changes.colorPreset.newValue;
        const preset = normalizeColorPresetId(
          raw !== undefined ? raw : "default",
        );
        logger.info(
          "useThemeSync",
          `${pageName} 检测到 chrome.storage 配色预设变化`,
          {
            areaName,
            preset,
          },
        );
        applyColorPresetToDocument(preset);
      }
    };

    try {
      if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener(storageListener);
        logger.debug("useThemeSync", `${pageName} chrome.storage 监听器已注册`);
      }
    } catch (error) {
      logger.warn(
        "useThemeSync",
        `${pageName} 注册 chrome.storage 监听器失败`,
        error,
      );
    }

    onUnmounted(() => {
      logger.info("useThemeSync", `${pageName} 页面停止监听主题与配色变化`);

      unsubscribeThemeChanged();
      unsubscribeColorPresetChanged();

      if (storageListener && chrome?.storage?.onChanged) {
        try {
          chrome.storage.onChanged.removeListener(storageListener);
          logger.debug(
            "useThemeSync",
            `${pageName} chrome.storage 监听器已移除`,
          );
        } catch (error) {
          logger.warn(
            "useThemeSync",
            `${pageName} 移除 chrome.storage 监听器失败`,
            error,
          );
        }
      }
    });
  });
}
