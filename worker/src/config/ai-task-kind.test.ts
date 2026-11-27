import { describe, expect, test } from 'bun:test'

import {
  AI_CHAT_TASK_KINDS,
  AI_CHAT_TASK_MAX_TOKENS,
  AI_CHAT_TASK_REGISTRY,
  HOSTED_ROUTE_TASK_KINDS,
  parseAiChatTaskKind,
  resolveHostedModelForTask,
  isNlgAiChatTaskKind,
  resolveHostedMaxTokensForTask
} from './ai-task-kind'
import { HOSTED_COMPLETE_TASK_KINDS } from '../services/ai/hosted-system-prompts'

/** 指纹表已覆盖的 hosted kind（与 hosted-system-prompts switch / 前缀表对齐；锚行本身不改）。 */
const FINGERPRINT_HOSTED_TASK_KINDS = [
  'nlu',
  'framing_nlg',
  'follow_up_nlg',
  'narrow_polish',
  'portrait_narrative',
  'portrait_cluster'
] as const

describe('AI_CHAT_TASK_REGISTRY 内部一致性', () => {
  test('kind 全集 10 个且无重复', () => {
    expect(AI_CHAT_TASK_REGISTRY).toHaveLength(10)
    expect(new Set(AI_CHAT_TASK_KINDS).size).toBe(10)
  })

  test('每 kind 有 maxTokens', () => {
    for (const entry of AI_CHAT_TASK_REGISTRY) {
      expect(entry.maxTokens).toBeGreaterThan(0)
      expect(AI_CHAT_TASK_MAX_TOKENS[entry.kind]).toBe(entry.maxTokens)
    }
  })

  test('hosted 集与指纹表 kind 集相等', () => {
    expect([...HOSTED_ROUTE_TASK_KINDS].sort()).toEqual([...FINGERPRINT_HOSTED_TASK_KINDS].sort())
    expect([...HOSTED_COMPLETE_TASK_KINDS].sort()).toEqual(
      [...FINGERPRINT_HOSTED_TASK_KINDS].sort()
    )
  })

  test('gs_samples 生效 maxTokens=700（与原 handler 写死值对齐）', () => {
    expect(AI_CHAT_TASK_MAX_TOKENS.gs_samples).toBe(700)
    expect(resolveHostedMaxTokensForTask('gs_samples', undefined)).toBe(700)
  })
})

describe('parseAiChatTaskKind', () => {
  test('合法闭集原样返回', () => {
    expect(parseAiChatTaskKind('nlu')).toBe('nlu')
    expect(parseAiChatTaskKind('framing_nlg')).toBe('framing_nlg')
    expect(parseAiChatTaskKind('follow_up_nlg')).toBe('follow_up_nlg')
    expect(parseAiChatTaskKind('narrow_polish')).toBe('narrow_polish')
    expect(parseAiChatTaskKind('portrait_narrative')).toBe('portrait_narrative')
    expect(parseAiChatTaskKind('portrait_cluster')).toBe('portrait_cluster')
    expect(parseAiChatTaskKind('dreaming')).toBe('dreaming')
    expect(parseAiChatTaskKind('extract')).toBe('extract')
  })

  test('缺省 / 未知 → nlu（兼容旧客户端）', () => {
    expect(parseAiChatTaskKind(undefined)).toBe('nlu')
    expect(parseAiChatTaskKind(null)).toBe('nlu')
    expect(parseAiChatTaskKind('')).toBe('nlu')
    expect(parseAiChatTaskKind('agent_planner')).toBe('nlu')
  })
})

describe('resolveHostedModelForTask', () => {
  test('未配分档 env → 全任务同全局模型', () => {
    const env = { AI_HOSTED_MODEL: 'deepseek-flash' }
    expect(resolveHostedModelForTask(env, 'nlu')).toBe('deepseek-flash')
    expect(resolveHostedModelForTask(env, 'framing_nlg')).toBe('deepseek-flash')
    expect(resolveHostedModelForTask(env, 'narrow_polish')).toBe('deepseek-flash')
  })

  test('仅 NLU 覆盖不影响 NLG', () => {
    const env = {
      AI_HOSTED_MODEL: 'deepseek-flash',
      AI_HOSTED_MODEL_NLU: 'deepseek-chat'
    }
    expect(resolveHostedModelForTask(env, 'nlu')).toBe('deepseek-chat')
    expect(resolveHostedModelForTask(env, 'framing_nlg')).toBe('deepseek-flash')
  })

  test('NLG 覆盖作用于 framing / follow_up / narrow / portrait_narrative / portrait_cluster', () => {
    const env = {
      AI_HOSTED_MODEL: 'deepseek-flash',
      AI_HOSTED_MODEL_NLG: 'deepseek-chat'
    }
    expect(resolveHostedModelForTask(env, 'framing_nlg')).toBe('deepseek-chat')
    expect(resolveHostedModelForTask(env, 'follow_up_nlg')).toBe('deepseek-chat')
    expect(resolveHostedModelForTask(env, 'narrow_polish')).toBe('deepseek-chat')
    expect(resolveHostedModelForTask(env, 'portrait_narrative')).toBe('deepseek-chat')
    expect(resolveHostedModelForTask(env, 'portrait_cluster')).toBe('deepseek-chat')
    expect(resolveHostedModelForTask(env, 'nlu')).toBe('deepseek-flash')
  })
})

describe('isNlgAiChatTaskKind', () => {
  test('浅 NLG 为 true，nlu 为 false', () => {
    expect(isNlgAiChatTaskKind('framing_nlg')).toBe(true)
    expect(isNlgAiChatTaskKind('portrait_narrative')).toBe(true)
    expect(isNlgAiChatTaskKind('portrait_cluster')).toBe(true)
    expect(isNlgAiChatTaskKind('nlu')).toBe(false)
  })
})

describe('resolveHostedMaxTokensForTask', () => {
  test('未传 requested → 任务默认 cap', () => {
    expect(resolveHostedMaxTokensForTask('nlu', undefined)).toBe(400)
    expect(resolveHostedMaxTokensForTask('framing_nlg', undefined)).toBe(256)
    expect(resolveHostedMaxTokensForTask('narrow_polish', undefined)).toBe(128)
    expect(resolveHostedMaxTokensForTask('portrait_narrative', undefined)).toBe(256)
    expect(resolveHostedMaxTokensForTask('portrait_cluster', undefined)).toBe(512)
    expect(resolveHostedMaxTokensForTask('gs_samples', undefined)).toBe(700)
    expect(resolveHostedMaxTokensForTask('extract', undefined)).toBe(800)
  })

  test('客户端过大 → 钳到任务 cap', () => {
    expect(resolveHostedMaxTokensForTask('narrow_polish', 400)).toBe(128)
    expect(resolveHostedMaxTokensForTask('nlu', 900)).toBe(400)
    expect(resolveHostedMaxTokensForTask('gs_samples', 2000)).toBe(700)
  })

  test('客户端更小 → 保留', () => {
    expect(resolveHostedMaxTokensForTask('nlu', 64)).toBe(64)
    expect(resolveHostedMaxTokensForTask('framing_nlg', 100)).toBe(100)
  })
})
