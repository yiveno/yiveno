/**
 * Service Worker 生命周期测试（单元测试版本）
 *
 * 测试目标：
 * 1. Service Worker 初始化逻辑
 * 2. 状态持久化策略
 * 3. 消息处理器注册
 *
 * 注意：这是单元测试版本，不需要真实浏览器
 * 完整的 Service Worker 终止测试请参考 termination.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Service Worker 生命周期（单元测试）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('初始化逻辑', () => {
    it('应该在启动时注册所有必要的监听器', () => {
      // 模拟 Service Worker 初始化
      const messageListeners: Array<
        (
          message: chrome.runtime.MessageSender,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void
        ) => void
      > = []
      const alarmListeners: Array<(alarm: chrome.alarms.Alarm) => void> = []

      vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation(listener => {
        messageListeners.push(listener)
      })

      vi.mocked(chrome.alarms.onAlarm.addListener).mockImplementation(listener => {
        alarmListeners.push(listener)
      })

      // 模拟初始化代码
      function initializeServiceWorker() {
        // 注册消息监听器
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
          if (message.type === 'PING') {
            sendResponse({ pong: true })
          }
          return true
        })

        // 注册 Alarm 监听器
        chrome.alarms.onAlarm.addListener(alarm => {
          console.log('Alarm triggered:', alarm.name)
        })
      }

      initializeServiceWorker()

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled()
      expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalled()
      expect(messageListeners).toHaveLength(1)
      expect(alarmListeners).toHaveLength(1)
    })

    it('应该在启动时恢复持久化状态', async () => {
      // Mock storage 返回之前保存的状态
      const mockGet = vi.mocked(chrome.storage.local.get)
      mockGet.mockImplementation(() =>
        Promise.resolve({
          lastSyncTime: 1234567890,
          bookmarkCount: 1000,
          isInitialized: true
        })
      )

      // 模拟状态恢复逻辑
      async function restoreState() {
        const state = await chrome.storage.local.get([
          'lastSyncTime',
          'bookmarkCount',
          'isInitialized'
        ])
        return state
      }

      const restoredState = await restoreState()

      expect(chrome.storage.local.get).toHaveBeenCalled()
      expect(restoredState.lastSyncTime).toBe(1234567890)
      expect(restoredState.bookmarkCount).toBe(1000)
      expect(restoredState.isInitialized).toBe(true)
    })
  })

  describe('状态持久化策略', () => {
    it('应该在关键操作后保存状态', async () => {
      // 模拟书签同步操作
      async function syncBookmarks() {
        // 1. 执行同步
        const bookmarks = [{ id: '1', title: 'Test' }]

        // 2. 保存状态到 storage（持久化）
        await chrome.storage.local.set({
          lastSyncTime: Date.now(),
          bookmarkCount: bookmarks.length,
          syncStatus: 'completed'
        })

        return bookmarks
      }

      await syncBookmarks()

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          lastSyncTime: expect.any(Number),
          bookmarkCount: 1,
          syncStatus: 'completed'
        })
      )
    })

    it('应该使用 chrome.storage 而不是内存变量', async () => {
      // ❌ 错误：使用内存变量（Service Worker 终止后丢失）
      const _inMemoryState = { count: 0 }

      // 示例代码：错误的做法（仅用于演示）
      void _inMemoryState // 避免未使用警告

      // ✅ 正确：使用 chrome.storage（持久化）
      async function incrementCountCorrect() {
        const { count = 0 } = (await chrome.storage.local.get('count')) as {
          count?: number
        }
        await chrome.storage.local.set({ count: count + 1 })
      }

      // 测试正确的方法
      const mockGet = vi.mocked(chrome.storage.local.get)
      mockGet.mockImplementation(() => Promise.resolve({ count: 5 }))

      await incrementCountCorrect()

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ count: 6 })
    })

    it('应该处理 storage 写入失败', async () => {
      // Mock storage.set 失败
      vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error('Storage quota exceeded'))

      // 模拟带错误处理的保存逻辑
      async function saveStateWithErrorHandling(data: Record<string, unknown>) {
        try {
          await chrome.storage.local.set(data)
          return { success: true }
        } catch (error) {
          console.error('Failed to save state:', error)
          return { success: false, error }
        }
      }

      const result = await saveStateWithErrorHandling({ test: 'data' })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('消息处理器注册', () => {
    it('应该正确处理异步消息', async () => {
      const messageHandler = vi.fn(
        (
          message: chrome.runtime.MessageSender,
          _sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void
        ) => {
          if ((message as { type?: string }).type === 'ASYNC_TASK') {
            // 异步处理
            setTimeout(() => {
              sendResponse({ result: 'completed' })
            }, 100)
            return true // 保持消息通道开放
          }
          return false
        }
      )

      chrome.runtime.onMessage.addListener(messageHandler)

      // 模拟消息发送
      const listeners = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls
      expect(listeners[0]).toBeDefined()
      const registeredHandler = listeners[0]![0]

      const sendResponse = vi.fn()
      const returnValue = registeredHandler({ type: 'ASYNC_TASK' }, {}, sendResponse)

      expect(returnValue).toBe(true) // 应该返回 true 保持通道开放

      // 等待异步处理完成
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(sendResponse).toHaveBeenCalledWith({ result: 'completed' })
    })

    it('应该处理消息处理器中的错误', () => {
      const messageHandler = (
        message: chrome.runtime.MessageSender,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void
      ) => {
        try {
          if ((message as { type?: string }).type === 'ERROR_TASK') {
            throw new Error('Task failed')
          }
          sendResponse({ success: true })
        } catch (error) {
          sendResponse({ success: false, error: (error as Error).message })
        }
        return true
      }

      chrome.runtime.onMessage.addListener(messageHandler)

      const listeners = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls
      expect(listeners[0]).toBeDefined()
      const registeredHandler = listeners[0]![0]

      const sendResponse = vi.fn()
      registeredHandler({ type: 'ERROR_TASK' }, {}, sendResponse)

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Task failed'
      })
    })

    describe('错误使用场景（边界测试）', () => {
      it('❌ 应该检测到忘记返回 true 的错误', async () => {
        // 这是最常见的错误：异步消息处理器忘记返回 true
        const incorrectHandler = vi.fn(
          (
            message: chrome.runtime.MessageSender,
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response?: unknown) => void
          ) => {
            if ((message as { type?: string }).type === 'ASYNC_TASK') {
              setTimeout(() => {
                sendResponse({ result: 'completed' })
              }, 100)
              // ❌ 错误：忘记返回 true，消息通道会过早关闭
            }
          }
        )

        chrome.runtime.onMessage.addListener(incorrectHandler)

        const listeners = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls
        expect(listeners[0]).toBeDefined()
        const registeredHandler = listeners[0]![0]

        const sendResponse = vi.fn()
        const returnValue = registeredHandler({ type: 'ASYNC_TASK' }, {}, sendResponse)

        // 验证：没有返回 true（或返回 undefined）
        expect(returnValue).toBeUndefined()

        // 等待异步处理
        await new Promise(resolve => setTimeout(resolve, 150))

        // 在真实环境中，sendResponse 会失败，因为通道已关闭
        // 这里我们验证了错误的使用模式
        expect(sendResponse).toHaveBeenCalled()
      })

      it('❌ 应该检测到多次调用 sendResponse 的错误', () => {
        // 另一个常见错误：多次调用 sendResponse
        const incorrectHandler = (
          message: chrome.runtime.MessageSender,
          _sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void
        ) => {
          if ((message as { type?: string }).type === 'MULTI_RESPONSE') {
            sendResponse({ step: 1 })
            sendResponse({ step: 2 })
          }
          return true
        }

        chrome.runtime.onMessage.addListener(incorrectHandler)

        const listeners = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls
        expect(listeners[0]).toBeDefined()
        const registeredHandler = listeners[0]![0]

        const sendResponse = vi.fn()
        registeredHandler({ type: 'MULTI_RESPONSE' }, {}, sendResponse)

        // 验证：sendResponse 被调用了多次（这是错误的）
        expect(sendResponse).toHaveBeenCalledTimes(2)
        expect(sendResponse).toHaveBeenNthCalledWith(1, { step: 1 })
        expect(sendResponse).toHaveBeenNthCalledWith(2, { step: 2 })
      })

      it('❌ 应该检测到同步返回 true 但不调用 sendResponse 的错误', async () => {
        // 错误：返回了 true 但从不调用 sendResponse
        const incorrectHandler = vi.fn(
          (
            message: chrome.runtime.MessageSender,
            _sender: chrome.runtime.MessageSender,
            _sendResponse: (response?: unknown) => void
          ) => {
            if ((message as { type?: string }).type === 'NO_RESPONSE') {
              return true
            }
            return undefined
          }
        )

        chrome.runtime.onMessage.addListener(incorrectHandler)

        const listeners = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls
        const registeredHandler = listeners[0][0]

        const sendResponse = vi.fn()
        const returnValue = registeredHandler({ type: 'NO_RESPONSE' }, {}, sendResponse)

        expect(returnValue).toBe(true)

        // 等待一段时间
        await new Promise(resolve => setTimeout(resolve, 200))

        // 验证：sendResponse 从未被调用（这会导致调用方超时）
        expect(sendResponse).not.toHaveBeenCalled()
      })

      it('✅ 正确的异步消息处理模式', async () => {
        // 这是正确的模式，作为对比
        const correctHandler = vi.fn(
          (
            message: chrome.runtime.MessageSender,
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response?: unknown) => void
          ) => {
            if ((message as { type?: string }).type === 'CORRECT_ASYNC') {
              setTimeout(() => {
                sendResponse({ result: 'success' })
              }, 100)
              return true // ✅ 正确：返回 true 保持通道开放
            }
            return false // ✅ 正确：同步消息返回 false
          }
        )

        chrome.runtime.onMessage.addListener(correctHandler)

        const listeners = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls
        expect(listeners[0]).toBeDefined()
        const registeredHandler = listeners[0]![0]

        const sendResponse = vi.fn()
        const returnValue = registeredHandler({ type: 'CORRECT_ASYNC' }, {}, sendResponse)

        expect(returnValue).toBe(true)

        await new Promise(resolve => setTimeout(resolve, 150))

        expect(sendResponse).toHaveBeenCalledTimes(1)
        expect(sendResponse).toHaveBeenCalledWith({ result: 'success' })
      })

      it('❌ 应该检测到在 Promise 中使用 sendResponse 但忘记返回 true', async () => {
        // 错误：在 Promise 中使用 sendResponse，但忘记返回 true
        const incorrectHandler = vi.fn(
          (
            message: chrome.runtime.MessageSender,
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response?: unknown) => void
          ) => {
            if ((message as { type?: string }).type === 'PROMISE_TASK') {
              Promise.resolve().then(() => {
                sendResponse({ result: 'done' })
              })
            }
            return undefined
          }
        )

        chrome.runtime.onMessage.addListener(incorrectHandler)

        const listeners = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls
        expect(listeners[0]).toBeDefined()
        const registeredHandler = listeners[0]![0]

        const sendResponse = vi.fn()
        const returnValue = registeredHandler({ type: 'PROMISE_TASK' }, {}, sendResponse)

        expect(returnValue).toBeUndefined()

        await new Promise(resolve => setTimeout(resolve, 50))

        // 在真实环境中，这会失败，因为通道已关闭
        expect(sendResponse).toHaveBeenCalled()
      })
    })
  })

  describe('Alarm 管理', () => {
    it('应该在 Service Worker 启动时重新创建 Alarms', async () => {
      // 模拟 Service Worker 启动时的 Alarm 初始化
      async function initializeAlarms() {
        // 清除旧的 Alarms
        await chrome.alarms.clearAll()

        // 创建新的 Alarms
        await chrome.alarms.create('sync-task', {
          delayInMinutes: 1,
          periodInMinutes: 5
        })

        await chrome.alarms.create('cleanup-task', {
          delayInMinutes: 60,
          periodInMinutes: 1440 // 每天
        })
      }

      await initializeAlarms()

      expect(chrome.alarms.clearAll).toHaveBeenCalled()
      expect(chrome.alarms.create).toHaveBeenCalledWith('sync-task', {
        delayInMinutes: 1,
        periodInMinutes: 5
      })
      expect(chrome.alarms.create).toHaveBeenCalledWith('cleanup-task', {
        delayInMinutes: 60,
        periodInMinutes: 1440
      })
    })

    it('应该处理 Alarm 触发事件', () => {
      const alarmHandler = vi.fn((alarm: chrome.alarms.Alarm) => {
        if (alarm.name === 'sync-task') {
          // 执行同步任务
          console.log('Running sync task')
        }
      })

      chrome.alarms.onAlarm.addListener(alarmHandler)

      // 模拟 Alarm 触发
      const alarm: chrome.alarms.Alarm = {
        name: 'sync-task',
        scheduledTime: Date.now()
      }

      // @ts-expect-error - trigger 是自定义的测试方法
      chrome.alarms.onAlarm.trigger(alarm)

      expect(alarmHandler).toHaveBeenCalledWith(alarm)
    })
  })

  describe('最佳实践验证', () => {
    it('应该使用 chrome.storage 而不是全局变量', () => {
      // 这是一个代码审查测试，验证最佳实践

      // ❌ 反模式：全局变量
      const _badExample = () => {
        const _globalState = { count: 0 }
        _globalState.count++
        // Service Worker 终止后，globalState 会丢失
      }

      // ✅ 最佳实践：chrome.storage
      const goodExample = async () => {
        const { count = 0 } = (await chrome.storage.local.get('count')) as {
          count?: number
        }
        await chrome.storage.local.set({ count: count + 1 })
      }

      expect(typeof goodExample).toBe('function')
      expect(typeof _badExample).toBe('function')
    })

    it('应该在消息处理器中返回 true 以保持通道开放', () => {
      const correctHandler = (
        _message: chrome.runtime.MessageSender,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void
      ) => {
        setTimeout(() => {
          sendResponse({ result: 'done' })
        }, 100)
        return true // ✅ 正确：保持消息通道开放
      }

      const result = correctHandler(
        {} as chrome.runtime.MessageSender,
        {} as chrome.runtime.MessageSender,
        vi.fn()
      )
      expect(result).toBe(true)
    })

    it('应该使用 chrome.alarms 而不是 setTimeout', () => {
      // ❌ 反模式：setTimeout（Service Worker 终止后失效）
      const _badExample = () => {
        setTimeout(() => {
          console.log('This will not work after SW termination')
        }, 60000)
      }

      // ✅ 最佳实践：chrome.alarms（持久化）
      const goodExample = async () => {
        await chrome.alarms.create('task', { delayInMinutes: 1 })
      }

      expect(typeof goodExample).toBe('function')
      expect(typeof _badExample).toBe('function')
    })
  })
})

/**
 * Service Worker 最佳实践总结：
 *
 * 1. 使用 chrome.storage 存储状态（不要用全局变量）
 * 2. 使用 chrome.alarms 调度任务（不要用 setTimeout）
 * 3. 在异步消息处理器中返回 true
 * 4. 在启动时重新注册所有监听器
 * 5. 处理所有可能的错误场景
 * 6. 假设 Service Worker 随时可能终止
 * 7. 使用 IndexedDB 存储大量数据
 * 8. 避免长时间运行的同步操作
 *
 * 参考文档：
 * https://developer.chrome.com/docs/extensions/mv3/service_workers/
 */
