/**
 * 同步进度管理 Composable
 * 负责监听 Chrome Extension 同步状态
 */
import { ref, onMounted, onUnmounted } from "vue";
import type { ChromeExtensionMessage } from "@/types/chrome-messages";
import { logger } from "@/infrastructure/logging/logger";

export function useSyncProgress() {
  const progress = ref(0);
  const progressMessage = ref("Initializing...");
  const isSyncing = ref(true);
  const isCompleted = ref(false);

  function completeSync() {
    if (!isCompleted.value) {
      isSyncing.value = false;
      isCompleted.value = true;
      progress.value = 100;
      progressMessage.value = "Ready";
    }
  }

  function updateProgress(percentage: number, message: string) {
    progress.value = percentage;
    progressMessage.value = message;
  }

  // Chrome Extension 消息监听
  const messageListener = (message: ChromeExtensionMessage) => {
    if (message.type === "acuity-bookmarks-sync-progress") {
      updateProgress(message.data.percentage, message.data.message);

      if (message.data.phase === "completed") {
        completeSync();
      }
    } else if (message.type === "acuity-bookmarks-db-ready") {
      completeSync();
    }
  };

  // 模拟进度（非扩展环境）
  function simulateProgress() {
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      updateProgress(currentProgress, `Processing... ${currentProgress}%`);

      if (currentProgress >= 100) {
        clearInterval(interval);
        completeSync();
      }
    }, 300);

    return interval;
  }

  onMounted(() => {
    // 检查 Chrome Extension API 是否可用
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener(messageListener);

      // 检查初始化状态
      if (chrome.storage?.local) {
        chrome.storage.local.get(["AB_INITIALIZED"], (result) => {
          if (result.AB_INITIALIZED) {
            completeSync();
          }
        });
      }
    } else {
      // 非扩展环境：演示模式
      logger.warn(
        "SyncProgress",
        "Env",
        "Chrome Extension APIs not available. Running in demo mode.",
      );
      simulateProgress();
    }
  });

  onUnmounted(() => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.removeListener(messageListener);
    }
  });

  return {
    progress,
    progressMessage,
    isSyncing,
    isCompleted,
    completeSync,
    updateProgress,
  };
}
