/**
 * 画像叙事 prompt 构建。
 */

import { describe, expect, it } from 'vitest'

import {
  buildPortraitNarrativeContentPoints,
  buildPortraitNarrativeMessages,
  buildPortraitNarrativeSystemPrompt,
  PORTRAIT_NARRATIVE_SYSTEM_ANCHORS,
  PORTRAIT_NARRATIVE_SYSTEM_PREFIX,
  serializePortraitNarrativePoints
} from '@/core/portrait/portrait-narrative-prompt'

describe('portrait-narrative-prompt', () => {
  it('内容点序列化含分级标签与计数；空组不出现', () => {
    const points = buildPortraitNarrativeContentPoints({
      locale: 'zh_CN',
      groups: [
        { key: 'verified', values: ['github.com', 'rag'], total: 2 },
        { key: 'corroborated', values: [], total: 0 },
        { key: 'unconfirmed', values: ['zig'], total: 1 },
        { key: 'contested', values: ['vim'], total: 1 }
      ],
      pendingValues: ['zig'],
      contestedValues: ['vim']
    })
    expect(points.groups.map(g => g.key)).toEqual(['verified', 'unconfirmed', 'contested'])
    expect(points.groups.find(g => g.key === 'verified')?.label).toBe('确定')
    expect(points.groups.find(g => g.key === 'unconfirmed')?.label).toBe('待确认')
    const serialized = serializePortraitNarrativePoints(points)
    expect(serialized).toContain('label=确定')
    expect(serialized).toContain('total=2')
    expect(serialized).toContain('pending total=1')
    expect(serialized).toContain('contested total=1')
    expect(serialized).not.toContain('corroborated')
  })

  it('system 指令含硬约束锚行与长度/locale；首段与 Worker 指纹一致', () => {
    const system = buildPortraitNarrativeSystemPrompt('en')
    expect(system.startsWith(PORTRAIT_NARRATIVE_SYSTEM_PREFIX)).toBe(true)
    for (const anchor of PORTRAIT_NARRATIVE_SYSTEM_ANCHORS) {
      expect(system).toContain(anchor)
    }
    expect(system).toContain('Do not present unconfirmed or conflicting')
    expect(system).toContain('Max 90 words')
    expect(system).not.toContain('markdown list')
  })

  it('messages 为 [system, user]；纠正指令可追加', () => {
    const points = buildPortraitNarrativeContentPoints({
      locale: 'zh_CN',
      groups: [{ key: 'verified', values: ['a'], total: 1 }],
      pendingValues: [],
      contestedValues: []
    })
    const base = buildPortraitNarrativeMessages(points)
    expect(base).toHaveLength(2)
    expect(base[0]?.role).toBe('system')
    expect(base[1]?.role).toBe('user')
    expect(base[1]?.content).toContain('values=["a"]')

    const corrected = buildPortraitNarrativeMessages(points, {
      correctionReasons: ['too_long', 'markdown']
    })
    expect(corrected[1]?.content).toContain('上次输出未通过审核：too_long；markdown')
  })

  it('代表项截断至多 5', () => {
    const values = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const points = buildPortraitNarrativeContentPoints({
      locale: 'en',
      groups: [{ key: 'verified', values, total: 7 }],
      pendingValues: [],
      contestedValues: []
    })
    expect(points.groups[0]?.values).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(points.groups[0]?.total).toBe(7)
    expect(points.groups[0]?.label).toBe('certain')
  })
})
