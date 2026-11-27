/**
 * 跨包契约：扩展镜像表 ↔ Worker 注册表（kind / maxTokens / route）逐项相等。
 * 以相对路径实读 Worker 源文件；解析不到或不一致即失败（禁止手抄期望值冒充）。
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  AI_CHAT_TASK_REGISTRY,
  type AiChatTaskRoute
} from '@/core/recall/understand/ai-chat-task-kind'

/** extension/src/core/recall/understand → 仓库根 → worker 注册表。 */
const WORKER_REGISTRY_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../worker/src/config/ai-task-kind.ts'
)

type ParsedEntry = {
  kind: string
  route: AiChatTaskRoute
  maxTokens: number
}

/**
 * 从 Worker 注册表源码解析 `{ kind, route, maxTokens }` 行。
 * 依赖注册表条目字面量形态稳定（本批约定）。
 */
function parseWorkerRegistryEntries(source: string): ParsedEntry[] {
  const registryMatch = source.match(
    /export const AI_CHAT_TASK_REGISTRY\s*=\s*\[([\s\S]*?)\]\s*as const/
  )
  if (!registryMatch?.[1]) {
    throw new Error('无法解析 AI_CHAT_TASK_REGISTRY 数组体')
  }
  const body = registryMatch[1]
  const entryRe =
    /\{\s*kind:\s*'([a-z_]+)'\s*,\s*route:\s*'(hosted|dedicated)'\s*,\s*maxTokens:\s*(\d+)\s*,/g
  const entries: ParsedEntry[] = []
  for (const match of body.matchAll(entryRe)) {
    const kind = match[1]
    const route = match[2] as AiChatTaskRoute
    const maxTokens = Number(match[3])
    if (!kind || (route !== 'hosted' && route !== 'dedicated') || !Number.isFinite(maxTokens)) {
      throw new Error(`注册表条目解析失败: ${match[0]}`)
    }
    entries.push({ kind, route, maxTokens })
  }
  if (entries.length === 0) {
    throw new Error('AI_CHAT_TASK_REGISTRY 解析结果为空')
  }
  return entries
}

describe('ai-chat-task-kind 跨包契约', () => {
  it('相对路径可达且镜像表与 Worker 注册表逐项相等', () => {
    expect(existsSync(WORKER_REGISTRY_PATH), `Worker 注册表不可达: ${WORKER_REGISTRY_PATH}`).toBe(
      true
    )
    const source = readFileSync(WORKER_REGISTRY_PATH, 'utf8')
    const workerEntries = parseWorkerRegistryEntries(source)

    expect(workerEntries).toHaveLength(AI_CHAT_TASK_REGISTRY.length)

    for (let i = 0; i < AI_CHAT_TASK_REGISTRY.length; i += 1) {
      const mirror = AI_CHAT_TASK_REGISTRY[i]
      const worker = workerEntries[i]
      expect(worker, `缺 Worker 条目 index=${i}`).toBeDefined()
      expect(mirror, `缺镜像条目 index=${i}`).toBeDefined()
      expect(mirror!.kind).toBe(worker!.kind)
      expect(mirror!.route).toBe(worker!.route)
      expect(mirror!.maxTokens).toBe(worker!.maxTokens)
    }
  })
})
