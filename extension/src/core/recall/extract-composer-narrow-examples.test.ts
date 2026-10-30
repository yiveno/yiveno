import { describe, expect, it } from 'vitest'

import {
  extractComposerNarrowExamples,
  NARROW_EXAMPLE_TYPE_DOMINANCE_MAX,
  scoreNarrowExampleDocFreq,
  type NarrowExampleSource
} from '@/core/recall/extract-composer-narrow-examples'

describe('scoreNarrowExampleDocFreq', () => {
  it('df<2 → 无效', () => {
    expect(scoreNarrowExampleDocFreq(1, 8)).toBeLessThan(0)
  })

  it('部分覆盖分高于全覆盖', () => {
    const partial = scoreNarrowExampleDocFreq(3, 8)
    const full = scoreNarrowExampleDocFreq(8, 8)
    expect(partial).toBeGreaterThan(full)
  })

  it('接近半池共现更优', () => {
    const half = scoreNarrowExampleDocFreq(4, 8)
    const almostAll = scoreNarrowExampleDocFreq(7, 8)
    expect(half).toBeGreaterThan(almostAll)
  })
})

describe('extractComposerNarrowExamples', () => {
  it('多类型词面（URL youtube + 标题 repo）→ 举 video / code', () => {
    const examples = extractComposerNarrowExamples({
      candidates: [
        {
          itemKind: 'bookmark',
          title: 'Talk',
          subtitle: 'youtube.com',
          url: 'https://www.youtube.com/watch?v=1'
        },
        {
          itemKind: 'bookmark',
          title: 'App repo',
          subtitle: 'github.com',
          url: 'https://github.com/acme/app'
        },
        {
          itemKind: 'bookmark',
          title: 'Second talk',
          subtitle: 'youtube.com',
          url: 'https://youtube.com/watch?v=2'
        },
        {
          itemKind: 'bookmark',
          title: 'Lib repository',
          subtitle: 'github.com',
          url: 'https://github.com/acme/lib'
        },
        {
          itemKind: 'bookmark',
          title: 'Pkg code',
          subtitle: 'npmjs.com',
          url: 'https://www.npmjs.com/package/x'
        },
        {
          itemKind: 'bookmark',
          title: 'More on youtube',
          subtitle: 'vimeo.com',
          url: 'https://vimeo.com/1'
        }
      ]
    })
    expect(examples).toEqual(expect.arrayContaining(['video', 'code']))
    expect(examples[0]).toMatch(/^(video|code)$/)
  })

  it('跨文档共现 token 可作举例', () => {
    const examples = extractComposerNarrowExamples({
      candidates: [
        {
          itemKind: 'text_excerpt',
          title: 'A',
          subtitle: '',
          url: 'https://example.com/a',
          excerpt: 'Kubernetes rollout notes'
        },
        {
          itemKind: 'text_excerpt',
          title: 'B',
          subtitle: '',
          url: 'https://example.com/b',
          excerpt: 'Kubernetes scaling guide'
        },
        {
          itemKind: 'bookmark',
          title: 'Other',
          subtitle: 'example.com',
          url: 'https://example.com/c'
        }
      ]
    })
    expect(examples).toContain('kubernetes')
  })

  it('线索已含的词不再举', () => {
    const examples = extractComposerNarrowExamples({
      clueText: 'kubernetes notes',
      candidates: [
        {
          itemKind: 'text_excerpt',
          title: 'A',
          subtitle: '',
          url: 'https://a.example/x',
          excerpt: 'Kubernetes rollout'
        },
        {
          itemKind: 'text_excerpt',
          title: 'B',
          subtitle: '',
          url: 'https://b.example/y',
          excerpt: 'Kubernetes scaling'
        }
      ]
    })
    expect(examples).not.toContain('kubernetes')
  })

  it(`单一类型统治（≥${NARROW_EXAMPLE_TYPE_DOMINANCE_MAX}）时不举该类型`, () => {
    const examples = extractComposerNarrowExamples({
      candidates: Array.from({ length: 8 }, (_, i) => ({
        itemKind: 'bookmark' as const,
        title: `Vid ${i}`,
        subtitle: 'youtube.com',
        url: `https://youtube.com/watch?v=${i}`
      }))
    })
    expect(examples).not.toContain('video')
  })

  it('空候选 → []', () => {
    expect(extractComposerNarrowExamples({ candidates: [] })).toEqual([])
  })

  it('不把 TLD / 低切割力页壳词当举例；优先 host 标签', () => {
    const examples = extractComposerNarrowExamples({
      candidates: [
        {
          itemKind: 'bookmark',
          title: 'Alpha guide',
          subtitle: 'alpha.example.org',
          url: 'https://alpha.example.org/a'
        },
        {
          itemKind: 'bookmark',
          title: 'Beta guide',
          subtitle: 'beta.example.org',
          url: 'https://beta.example.org/b'
        },
        {
          itemKind: 'bookmark',
          title: 'Gamma notes',
          subtitle: 'gamma.example.org',
          url: 'https://gamma.example.org/c'
        }
      ]
    })
    expect(examples).not.toContain('org')
    expect(examples).not.toContain('guide')
    expect(examples.some(e => e === 'alpha' || e === 'beta' || e === 'gamma')).toBe(true)
  })

  it('有部分覆盖 token 时，不优先举全覆盖弱词', () => {
    const examples = extractComposerNarrowExamples({
      candidates: [
        {
          itemKind: 'text_excerpt',
          title: 'A',
          subtitle: '',
          url: 'https://a.example/1',
          excerpt: 'Shared filler word and Kafka notes'
        },
        {
          itemKind: 'text_excerpt',
          title: 'B',
          subtitle: '',
          url: 'https://b.example/2',
          excerpt: 'Shared filler word and Kafka guide'
        },
        {
          itemKind: 'text_excerpt',
          title: 'C',
          subtitle: '',
          url: 'https://c.example/3',
          excerpt: 'Shared filler word only here'
        },
        {
          itemKind: 'text_excerpt',
          title: 'D',
          subtitle: '',
          url: 'https://d.example/4',
          excerpt: 'Shared filler word again'
        }
      ]
    })
    expect(examples[0]).toBe('kafka')
    expect(examples).not.toContain('shared')
    expect(examples).not.toContain('filler')
    expect(examples).not.toContain('word')
  })

  it('忽略 chrome-extension 详情 URL / 扩展 id host', () => {
    const examples = extractComposerNarrowExamples({
      candidates: [
        {
          itemKind: 'text_excerpt',
          title: 'A',
          subtitle: 'history.js.org',
          url: 'chrome-extension://npaopcapgknadgooegpkondgfhphkjld/detail.html?id=1',
          excerpt: 'Eloquent history notes'
        },
        {
          itemKind: 'bookmark',
          title: 'Eloquent JavaScript',
          subtitle: 'eloquentjavascript.net',
          url: 'https://eloquentjavascript.net/'
        },
        {
          itemKind: 'bookmark',
          title: 'MDN',
          subtitle: 'developer.mozilla.org',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript'
        }
      ]
    })
    expect(examples.join(' ')).not.toMatch(/npaopcapgknadgooegpkondgfhphkjld/)
    expect(examples.some(e => e === 'eloquent' || e === 'developer' || e === 'history')).toBe(true)
  })

  // Gap 2：topicTerms 独立 topic 示例
  it('topicTerms 存在 → 末尾追加独立 topic 示例（不参与切割力排序）', () => {
    // 用「几乎全覆盖」候选制造：无 token 达到 df<全覆盖，从而 topicTerms 作为兜底追加
    const candidates: NarrowExampleSource[] = [
      {
        itemKind: 'text_excerpt',
        title: 'A',
        subtitle: '',
        url: 'https://a.example/1',
        excerpt: 'Shared content one'
      },
      {
        itemKind: 'text_excerpt',
        title: 'B',
        subtitle: '',
        url: 'https://b.example/2',
        excerpt: 'Shared content two'
      },
      {
        itemKind: 'text_excerpt',
        title: 'C',
        subtitle: '',
        url: 'https://c.example/3',
        excerpt: 'Shared content three'
      }
    ]
    // 无合格 token（shared 长度 6 但 df=3 = 全覆盖）；topicTerms['Model 3'] 追加
    const examples = extractComposerNarrowExamples({
      candidates,
      clueText: 'shared content',
      topicTerms: ['Model 3']
    })
    expect(examples).toContain('Model 3')
  })

  it('topicTerms 与 clueText 重复词不重复追加', () => {
    const candidates: NarrowExampleSource[] = [
      {
        itemKind: 'text_excerpt',
        title: 'Kubernetes',
        subtitle: '',
        url: 'https://k8s.example/1',
        excerpt: 'Kubernetes notes'
      },
      {
        itemKind: 'text_excerpt',
        title: 'Kubernetes',
        subtitle: '',
        url: 'https://k8s.example/2',
        excerpt: 'Kubernetes guide'
      }
    ]
    // kubernetes 在候选 df>=2，且 clueText 已含 → 不追加（blocked by clueTokenSet）
    const examples = extractComposerNarrowExamples({
      candidates,
      clueText: 'kubernetes notes',
      topicTerms: ['kubernetes']
    })
    // kubernetes 已由 clue 阻塞；topicTerms 不追加（push 逻辑已做去重）
    expect(examples).toHaveLength(0)
  })

  it('topicTerms 为空数组 → 不追加（与无 topicTerms 等价）', () => {
    // 至少 2 条候选使 df>=2，unique 才有资格被选入
    const candidates: NarrowExampleSource[] = [
      {
        itemKind: 'text_excerpt',
        title: 'A',
        subtitle: '',
        url: 'https://a.example/1',
        excerpt: 'unique token here'
      },
      {
        itemKind: 'text_excerpt',
        title: 'B',
        subtitle: '',
        url: 'https://b.example/2',
        excerpt: 'unique token also'
      }
    ]
    const examples = extractComposerNarrowExamples({
      candidates,
      topicTerms: []
    })
    // 空数组 topicTerms 等价于不传；unique 有 df=2，应被选入
    expect(examples).toContain('unique')
  })
})
