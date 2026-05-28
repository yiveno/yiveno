/**
 * 性能监控工具
 *
 * 监控应用性能指标，提供性能优化建议
 */

import { logger } from '@/infrastructure/logging/logger'

/**
 * 性能事件时间接口
 */
interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number
}

/**
 * 布局偏移接口
 */
interface LayoutShift extends PerformanceEntry {
  value: number
  hadRecentInput: boolean
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 首次内容绘制时间（ms） */
  fcp?: number
  /** 最大内容绘制时间（ms） */
  lcp?: number
  /** 首次输入延迟（ms） */
  fid?: number
  /** 累积布局偏移 */
  cls?: number
  /** 首次字节时间（ms） */
  ttfb?: number
  /** DOM 内容加载完成时间（ms） */
  domContentLoaded?: number
  /** 页面完全加载时间（ms） */
  loadComplete?: number
  /** 内存使用（MB） */
  memoryUsage?: number
}

/**
 * 性能监控器
 */
class PerformanceMonitor {
  private metrics: PerformanceMetrics = {}
  private observers: PerformanceObserver[] = []

  /**
   * 初始化性能监控
   */
  initialize(): void {
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
      return
    }

    // 监控 FCP (First Contentful Paint)
    this.observePaint()

    // 监控 LCP (Largest Contentful Paint)
    this.observeLCP()

    // 监控 FID (First Input Delay)
    this.observeFID()

    // 监控 CLS (Cumulative Layout Shift)
    this.observeCLS()

    // 监控导航时间
    this.observeNavigation()

    // 监控内存使用
    this.observeMemory()

    logger.info('PerformanceMonitor', '✅ 性能监控已启动')
  }

  /**
   * 监控绘制时间（FCP）
   */
  private observePaint(): void {
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = entry.startTime
            logger.info('PerformanceMonitor', `FCP: ${entry.startTime.toFixed(2)}ms`)
          }
        }
      })
      observer.observe({ entryTypes: ['paint'] })
      this.observers.push(observer)
    } catch (err) {
      logger.warn('PerformanceMonitor', 'FCP 监控失败', err)
    }
  }

  /**
   * 监控最大内容绘制（LCP）
   */
  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        if (lastEntry) {
          this.metrics.lcp = lastEntry.startTime
          logger.info('PerformanceMonitor', `LCP: ${lastEntry.startTime.toFixed(2)}ms`)
        }
      })
      observer.observe({ entryTypes: ['largest-contentful-paint'] })
      this.observers.push(observer)
    } catch (err) {
      logger.warn('PerformanceMonitor', 'LCP 监控失败', err)
    }
  }

  /**
   * 监控首次输入延迟（FID）
   */
  private observeFID(): void {
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const perfEntry = entry as PerformanceEventTiming
          const fid = perfEntry.processingStart - entry.startTime
          this.metrics.fid = fid
          logger.info('PerformanceMonitor', `FID: ${fid.toFixed(2)}ms`)
        }
      })
      observer.observe({ entryTypes: ['first-input'] })
      this.observers.push(observer)
    } catch (err) {
      logger.warn('PerformanceMonitor', 'FID 监控失败', err)
    }
  }

  /**
   * 监控累积布局偏移（CLS）
   */
  private observeCLS(): void {
    try {
      let clsValue = 0
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as LayoutShift
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value
            this.metrics.cls = clsValue
          }
        }
      })
      observer.observe({ entryTypes: ['layout-shift'] })
      this.observers.push(observer)
    } catch (err) {
      logger.warn('PerformanceMonitor', 'CLS 监控失败', err)
    }
  }

  /**
   * 监控导航时间
   */
  private observeNavigation(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (perfData) {
        this.metrics.ttfb = perfData.responseStart - perfData.requestStart
        this.metrics.domContentLoaded = perfData.domContentLoadedEventEnd - perfData.fetchStart
        this.metrics.loadComplete = perfData.loadEventEnd - perfData.fetchStart

        logger.info('PerformanceMonitor', '导航时间', {
          ttfb: `${this.metrics.ttfb.toFixed(2)}ms`,
          domContentLoaded: `${this.metrics.domContentLoaded.toFixed(2)}ms`,
          loadComplete: `${this.metrics.loadComplete.toFixed(2)}ms`
        })
      }
    })
  }

  /**
   * 监控内存使用
   */
  private observeMemory(): void {
    if (typeof window === 'undefined') return

    // @ts-expect-error - memory 是 Chrome 扩展 API
    const memory = performance.memory
    if (memory) {
      const usedMemory = memory.usedJSHeapSize / 1024 / 1024
      this.metrics.memoryUsage = usedMemory
      logger.info('PerformanceMonitor', `内存使用: ${usedMemory.toFixed(2)}MB`)
    }
  }

  /**
   * 获取性能指标
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取性能评分
   *
   * @returns 性能评分（0-100）
   */
  getPerformanceScore(): number {
    let score = 100

    score -= this.calculateFCPScore()
    score -= this.calculateLCPScore()
    score -= this.calculateFIDScore()
    score -= this.calculateCLSScore()
    score -= this.calculateMemoryScore()

    return Math.max(0, score)
  }

  /**
   * 计算 FCP 评分
   */
  private calculateFCPScore(): number {
    if (!this.metrics.fcp) return 0
    if (this.metrics.fcp > 3000) return 20
    if (this.metrics.fcp > 1800) return 10
    return 0
  }

  /**
   * 计算 LCP 评分
   */
  private calculateLCPScore(): number {
    if (!this.metrics.lcp) return 0
    if (this.metrics.lcp > 4000) return 20
    if (this.metrics.lcp > 2500) return 10
    return 0
  }

  /**
   * 计算 FID 评分
   */
  private calculateFIDScore(): number {
    if (!this.metrics.fid) return 0
    if (this.metrics.fid > 300) return 20
    if (this.metrics.fid > 100) return 10
    return 0
  }

  /**
   * 计算 CLS 评分
   */
  private calculateCLSScore(): number {
    if (!this.metrics.cls) return 0
    if (this.metrics.cls > 0.25) return 20
    if (this.metrics.cls > 0.1) return 10
    return 0
  }

  /**
   * 计算内存使用评分
   */
  private calculateMemoryScore(): number {
    if (!this.metrics.memoryUsage) return 0
    if (this.metrics.memoryUsage > 100) return 20
    if (this.metrics.memoryUsage > 50) return 10
    return 0
  }

  /**
   * 获取性能优化建议
   */
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = []

    if (this.metrics.fcp && this.metrics.fcp > 1800) {
      suggestions.push('FCP 较慢，建议优化首屏渲染速度（减少阻塞资源、使用懒加载）')
    }

    if (this.metrics.lcp && this.metrics.lcp > 2500) {
      suggestions.push('LCP 较慢，建议优化最大内容元素的加载速度（图片优化、预加载）')
    }

    if (this.metrics.fid && this.metrics.fid > 100) {
      suggestions.push('FID 较高，建议优化 JavaScript 执行时间（代码分割、Web Worker）')
    }

    if (this.metrics.cls && this.metrics.cls > 0.1) {
      suggestions.push('CLS 较高，建议为图片和动态内容设置固定尺寸')
    }

    if (this.metrics.memoryUsage && this.metrics.memoryUsage > 50) {
      suggestions.push('内存使用较高，建议检查内存泄漏和优化数据结构')
    }

    if (suggestions.length === 0) {
      suggestions.push('性能表现良好，无需优化')
    }

    return suggestions
  }

  /**
   * 打印性能报告
   */
  printReport(): void {
    const metrics = this.getMetrics()
    const score = this.getPerformanceScore()
    const suggestions = this.getOptimizationSuggestions()

    logger.info('PerformanceMonitor', '性能报告', {
      score,
      metrics,
      suggestions
    })
  }

  /**
   * 清理监控器
   */
  dispose(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
    logger.info('PerformanceMonitor', '性能监控已停止')
  }
}

/** 全局性能监控器实例 */
export const performanceMonitor = new PerformanceMonitor()

/** 默认导出 */
export default performanceMonitor
