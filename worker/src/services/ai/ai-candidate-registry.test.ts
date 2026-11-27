/**
 * 候选注册表契约：id 唯一、taskKind 合法、apiKeyEnv 为 Env 已知键名。
 */

import { describe, expect, test } from 'bun:test'
import { AI_CHAT_TASK_KINDS, type AiChatTaskKind } from '../../config/ai-task-kind'
import {
  AI_CANDIDATE_KNOWN_API_KEY_ENV_NAMES,
  AI_CANDIDATE_REGISTRY,
  getCandidate,
  listRoutableCandidates
} from './ai-candidate-registry'

describe('AI_CANDIDATE_REGISTRY 契约', () => {
  test('candidateId 唯一', () => {
    const ids = AI_CANDIDATE_REGISTRY.map(e => e.candidateId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('qualifiedTaskKinds 均为合法 AiChatTaskKind', () => {
    const allowed = new Set<string>(AI_CHAT_TASK_KINDS)
    for (const entry of AI_CANDIDATE_REGISTRY) {
      for (const kind of entry.qualifiedTaskKinds) {
        expect(allowed.has(kind)).toBe(true)
      }
    }
  })

  test('apiKeyEnv 均为 Env 已知键名', () => {
    const known = new Set<string>(AI_CANDIDATE_KNOWN_API_KEY_ENV_NAMES)
    for (const entry of AI_CANDIDATE_REGISTRY) {
      expect(known.has(entry.apiKeyEnv)).toBe(true)
    }
  })

  test('deepseek-flash 启用且合格全部 10 个 taskKind', () => {
    const deepseek = getCandidate('deepseek-flash')
    expect(deepseek).toBeDefined()
    expect(deepseek!.enabled).toBe(true)
    expect(deepseek!.privacyTier).toBe('paid_standard')
    expect(deepseek!.qualifiedTaskKinds.length).toBe(AI_CHAT_TASK_KINDS.length)
    for (const kind of AI_CHAT_TASK_KINDS) {
      expect(deepseek!.qualifiedTaskKinds).toContain(kind)
    }
  })

  test('gemini / groq 默认未启用且 qualified 为空', () => {
    const gemini = getCandidate('gemini-3.5-flash-lite')
    const groq = getCandidate('groq-gpt-oss-120b')
    expect(gemini?.enabled).toBe(false)
    expect(gemini?.qualifiedTaskKinds).toEqual([])
    expect(gemini?.privacyTier).toBe('free_terms_unverified')
    expect(gemini?.freeTier?.rpm).toBe(15)
    expect(gemini?.freeTier?.tpm).toBe(250_000)
    expect(gemini?.freeTier?.rpd).toBe(500)

    expect(groq?.enabled).toBe(false)
    expect(groq?.qualifiedTaskKinds).toEqual([])
    expect(groq?.freeTier?.rpm).toBe(30)
    expect(groq?.freeTier?.tpm).toBe(8_000)
    expect(groq?.freeTier?.rpd).toBe(1_000)
    expect(groq?.freeTier?.tpd).toBe(200_000)
  })
})

describe('listRoutableCandidates / getCandidate', () => {
  test('listRoutableCandidates 仅返回 enabled+合格条目', () => {
    const nlu = listRoutableCandidates('nlu')
    expect(nlu.map(e => e.candidateId)).toEqual(['deepseek-flash'])
    const extract = listRoutableCandidates('extract' as AiChatTaskKind)
    expect(extract.map(e => e.candidateId)).toEqual(['deepseek-flash'])
  })

  test('getCandidate 未知 id → undefined', () => {
    expect(getCandidate('no-such-candidate')).toBeUndefined()
  })
})
