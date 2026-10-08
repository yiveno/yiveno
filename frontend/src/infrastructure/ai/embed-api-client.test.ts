import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
globalThis.fetch = fetchMock as unknown as typeof fetch

import {
  clearEmbedCacheForTests,
  requestWorkerEmbeddings
} from '@/infrastructure/ai/embed-api-client'

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.aaaaaaaaaaaa'
const TEXT = 'manifest v3'
const VECTOR = new Array(1024).fill(0).map((_, i) => i / 1024)

function okResponse(embeddings: number[][]): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data: { model: '@cf/baai/bge-m3', dim: 1024, embeddings }
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )
}

function errorResponse(status = 401, code = 'unauthorized'): Response {
  return new Response(JSON.stringify({ success: false, error: code }), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

describe('requestWorkerEmbeddings · 缓存行为（A2）', () => {
  beforeEach(() => {
    clearEmbedCacheForTests()
    fetchMock.mockReset()
  })

  afterEach(() => {
    clearEmbedCacheForTests()
  })

  it('首次请求：调 fetch 并写入缓存', async () => {
    fetchMock.mockResolvedValueOnce(okResponse([VECTOR]))
    const result = await requestWorkerEmbeddings(TOKEN, [TEXT])
    expect(result.embeddings).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('同文本 5min 内再次请求：零 fetch，命中缓存', async () => {
    fetchMock.mockResolvedValueOnce(okResponse([VECTOR]))
    await requestWorkerEmbeddings(TOKEN, [TEXT])
    // 第二次同 clue：缓存路径，零网络
    const result = await requestWorkerEmbeddings(TOKEN, [TEXT])
    expect(fetchMock).toHaveBeenCalledTimes(1) // 第二次没触发
    expect(result.embeddings[0]).toEqual(VECTOR)
  })

  it('不同文本：分别缓存，分别 fetch', async () => {
    fetchMock.mockResolvedValueOnce(okResponse([VECTOR]))
    fetchMock.mockResolvedValueOnce(okResponse([VECTOR.slice()]))
    await requestWorkerEmbeddings(TOKEN, ['manifest v3'])
    await requestWorkerEmbeddings(TOKEN, ['cloudflare workers'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // 再来一次第一次的文本：仍应命中缓存
    await requestWorkerEmbeddings(TOKEN, ['manifest v3'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('请求失败：不污染缓存，下次重试仍走网络', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'server_error'))
    await expect(requestWorkerEmbeddings(TOKEN, [TEXT])).rejects.toThrow('server_error')
    // 下次同文本仍需走网络（因为失败未写缓存）
    fetchMock.mockResolvedValueOnce(okResponse([VECTOR]))
    const result = await requestWorkerEmbeddings(TOKEN, [TEXT])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.embeddings[0]).toEqual(VECTOR)
  })

  it('不同 token 隔离缓存：tokenA 的命中不污染 tokenB', async () => {
    fetchMock.mockResolvedValueOnce(okResponse([VECTOR]))
    await requestWorkerEmbeddings(TOKEN, [TEXT])
    const otherToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTQ1NiJ9.bbbbbbbbbbbb'
    fetchMock.mockResolvedValueOnce(okResponse([VECTOR.slice()]))
    await requestWorkerEmbeddings(otherToken, [TEXT])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('多文本批量：部分缓存命中时只请求缺失部分', async () => {
    fetchMock.mockResolvedValueOnce(okResponse([VECTOR]))
    await requestWorkerEmbeddings(TOKEN, ['cached text'])
    // 第二次：1 个 cached + 1 个 fresh
    fetchMock.mockResolvedValueOnce(okResponse([VECTOR.slice()]))
    await requestWorkerEmbeddings(TOKEN, ['cached text', 'fresh text'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // 验证第二次 fetch 只发了 1 个文本
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)
    expect(secondCallBody.texts).toEqual(['fresh text'])
  })

  it('cache 容量上限 64 条：超出后淘汰最早条目', async () => {
    // 模拟 65 个不同文本：只填第一条时 cache hit 0；第二条时 cache miss 1；
    // ...第 65 条时应有 1 条被淘汰
    fetchMock.mockImplementation(async (_url, init) => {
      const body = JSON.parse(init?.body as string)
      return okResponse(body.texts.map(() => VECTOR.slice()))
    })
    for (let i = 0; i < 65; i++) {
      await requestWorkerEmbeddings(TOKEN, [`text-${i}`])
    }
    expect(fetchMock).toHaveBeenCalledTimes(65)
    // 重新查 text-0（最早）：应触发 fetch（已被淘汰）
    await requestWorkerEmbeddings(TOKEN, ['text-0'])
    expect(fetchMock).toHaveBeenCalledTimes(66)
    // 重新查 text-64（最新）：应命中
    await requestWorkerEmbeddings(TOKEN, ['text-64'])
    expect(fetchMock).toHaveBeenCalledTimes(66) // 没增加
  })
})
