/**
 * Probe M4：冻结夹具离线关键词路径门禁。
 * 刷新夹具：`cd extension && bun run probe-eval:export-fixture`
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { ProbeGeneratedFixture } from '@yiveno/probe'

import {
  assertProbeGeneratedBaseline,
  runProbeGeneratedEval,
  stableProbeEvalItemId
} from '@/core/recall/eval/probe-generated-eval'

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/probe-generated-curated-researcher-v1.json'
)

function loadFixture(): ProbeGeneratedFixture {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as ProbeGeneratedFixture
}

describe('probe-generated-eval', () => {
  it('稳定 id 可复现且为 uuid 形', () => {
    const a = stableProbeEvalItemId('atlantic-attention')
    const b = stableProbeEvalItemId('atlantic-attention')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('夹具基线：关键词路径 top1 / inTop3 不得回退', () => {
    const fixture = loadFixture()
    expect(fixture.meta.id).toBe('probe-generated-curated-researcher-v1')
    expect(fixture.items.length).toBeGreaterThan(0)
    expect(fixture.cases.length).toBe(fixture.meta.baseline.judged)

    const report = runProbeGeneratedEval(fixture)
    expect(report.unmapped).toBe(0)
    assertProbeGeneratedBaseline(report, fixture.meta.baseline)
  })
})
