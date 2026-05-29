/**
 * 调度服务公开的类型集合。
 */
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * 调度任务的可配置选项。
 */
export interface ScheduleOptions {
  /** 延迟执行毫秒数 */
  delayMs?: number
  /** 任务优先级 */
  priority?: TaskPriority
  /** 超时时间（毫秒） */
  timeoutMs?: number
  /** 最大重试次数 */
  retries?: number
  /** 重试间隔（毫秒） */
  retryDelay?: number
}

/**
 * 任务运行时的固有配置。
 */
export interface TaskOptions {
  /** 超时时间（毫秒） */
  timeoutMs: number
  /** 调度时的优先级 */
  priority: TaskPriority
  /** 最大重试次数 */
  retries: number
  /** 重试间隔（毫秒） */
  retryDelay: number
}

/**
 * 调度队列中的单个任务描述。
 */
export interface Task {
  /** 任务 ID */
  id: string
  /** 任务展示名称 */
  name: string
  /** 任务类型（UI、背景等） */
  type: string
  /** 当前优先级 */
  priority: TaskPriority
  /** 实际执行函数 */
  fn: () => void | Promise<void>
  /** 固有配置 */
  options: TaskOptions
  /** 创建时间戳 */
  createdAt: number
  /** 已执行的重试次数 */
  retryCount: number
}

/**
 * 调度器的全局配置。
 */
export interface SchedulerConfig {
  /** 默认超时时间（毫秒） */
  defaultTimeout: number
  /** 默认重试间隔（毫秒） */
  retryDelay: number
  /** 默认最大重试次数 */
  maxRetries: number
  /** 并发执行的最大任务数 */
  maxConcurrentTasks: number
  /** 是否开启优先级队列 */
  enablePriorityQueue: boolean
  /** 是否支持自动重试 */
  enableRetry: boolean
}

/**
 * 调度器统计信息
 */
export interface SchedulerStats {
  totalTasks: number
  completedTasks: number
  failedTasks: number
  pendingTasks: number
  activeTasks: number
  averageExecutionTime: number
}
