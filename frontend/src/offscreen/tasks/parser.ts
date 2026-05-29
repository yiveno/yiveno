/**
 * 页面元数据类型
 */
export interface PageMetadata {
  title?: string
  description?: string
  keywords?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  ogType?: string
  iconHref?: string
  lang?: string
  author?: string
}

/**
 * 将 HTML 文本解析为结构化页面元数据
 *
 * 使用 DOMParser 提取页面基础元数据，仅返回爬虫需要的关键字段
 *
 * @param html 原始 HTML 字符串
 * @returns 提取到的关键元数据字段
 */
export function parseHtml(html: string): Partial<PageMetadata> {
  const normalizedHtml = typeof html === 'string' ? html : ''
  if (!normalizedHtml.trim()) {
    return {}
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(normalizedHtml, 'text/html')

    const getMeta = (name: string) =>
      (
        doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ??
        doc.querySelector(`meta[property="${name}"]`)?.getAttribute('content') ??
        ''
      ).trim()

    const title = (doc.querySelector('title')?.textContent ?? '').trim()
    const description = getMeta('description') || getMeta('og:description') || ''
    const keywords = getMeta('keywords')
    const ogTitle = getMeta('og:title')
    const ogDescription = getMeta('og:description')
    const ogImage = getMeta('og:image')
    const ogType = getMeta('og:type')
    const iconHref =
      doc
        .querySelector('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
        ?.getAttribute('href') ?? ''
    const language = doc.querySelector('html')?.getAttribute('lang')?.trim().toLowerCase() ?? ''
    const author = getMeta('author')

    return {
      title,
      description,
      keywords,
      ogTitle,
      ogDescription,
      ogImage,
      ogType,
      iconHref,
      lang: language,
      author
    }
  } catch {
    // DOMParser 解析失败时回退为空对象
    return {}
  }
}
