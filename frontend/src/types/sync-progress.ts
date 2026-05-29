/**
 * 同步进度类型定义
 *
 * 用于所有长耗时同步任务的进度反馈
 */

/**
 * 同步阶段
 */
export type SyncPhase =
  | "fetching" // 从 Chrome API 获取数据
  | "converting" // 转换数据格式
  | "writing" // 写入 IndexedDB
  | "indexing" // 构建索引
  | "completed" // 完成
  | "failed" // 失败
  | "timeout"; // 超时

/**
 * 错误类型
 */
export type SyncErrorType =
  | "network" // 网络错误
  | "indexeddb" // IndexedDB 错误
  | "chrome_api" // Chrome API 错误
  | "timeout" // 超时错误
  | "unknown"; // 未知错误

/**
 * 同步错误信息
 */
export interface SyncError {
  /** 错误类型 */
  type: SyncErrorType;

  /** 错误消息 */
  message: string;

  /** 是否可以重试 */
  canRetry: boolean;

  /** 已重试次数 */
  retryCount?: number;

  /** 原始错误对象 */
  originalError?: unknown;
}

/**
 * 同步进度数据结构
 */
export interface SyncProgress {
  /** 当前阶段 */
  phase: SyncPhase;

  /** 当前已处理数量 */
  current: number;

  /** 总数量 */
  total: number;

  /** 进度百分比 (0-100) */
  percentage: number;

  /** 进度消息 */
  message: string;

  /** 预计剩余时间（毫秒），可选 */
  estimatedRemaining?: number;

  /** 开始时间（用于计算预计剩余时间） */
  startTime?: number;

  /** 错误信息（仅在 failed 或 timeout 阶段） */
  error?: SyncError;
}

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (progress: SyncProgress) => void;

/**
 * 阶段信息
 */
export interface PhaseInfo {
  key: SyncPhase;
  label: string;
  icon: string;
}

/**
 * 所有阶段的定义
 */
export const SYNC_PHASES: PhaseInfo[] = [
  { key: "fetching", label: "读取", icon: "download" },
  { key: "converting", label: "转换", icon: "refresh" },
  { key: "writing", label: "写入", icon: "save" },
  { key: "indexing", label: "索引", icon: "zap" },
  { key: "completed", label: "完成", icon: "check-circle" },
];

/**
 * 阶段标题映射
 */
export const PHASE_TITLES: Record<SyncPhase, string> = {
  fetching: "正在读取书签",
  converting: "正在转换数据",
  writing: "正在写入数据库",
  indexing: "正在建立索引",
  completed: "同步完成",
  failed: "同步失败",
  timeout: "同步超时",
};

/**
 * 错误类型的用户友好消息
 */
export const ERROR_MESSAGES: Record<SyncErrorType, string> = {
  network: "网络连接失败，请检查网络设置",
  indexeddb: "数据库写入失败，请尝试重启浏览器",
  chrome_api: "Chrome 书签 API 调用失败",
  timeout: "同步操作超时，请重试",
  unknown: "发生未知错误，请重试",
};

/**
 * 创建初始进度对象
 */
export function createInitialProgress(): SyncProgress {
  return {
    phase: "fetching",
    current: 0,
    total: 0,
    percentage: 0,
    message: "准备开始...",
    startTime: Date.now(),
  };
}

/**
 * 计算预计剩余时间
 *
 * @param progress - 当前进度
 * @returns 预计剩余时间（毫秒）
 */
export function calculateEstimatedRemaining(progress: SyncProgress): number {
  if (!progress.startTime || progress.current === 0 || progress.total === 0) {
    return 0;
  }

  const elapsed = Date.now() - progress.startTime;
  const rate = progress.current / elapsed; // 每毫秒处理的数量
  const remaining = progress.total - progress.current;

  return Math.round(remaining / rate);
}

import { t } from "@/utils/i18n-helpers";

/**
 * 格式化时间显示
 *
 * @param ms - 毫秒数
 * @returns 格式化的时间字符串
 */
export function formatTime(ms: number): string {
  if (ms < 1000) {
    return t("time_less_than_second");
  }

  if (ms < 60000) {
    const seconds = Math.ceil(ms / 1000);
    return t("time.seconds", String(seconds));
  }

  const minutes = Math.ceil(ms / 60000);
  return t("time.minutes", String(minutes));
}

/**
 * 判断阶段是否已完成
 *
 * @param currentPhase - 当前阶段
 * @param checkPhase - 要检查的阶段
 * @returns 是否已完成
 */
export function isPhaseCompleted(
  currentPhase: SyncPhase,
  checkPhase: SyncPhase,
): boolean {
  const currentIndex = SYNC_PHASES.findIndex((p) => p.key === currentPhase);
  const checkIndex = SYNC_PHASES.findIndex((p) => p.key === checkPhase);

  return checkIndex < currentIndex || currentPhase === "completed";
}
