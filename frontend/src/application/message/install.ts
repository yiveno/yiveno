/**
 * Message 组件安装器
 *
 * 在应用启动时自动挂载 Message 组件到 body
 *
 * @module application/message/install
 */

import { createApp, h } from "vue";
import Message from "@/components/base/Message/Message.vue";
import { logger } from "@/infrastructure/logging/logger";

let messageApp: ReturnType<typeof createApp> | null = null;
let messageContainer: HTMLDivElement | null = null;

/**
 * 安装 Message 组件
 *
 * 在应用启动时调用一次即可
 *
 * @example
 * ```typescript
 * import { installMessage } from '@/application/message/install'
 *
 * // 在 main.ts 中
 * installMessage()
 * ```
 */
export function installMessage(): void {
  // 避免重复安装
  if (messageApp) {
    logger.warn("MessageInstaller", "Message 组件已安装，跳过重复安装");
    return;
  }

  // Service Worker 环境检查
  if (typeof document === "undefined") {
    logger.debug(
      "MessageInstaller",
      "Service Worker 环境，跳过 Message 组件安装",
    );
    return;
  }

  try {
    // 创建容器
    messageContainer = document.createElement("div");
    messageContainer.id = "message-container";
    document.body.appendChild(messageContainer);

    // 创建 Vue 应用
    messageApp = createApp({
      render: () => h(Message),
    });

    // 挂载到容器
    messageApp.mount(messageContainer);

    logger.info("MessageInstaller", "Message 组件已安装");
  } catch (error) {
    logger.error("MessageInstaller", "Message 组件安装失败", error);
  }
}

/**
 * 卸载 Message 组件
 *
 * 通常在应用销毁时调用
 */
export function uninstallMessage(): void {
  if (messageApp && messageContainer) {
    try {
      messageApp.unmount();
      document.body.removeChild(messageContainer);
      messageApp = null;
      messageContainer = null;
      logger.info("MessageInstaller", "Message 组件已卸载");
    } catch (error) {
      logger.error("MessageInstaller", "Message 组件卸载失败", error);
    }
  }
}
