/**
 * 分享服务
 * @module share/share-service
 * @description 提供书签数据编码、解码、分享链接生成等功能
 */

import type { BookmarkNode } from '@/types'
import { ShareError, ShareErrorCode, type ShareData } from './types'
import { logger } from '@/infrastructure/logging/logger'
import { websiteUrls } from '@/config/website'

/**
 * 分享服务接口
 */
export interface ShareService {
  /**
   * 编码书签数据为压缩字符串
   * @param bookmarks 书签列表
   * @param title 分享标题（可选）
   * @param sharedBy 分享者昵称（可选）
   * @returns 压缩编码后的字符串
   * @throws {ShareError} 当数据过大时抛出错误
   */
  encodeShareData(bookmarks: BookmarkNode[], title?: string, sharedBy?: string): Promise<string>

  /**
   * 解码分享数据
   * @param encoded 编码后的字符串
   * @returns 解码后的分享数据
   * @throws {ShareError} 当数据无效时抛出错误
   */
  decodeShareData(encoded: string): Promise<ShareData>

  /**
   * 生成分享 URL
   * @param encoded 编码后的数据
   * @returns 完整的分享 URL
   */
  generateShareUrl(encoded: string): string

  /**
   * 复制文本到剪贴板
   * @param text 要复制的文本
   * @throws {ShareError} 当浏览器不支持剪贴板 API 时抛出错误
   */
  copyToClipboard(text: string): Promise<void>

  /**
   * 下载图片
   * @param dataUrl 图片 Data URL
   * @param filename 文件名
   */
  downloadImage(dataUrl: string, filename: string): void
}

/**
 * 分享服务实现
 */
class ShareServiceImpl implements ShareService {
  /** 分享落地页基础 URL */
  private readonly BASE_URL = this.getBaseUrl()

  /** 最大数据长度（字符） */
  private readonly MAX_DATA_LENGTH = 4000

  /** 当前版本号 */
  private readonly VERSION = 1

  /**
   * 获取分享落地页基础 URL
   * 开发环境：使用环境变量配置的 URL（支持本地 IP，方便手机扫码测试）
   * 生产环境：使用正式域名
   */
  private getBaseUrl(): string {
    // 生产环境
    if (import.meta.env.PROD) {
      return `${websiteUrls.home}/share`
    }

    // 开发环境：优先使用环境变量，否则使用 localhost
    // 设置方法：在 frontend/.env.development.local 中配置 VITE_SHARE_BASE_URL
    // 例如：VITE_SHARE_BASE_URL=http://192.168.1.100:3001/share
    return import.meta.env.VITE_SHARE_BASE_URL || 'http://localhost:3001/share'
  }

  /**
   * 编码书签数据
   */
  async encodeShareData(
    bookmarks: BookmarkNode[],
    title?: string,
    sharedBy?: string
  ): Promise<string> {
    try {
      // 1. 构建分享数据结构
      const data: ShareData = {
        v: this.VERSION,
        b: bookmarks.map(bookmark => ({
          t: bookmark.title,
          u: bookmark.url || '',
          ...(typeof bookmark.description === 'string' ? { d: bookmark.description } : {})
        })),
        ...(title ? { t: title } : {}),
        ...(sharedBy ? { s: sharedBy } : {})
      }

      // 2. 序列化为 JSON
      const json = JSON.stringify(data)

      // 3. 使用 LZ-String 压缩
      const { default: LZString } = await import('lz-string')
      const compressed = LZString.compressToEncodedURIComponent(json)

      // 4. 检查数据大小
      if (compressed.length > this.MAX_DATA_LENGTH) {
        // 计算建议的书签数量
        const ratio = this.MAX_DATA_LENGTH / compressed.length
        const suggestedCount = Math.floor(bookmarks.length * ratio * 0.9) // 留 10% 余量

        logger.warn('ShareService', '分享数据过大', {
          length: compressed.length,
          maxLength: this.MAX_DATA_LENGTH,
          bookmarkCount: bookmarks.length,
          suggestedCount
        })

        throw new ShareError(
          ShareErrorCode.DATA_TOO_LARGE,
          `分享数据过大（${compressed.length} 字符，限制 ${this.MAX_DATA_LENGTH} 字符）\n` +
            `当前 ${bookmarks.length} 个书签，建议减少到 ${suggestedCount} 个以内`
        )
      }

      logger.info('ShareService', '数据编码成功', {
        bookmarkCount: bookmarks.length,
        originalSize: json.length,
        compressedSize: compressed.length,
        compressionRatio: ((1 - compressed.length / json.length) * 100).toFixed(1) + '%'
      })

      return compressed
    } catch (error) {
      if (error instanceof ShareError) {
        throw error
      }
      logger.error('ShareService', '数据编码失败', error)
      throw new ShareError(ShareErrorCode.INVALID_DATA, '数据编码失败，请重试')
    }
  }

  /**
   * 解码分享数据
   */
  async decodeShareData(encoded: string): Promise<ShareData> {
    try {
      // 1. 解压缩
      const { default: LZString } = await import('lz-string')
      const decompressed = LZString.decompressFromEncodedURIComponent(encoded)

      if (!decompressed) {
        throw new Error('解压缩失败')
      }

      // 2. 解析 JSON
      const data = JSON.parse(decompressed) as ShareData

      // 3. 验证数据格式
      this.validateShareData(data)

      logger.info('ShareService', '数据解码成功', {
        version: data.v,
        bookmarkCount: data.b.length,
        hasTitle: !!data.t,
        hasSharedBy: !!data.s
      })

      return data
    } catch (error) {
      logger.error('ShareService', '数据解码失败', error)
      throw new ShareError(ShareErrorCode.INVALID_DATA, '分享链接无效或已损坏，请检查链接是否完整')
    }
  }

  /**
   * 验证分享数据格式
   */
  private validateShareData(data: unknown): asserts data is ShareData {
    if (!data || typeof data !== 'object') {
      throw new Error('数据格式无效：不是对象')
    }

    const d = data as Record<string, unknown>

    // 验证版本号
    if (typeof d.v !== 'number' || d.v < 1) {
      throw new Error('数据格式无效：版本号缺失或无效')
    }

    // 验证书签列表
    if (!Array.isArray(d.b)) {
      throw new Error('数据格式无效：书签列表缺失')
    }

    // 验证每个书签
    for (const bookmark of d.b) {
      if (!bookmark || typeof bookmark !== 'object') {
        throw new Error('数据格式无效：书签格式错误')
      }

      const b = bookmark as Record<string, unknown>

      if (typeof b.t !== 'string' || typeof b.u !== 'string') {
        throw new Error('数据格式无效：书签缺少标题或 URL')
      }
    }

    // 验证可选字段
    if (d.t !== undefined && typeof d.t !== 'string') {
      throw new Error('数据格式无效：标题格式错误')
    }

    if (d.s !== undefined && typeof d.s !== 'string') {
      throw new Error('数据格式无效：分享者信息格式错误')
    }
  }

  /**
   * 生成分享 URL
   */
  generateShareUrl(encoded: string): string {
    return `${this.BASE_URL}?data=${encoded}`
  }

  /**
   * 复制文本到剪贴板
   */
  async copyToClipboard(text: string): Promise<void> {
    // 检查浏览器是否支持 Clipboard API
    if (!navigator.clipboard) {
      logger.warn('ShareService', '浏览器不支持 Clipboard API')
      throw new ShareError(
        ShareErrorCode.CLIPBOARD_NOT_SUPPORTED,
        '浏览器不支持剪贴板功能，请手动复制'
      )
    }

    try {
      await navigator.clipboard.writeText(text)
      logger.info('ShareService', '文本已复制到剪贴板', {
        length: text.length
      })
    } catch (error) {
      logger.error('ShareService', '复制到剪贴板失败', error)
      throw new ShareError(ShareErrorCode.CLIPBOARD_NOT_SUPPORTED, '复制失败，请手动复制')
    }
  }

  /**
   * 下载图片
   */
  downloadImage(dataUrl: string, filename: string): void {
    try {
      // 创建临时 <a> 元素
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = filename

      // 触发下载
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      logger.info('ShareService', '图片下载已触发', { filename })
    } catch (error) {
      logger.error('ShareService', '图片下载失败', error)
      throw new Error('图片下载失败，请重试')
    }
  }
}

/**
 * 分享服务单例
 */
export const shareService: ShareService = new ShareServiceImpl()
