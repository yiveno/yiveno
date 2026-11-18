import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import { createApp } from '../app'
import * as sketches from '../data-access/dual-thread-sketches'
import {
  handleResearchSketchDelete,
  handleResearchSketchPost,
  parseResearchSketchBody
} from './research'
import type { Env } from '../types/env'

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111'

function createBaseEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    JWT_SECRET: 'test-secret',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    WEBSITE_URL: 'https://example.com',
    ...overrides
  } as unknown as Env
}

const validSketch = {
  generatedAt: '2026-11-17T12:00:00.000Z',
  adaptationConfigVersion: 'v1',
  telemetryEventCount: 3,
  resultOutcomeCounts: { top_pick: 1, need_a_clue: 1, no_match: 1 },
  confirmLabelCounts: { target: 1 },
  failureStageCounts: { unknown: 0, not_captured: 0 },
  timingTotalMs: { n: 2, p50: 100, p90: 200 },
  privacyNoteZh: '仅匿名计数'
}

afterEach(() => {
  // 不使用 mock.module，避免污染 verifySupabaseAccessToken 等其它单测
})

describe('parseResearchSketchBody（隐私硬线）', () => {
  test('正常草图通过', () => {
    const parsed = parseResearchSketchBody(validSketch)
    expect(parsed.ok).toBe(true)
  })

  test('含 cluePreview → privacy_field_forbidden', () => {
    const parsed = parseResearchSketchBody({ ...validSketch, cluePreview: 'secret' })
    expect(parsed).toEqual({
      ok: false,
      error: 'privacy_field_forbidden',
      field: 'cluePreview'
    })
  })

  test('含 anchor → privacy_field_forbidden', () => {
    const parsed = parseResearchSketchBody({ ...validSketch, anchor: 'title' })
    expect(parsed).toEqual({
      ok: false,
      error: 'privacy_field_forbidden',
      field: 'anchor'
    })
  })

  test('schema 外字段 → invalid_payload', () => {
    const parsed = parseResearchSketchBody({ ...validSketch, extraFreeText: 'nope' })
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.error).toBe('invalid_payload')
    }
  })
})

describe('POST/DELETE /api/research/sketch', () => {
  test('未登录 → 401', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/research/sketch',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validSketch)
      },
      createBaseEnv()
    )
    expect(response.status).toBe(401)
  })

  test('正常草图 → 200 + upsert；同日重复覆盖', async () => {
    let upsertCalls = 0
    const upsertSpy = spyOn(sketches, 'upsertDualThreadSketch').mockImplementation(
      async (_env, input) => {
        upsertCalls += 1
        return { sketchDate: input.sketchDate }
      }
    )
    try {
      const env = createBaseEnv()
      const first = await handleResearchSketchPost(env, TEST_USER_ID, validSketch)
      expect(first.status).toBe(200)
      const firstBody = (await first.json()) as {
        success: boolean
        data: { sketchDate: string }
      }
      expect(firstBody.success).toBe(true)
      expect(firstBody.data.sketchDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      const second = await handleResearchSketchPost(env, TEST_USER_ID, {
        ...validSketch,
        telemetryEventCount: 9
      })
      expect(second.status).toBe(200)
      expect(upsertCalls).toBe(2)
      expect(upsertSpy.mock.calls[0]?.[1]?.userId).toBe(TEST_USER_ID)
      expect(upsertSpy.mock.calls[0]?.[1]?.sketchDate).toBe(
        upsertSpy.mock.calls[1]?.[1]?.sketchDate
      )
    } finally {
      upsertSpy.mockRestore()
    }
  })

  test('body 含 cluePreview → 400', async () => {
    const upsertSpy = spyOn(sketches, 'upsertDualThreadSketch').mockResolvedValue({
      sketchDate: '2026-11-17'
    })
    try {
      const response = await handleResearchSketchPost(createBaseEnv(), TEST_USER_ID, {
        ...validSketch,
        cluePreview: 'secret clue'
      })
      expect(response.status).toBe(400)
      const body = (await response.json()) as { error: string; field?: string }
      expect(body.error).toBe('privacy_field_forbidden')
      expect(body.field).toBe('cluePreview')
      expect(upsertSpy).not.toHaveBeenCalled()
    } finally {
      upsertSpy.mockRestore()
    }
  })

  test('body 含 anchor → 400', async () => {
    const upsertSpy = spyOn(sketches, 'upsertDualThreadSketch').mockResolvedValue({
      sketchDate: '2026-11-17'
    })
    try {
      const response = await handleResearchSketchPost(createBaseEnv(), TEST_USER_ID, {
        ...validSketch,
        anchor: 'title leak'
      })
      expect(response.status).toBe(400)
      const body = (await response.json()) as { error: string; field?: string }
      expect(body.error).toBe('privacy_field_forbidden')
      expect(body.field).toBe('anchor')
      expect(upsertSpy).not.toHaveBeenCalled()
    } finally {
      upsertSpy.mockRestore()
    }
  })

  test('schema 外字段 → 400', async () => {
    const response = await handleResearchSketchPost(createBaseEnv(), TEST_USER_ID, {
      ...validSketch,
      extraFreeText: 'nope'
    })
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe('invalid_payload')
  })

  test('DELETE 清空该用户行', async () => {
    const deleteSpy = spyOn(sketches, 'deleteAllDualThreadSketchesForUser').mockResolvedValue({
      deletedCount: 2
    })
    try {
      const response = await handleResearchSketchDelete(createBaseEnv(), TEST_USER_ID)
      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        success: boolean
        data: { deletedCount: number }
      }
      expect(body.success).toBe(true)
      expect(body.data.deletedCount).toBe(2)
      expect(deleteSpy).toHaveBeenCalledWith(expect.anything(), TEST_USER_ID)
    } finally {
      deleteSpy.mockRestore()
    }
  })
})
