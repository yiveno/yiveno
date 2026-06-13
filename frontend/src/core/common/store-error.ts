/**
 * 数据验证工具
 */

/**
 * 书签节点与 URL 校验
 */
export class DataValidator {
  /**
   * 检查是否为书签树节点
   */
  static isBookmarkTreeNode(obj: unknown): obj is chrome.bookmarks.BookmarkTreeNode {
    if (!obj || typeof obj !== 'object') return false
    const node = obj as Record<string, unknown>
    return typeof node.id === 'string' && typeof node.title === 'string'
  }

  /**
   * 检查是否为书签数组
   */
  static isBookmarkArray(arr: unknown): arr is chrome.bookmarks.BookmarkTreeNode[] {
    return Array.isArray(arr) && arr.every(item => this.isBookmarkTreeNode(item))
  }

  /**
   * 验证 URL 是否有效
   */
  static validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)

      const protocol = urlObj.protocol.toLowerCase()
      if (!['http:', 'https:'].includes(protocol)) return false

      const host = urlObj.hostname.trim()
      if (!host) return false

      if (host === 'localhost') return false
      if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false

      const parts = host.split('.')
      if (parts.length < 2) return false

      const tld = parts[parts.length - 1]
      const sld = parts[parts.length - 2]
      if (!tld || !sld) return false

      if (!/^[a-z]{2,}$/i.test(tld)) return false

      const labelRegex = /^(?:xn--)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
      if (!labelRegex.test(sld)) return false
      for (const label of parts) {
        if (!labelRegex.test(label)) return false
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * 验证书签节点数据（仅验证有 URL 的书签，文件夹节点无需 URL 验证）
   */
  static validateBookmarkNode(node: unknown): boolean {
    return this.isBookmarkTreeNode(node) && this.validateUrl(node.url || '')
  }
}
