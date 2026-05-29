/// <reference lib="webworker" />
import { Document } from 'flexsearch'
import type {
  WorkerDoc,
  WorkerHit,
  SearchWorkerCommand,
  SearchWorkerEvent,
  WorkerInitOptions
} from '@/types/domain/query'

declare const self: DedicatedWorkerGlobalScope

/**
 * FlexSearch 索引文档类型
 */
interface IndexedDoc {
  id: string
  titleLower: string
  urlLower: string
  domain: string
  [key: string]: string // 添加索引签名以满足 FlexSearch 的 DocumentData 约束
}

/** FlexSearch 查询实例 */
let flexIndex: Document<IndexedDoc> | null = null
/** 当前索引的文档集合 */
let docs: WorkerDoc[] = []
/** 文档 ID 到索引的映射 */
const docMap: Map<string, WorkerDoc> = new Map()

/**
 * 向主线程发送消息
 */
function post(msg: SearchWorkerEvent) {
  self.postMessage(msg)
}

/**
 * 构建 FlexSearch 索引
 */
function buildIndex(input: WorkerDoc[], _options?: WorkerInitOptions) {
  // 创建 FlexSearch Document Index
  flexIndex = new Document<IndexedDoc>({
    id: 'id',
    index: [
      {
        field: 'titleLower',
        tokenize: 'forward', // 前向分词，适合中文
        resolution: 9 // 高精度
      },
      {
        field: 'urlLower',
        tokenize: 'strict', // 严格分词，适合 URL
        resolution: 5
      },
      {
        field: 'domain',
        tokenize: 'forward',
        resolution: 5
      }
    ],
    store: ['id', 'titleLower', 'urlLower', 'domain'],
    cache: true
  })

  // 构建文档映射
  docMap.clear()
  for (const doc of input) {
    docMap.set(doc.id, doc)

    // 添加到索引
    flexIndex.add({
      id: doc.id,
      titleLower: doc.titleLower || '',
      urlLower: doc.urlLower || '',
      domain: doc.domain || ''
    })
  }
}

/**
 * 处理初始化命令
 */
function handleInit(cmd: Extract<SearchWorkerCommand, { type: 'init' }>) {
  docs = cmd.docs || []
  buildIndex(docs, cmd.options)
  post({ type: 'inited', docCount: docs.length })
}

/**
 * 处理查询命令
 */
function handleQuery(cmd: Extract<SearchWorkerCommand, { type: 'query' }>) {
  if (!flexIndex) {
    buildIndex(docs)
  }
  if (!flexIndex) {
    post({
      type: 'error',
      message: 'Search index not initialized',
      reqId: cmd.reqId
    })
    return
  }

  // 执行搜索
  const results = flexIndex.search(cmd.q, cmd.limit || 100, {
    index: ['titleLower', 'urlLower', 'domain']
  })

  // FlexSearch 返回格式：
  // [
  //   { field: 'titleLower', result: ['id1', 'id2'] },
  //   { field: 'urlLower', result: ['id3'] },
  //   ...
  // ]

  // 合并结果并计算综合得分
  const scoreMap = new Map<string, { score: number; matchedFields: Set<string> }>()

  // 字段权重
  const fieldWeights: Record<string, number> = {
    titleLower: 0.6,
    urlLower: 0.3,
    domain: 0.2
  }

  // 遍历每个字段的结果
  for (const fieldResult of results) {
    const field = fieldResult.field as string
    const ids = fieldResult.result as string[]
    const weight = fieldWeights[field] || 0.1

    // 为每个匹配的 ID 累加得分
    ids.forEach((id, index) => {
      const existing = scoreMap.get(id)
      // 位置越靠前，得分越高
      const positionScore = 1 - (index / ids.length) * 0.5
      const fieldScore = weight * positionScore

      if (existing) {
        existing.score += fieldScore
        existing.matchedFields.add(field)
      } else {
        scoreMap.set(id, {
          score: fieldScore,
          matchedFields: new Set([field])
        })
      }
    })
  }

  // 转换为 WorkerHit 数组
  const hits: WorkerHit[] = []
  for (const [id, { score, matchedFields }] of scoreMap.entries()) {
    // 多字段匹配加成
    const multiFieldBonus = matchedFields.size > 1 ? 0.2 : 0
    const finalScore = Math.min(1.0, score + multiFieldBonus)

    hits.push({
      id,
      score: finalScore
    })
  }

  // 按得分降序排序
  hits.sort((a, b) => b.score - a.score)

  // 限制返回数量
  const top = cmd.limit ? hits.slice(0, cmd.limit) : hits

  post({ type: 'result', reqId: cmd.reqId, hits: top })
}

/**
 * 处理增量更新命令
 *
 * 支持添加、更新、删除文档
 */
function handlePatch(cmd: Extract<SearchWorkerCommand, { type: 'applyPatch' }>) {
  let changed = false
  if (cmd.removes && cmd.removes.length) {
    const set = new Set(cmd.removes)
    const before = docs.length
    docs = docs.filter(d => !set.has(d.id))
    changed = changed || docs.length !== before
  }
  if (cmd.updates && cmd.updates.length) {
    const idMap = new Map(docs.map(d => [d.id, d] as const))
    for (const u of cmd.updates) {
      const existing = idMap.get(u.id)
      if (existing) {
        Object.assign(existing, u)
      }
    }
    docs = Array.from(idMap.values())
    changed = true
  }
  if (cmd.adds && cmd.adds.length) {
    docs.push(...cmd.adds)
    changed = true
  }
  if (changed) buildIndex(docs)
}

/**
 * 处理销毁命令
 *
 * 清理索引和文档数据
 */
function handleDispose() {
  flexIndex = null
  docs = []
  docMap.clear()
}

/**
 * 监听主线程消息
 */
self.onmessage = (e: MessageEvent<SearchWorkerCommand>) => {
  const data = e.data
  try {
    switch (data.type) {
      case 'init':
        handleInit(data)
        break
      case 'query':
        handleQuery(data)
        break
      case 'applyPatch':
        handlePatch(data)
        break
      case 'dispose':
        handleDispose()
        break
      default:
        post({ type: 'error', message: 'Unknown command type' })
    }
  } catch (err) {
    const message = (err as Error).message || 'Unknown error'
    const reqId = data.type === 'query' ? data.reqId : undefined
    post({ type: 'error', message, reqId })
  }
}

// 通知主线程 Worker 已就绪
post({ type: 'ready' })
