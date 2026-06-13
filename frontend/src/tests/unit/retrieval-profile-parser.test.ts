import { describe, expect, it } from 'vitest'
import {
  parseRetrievalProfileBatchResponse,
  repairLlmJsonText,
  salvageRetrievalProfilesFromText
} from '@/application/ai/retrieval-profile-parser'

describe('retrieval-profile-parser', () => {
  it('解析批处理 JSON 并规范化 keywords', () => {
    const profiles = parseRetrievalProfileBatchResponse(
      `\`\`\`json
{
  "profiles": [
    {
      "bookmarkId": "music163",
      "profile": "在线音乐平台，可听歌、播放歌曲、创建歌单",
      "keywords": ["听歌", "音乐", "播放", "听歌", "歌单"]
    }
  ]
}
\`\`\``,
      new Set(['music163'])
    )

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.bookmarkId).toBe('music163')
    expect(profiles[0]?.keywords).toEqual(['听歌', '音乐', '播放', '歌单'])
  })

  it('repair 后可解析 trailing comma JSON', () => {
    const broken = `{"profiles":[{"bookmarkId":"music163","profile":"音乐平台","keywords":["听歌","音乐",]}]}`
    const repaired = repairLlmJsonText(broken)
    const profiles = parseRetrievalProfileBatchResponse(repaired, new Set(['music163']))
    expect(profiles).toHaveLength(1)
  })

  it('损坏 JSON 时可 salvage 单条 profile', () => {
    const broken = `
{
  "profiles": [
    {"bookmarkId":"music163","profile":"在线音乐平台，可听歌","keywords":["听歌","音乐",]}
    {"bookmarkId":"taobao","profile":"购物","keywords":["购物"]}
  ]
}
`
    const salvaged = salvageRetrievalProfilesFromText(broken, new Set(['music163', 'taobao']))
    expect(salvaged.length).toBeGreaterThanOrEqual(1)
    expect(salvaged[0]?.bookmarkId).toBe('music163')
  })

  it('忽略无效 bookmarkId', () => {
    const profiles = parseRetrievalProfileBatchResponse(
      JSON.stringify({
        profiles: [{ bookmarkId: 'missing', profile: 'test', keywords: ['a'] }]
      }),
      new Set(['real-id'])
    )

    expect(profiles).toHaveLength(0)
  })
})
