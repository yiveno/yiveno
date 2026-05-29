/**
 * Ant Design 风格的 Notification 组合式函数
 *
 * 用法：
 * ```ts
 * import { useNotification } from '@/composables/useNotification'
 *
 * const notification = useNotification()
 *
 * notification.success({
 *   message: '成功',
 *   description: '操作成功！',
 *   key: 'my-notification', // 相同 key 会更新而不是创建新的
 *   duration: 3 // 秒
 * })
 * ```
 */

import { createApp, h, type App } from "vue";
import Notification from "@/components/composite/Notification/Notification.vue";

interface NotificationConfig {
  key?: string;
  message?: string;
  description?: string;
  duration?: number;
  closable?: boolean;
  icon?: boolean;
  placement?: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
}

interface NotificationInterface {
  success(config: NotificationConfig): void;
  error(config: NotificationConfig): void;
  info(config: NotificationConfig): void;
  warning(config: NotificationConfig): void;
  open(
    config: NotificationConfig & {
      type: "success" | "error" | "info" | "warning";
    },
  ): void;
  destroy(key?: string): void;
  config(cfg: {
    placement?: NotificationConfig["placement"];
    duration?: number;
  }): void;
}

/**
 * Notification 组件实例类型
 */
interface NotificationComponentInstance {
  success: (config: NotificationConfig) => void;
  error: (config: NotificationConfig) => void;
  info: (config: NotificationConfig) => void;
  warning: (config: NotificationConfig) => void;
  open: (
    config: NotificationConfig & {
      type: "success" | "error" | "info" | "warning";
    },
  ) => void;
  destroy: (key?: string) => void;
  config: (cfg: {
    placement?: NotificationConfig["placement"];
    duration?: number;
  }) => void;
}

class NotificationManager implements NotificationInterface {
  private container: HTMLElement | null = null;
  private app: App | null = null;
  private instance: NotificationComponentInstance | null = null;

  private ensureMounted() {
    if (this.container && this.instance) return;

    // 创建容器
    this.container = document.createElement("div");
    this.container.className = "ab-notification-wrapper";
    document.body.appendChild(this.container);

    // 创建 Vue 应用
    this.app = createApp({
      render: () => h(Notification, { ref: "notification" }),
    });

    // 挂载到容器
    const vm = this.app.mount(this.container);

    // 获取组件实例
    const refs = (vm as { $refs: Record<string, unknown> }).$refs;
    this.instance = refs.notification as NotificationComponentInstance;
  }

  success(config: NotificationConfig) {
    this.ensureMounted();
    this.instance?.success(config);
  }

  error(config: NotificationConfig) {
    this.ensureMounted();
    this.instance?.error(config);
  }

  info(config: NotificationConfig) {
    this.ensureMounted();
    this.instance?.info(config);
  }

  warning(config: NotificationConfig) {
    this.ensureMounted();
    this.instance?.warning(config);
  }

  open(
    config: NotificationConfig & {
      type: "success" | "error" | "info" | "warning";
    },
  ) {
    this.ensureMounted();
    this.instance?.open(config);
  }

  destroy(key?: string) {
    this.instance?.destroy(key);
  }

  config(cfg: {
    placement?: NotificationConfig["placement"];
    duration?: number;
  }) {
    this.ensureMounted();
    this.instance?.config(cfg);
  }
}

// 全局单例
const globalNotification = new NotificationManager();

/**
 * 使用 Notification 的组合式函数
 */
export function useNotification(): NotificationInterface {
  return globalNotification;
}

/**
 * 全局 notification 对象（类似 Ant Design 的用法）
 */
export const notification = globalNotification;
