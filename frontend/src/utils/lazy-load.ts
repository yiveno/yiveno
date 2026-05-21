/**
 * 懒加载工具函数
 * 
 * 提供组件和模块的懒加载功能，优化首屏加载速度
 */

import { defineAsyncComponent, type Component, type AsyncComponentLoader } from 'vue'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 懒加载组件配置
 */
interface LazyComponentOptions {
  /** 加载组件的函数 */
  loader: AsyncComponentLoader
  /** 加载中显示的组件 */
  loadingComponent?: Component
  /** 加载失败显示的组件 */
  errorComponent?: Component
  /** 延迟显示加载组件的时间（ms） */
  delay?: number
  /** 超时时间（ms） */
  timeout?: number
  /** 是否在空闲时预加载 */
  preloadOnIdle?: boolean
}

/**
 * 创建懒加载组件
 * 
 * @param options - 懒加载配置
 * @returns Vue 异步组件
 * 
 * @example
 * ```typescript
 * const BookmarkList = createLazyComponent({
 *   loader: () => import('./BookmarkList.vue'),
 *   delay: 200,
 *   timeout: 10000,
 *   preloadOnIdle: true
 * })
 * ```
 */
export function createLazyComponent(options: LazyComponentOptions) {
  const {
    loader,
    loadingComponent,
    errorComponent,
    delay = 200,
    timeout = 10000,
    preloadOnIdle = false
  } = options

  // 空闲时预加载
  if (preloadOnIdle && typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => {
      loader().catch(err => {
        logger.warn('LazyLoad', '预加载组件失败', err)
      })
    })
  }

  return defineAsyncComponent({
    loader,
    ...(loadingComponent && { loadingComponent }),
    ...(errorComponent && { errorComponent }),
    delay,
    timeout,
    onError(error, retry, fail, attempts) {
      logger.error('LazyLoad', `组件加载失败 (尝试 ${attempts} 次)`, error)

      // 最多重试 3 次
      if (attempts < 3) {
        retry()
      } else {
        fail()
      }
    }
  })
}

/**
 * 懒加载模块（带缓存）
 * 
 * @param loader - 加载模块的函数
 * @returns 缓存的模块加载函数
 * 
 * @example
 * ```typescript
 * const loadHeavyModule = createLazyModule(() => import('./heavy-module'))
 * 
 * // 第一次调用会加载模块
 * const module1 = await loadHeavyModule()
 * 
 * // 第二次调用直接返回缓存
 * const module2 = await loadHeavyModule()
 * ```
 */
export function createLazyModule<T>(loader: () => Promise<T>): () => Promise<T> {
  let cache: Promise<T> | null = null

  return () => {
    if (!cache) {
      cache = loader().catch(err => {
        // 加载失败时清除缓存，允许重试
        cache = null
        throw err
      })
    }
    return cache
  }
}

/**
 * 预加载组件
 * 
 * 在空闲时预加载组件，提高后续加载速度
 * 
 * @param loader - 加载组件的函数
 * @param priority - 优先级（high/low），默认 low
 * 
 * @example
 * ```typescript
 * // 低优先级预加载（空闲时）
 * preloadComponent(() => import('./BookmarkList.vue'))
 * 
 * // 高优先级预加载（立即）
 * preloadComponent(() => import('./BookmarkList.vue'), 'high')
 * ```
 */
export function preloadComponent(
  loader: () => Promise<unknown>,
  priority: 'high' | 'low' = 'low'
): void {
  if (priority === 'high') {
    // 高优先级：立即加载
    loader().catch(err => {
      logger.warn('LazyLoad', '预加载组件失败', err)
    })
  } else {
    // 低优先级：空闲时加载
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        loader().catch(err => {
          logger.warn('LazyLoad', '预加载组件失败', err)
        })
      })
    } else {
      // 降级：使用 setTimeout
      setTimeout(() => {
        loader().catch(err => {
          logger.warn('LazyLoad', '预加载组件失败', err)
        })
      }, 1000)
    }
  }
}

/**
 * 批量预加载组件
 * 
 * @param loaders - 加载组件的函数数组
 * @param priority - 优先级（high/low），默认 low
 * 
 * @example
 * ```typescript
 * preloadComponents([
 *   () => import('./BookmarkList.vue'),
 *   () => import('./BookmarkTree.vue'),
 *   () => import('./BookmarkSearch.vue')
 * ])
 * ```
 */
export function preloadComponents(
  loaders: Array<() => Promise<unknown>>,
  priority: 'high' | 'low' = 'low'
): void {
  loaders.forEach(loader => preloadComponent(loader, priority))
}

/**
 * 懒加载图片
 * 
 * 使用 Intersection Observer 实现图片懒加载
 * 
 * @param selector - 图片选择器
 * @param options - Intersection Observer 配置
 * 
 * @example
 * ```typescript
 * // 在组件挂载后调用
 * onMounted(() => {
 *   lazyLoadImages('img[data-src]')
 * })
 * ```
 */
export function lazyLoadImages(
  selector: string,
  options?: IntersectionObserverInit
): void {
  if (typeof IntersectionObserver === 'undefined') {
    // 降级：立即加载所有图片
    document.querySelectorAll<HTMLImageElement>(selector).forEach(img => {
      const src = img.dataset.src
      if (src) {
        img.src = src
        delete img.dataset.src
      }
    })
    return
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement
        const src = img.dataset.src
        if (src) {
          img.src = src
          delete img.dataset.src
          observer.unobserve(img)
        }
      }
    })
  }, options)

  document.querySelectorAll<HTMLImageElement>(selector).forEach(img => {
    observer.observe(img)
  })
}
