/**
 * Embedding 调试工具
 *
 * 将 embeddingService 的关键方法挂载到 window，
 * 方便在 Chrome 扩展 DevTools Console 里直接调试。
 *
 * 使用方式（在扩展页面的 Console 里）：
 *
 * // 1. 检查 Provider 是否可用
 * await __AB_EMBEDDING__.checkProvider()
 *
 * // 2. 查看向量库统计
 * await __AB_EMBEDDING__.stats()
 *
 * // 3. 手动触发书签同步（生成 embedding）
 * await __AB_EMBEDDING__.sync()
 *
 * // 4. 测试语义搜索
 * await __AB_EMBEDDING__.search('音乐相关')
 *
 * // 5. 测试单条 embedding 生成
 * await __AB_EMBEDDING__.embed('JavaScript 教程')
 */

import { embeddingService } from '@/infrastructure/embedding/embedding-service'
import { localVectorStore } from '@/infrastructure/embedding/local-vector-store'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'EmbeddingDebug'

export interface EmbeddingDebugBridge {
  /** 检查 Provider 可用性 */
  checkProvider(): Promise<{
    available: boolean
    providerName: string | null
    dimensions: number | null
  }>
  /** 查看向量库统计 */
  stats(): Promise<{ count: number; providerName: string | null }>
  /** 手动触发全量同步 */
  sync(): Promise<void>
  /** 测试语义搜索 */
  search(query: string, topK?: number): Promise<Array<{ title: string; url: string; score: number }>>
  /** 测试单条 embedding 生成（验证模型是否正常工作） */
  embed(text: string): Promise<number[]>
  /** 清空向量库（用于重置测试） */
  clearVectors(): Promise<void>
  /** 诊断向量数据质量 */
  diagnose(): Promise<void>
  /** 检查书签元数据覆盖率 */
  checkMetadataCoverage(): Promise<void>
  /** 直接访问 vectorStore（用于调试） */
  vectorStore: typeof localVectorStore
  /** 直接访问 embeddingService（用于调试） */
  service: typeof embeddingService
}

async function checkProvider() {
  const provider = await embeddingService.getProvider()
  if (!provider) {
    console.warn('[EmbeddingDebug] ❌ 没有可用的 Embedding Provider')
    return { available: false, providerName: null, dimensions: null }
  }
  console.info(`[EmbeddingDebug] ✅ Provider 可用: ${provider.name}, 维度: ${provider.dimensions}`)
  return { available: true, providerName: provider.name, dimensions: provider.dimensions }
}

async function stats() {
  const result = await embeddingService.getStats()
  console.info(`[EmbeddingDebug] 向量库: ${result.count} 条, Provider: ${result.providerName ?? '未初始化'}`)
  return result
}

async function sync() {
  console.info('[EmbeddingDebug] 开始同步书签 embedding...')
  const bookmarks = await indexedDBManager.getAllBookmarks()
  const urlBookmarks = bookmarks.filter(b => b.url && !b.isFolder)
  console.info(`[EmbeddingDebug] 共 ${urlBookmarks.length} 条书签需要处理`)

  await embeddingService.syncBookmarks(bookmarks, progress => {
    const pct = Math.round((progress.processed / progress.total) * 100)
    console.info(`[EmbeddingDebug] 进度: ${progress.processed}/${progress.total} (${pct}%) 失败: ${progress.failed}`)
  })
  console.info('[EmbeddingDebug] ✅ 同步完成')
}

async function search(query: string, topK = 10) {
  console.info(`[EmbeddingDebug] 搜索: "${query}"`)
  
  // 获取查询向量
  const provider = await embeddingService.getProvider()
  if (!provider) {
    console.error('[EmbeddingDebug] Provider 不可用')
    return []
  }
  
  const queryVector = await provider.embed(query.trim())
  console.info(`[EmbeddingDebug] 查询向量维度: ${queryVector.length}`)
  console.info(`[EmbeddingDebug] 查询向量前5个值: [${queryVector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)
  console.info(`[EmbeddingDebug] 查询向量是否全为0: ${queryVector.every(v => v === 0)}`)
  
  // 获取所有向量记录
  const allRecords = await localVectorStore.getAll()
  console.info(`[EmbeddingDebug] 向量库总记录数: ${allRecords.length}`)
  
  if (allRecords.length === 0) {
    console.warn('[EmbeddingDebug] 向量库为空，请先运行 sync()')
    return []
  }
  
  // 检查包含查询词的记录
  const matchingRecords = allRecords.filter(r => r.title.includes(query))
  console.info(`[EmbeddingDebug] 标题包含"${query}"的记录数: ${matchingRecords.length}`)
  
  const firstMatch = matchingRecords[0]
  if (firstMatch) {
    console.info(`[EmbeddingDebug] 第一条匹配记录:`, {
      title: firstMatch.title,
      vectorDim: firstMatch.vector.length,
      vectorFirst5: firstMatch.vector.slice(0, 5).map(v => v.toFixed(4)),
      vectorAllZero: firstMatch.vector.every(v => v === 0)
    })
    
    // 手动计算相似度
    const similarity = dotProduct(queryVector, firstMatch.vector)
    console.info(`[EmbeddingDebug] 手动计算相似度: ${similarity.toFixed(4)}`)
  }
  
  // 执行搜索（使用较低的阈值）
  const results = await embeddingService.search(query, topK, 0.1)
  
  if (results.length === 0) {
    console.warn('[EmbeddingDebug] ❌ 无结果！可能原因：')
    console.warn('  1. 向量数据全为0（检查上面的 vectorAllZero）')
    console.warn('  2. 向量维度不匹配（检查上面的 vectorDim）')
    console.warn('  3. 相似度计算有问题（检查上面的手动计算相似度）')
    console.warn('  4. 需要重新同步向量库：await __AB_EMBEDDING__.sync()')
    return []
  }
  
  const formatted = results.map(r => ({ title: r.title, url: r.url, score: Number(r.score.toFixed(4)) }))
  console.table(formatted)
  return formatted
}

// 点积计算（用于手动验证相似度）
function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const left = a[i]
    const right = b[i]
    if (left === undefined || right === undefined) return 0
    sum += left * right
  }
  return sum
}

async function embed(text: string) {
  const provider = await embeddingService.getProvider()
  if (!provider) {
    console.error('[EmbeddingDebug] Provider 不可用')
    return []
  }
  console.info(`[EmbeddingDebug] 生成 embedding: "${text}"`)
  const vector = await provider.embed(text)
  console.info(`[EmbeddingDebug] ✅ 向量维度: ${vector.length}, 前5个值: [${vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)
  return vector
}

async function clearVectors() {
  const allIds = await localVectorStore.getAllIds()
  await localVectorStore.deleteBatch(Array.from(allIds))
  console.info(`[EmbeddingDebug] 已清空 ${allIds.size} 条向量记录`)
}

/**
 * 诊断向量数据质量
 */
async function diagnose() {
  console.info('[EmbeddingDebug] 🔍 开始诊断向量数据...')
  
  const allRecords = await localVectorStore.getAll()
  console.info(`[EmbeddingDebug] 向量库总记录数: ${allRecords.length}`)
  
  if (allRecords.length === 0) {
    console.warn('[EmbeddingDebug] ❌ 向量库为空，请先运行: await __AB_EMBEDDING__.sync()')
    return
  }
  
  // 统计向量质量
  let zeroVectorCount = 0
  let wrongDimensionCount = 0
  const expectedDim = 384
  
  for (const record of allRecords) {
    if (record.vector.every(v => v === 0)) {
      zeroVectorCount++
    }
    if (record.vector.length !== expectedDim) {
      wrongDimensionCount++
    }
  }
  
  console.info('[EmbeddingDebug] 📊 向量质量统计:')
  console.info(`  - 总记录数: ${allRecords.length}`)
  console.info(`  - 全为0的向量: ${zeroVectorCount} (${((zeroVectorCount / allRecords.length) * 100).toFixed(1)}%)`)
  console.info(`  - 维度错误的向量: ${wrongDimensionCount} (${((wrongDimensionCount / allRecords.length) * 100).toFixed(1)}%)`)
  console.info(`  - 正常向量: ${allRecords.length - zeroVectorCount - wrongDimensionCount}`)
  
  // 显示前3条记录的详细信息
  console.info('[EmbeddingDebug] 📝 前3条记录详情:')
  allRecords.slice(0, 3).forEach((record, idx) => {
    console.info(`  ${idx + 1}. ${record.title}`)
    console.info(`     - 向量维度: ${record.vector.length}`)
    console.info(`     - 向量前5个值: [${record.vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)
    console.info(`     - 是否全为0: ${record.vector.every(v => v === 0)}`)
    console.info(`     - 模型: ${record.model}`)
  })
  
  // 检查 Provider
  const provider = await embeddingService.getProvider()
  if (provider) {
    console.info('[EmbeddingDebug] ✅ Provider 可用:', provider.name)
    
    // 测试生成一个向量
    const testVector = await provider.embed('测试文本')
    console.info('[EmbeddingDebug] 🧪 测试向量生成:')
    console.info(`  - 维度: ${testVector.length}`)
    console.info(`  - 前5个值: [${testVector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)
    console.info(`  - 是否全为0: ${testVector.every(v => v === 0)}`)
  } else {
    console.error('[EmbeddingDebug] ❌ Provider 不可用')
  }
  
  // 给出建议
  if (zeroVectorCount > 0 || wrongDimensionCount > 0) {
    console.warn('[EmbeddingDebug] ⚠️ 发现问题向量，建议操作:')
    console.warn('  1. 清空向量库: await __AB_EMBEDDING__.clearVectors()')
    console.warn('  2. 重新同步: await __AB_EMBEDDING__.sync()')
  } else {
    console.info('[EmbeddingDebug] ✅ 向量数据质量正常')
  }
}

/**
 * 检查书签的元数据覆盖率
 */
async function checkMetadataCoverage() {
  console.info('[EmbeddingDebug] 📊 检查书签元数据覆盖率...')
  
  const allBookmarks = await indexedDBManager.getAllBookmarks()
  const urlBookmarks = allBookmarks.filter(b => b.url && !b.isFolder)
  
  let hasMetaTitleCount = 0
  let hasMetaDescCount = 0
  let hasMetaKeywordsCount = 0
  
  for (const bookmark of urlBookmarks) {
    if (bookmark.metaTitleLower) hasMetaTitleCount++
    if (bookmark.metaDescriptionLower) hasMetaDescCount++
    if (bookmark.metaKeywordsTokens && bookmark.metaKeywordsTokens.length > 0) {
      hasMetaKeywordsCount++
    }
  }
  
  console.info('[EmbeddingDebug] 📈 元数据覆盖率:')
  console.info(`  - 总书签数: ${urlBookmarks.length}`)
  console.info(`  - 有 meta title: ${hasMetaTitleCount} (${((hasMetaTitleCount / urlBookmarks.length) * 100).toFixed(1)}%)`)
  console.info(`  - 有 meta description: ${hasMetaDescCount} (${((hasMetaDescCount / urlBookmarks.length) * 100).toFixed(1)}%)`)
  console.info(`  - 有 meta keywords: ${hasMetaKeywordsCount} (${((hasMetaKeywordsCount / urlBookmarks.length) * 100).toFixed(1)}%)`)
  
  // 显示几个有元数据的示例
  const withMetadata = urlBookmarks.filter(b => 
    b.metaTitleLower || b.metaDescriptionLower || (b.metaKeywordsTokens && b.metaKeywordsTokens.length > 0)
  ).slice(0, 3)
  
  if (withMetadata.length > 0) {
    console.info('[EmbeddingDebug] 📝 元数据示例:')
    withMetadata.forEach((bookmark, idx) => {
      console.info(`  ${idx + 1}. ${bookmark.title}`)
      if (bookmark.metaTitleLower) {
        console.info(`     - Meta Title: ${bookmark.metaTitleLower}`)
      }
      if (bookmark.metaDescriptionLower) {
        console.info(`     - Meta Description: ${bookmark.metaDescriptionLower.slice(0, 100)}...`)
      }
      if (bookmark.metaKeywordsTokens && bookmark.metaKeywordsTokens.length > 0) {
        console.info(`     - Meta Keywords: ${bookmark.metaKeywordsTokens.slice(0, 5).join(', ')}`)
      }
    })
  } else {
    console.warn('[EmbeddingDebug] ⚠️ 没有书签包含元数据')
    console.info('[EmbeddingDebug] 💡 提示: 元数据需要通过爬虫服务获取')
    console.info('  当前 buildBookmarkText 已支持元数据，一旦有元数据就会自动使用')
  }
}

/**
 * 启用 Embedding 调试桥
 * 将调试方法挂载到 window.__AB_EMBEDDING__
 */
export function enableEmbeddingDebugBridge(): () => void {
  const bridge: EmbeddingDebugBridge = {
    checkProvider,
    stats,
    sync,
    search,
    embed,
    clearVectors,
    diagnose,
    checkMetadataCoverage,
    vectorStore: localVectorStore,
    service: embeddingService
  }

  ;(window as Window & { __AB_EMBEDDING__?: EmbeddingDebugBridge }).__AB_EMBEDDING__ = bridge
  logger.info(LOG_TAG, '🔧 Embedding 调试桥已启用，在 Console 中使用 __AB_EMBEDDING__')
  
  // 获取控制台样式颜色
  const getConsoleColor = (): string => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { materialColors } = require('@acuity-bookmarks/design-tokens/colors')
      return materialColors.primaryDark.rgb
    } catch {
      // 降级方案
      return 'rgb(155, 203, 251)'
    }
  }
  
  console.info(
    '%c[EmbeddingDebug] 调试命令：\n' +
    '  await __AB_EMBEDDING__.checkProvider()         // 检查 Provider\n' +
    '  await __AB_EMBEDDING__.stats()                 // 向量库统计\n' +
    '  await __AB_EMBEDDING__.diagnose()              // 诊断向量数据质量\n' +
    '  await __AB_EMBEDDING__.checkMetadataCoverage() // 检查元数据覆盖率 ⭐\n' +
    '  await __AB_EMBEDDING__.sync()                  // 触发同步\n' +
    '  await __AB_EMBEDDING__.search("音乐")          // 测试搜索\n' +
    '  await __AB_EMBEDDING__.embed("文本")           // 测试 embedding\n' +
    '  await __AB_EMBEDDING__.vectorStore.getAll()    // 获取所有向量',
    `color: ${getConsoleColor()}; font-weight: bold`
  )

  return () => {
    delete (window as Window & { __AB_EMBEDDING__?: EmbeddingDebugBridge }).__AB_EMBEDDING__
  }
}
