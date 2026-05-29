/**
 * Chrome Alarms API 测试
 *
 * 测试目标：
 * 1. Alarm 创建和管理
 * 2. Alarm 触发处理
 * 3. 后台任务调度
 *
 * 基于官方文档: https://developer.chrome.com/docs/extensions/reference/api/alarms
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Chrome Alarms API', () => {
  beforeEach(() => {
    // 每个测试前重置 Mock
    vi.clearAllMocks()
  })

  describe('Alarm 创建', () => {
    it('应该能够创建延迟 Alarm', async () => {
      await chrome.alarms.create('test-alarm', { delayInMinutes: 1 })

      expect(chrome.alarms.create).toHaveBeenCalledWith('test-alarm', {
        delayInMinutes: 1
      })
    })

    it('应该能够创建周期性 Alarm', async () => {
      await chrome.alarms.create('periodic-alarm', {
        delayInMinutes: 1,
        periodInMinutes: 5
      })

      expect(chrome.alarms.create).toHaveBeenCalledWith('periodic-alarm', {
        delayInMinutes: 1,
        periodInMinutes: 5
      })
    })

    it('应该能够创建指定时间的 Alarm', async () => {
      const when = Date.now() + 60000 // 1 分钟后
      await chrome.alarms.create('scheduled-alarm', { when })

      expect(chrome.alarms.create).toHaveBeenCalledWith('scheduled-alarm', {
        when
      })
    })
  })

  describe('Alarm 查询', () => {
    it('应该能够获取单个 Alarm', async () => {
      await chrome.alarms.get('test-alarm')

      expect(chrome.alarms.get).toHaveBeenCalledWith('test-alarm')
    })

    it('应该能够获取所有 Alarms', async () => {
      await chrome.alarms.getAll()

      expect(chrome.alarms.getAll).toHaveBeenCalled()
    })
  })

  describe('Alarm 清除', () => {
    it('应该能够清除单个 Alarm', async () => {
      const result = await chrome.alarms.clear('test-alarm')

      expect(chrome.alarms.clear).toHaveBeenCalledWith('test-alarm')
      expect(result).toBe(true)
    })

    it('应该能够清除所有 Alarms', async () => {
      const result = await chrome.alarms.clearAll()

      expect(chrome.alarms.clearAll).toHaveBeenCalled()
      expect(result).toBe(true)
    })
  })

  describe('Alarm 触发处理', () => {
    it('应该能够监听 Alarm 触发', () => {
      const handler = vi.fn()
      chrome.alarms.onAlarm.addListener(handler)

      expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalledWith(handler)
    })

    it('应该能够处理 Alarm 触发事件', () => {
      const handler = vi.fn()
      chrome.alarms.onAlarm.addListener(handler)

      // 模拟 Alarm 触发
      const alarm: chrome.alarms.Alarm = {
        name: 'test-alarm',
        scheduledTime: Date.now()
      }

      // 使用自定义的 trigger 方法触发事件
      // @ts-expect-error - trigger 是自定义的测试方法
      chrome.alarms.onAlarm.trigger(alarm)

      expect(handler).toHaveBeenCalledWith(alarm)
    })

    it('应该能够处理多个 Alarm 监听器', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      chrome.alarms.onAlarm.addListener(handler1)
      chrome.alarms.onAlarm.addListener(handler2)

      const alarm: chrome.alarms.Alarm = {
        name: 'test-alarm',
        scheduledTime: Date.now()
      }

      // @ts-expect-error - trigger 是自定义的测试方法
      chrome.alarms.onAlarm.trigger(alarm)

      expect(handler1).toHaveBeenCalledWith(alarm)
      expect(handler2).toHaveBeenCalledWith(alarm)
    })

    it('应该能够移除 Alarm 监听器', () => {
      const handler = vi.fn()
      chrome.alarms.onAlarm.addListener(handler)
      chrome.alarms.onAlarm.removeListener(handler)

      expect(chrome.alarms.onAlarm.removeListener).toHaveBeenCalledWith(handler)
    })
  })

  describe('实际使用场景', () => {
    it('应该能够实现后台定时任务', async () => {
      // 模拟后台任务调度器
      class BackgroundTaskScheduler {
        private alarmName = 'background-task'

        async start() {
          // 创建周期性 Alarm（每 5 分钟执行一次）
          await chrome.alarms.create(this.alarmName, {
            delayInMinutes: 1,
            periodInMinutes: 5
          })

          // 监听 Alarm 触发
          chrome.alarms.onAlarm.addListener(this.handleAlarm)
        }

        handleAlarm = (alarm: chrome.alarms.Alarm) => {
          if (alarm.name === this.alarmName) {
            // 执行后台任务
            this.runBackgroundTask()
          }
        }

        runBackgroundTask() {
          // 任务逻辑
        }

        async stop() {
          await chrome.alarms.clear(this.alarmName)
          chrome.alarms.onAlarm.removeListener(this.handleAlarm)
        }
      }

      const scheduler = new BackgroundTaskScheduler()
      const runTaskSpy = vi.spyOn(scheduler, 'runBackgroundTask')

      // 启动调度器
      await scheduler.start()

      // 验证 Alarm 已创建
      expect(chrome.alarms.create).toHaveBeenCalledWith('background-task', {
        delayInMinutes: 1,
        periodInMinutes: 5
      })

      // 模拟 Alarm 触发
      const alarm: chrome.alarms.Alarm = {
        name: 'background-task',
        scheduledTime: Date.now()
      }
      // @ts-expect-error - trigger 是自定义的测试方法
      chrome.alarms.onAlarm.trigger(alarm)

      // 验证任务已执行
      expect(runTaskSpy).toHaveBeenCalled()

      // 停止调度器
      await scheduler.stop()
      expect(chrome.alarms.clear).toHaveBeenCalledWith('background-task')
    })
  })
})
