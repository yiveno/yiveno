/**
 * 海报生成服务
 * @module share/poster-service
 * @description 使用 Canvas API 生成书签分享海报
 */

import { ShareError, ShareErrorCode, type PosterOptions, type PosterConfig } from './types'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 海报生成服务接口
 */
export interface PosterService {
  /**
   * 生成海报
   * @param options 海报选项
   * @returns 海报 Data URL (PNG 格式)
   * @throws {ShareError} 当 Canvas 不支持时抛出错误
   */
  generatePoster(options: PosterOptions): Promise<string>

  /**
   * 导出 Canvas 为 PNG Blob
   * @param canvas Canvas 元素
   * @returns PNG Blob
   */
  exportToPNG(canvas: HTMLCanvasElement): Promise<Blob>

  /**
   * 生成二维码
   * @param url 要编码的 URL
   * @returns 二维码 Data URL
   */
  generateQRCode(url: string): Promise<string>
}

/**
 * 海报生成服务实现
 */
class PosterServiceImpl implements PosterService {
  /** 海报宽度 */
  private readonly POSTER_WIDTH = 800

  /** 每个书签的高度 */
  private readonly BOOKMARK_HEIGHT = 60

  /** 内边距 */
  private readonly PADDING = 40

  /** 二维码尺寸 */
  private readonly QR_SIZE = 120

  /** 标题区域高度 */
  private readonly HEADER_HEIGHT = 80

  /** 底部区域高度（二维码 + 品牌） */
  private readonly FOOTER_HEIGHT = 150

  /** Favicon 缓存 */
  private faviconCache = new Map<string, HTMLImageElement>()

  /** Favicon 缓存最大数量 */
  private readonly MAX_FAVICON_CACHE_SIZE = 100

  /** 离屏 Canvas 缓存 */
  private offscreenCanvas: HTMLCanvasElement | null = null

  /**
   * 生成海报
   */
  async generatePoster(options: PosterOptions): Promise<string> {
    try {
      // 1. 检查 Canvas 支持
      if (!this.isCanvasSupported()) {
        throw new ShareError(
          ShareErrorCode.CANVAS_NOT_SUPPORTED,
          '浏览器不支持 Canvas，无法生成海报'
        )
      }

      // 2. 创建或复用离屏 Canvas
      const canvas = this.getOrCreateOffscreenCanvas()
      const ctx = canvas.getContext('2d')!

      // 3. 计算画布尺寸
      const height = this.calculateHeight(options.bookmarks.length)
      canvas.width = this.POSTER_WIDTH
      canvas.height = height

      // 4. 获取配置
      const config = this.getConfig(options.theme)

      // 5. 使用 requestAnimationFrame 优化渲染
      await new Promise<void>(resolve => {
        requestAnimationFrame(async () => {
          // 6. 绘制背景
          this.drawBackground(ctx, config)

          // 7. 绘制标题
          this.drawTitle(ctx, options.title || '书签分享', config)

          // 8. 绘制书签列表
          await this.drawBookmarks(ctx, options.bookmarks, config)

          // 9. 绘制二维码
          const qrDataUrl = await this.generateQRCode(options.shareUrl)
          await this.drawQRCode(ctx, qrDataUrl)

          // 10. 绘制品牌标识
          this.drawBranding(ctx, config)

          resolve()
        })
      })

      // 11. 导出为 Data URL
      const dataUrl = canvas.toDataURL('image/png')

      logger.info('PosterService', '海报生成成功', {
        width: canvas.width,
        height: canvas.height,
        bookmarkCount: options.bookmarks.length,
        theme: options.theme
      })

      return dataUrl
    } catch (error) {
      if (error instanceof ShareError) {
        throw error
      }
      logger.error('PosterService', '海报生成失败', error)
      throw new Error('海报生成失败，请重试')
    }
  }

  /**
   * 获取或创建离屏 Canvas
   */
  private getOrCreateOffscreenCanvas(): HTMLCanvasElement {
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas')
    }
    return this.offscreenCanvas
  }

  /**
   * 检查 Canvas 支持
   */
  private isCanvasSupported(): boolean {
    try {
      const canvas = document.createElement('canvas')
      return !!(canvas.getContext && canvas.getContext('2d'))
    } catch {
      return false
    }
  }

  /**
   * 计算画布高度
   */
  private calculateHeight(bookmarkCount: number): number {
    return (
      this.PADDING * 2 +
      this.HEADER_HEIGHT +
      bookmarkCount * this.BOOKMARK_HEIGHT +
      this.FOOTER_HEIGHT
    )
  }

  /**
   * 获取主题配置
   */
  private getConfig(theme: 'dark' | 'light'): PosterConfig {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { materialColors } = require('@acuity-bookmarks/design-tokens/colors')

      if (theme === 'dark') {
        return {
          width: this.POSTER_WIDTH,
          theme: 'dark',
          padding: this.PADDING,
          bookmarkHeight: this.BOOKMARK_HEIGHT,
          qrSize: this.QR_SIZE,
          colors: {
            // ✅ 使用 Material Design 3 颜色（暗色主题）
            // 注意：Canvas 中无法直接使用 CSS 变量，需要从 design-tokens 包导入
            // 通过导入 TypeScript 常量，确保与 design-tokens 包自动同步
            background: materialColors.surfaceDark.rgb,
            text: materialColors.onSurfaceDark.rgb,
            primary: materialColors.primaryDark.rgb,
            secondary: materialColors.secondaryDark.rgb
          }
        }
      } else {
        return {
          width: this.POSTER_WIDTH,
          theme: 'light',
          padding: this.PADDING,
          bookmarkHeight: this.BOOKMARK_HEIGHT,
          qrSize: this.QR_SIZE,
          colors: {
            // ✅ 使用 Material Design 3 颜色（亮色主题）
            // 注意：Canvas 中无法直接使用 CSS 变量，需要从 design-tokens 包导入
            // 通过导入 TypeScript 常量，确保与 design-tokens 包自动同步
            background: materialColors.surface.rgb,
            text: materialColors.onSurface.rgb,
            primary: materialColors.primary.rgb,
            secondary: materialColors.secondary.rgb
          }
        }
      }
    } catch {
      // 降级方案：如果导入失败，使用硬编码值
      if (theme === 'dark') {
        return {
          width: this.POSTER_WIDTH,
          theme: 'dark',
          padding: this.PADDING,
          bookmarkHeight: this.BOOKMARK_HEIGHT,
          qrSize: this.QR_SIZE,
          colors: {
            background: 'rgb(16, 20, 24)',
            text: 'rgb(224, 226, 232)',
            primary: 'rgb(155, 203, 251)',
            secondary: 'rgb(185, 200, 218)'
          }
        }
      } else {
        return {
          width: this.POSTER_WIDTH,
          theme: 'light',
          padding: this.PADDING,
          bookmarkHeight: this.BOOKMARK_HEIGHT,
          qrSize: this.QR_SIZE,
          colors: {
            background: 'rgb(247, 249, 255)',
            text: 'rgb(24, 28, 32)',
            primary: 'rgb(47, 98, 140)',
            secondary: 'rgb(81, 96, 111)'
          }
        }
      }
    }
  }

  /**
   * 绘制背景
   */
  private drawBackground(ctx: CanvasRenderingContext2D, config: PosterConfig): void {
    ctx.fillStyle = config.colors.background
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }

  /**
   * 绘制标题
   */
  private drawTitle(ctx: CanvasRenderingContext2D, title: string, config: PosterConfig): void {
    ctx.save()

    // 标题文字
    ctx.fillStyle = config.colors.text
    ctx.font = 'bold 28px Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textBaseline = 'top'

    const titleY = this.PADDING + 20
    ctx.fillText(title, this.PADDING, titleY)

    ctx.restore()
  }

  /**
   * 绘制书签列表
   */
  private async drawBookmarks(
    ctx: CanvasRenderingContext2D,
    bookmarks: Array<{ title: string; url: string; description?: string }>,
    config: PosterConfig
  ): Promise<void> {
    let y = this.PADDING + this.HEADER_HEIGHT

    for (const bookmark of bookmarks) {
      await this.drawBookmark(ctx, bookmark, y, config)
      y += this.BOOKMARK_HEIGHT
    }
  }

  /**
   * 绘制单个书签
   */
  private async drawBookmark(
    ctx: CanvasRenderingContext2D,
    bookmark: { title: string; url: string; description?: string },
    y: number,
    config: PosterConfig
  ): Promise<void> {
    ctx.save()

    // 1. 绘制 favicon
    const faviconX = this.PADDING
    const faviconY = y + 10

    if (bookmark.url) {
      const favicon = await this.loadFavicon(bookmark.url)
      if (favicon) {
        try {
          ctx.drawImage(favicon, faviconX, faviconY, 20, 20)
        } catch (_error) {
          // Favicon 加载失败，绘制默认图标
          this.drawDefaultIcon(ctx, faviconX, faviconY, config)
        }
      } else {
        this.drawDefaultIcon(ctx, faviconX, faviconY, config)
      }
    } else {
      this.drawDefaultIcon(ctx, faviconX, faviconY, config)
    }

    // 2. 绘制标题
    const titleX = this.PADDING + 30
    const titleY = y + 15

    ctx.fillStyle = config.colors.text
    ctx.font = '16px Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textBaseline = 'top'

    const maxTitleWidth = this.POSTER_WIDTH - this.PADDING * 2 - 40
    const truncatedTitle = this.truncateText(ctx, bookmark.title, maxTitleWidth)
    ctx.fillText(truncatedTitle, titleX, titleY)

    // 3. 绘制 URL
    const urlX = titleX
    const urlY = y + 35

    ctx.fillStyle = config.colors.primary
    ctx.font = '12px Inter, -apple-system, BlinkMacSystemFont, sans-serif'

    const maxUrlWidth = this.POSTER_WIDTH - this.PADDING * 2 - 40
    const truncatedUrl = this.truncateText(ctx, bookmark.url, maxUrlWidth)
    ctx.fillText(truncatedUrl, urlX, urlY)

    ctx.restore()
  }

  /**
   * 绘制默认图标
   */
  private drawDefaultIcon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    config: PosterConfig
  ): void {
    ctx.save()

    // 绘制圆形背景
    ctx.fillStyle = config.colors.primary
    ctx.beginPath()
    ctx.arc(x + 10, y + 10, 10, 0, Math.PI * 2)
    ctx.fill()

    // 绘制 "🔖" emoji
    ctx.fillStyle = config.colors.background
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🔖', x + 10, y + 10)

    ctx.restore()
  }

  /**
   * 截断文本
   */
  private truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    const metrics = ctx.measureText(text)
    if (metrics.width <= maxWidth) {
      return text
    }

    let truncated = text
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1)
    }

    return truncated + '...'
  }

  /**
   * 加载 favicon
   */
  private async loadFavicon(url: string): Promise<HTMLImageElement | null> {
    // 检查缓存
    if (this.faviconCache.has(url)) {
      return this.faviconCache.get(url)!
    }

    try {
      const faviconUrl = this.getFaviconUrl(url)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = faviconUrl

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Favicon 加载失败'))
        // 3 秒超时
        setTimeout(() => reject(new Error('Favicon 加载超时')), 3000)
      })

      // 缓存成功加载的 favicon
      this.addToFaviconCache(url, img)
      return img
    } catch (_error) {
      logger.debug('PosterService', 'Favicon 加载失败', { url })
      return null
    }
  }

  /**
   * 添加到 favicon 缓存（带 LRU 策略）
   */
  private addToFaviconCache(url: string, img: HTMLImageElement): void {
    // 如果缓存已满，删除最早的条目
    if (this.faviconCache.size >= this.MAX_FAVICON_CACHE_SIZE) {
      const firstKey = this.faviconCache.keys().next().value
      if (firstKey) {
        this.faviconCache.delete(firstKey)
      }
    }

    this.faviconCache.set(url, img)
  }

  /**
   * 获取 favicon URL
   */
  private getFaviconUrl(url: string): string {
    try {
      const domain = new URL(url).hostname
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    } catch {
      return ''
    }
  }

  /**
   * 绘制二维码
   */
  private async drawQRCode(ctx: CanvasRenderingContext2D, qrDataUrl: string): Promise<void> {
    const img = new Image()
    img.src = qrDataUrl

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('二维码加载失败'))
    })

    // 绘制在右下角
    const x = this.POSTER_WIDTH - this.PADDING - this.QR_SIZE
    const y = ctx.canvas.height - this.PADDING - this.QR_SIZE

    ctx.drawImage(img, x, y, this.QR_SIZE, this.QR_SIZE)
  }

  /**
   * 绘制品牌标识
   */
  private drawBranding(ctx: CanvasRenderingContext2D, config: PosterConfig): void {
    ctx.save()

    const y = ctx.canvas.height - this.PADDING - this.QR_SIZE / 2

    // 品牌文字
    ctx.fillStyle = config.colors.secondary
    ctx.font = '14px Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textBaseline = 'middle'

    ctx.fillText('AcuityBookmarks', this.PADDING, y)

    // 副标题
    ctx.fillStyle = config.colors.secondary
    ctx.font = '12px Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('智能书签管理工具', this.PADDING, y + 20)

    ctx.restore()
  }

  /**
   * 导出为 PNG Blob
   */
  async exportToPNG(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Canvas 转 Blob 失败'))
          }
        },
        'image/png',
        1.0
      )
    })
  }

  /**
   * 生成二维码
   */
  async generateQRCode(url: string): Promise<string> {
    try {
      const { default: QRCode } = await import('qrcode')
      return await QRCode.toDataURL(url, {
        width: this.QR_SIZE,
        margin: 1,
        color: {
          // ✅ 二维码颜色：黑白是标准配色，保持不变
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      })
    } catch (error) {
      logger.error('PosterService', '二维码生成失败', error)
      throw new Error('二维码生成失败')
    }
  }
}

/**
 * 海报生成服务单例
 */
export const posterService: PosterService = new PosterServiceImpl()
