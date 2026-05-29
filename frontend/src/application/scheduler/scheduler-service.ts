/**
 * 任务调度服务 - 应用服务层
 *
 * 职责：
 * - 提供智能的任务调度机制
 * - 优化UI性能和响应性
 * - 支持多种调度策略
 * - 管理任务队列和优先级
 */

import type { Result } from '../../core/common/result'
import { ok, err } from '../../core/common/result'
import { logger } from '../../infrastructure/logging/logger'
import {
  TaskPriority,
  type ScheduleOptions,
  type Task,
  type SchedulerConfig,
  type SchedulerStats
} from '@/types/application/scheduler'

/**
 * 任务调度服务
 */
export class SchedulerService {
  private config: SchedulerConfig
  private taskQueue: Task[] = []
  private activeTasks = new Set<string>()
  private taskStats = {
    total: 0,
    completed: 0,
    failed: 0,
    executionTimes: [] as number[]
  }
  private nextTaskId = 1

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = {
      maxConcurrentTasks: 5,
      defaultTimeout: 100,
      enablePriorityQueue: true,
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    }
  }

  /**
   * 调度UI更新任务
   */
  scheduleUIUpdate(
    fn: () => void | Promise<void>,
    options: ScheduleOptions = {}
  ): Result<string, Error> {
    try {
      const task: Task = {
        id: this.generateTaskId(),
        name: 'ui-update',
        type: 'ui-update',
        priority: options.priority || TaskPriority.NORMAL,
        fn,
        options: {
          timeoutMs: options.timeoutMs || this.config.defaultTimeout,
          priority: options.priority || TaskPriority.NORMAL,
          retries: options.retries || 0,
          retryDelay: options.retryDelay || this.config.retryDelay
        },
        createdAt: Date.now(),
        retryCount: 0
      }

      this.enqueueTask(task)
      return ok(task.id)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 调度微任务
   */
  scheduleMicrotask(
    fn: () => void | Promise<void>,
    options: ScheduleOptions = {}
  ): Result<string, Error> {
    try {
      const task: Task = {
        id: this.generateTaskId(),
        name: 'microtask',
        type: 'microtask',
        priority: options.priority || TaskPriority.HIGH,
        fn,
        options: {
          timeoutMs: options.timeoutMs ?? 0,
          priority: options.priority || TaskPriority.HIGH,
          retries: options.retries || 0,
          retryDelay: options.retryDelay || this.config.retryDelay
        },
        createdAt: Date.now(),
        retryCount: 0
      }

      this.enqueueTask(task)
      return ok(task.id)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 调度后台任务
   */
  scheduleBackground(
    fn: () => void | Promise<void>,
    options: ScheduleOptions = {}
  ): Result<string, Error> {
    try {
      const task: Task = {
        id: this.generateTaskId(),
        name: 'background',
        type: 'background',
        priority: options.priority || TaskPriority.LOW,
        fn,
        options: {
          timeoutMs: options.timeoutMs || this.config.defaultTimeout,
          priority: options.priority || TaskPriority.LOW,
          retries: options.retries || this.config.maxRetries,
          retryDelay: options.retryDelay || this.config.retryDelay
        },
        createdAt: Date.now(),
        retryCount: 0
      }

      this.enqueueTask(task)
      return ok(task.id)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 调度动画任务
   */
  scheduleAnimation(
    fn: () => void | Promise<void>,
    options: ScheduleOptions = {}
  ): Result<string, Error> {
    try {
      const task: Task = {
        id: this.generateTaskId(),
        name: 'animation',
        type: 'animation',
        priority: options.priority || TaskPriority.CRITICAL,
        fn,
        options: {
          timeoutMs: options.timeoutMs || 16,
          priority: options.priority || TaskPriority.CRITICAL,
          retries: options.retries || 0,
          retryDelay: options.retryDelay || this.config.retryDelay
        },
        createdAt: Date.now(),
        retryCount: 0
      }

      this.enqueueTask(task)
      return ok(task.id)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 将任务加入队列
   */
  private enqueueTask(task: Task): void {
    if (!task.name) task.name = task.type
    this.taskQueue.push(task)
    this.taskStats.total++

    if (this.config.enablePriorityQueue) {
      this.taskQueue.sort((a, b) => {
        const priorityA = typeof a.priority === 'number' ? a.priority : 1
        const priorityB = typeof b.priority === 'number' ? b.priority : 1
        return priorityB - priorityA
      })
    }

    this.processQueue()
  }

  /**
   * 处理任务队列
   */
  private processQueue(): void {
    const maxConcurrent = this.config.maxConcurrentTasks || 5
    if (this.activeTasks.size >= maxConcurrent) {
      return
    }

    const task = this.taskQueue.shift()
    if (!task) return

    this.executeTask(task)
  }

  /**
   * 执行任务
   */
  private async executeTask(task: Task): Promise<void> {
    this.activeTasks.add(task.id)
    const startTime = Date.now()

    try {
      if (task.type === 'ui-update') {
        await this.executeUIUpdateTask(task)
      } else if (task.type === 'microtask') {
        await this.executeMicrotask(task)
      } else if (task.type === 'background') {
        await this.executeBackgroundTask(task)
      } else if (task.type === 'animation') {
        await this.executeAnimationTask(task)
      }

      const executionTime = Date.now() - startTime
      this.taskStats.executionTimes.push(executionTime)
      this.taskStats.completed++

      logger.debug('SchedulerService', 'Task completed', {
        taskId: task.id,
        type: task.type,
        executionTime
      })
    } catch (error) {
      this.taskStats.failed++
      logger.error('Component', 'SchedulerService', 'Task failed', {
        taskId: task.id,
        type: task.type,
        error
      })

      // 重试逻辑
      if (this.config.enableRetry && (task.retryCount || 0) < (task.options?.retries || 0)) {
        task.retryCount = (task.retryCount || 0) + 1
        setTimeout(
          () => {
            this.enqueueTask(task)
          },
          task.options?.retryDelay || this.config.retryDelay || 1000
        )
      }
    } finally {
      this.activeTasks.delete(task.id)
      this.processQueue() // 处理下一个任务
    }
  }

  /**
   * 执行UI更新任务
   */
  private async executeUIUpdateTask(task: Task): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 优先使用 requestIdleCallback
        const ric = (globalThis as Window & typeof globalThis).requestIdleCallback
        if (typeof ric === 'function') {
          ric(
            () => {
              try {
                if (!task.fn) {
                  resolve()
                  return
                }
                const result = task.fn()
                if (result instanceof Promise) {
                  result.then(resolve).catch(reject)
                } else {
                  resolve()
                }
              } catch (error) {
                reject(error)
              }
            },
            {
              timeout: task.options?.timeoutMs || this.config.defaultTimeout || 100
            }
          )
          return
        }
      } catch {
        // 忽略错误，使用降级方案
      }

      // 降级到 setTimeout
      setTimeout(
        () => {
          try {
            if (!task.fn) {
              resolve()
              return
            }
            const result = task.fn()
            if (result instanceof Promise) {
              result.then(resolve).catch(reject)
            } else {
              resolve()
            }
          } catch (error) {
            reject(error)
          }
        },
        Math.min(task.options?.timeoutMs || this.config.defaultTimeout || 100, 50)
      )
    })
  }

  /**
   * 执行微任务
   */
  private async executeMicrotask(task: Task): Promise<void> {
    return new Promise((resolve, reject) => {
      Promise.resolve()
        .then(() => {
          if (!task.fn) {
            resolve()
            return
          }
          const result = task.fn()
          if (result instanceof Promise) {
            return result
          }
          return undefined
        })
        .then(resolve)
        .catch(error => {
          logger.error('Component', 'SchedulerService', 'Microtask error', error)
          reject(error)
        })
    })
  }

  /**
   * 执行后台任务
   */
  private async executeBackgroundTask(task: Task): Promise<void> {
    if (!task.fn) {
      return
    }
    const result = task.fn()
    if (result instanceof Promise) {
      return result
    }
  }

  /**
   * 执行动画任务
   */
  private async executeAnimationTask(task: Task): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 使用 requestAnimationFrame 确保与浏览器刷新率同步
        const raf = (globalThis as Window & typeof globalThis).requestAnimationFrame
        if (typeof raf === 'function') {
          raf(() => {
            try {
              if (!task.fn) {
                resolve()
                return
              }
              const result = task.fn()
              if (result instanceof Promise) {
                result.then(resolve).catch(reject)
              } else {
                resolve()
              }
            } catch (error) {
              reject(error)
            }
          })
        } else {
          // 降级到 setTimeout
          setTimeout(() => {
            try {
              if (!task.fn) {
                resolve()
                return
              }
              const result = task.fn()
              if (result instanceof Promise) {
                result.then(resolve).catch(reject)
              } else {
                resolve()
              }
            } catch (error) {
              reject(error)
            }
          }, task.options?.timeoutMs || 16)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return `task_${this.nextTaskId++}_${Date.now()}`
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const taskIndex = this.taskQueue.findIndex(task => task.id === taskId)
    if (taskIndex !== -1) {
      this.taskQueue.splice(taskIndex, 1)
      return true
    }
    return false
  }

  /**
   * 清空任务队列
   */
  clearQueue(): void {
    this.taskQueue = []
  }

  /**
   * 获取调度器统计信息
   */
  getStats(): SchedulerStats {
    const averageExecutionTime =
      this.taskStats.executionTimes.length > 0
        ? this.taskStats.executionTimes.reduce((sum, time) => sum + time, 0) /
          this.taskStats.executionTimes.length
        : 0

    return {
      totalTasks: this.taskStats.total,
      completedTasks: this.taskStats.completed,
      failedTasks: this.taskStats.failed,
      pendingTasks: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      averageExecutionTime
    }
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): SchedulerConfig {
    return { ...this.config }
  }

  /**
   * 销毁调度器
   */
  destroy(): void {
    this.clearQueue()
    this.activeTasks.clear()
    this.taskStats = {
      total: 0,
      completed: 0,
      failed: 0,
      executionTimes: []
    }
  }
}

/**
 * 默认调度器服务实例
 */
export const schedulerService = new SchedulerService()

/**
 * 便捷函数（保持向后兼容）
 */
export function scheduleUIUpdate(fn: () => void, options: ScheduleOptions = {}): string | null {
  const result = schedulerService.scheduleUIUpdate(fn, options)
  return result.ok ? result.value : null
}

export function scheduleMicrotask(fn: () => void): string | null {
  const result = schedulerService.scheduleMicrotask(fn)
  return result.ok ? result.value : null
}
