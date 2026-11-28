/**
 * user-sim 数据集契约测试：确定性、schema 往返、GT 隔离、机制数据充分性。
 * 只测数据与生成器，不测 Recall 排名（排名走 user-sim:run 脚本出报告）。
 */

import { describe, expect, it } from 'vitest'
import { MemoryItemSchema } from '@/core/memory/memory-item'
import { BehaviorStatsRecordSchema } from '@/infrastructure/indexeddb/behavior-stats-types'
import { rankBehaviorDomains } from '@/core/behavior/rank-behavior-domains'
import { stableStringifyStage2 } from '../clue-chain/stage2/generate-dataset'
import { USER_SIM_PERSONAS } from './personas'
import { generateUserSimDataset } from './generate'
import { validateUserSimDataset } from './validate'
import { toStage2Tasks } from './to-stage2'

const SEED = 42
const END_ISO = '2026-11-28'
const NOW_MS = Date.parse(`${END_ISO}T12:00:00Z`)

describe('user-sim dataset contract', () => {
  it('is deterministic per seed and persona', () => {
    for (const p of USER_SIM_PERSONAS) {
      const a = generateUserSimDataset({ seed: SEED, endIso: END_ISO, personaId: p.id })
      const b = generateUserSimDataset({ seed: SEED, endIso: END_ISO, personaId: p.id })
      expect(stableStringifyStage2(a)).toBe(stableStringifyStage2(b))
    }
  })

  it('visible items round-trip through product schemas', () => {
    for (const p of USER_SIM_PERSONAS) {
      const data = generateUserSimDataset({ seed: SEED, endIso: END_ISO, personaId: p.id })
      for (const item of data.memoryItems) {
        expect(MemoryItemSchema.safeParse(item).success).toBe(true)
      }
      for (const row of data.behaviorStats) {
        expect(BehaviorStatsRecordSchema.safeParse(row).success).toBe(true)
      }
    }
  })

  it('passes isolation and aggregation validation for every persona', () => {
    for (const p of USER_SIM_PERSONAS) {
      const data = generateUserSimDataset({ seed: SEED, endIso: END_ISO, personaId: p.id })
      expect(validateUserSimDataset(data)).toEqual([])
    }
  })

  it('personas are disjoint in ids and owners', () => {
    const seen = new Set<string>()
    const owners = new Set<string>()
    for (const p of USER_SIM_PERSONAS) {
      const data = generateUserSimDataset({ seed: SEED, endIso: END_ISO, personaId: p.id })
      owners.add(data.memoryItems[0]!.ownerId)
      for (const item of data.memoryItems) {
        expect(seen.has(item.id)).toBe(false)
        seen.add(item.id)
      }
    }
    expect(owners.size).toBe(USER_SIM_PERSONAS.length)
  })

  it('behavior top-3 from visible stats overlaps latent truth by at least 2', () => {
    for (const p of USER_SIM_PERSONAS) {
      const data = generateUserSimDataset({ seed: SEED, endIso: END_ISO, personaId: p.id })
      const top3 = rankBehaviorDomains(data.behaviorStats, 'favorite', NOW_MS, 3).map(r => r.domain)
      const latent = data.groundTruth.behavior.latentTopDomains
      const overlap = top3.filter(d => latent.includes(d)).length
      expect(overlap).toBeGreaterThanOrEqual(2)
    }
  })

  it('portrait weekly top-5 overlap stays at or above the measured floor', () => {
    for (const p of USER_SIM_PERSONAS) {
      const data = generateUserSimDataset({ seed: SEED, endIso: END_ISO, personaId: p.id })
      const startMs = NOW_MS - (data.meta.days - 1) * 86400000
      const weeks = new Map<number, Map<string, number>>()
      for (const item of data.memoryItems) {
        const w = Math.floor((Date.parse(item.createdAt) - startMs) / (7 * 86400000))
        const topic = data.groundTruth.itemTopics[item.id]!
        const bucket = weeks.get(w) ?? new Map<string, number>()
        bucket.set(topic, (bucket.get(topic) ?? 0) + 1)
        weeks.set(w, bucket)
      }
      const overlaps = data.groundTruth.portrait.weeklyLatentTopTopics.map((lw, i) => {
        const visible = [...(weeks.get(i) ?? new Map()).entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([t]) => t)
        return visible.filter(t => lw.topTopics.includes(t)).length
      })
      const mean = overlaps.reduce((s, v) => s + v, 0) / overlaps.length
      expect(mean).toBeGreaterThanOrEqual(3.0)
    }
  })

  it('stage2 adapter maps tiers and keeps targets resolvable', () => {
    const data = generateUserSimDataset({ seed: SEED, endIso: END_ISO })
    const tasks = toStage2Tasks(data)
    expect(tasks).toHaveLength(80)
    const ids = new Set(data.memoryItems.map(m => m.id))
    for (const task of tasks) {
      expect(task.embeddingAnchor).toBe(task.clue)
      if (task.tier === 'negative') {
        expect(task.targetId).toBeNull()
      } else {
        expect(ids.has(task.targetId!)).toBe(true)
      }
    }
  })
})
