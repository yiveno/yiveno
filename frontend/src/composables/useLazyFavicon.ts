/**
 * 🖼️ 懒加载 Favicon 组合函数
 *
 * 职责：
 * - 实现 favicon 的懒加载，只加载可视区域的图标
 * - 集成 FaviconService 实现缓存和域名复用
 * - 提供响应式的加载状态管理
 * - 自动清理资源和取消订阅
 *
 * 功能：
 * 1. 使用 Intersection Observer 实现可视区域加载
 * 2. 支持多级回退策略（Google Favicon -> 直接获取 -> DuckDuckGo）
 * 3. 自动过滤特殊协议和本地URL
 * 4. 响应式状态更新
 * 5. 内存缓存和 IndexedDB 持久化
 *
 * 性能优化：
 * - 延迟加载直到元素进入可视区域
 * - 域名级别缓存复用
 * - 避免重复请求
 */

import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { faviconService, type FaviconStatus } from '@/infrastructure/services/favicon-service'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 懒加载 Favicon 选项接口
 */
export interface UseLazyFaviconOptions {
  /** 书签URL（响应式引用） */
  url: Ref<string | undefined>
  /** 节点的根元素引用 */
  rootEl: Ref<HTMLElement | null>
  /** Intersection Observer 的 root margin（默认：提前200px开始加载） */
  rootMargin?: string
  /** 是否启用懒加载（默认：true，禁用时立即加载） */
  enabled?: boolean
}

/**
 * 懒加载 Favicon 返回值接口
 */
export interface UseLazyFaviconReturn {
  /** favicon URL（响应式） */
  faviconUrl: Ref<string>
  /** 加载状态（loading/loaded/error） */
  status: Ref<FaviconStatus>
  /** 是否加载失败 */
  isError: Ref<boolean>
  /** 是否正在加载 */
  isLoading: Ref<boolean>
  /** 是否已加载成功 */
  isLoaded: Ref<boolean>
  /** 手动触发加载函数 */
  load: () => void
  /** 图片加载成功处理函数 */
  handleLoad: () => void
  /** 图片加载失败处理函数 */
  handleError: () => void
}

/**
 * 懒加载 Favicon 组合函数
 *
 * @param options - 配置选项
 * @returns Favicon 加载相关的响应式状态和方法
 *
 * @example
 * ```ts
 * const { faviconUrl, status, isLoading } = useLazyFavicon({
 *   url: ref('https://example.com'),
 *   rootEl: elementRef,
 *   rootMargin: '200px',
 *   enabled: true
 * })
 * ```
 */
export function useLazyFavicon(options: UseLazyFaviconOptions): UseLazyFaviconReturn {
  const { url, rootEl, rootMargin = '200px', enabled = true } = options

  // 响应式状态
  const faviconUrl = ref('')
  const status = ref<FaviconStatus>('loading')
  const isIntersecting = ref(false)
  const hasLoaded = ref(false)

  // Intersection Observer实例
  let observer: IntersectionObserver | null = null
  let unsubscribe: (() => void) | null = null

  // 计算属性
  const isError = ref(false)
  const isLoading = ref(false)
  const isLoaded = ref(false)

  /**
   * 更新计算状态
   *
   * 根据当前 status 更新派生的布尔状态值
   */
  const updateComputedState = () => {
    isError.value = status.value === 'error'
    isLoading.value = status.value === 'loading'
    isLoaded.value = status.value === 'loaded'
  }

  /**
   * 加载 favicon
   *
   * 从 FaviconService 获取 favicon URL，自动过滤特殊协议和本地URL
   */
  const load = async () => {
    const bookmarkUrl = url.value
    if (!bookmarkUrl || hasLoaded.value) return

    // ✅ 检查是否是特殊协议URL或本地URL
    try {
      const parsed = new URL(bookmarkUrl)

      // 跳过特殊协议
      const specialProtocols = [
        'chrome-extension:',
        'chrome:',
        'file:',
        'about:',
        'data:',
        'javascript:'
      ]
      if (specialProtocols.includes(parsed.protocol)) {
        status.value = 'error'
        updateComputedState()
        return
      }

      // 跳过localhost和本地IP
      const hostname = parsed.hostname
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.')
      ) {
        status.value = 'error'
        updateComputedState()
        return
      }
    } catch {
      // URL解析失败，跳过
      status.value = 'error'
      updateComputedState()
      return
    }

    hasLoaded.value = true

    try {
      // 使用FaviconService获取favicon
      const initialUrl = await faviconService.getFavicon(bookmarkUrl, (newStatus, newUrl) => {
        status.value = newStatus
        if (newUrl) {
          faviconUrl.value = newUrl
        }
        updateComputedState()
      })

      if (!initialUrl) {
        // 服务返回空（可能是特殊协议），标记为error
        status.value = 'error'
        updateComputedState()
        return
      }

      faviconUrl.value = initialUrl
      status.value = 'loading'
      updateComputedState()
    } catch (error) {
      logger.error('useLazyFavicon', '加载favicon失败:', error)
      status.value = 'error'
      updateComputedState()
    }
  }

  /**
   * 处理图片加载成功
   *
   * 通知 FaviconService 标记该 favicon 已成功加载
   */
  const handleLoad = () => {
    const bookmarkUrl = url.value
    if (!bookmarkUrl) return

    logger.debug('useLazyFavicon', `✅ Favicon加载成功: ${bookmarkUrl} -> ${faviconUrl.value}`)
    faviconService.markLoaded(bookmarkUrl, faviconUrl.value)
    status.value = 'loaded'
    updateComputedState()
  }

  /**
   * 处理图片加载失败
   *
   * 自动尝试下一个回退方案，直到所有方案都失败
   */
  const handleError = () => {
    const bookmarkUrl = url.value
    if (!bookmarkUrl) return

    logger.warn(
      'useLazyFavicon',
      `❌ Favicon加载失败: ${bookmarkUrl} (当前URL: ${faviconUrl.value})`
    )

    // 尝试下一个回退方案
    const nextUrl = faviconService.markError(bookmarkUrl)
    if (nextUrl) {
      logger.debug('useLazyFavicon', `🔄 尝试回退URL: ${nextUrl}`)
      faviconUrl.value = nextUrl
      status.value = 'loading'
    } else {
      logger.error('useLazyFavicon', `💀 所有回退方案失败: ${bookmarkUrl}`)
      status.value = 'error'
    }
    updateComputedState()
  }

  /**
   * 初始化 Intersection Observer
   *
   * 监听元素进入可视区域，触发 favicon 加载
   */
  const initObserver = () => {
    if (!enabled || !rootEl.value) return

    observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !isIntersecting.value) {
            isIntersecting.value = true
            // 进入可视区域，开始加载
            load()
          }
        })
      },
      {
        rootMargin,
        threshold: 0.01 // 只要有1%可见就触发
      }
    )

    observer.observe(rootEl.value)
  }

  /**
   * 清理 Observer
   *
   * 断开所有观察并释放资源
   */
  const cleanupObserver = () => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }

  // 监听rootEl变化
  watch(rootEl, (newEl, oldEl) => {
    if (oldEl && observer) {
      observer.unobserve(oldEl)
    }
    if (newEl && enabled) {
      initObserver()
    }
  })

  // 监听URL变化
  watch(url, () => {
    // URL变化时重置状态
    hasLoaded.value = false
    faviconUrl.value = ''
    status.value = 'loading'
    updateComputedState()

    // 如果已在可视区域，立即加载
    if (isIntersecting.value) {
      load()
    }
  })

  // 组件挂载
  onMounted(() => {
    if (!enabled) {
      // 禁用懒加载，直接加载
      load()
    } else {
      // 启用懒加载，等待进入可视区域
      initObserver()
    }
  })

  // 组件卸载
  onUnmounted(() => {
    cleanupObserver()
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  })

  return {
    faviconUrl,
    status,
    isError,
    isLoading,
    isLoaded,
    load,
    handleLoad,
    handleError
  }
}
