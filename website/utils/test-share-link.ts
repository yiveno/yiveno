/**
 * 生成测试用的分享链接
 * 用于开发和测试分享落地页
 */

import LZString from 'lz-string'
import type { ShareData } from './share-service'

export function generateTestShareLink(): string {
  const testData: ShareData = {
    bookmarks: [
      {
        title: 'Vue.js 官方文档',
        url: 'https://vuejs.org/',
        description: 'Vue.js 是一个渐进式 JavaScript 框架'
      },
      {
        title: 'Nuxt 3 文档',
        url: 'https://nuxt.com/',
        description: 'Nuxt 是一个基于 Vue.js 的全栈框架'
      },
      {
        title: 'TypeScript 官网',
        url: 'https://www.typescriptlang.org/',
        description: 'TypeScript 是 JavaScript 的超集'
      },
      {
        title: 'Tailwind CSS',
        url: 'https://tailwindcss.com/',
        description: '实用优先的 CSS 框架'
      },
      {
        title: 'GitHub',
        url: 'https://github.com/',
        description: '全球最大的代码托管平台'
      }
    ],
    title: '我的前端开发书签',
    timestamp: Date.now(),
    version: 1 // 修改为数字类型
  }

  // 1. JSON 序列化
  const jsonString = JSON.stringify(testData)

  // 2. LZ-String 压缩
  const compressed = LZString.compressToUTF16(jsonString)

  // 3. Base64 编码
  const encoded = btoa(compressed)

  // 4. 生成完整 URL
  const baseUrl = 'http://localhost:3000/share'
  return `${baseUrl}?data=${encodeURIComponent(encoded)}`
}

// 在开发环境中打印测试链接
if (process.env.NODE_ENV === 'development') {
  console.log('测试分享链接:', generateTestShareLink())
}
