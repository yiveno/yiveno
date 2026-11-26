import { describe, expect, it } from 'vitest'

import { groundTimeLabel } from '@/core/recall/understand/ground-llm-parse-slots'

describe('groundTimeLabel · 中文糊时间', () => {
  it.each([
    ['之前看的那个视频', 'a_while_ago'],
    ['以前存过一篇文章', 'a_while_ago'],
    ['上次打开的那个页面', 'a_while_ago'],
    ['去年看的纪录片', 'long_ago'],
    ['前年收藏的工具', 'long_ago'],
    ['去年或前年读过的那篇', 'long_ago']
  ] as const)('%s → %s（模型未给 label 时兜底）', (clue, label) => {
    expect(groundTimeLabel(clue, null)).toBe(label)
    expect(groundTimeLabel(clue, undefined)).toBe(label)
  })

  it('很久以前 仍优先 long_ago（长于「以前」）', () => {
    expect(groundTimeLabel('很久以前看的视频', null)).toBe('long_ago')
  })

  it('绝对季节 / 日期反例：不套 long_ago', () => {
    expect(groundTimeLabel('去年夏天看到的那篇文章', null)).toBeUndefined()
    expect(groundTimeLabel('前年冬天听的歌', null)).toBeUndefined()
    expect(groundTimeLabel('2024年3月存的页面', null)).toBeUndefined()
    expect(groundTimeLabel('世界杯期间看的视频', null)).toBeUndefined()
  })

  it('模型已给合法相对 label 且无线索词面冲突 → 采纳', () => {
    expect(groundTimeLabel('that video', 'recent')).toBe('recent')
  })

  it('糊时间置信由 label 派生为 low（调用方侧约定；本层只出 label）', () => {
    expect(groundTimeLabel('之前那个', null)).toBe('a_while_ago')
    expect(groundTimeLabel('去年那个', null)).toBe('long_ago')
  })
})
