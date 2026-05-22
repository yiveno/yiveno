/**
 * 分享服务 - 官网版本
 * 用于解码分享链接中的书签数据
 *
 * 注意：必须与 frontend/src/application/share/share-service.ts 的编码方式保持一致
 */

import LZString from 'lz-string'

/**
 * 分享数据结构（内部格式，与 frontend 保持一致）
 */
interface ShareDataInternal {
  /** 版本号 */
  v: number
  /** 分享标题（可选） */
  t?: string
  /** 书签列表 */
  b: Array<{
    /** 书签标题 */
    t: string
    /** URL */
    u: string
    /** 描述（可选） */
    d?: string
  }>
  /** 分享者信息（可选） */
  s?: string
}

/**
 * 分享数据结构（对外展示格式）
 */
export interface ShareData {
  bookmarks: Array<{
    title: string
    url: string
    description?: string
  }>
  title: string
  timestamp: number
  version: number
}

/**
 * 解码分享数据
 * @param encoded LZ-String 压缩的 URI 编码数据
 * @returns 解码后的分享数据
 */
export function decodeShareData(encoded: string): ShareData {
  try {
    // 1. LZ-String 解压缩（使用 decompressFromEncodedURIComponent，与 frontend 编码方式对应）
    const decompressed = LZString.decompressFromEncodedURIComponent(encoded)

    if (!decompressed) {
      throw new Error('解压缩失败')
    }

    // 2. JSON 解析
    const data = JSON.parse(decompressed) as ShareDataInternal

    // 3. 数据验证
    if (!data.v || !Array.isArray(data.b)) {
      throw new Error('无效的分享数据格式')
    }

    // 4. 转换为对外格式
    return {
      version: data.v,
      title: data.t || '分享的书签',
      timestamp: Date.now(), // 当前时间作为查看时间
      bookmarks: data.b.map(b => ({
        title: b.t,
        url: b.u,
        description: b.d
      }))
    }
  } catch (error) {
    console.error('解码分享数据失败:', error)
    throw new Error('无法解析分享链接，请检查链接是否完整')
  }
}

/**
 * 从 URL 参数中获取分享数据
 * @param url 完整的 URL 或 search 参数字符串
 * @returns 解码后的分享数据，如果没有数据则返回 null
 */
export function getShareDataFromUrl(url?: string): ShareData | null {
  try {
    const searchParams = new URLSearchParams(
      url || (typeof window !== 'undefined' ? window.location.search : '')
    )

    const encoded = searchParams.get('data')

    if (!encoded) {
      return null
    }

    return decodeShareData(encoded)
  } catch (error) {
    console.error('从 URL 获取分享数据失败:', error)
    return null
  }
}
