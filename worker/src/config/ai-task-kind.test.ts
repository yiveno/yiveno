import { describe, expect, test } from 'bun:test'

import {
  parseAiChatTaskKind,
  resolveHostedModelForTask,
  isNlgAiChatTaskKind,
  resolveHostedMaxTokensForTask
} from './ai-task-kind'

describe('parseAiChatTaskKind', () => {
  test('合法闭集原样返回', () => {
    expect(parseAiChatTaskKind('nlu')).toBe('nlu')
    expect(parseAiChatTaskKind('framing_nlg')).toBe('framing_nlg')
    expect(parseAiChatTaskKind('follow_up_nlg')).toBe('follow_up_nlg')
    expect(parseAiChatTaskKind('narrow_polish')).toBe('narrow_polish')
    expect(parseAiChatTaskKind('dreaming')).toBe('dreaming')
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
    const env = { AI_HOSTED_MODEL: 'deepseek-v4-flash' }
    expect(resolveHostedModelForTask(env, 'nlu')).toBe('deepseek-v4-flash')
    expect(resolveHostedModelForTask(env, 'framing_nlg')).toBe('deepseek-v4-flash')
    expect(resolveHostedModelForTask(env, 'narrow_polish')).toBe('deepseek-v4-flash')
  })

  test('仅 NLU 覆盖不影响 NLG', () => {
    const env = {
      AI_HOSTED_MODEL: 'deepseek-v4-flash',
      AI_HOSTED_MODEL_NLU: 'deepseek-chat'
    }
    expect(resolveHostedModelForTask(env, 'nlu')).toBe('deepseek-chat')
    expect(resolveHostedModelForTask(env, 'framing_nlg')).toBe('deepseek-v4-flash')
  })

  test('NLG 覆盖作用于 framing / follow_up / narrow', () => {
    const env = {
      AI_HOSTED_MODEL: 'deepseek-v4-flash',
      AI_HOSTED_MODEL_NLG: 'deepseek-chat'
    }
    expect(resolveHostedModelForTask(env, 'framing_nlg')).toBe('deepseek-chat')
    expect(resolveHostedModelForTask(env, 'follow_up_nlg')).toBe('deepseek-chat')
    expect(resolveHostedModelForTask(env, 'narrow_polish')).toBe('deepseek-chat')
    expect(resolveHostedModelForTask(env, 'nlu')).toBe('deepseek-v4-flash')
  })
})

describe('isNlgAiChatTaskKind', () => {
  test('浅 NLG 为 true，nlu 为 false', () => {
    expect(isNlgAiChatTaskKind('framing_nlg')).toBe(true)
    expect(isNlgAiChatTaskKind('nlu')).toBe(false)
  })
})

describe('resolveHostedMaxTokensForTask', () => {
  test('未传 requested → 任务默认 cap', () => {
    expect(resolveHostedMaxTokensForTask('nlu', undefined)).toBe(400)
    expect(resolveHostedMaxTokensForTask('framing_nlg', undefined)).toBe(256)
    expect(resolveHostedMaxTokensForTask('narrow_polish', undefined)).toBe(128)
  })

  test('客户端过大 → 钳到任务 cap', () => {
    expect(resolveHostedMaxTokensForTask('narrow_polish', 400)).toBe(128)
    expect(resolveHostedMaxTokensForTask('nlu', 900)).toBe(400)
  })

  test('客户端更小 → 保留', () => {
    expect(resolveHostedMaxTokensForTask('nlu', 64)).toBe(64)
    expect(resolveHostedMaxTokensForTask('framing_nlg', 100)).toBe(100)
  })
})
