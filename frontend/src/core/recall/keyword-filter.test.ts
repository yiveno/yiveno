import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import { recallByKeyword } from '@/core/recall/build-recall-result'
import {
  camelCaseAcronym,
  compactRecallText,
  computeBehaviorBoost,
  computeCaseFitBoost,
  computeDismissPenalty,
  expandRecallHostClueVariants,
  extractCasedClueTokens,
  extractOrthographicAcronyms,
  filterMemoryItemsByKeyword,
  isGenericRecallClue,
  isGenericOnlyHitAgainstSpecificClue,
  latinInflectionVariants,
  recallTopPickBlockedByGenericPageTitleGate,
  scoreMemoryItem,
  tokenizeRecallClue
} from '@/core/recall/keyword-filter'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-22T06:00:00.000Z'
}

describe('keyword-filter', () => {
  it('tokenizeRecallClue 保留整句、分词与无空格段首尾 2-gram', () => {
    expect(tokenizeRecallClue('retention analysis')).toEqual(
      expect.arrayContaining(['retention analysis', 'retention', 'analysis'])
    )
    expect(tokenizeRecallClue('what checks before release')).toEqual(
      expect.arrayContaining(['checks', 'release'])
    )
    // ASCII 单字母过噪丢弃
    expect(tokenizeRecallClue('a')).toEqual([])
  })

  it('short English clue can hit a title token', () => {
    const bookmark = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'Red Quarry multiplayer platform',
        url: 'https://ra2web.com/red-quarry'
      }
    })

    const result = recallByKeyword([bookmark], 'red')
    expect(result.topPick?.item.id).toBe(bookmark.id)
    expect(tokenizeRecallClue('red')).toEqual(expect.arrayContaining(['red']))
  })

  it('compactRecallText 去掉空白以便跨空格命中', () => {
    expect(compactRecallText('Yiveno Product')).toBe('yivenoproduct')
  })

  it('scoreMemoryItem 支持去空白与轻量错别字', () => {
    const bookmark = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'Yiveno Product Doc v4.0',
        url: 'https://docs.yiveno.com/product/v4'
      }
    })

    const match = scoreMemoryItem(bookmark, 'Yiveno product dox')
    expect(match.score).toBeGreaterThan(0)
    expect(match.matchedFields).toContain('title')
  })

  it('词面命中后叠加行为加权；无命中不加', () => {
    const cold = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Yiveno Product Doc', url: 'https://docs.yiveno.com/a' }
    })
    const hot = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Yiveno Design Principles', url: 'https://docs.yiveno.com/b' },
      clues: {
        openCount: 20,
        lastOpenedAt: '2026-07-24T10:00:00.000Z'
      }
    })

    const nowMs = Date.parse('2026-07-25T12:00:00.000Z')
    expect(computeBehaviorBoost(hot, { nowMs })).toBeGreaterThan(0)
    expect(computeBehaviorBoost(cold, { nowMs })).toBe(0)

    const ranked = filterMemoryItemsByKeyword([cold, hot], 'Yiveno', {
      minScore: 1,
      nowMs
    })
    expect(ranked[0]?.item.id).toBe(hot.id)

    expect(scoreMemoryItem(hot, 'totally unrelated', { nowMs }).score).toBe(0)
  })

  it('extractOrthographicAcronyms：CamelCase 与多词首字母（无词典）', () => {
    expect(extractOrthographicAcronyms('现代 JavaScript 教程')).toEqual(
      expect.arrayContaining(['js'])
    )
    expect(extractOrthographicAcronyms('React Native')).toEqual(expect.arrayContaining(['rn']))
    expect(extractOrthographicAcronyms('CSS: Cascading Style Sheets')).toEqual(
      expect.arrayContaining(['css'])
    )
    expect(extractOrthographicAcronyms('javascript handbook')).not.toContain('js')
  })

  it('精排短词：js 经形态缩写命中 JavaScript（非字面子串、无别名表）', () => {
    expect(camelCaseAcronym('JavaScript')).toBe('js')
    // 回归：全小写 javascript 既不含连续「js」，也不以「js」开头——形态通解依赖原文大小写
    expect('javascript'.includes('js')).toBe(false)
    expect('javascript'.startsWith('js')).toBe(false)

    const jsCookie = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'js-cookie - npm', url: 'https://www.npmjs.com/package/js-cookie' }
    })
    const javascriptTutorial = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: '现代 JavaScript 教程',
        url: 'https://zh.javascript.info/'
      }
    })
    const mdn = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'JavaScript | MDN',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript'
      }
    })
    const lowerOnly = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'javascript handbook',
        url: 'https://handbook.example.com/javascript'
      }
    })
    const reactNative = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'React Native docs',
        url: 'https://reactnative.dev/'
      }
    })
    const unrelated = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Python tutorial', url: 'https://docs.python.org/' }
    })

    const ranked = filterMemoryItemsByKeyword(
      [jsCookie, javascriptTutorial, mdn, lowerOnly, reactNative, unrelated],
      'js',
      { minScore: 1, limit: 10 }
    )
    const ids = ranked.map(match => match.item.id)
    expect(ids).toContain(jsCookie.id)
    expect(ids).toContain(javascriptTutorial.id)
    expect(ids).toContain(mdn.id)
    // 全小写无形态边界：不靠硬编码别名表命中
    expect(ids).not.toContain(lowerOnly.id)
    expect(ids).not.toContain(reactNative.id)
    expect(ids).not.toContain(unrelated.id)

    const rnRanked = filterMemoryItemsByKeyword([reactNative, unrelated], 'rn', {
      minScore: 1,
      limit: 5
    })
    expect(rnRanked.map(match => match.item.id)).toContain(reactNative.id)
  })

  it('精排子串：css 可命中 Cascading Style Sheets 标题中的 CSS', () => {
    const mdnCss = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'CSS: Cascading Style Sheets | MDN',
        url: 'https://developer.mozilla.org/en-US/docs/Web/CSS'
      }
    })
    const match = scoreMemoryItem(mdnCss, 'css')
    expect(match.score).toBeGreaterThan(0)
    expect(match.matchedFields).toContain('title')
  })

  it('大小写贴合：线索含大写时，原文大小写一致高于乱写；全小写线索不加分', () => {
    expect(extractCasedClueTokens('javascript')).toEqual([])
    expect(extractCasedClueTokens('JavaScript')).toEqual(['JavaScript'])
    expect(computeCaseFitBoost('javascript', ['JavaScript | MDN'])).toBe(0)
    expect(computeCaseFitBoost('JavaScript', ['JavaScript | MDN'])).toBeGreaterThan(0)
    expect(computeCaseFitBoost('JavaScript', ['JAVASCRIPT GUIDE'])).toBe(0)

    const exactCase = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'JavaScript | MDN',
        url: 'https://mdn.example.com/docs'
      }
    })
    const upperCase = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'JAVASCRIPT GUIDE',
        url: 'https://upper.example.com/docs'
      }
    })
    const lowerCase = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'javascript tutorial',
        url: 'https://lower.example.com/docs'
      }
    })

    const clueCased = 'JavaScript'
    const exactScore = scoreMemoryItem(exactCase, clueCased).score
    const upperScore = scoreMemoryItem(upperCase, clueCased).score
    const lowerScore = scoreMemoryItem(lowerCase, clueCased).score
    expect(exactScore).toBeGreaterThan(upperScore)
    expect(exactScore).toBeGreaterThan(lowerScore)

    // 全小写线索：均可命中，case-fit 为 0
    const plain = 'javascript'
    expect(scoreMemoryItem(exactCase, plain).score).toBeGreaterThan(0)
    expect(scoreMemoryItem(upperCase, plain).score).toBeGreaterThan(0)
    expect(scoreMemoryItem(lowerCase, plain).score).toBeGreaterThan(0)
    expect(computeCaseFitBoost(plain, ['JavaScript | MDN'])).toBe(0)
  })

  it('否定反馈 dismissCount 降权；多次封顶', () => {
    const clean = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Yiveno Product Doc', url: 'https://docs.yiveno.com/clean' }
    })
    const dismissed = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Yiveno Product Doc', url: 'https://docs.yiveno.com/dismissed' },
      clues: { dismissCount: 3 }
    })
    const heavilyDismissed = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Yiveno Product Doc', url: 'https://docs.yiveno.com/heavy' },
      clues: { dismissCount: 99 }
    })

    expect(computeDismissPenalty(clean)).toBe(0)
    expect(computeDismissPenalty(dismissed)).toBeGreaterThan(0)
    expect(computeDismissPenalty(heavilyDismissed)).toBe(10)

    const cleanScore = scoreMemoryItem(clean, 'Yiveno').score
    const dismissedScore = scoreMemoryItem(dismissed, 'Yiveno').score
    expect(dismissedScore).toBeLessThan(cleanScore)
  })

  it('scoreMemoryItem 命中标题时分数更高', () => {
    const bookmark = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'Retention Analysis Framework',
        url: 'https://example.com/retention'
      }
    })

    const match = scoreMemoryItem(bookmark, 'retention analysis')
    expect(match.score).toBeGreaterThan(0)
    expect(match.matchedFields).toContain('title')
  })

  it('多内容词覆盖：dpr+arxiv 压过仅命中泛词 paper 的 Working Paper', () => {
    const dpr = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'Dense Passage Retrieval for Open-Domain QA',
        url: 'https://arxiv.org/abs/2004.04906'
      }
    })
    const working = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'Working Paper: Measuring Trust in News',
        url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1234567'
      }
    })
    const clue = 'dpr paper arxiv'
    expect(scoreMemoryItem(dpr, clue).score).toBeGreaterThan(scoreMemoryItem(working, clue).score)
  })

  it('filterMemoryItemsByKeyword 按分数排序并截断', () => {
    const items = [
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'Unrelated content', url: 'https://a.example.com' }
      }),
      createTextExcerptMemoryItem({
        ...baseContext,
        payload: {
          selectedText: 'Key retention metrics overview',
          sourceUrl: 'https://b.example.com/post',
          pageTitle: 'Growth notes'
        }
      })
    ]

    const matches = filterMemoryItemsByKeyword(items, 'retention', { limit: 1, minScore: 1 })
    expect(matches).toHaveLength(1)
    expect(matches[0]?.item.type).toBe('text_excerpt')
  })

  it('recallByKeyword 无命中时返回 no_match', () => {
    const bookmark = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Hello', url: 'https://hello.example.com' }
    })

    const result = recallByKeyword([bookmark], 'totally unrelated')
    expect(result.outcome).toBe('no_match')
    expect(result.topPick).toBeNull()
  })

  it('recallByKeyword 返回 Top Pick 与候选', () => {
    const items = [
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'Yiveno Product Doc', url: 'https://docs.yiveno.example/docs' }
      }),
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'Yiveno Design Principles', url: 'https://design.other.example/design' }
      })
    ]

    const result = recallByKeyword(items, 'Yiveno')
    expect(result.outcome).toBe('top_pick')
    expect(result.topPick).not.toBeNull()
    expect(result.alsoPossible.length).toBeGreaterThan(0)
  })

  it('主文含词压过仅上下文沾边（即使上下文项更新且常打开）', () => {
    const contextOnly = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'Sequence still matters.',
        sourceUrl: 'https://www.gushiwen.cn/a',
        pageTitle: 'Palette notes',
        contextBefore: 'deep red and white'
      },
      clues: {
        openCount: 40,
        lastOpenedAt: '2026-07-24T18:00:00.000Z'
      },
      now: () => '2026-07-25T08:00:00.000Z'
    })
    const inSelected = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'deep red white tone',
        sourceUrl: 'https://www.gushiwen.cn/b',
        pageTitle: 'Palette notes'
      },
      now: () => '2026-07-10T08:00:00.000Z'
    })

    const ranked = filterMemoryItemsByKeyword([contextOnly, inSelected], 'red white', {
      nowMs: Date.parse('2026-07-25T12:00:00.000Z')
    })
    expect(ranked[0]?.item.id).toBe(inSelected.id)
    expect(ranked[0]?.matchedFields).toContain('textExcerpt')
  })

  it('语言无关贴合度：起首+短密压过夹心（中/英）', () => {
    const embeddedAlt = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'deep red white tone',
        sourceUrl: 'https://example.com/alt-mid',
        pageTitle: 'x'
      },
      now: () => '2026-07-20T08:00:00.000Z'
    })
    const prefixAlt = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'red white ok',
        sourceUrl: 'https://example.com/alt-prefix',
        pageTitle: 'x'
      },
      now: () => '2026-07-01T08:00:00.000Z'
    })
    const embeddedEn = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'deep red white tone',
        sourceUrl: 'https://example.com/en-mid',
        pageTitle: 'x'
      },
      now: () => '2026-07-20T08:00:00.000Z'
    })
    const prefixEn = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'red white ok',
        sourceUrl: 'https://example.com/en-prefix',
        pageTitle: 'x'
      },
      now: () => '2026-07-01T08:00:00.000Z'
    })

    expect(filterMemoryItemsByKeyword([embeddedAlt, prefixAlt], 'red white')[0]?.item.id).toBe(
      prefixAlt.id
    )
    expect(filterMemoryItemsByKeyword([embeddedEn, prefixEn], 'red white')[0]?.item.id).toBe(
      prefixEn.id
    )
  })

  it('摘录出处页名命中记为 pageTitle 而非 title', () => {
    const excerpt = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'Sequence still matters.',
        sourceUrl: 'https://www.gushiwen.cn/x',
        pageTitle: 'Poetry archive'
      }
    })

    const match = scoreMemoryItem(excerpt, 'poetry')
    expect(match.matchedFields).toContain('pageTitle')
    expect(match.matchedFields).not.toContain('title')

    const result = recallByKeyword([excerpt], 'poetry')
    expect(result.outcome).toBe('top_pick')
    expect(result.topPick?.item.id).toBe(excerpt.id)
  })

  it('用户附注命中权重大于正文，可作强线索找回', () => {
    const byBody = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'a sentence about red and white',
        sourceUrl: 'https://example.com/body',
        pageTitle: 'Poetry line'
      }
    })
    const byNote = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'clouds stack over distant mountains',
        sourceUrl: 'https://example.com/note',
        pageTitle: 'A quiet line'
      },
      clues: { note: 'red white impression' }
    })

    const ranked = filterMemoryItemsByKeyword([byBody, byNote], 'red white')
    expect(ranked[0]?.item.id).toBe(byNote.id)
    expect(ranked[0]?.matchedFields).toContain('note')
  })

  it('latinInflectionVariants：disagreed → disagree', () => {
    expect(latinInflectionVariants('disagreed')).toEqual(
      expect.arrayContaining(['disagreed', 'disagree'])
    )
  })

  it('附注屈折对齐 + 多词覆盖：压过单共享词 newsletter 沾边', () => {
    const target = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'Why note-taking apps fail researchers',
        url: 'https://example.substack.com/p/why-note-taking-apps-fail',
        domain: 'example.substack.com'
      },
      clues: { note: 'disagree with section 3' }
    })
    const rival = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText:
          'Boredom is not empty time; it is unstructured time that still belongs to you.',
        sourceUrl: 'https://aeon.co/essays/the-joy-of-being-bored',
        pageTitle: 'The joy of being bored'
      },
      clues: { note: 'use in newsletter opener' }
    })

    const clue = 'newsletter where I disagreed with section 3'
    const ranked = filterMemoryItemsByKeyword([rival, target], clue)
    expect(ranked[0]?.item.id).toBe(target.id)
    expect(scoreMemoryItem(target, clue).score).toBeGreaterThan(scoreMemoryItem(rival, clue).score)
  })

  it('expandRecallHostClueVariants 补 www 与裸域', () => {
    expect(expandRecallHostClueVariants('rottentomatoes.com')).toEqual(
      expect.arrayContaining(['rottentomatoes.com', 'www.rottentomatoes.com'])
    )
    expect(expandRecallHostClueVariants('www.rottentomatoes.com')).toEqual(
      expect.arrayContaining(['www.rottentomatoes.com', 'rottentomatoes.com'])
    )
  })

  it('纯 host 线索命中 www 域摘录', () => {
    const excerpt = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText:
          'A powerful, visually spectacular drama that demands your full concentration, Oppenheimer is unmistakably the work of writer-director Christopher Nolan.',
        sourceUrl: 'https://www.rottentomatoes.com/m/oppenheimer_2023',
        pageTitle: 'Oppenheimer (2023) | Rotten Tomatoes'
      }
    })

    const result = recallByKeyword([excerpt], 'rottentomatoes.com')
    expect(result.topPick?.item.id).toBe(excerpt.id)
    expect(result.topPick?.matchedFields).toEqual(expect.arrayContaining(['domain']))
  })

  it('isGenericRecallClue 识别全泛词与带锚点 clue', () => {
    expect(isGenericRecallClue('movie review I saved')).toBe(true)
    expect(isGenericRecallClue('weekly review')).toBe(false)
    expect(isGenericRecallClue('rottentomatoes.com')).toBe(false)
  })

  it('含锚点 clue 时，仅泛词沾边的条目视为假阳性', () => {
    const weekly = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'This week: popup empty-state tiers and library browse.',
        sourceUrl: 'https://notes.example.com/weekly-review',
        pageTitle: 'Weekly review'
      }
    })
    const oppenheimer = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText:
          'A powerful, visually spectacular drama about the atomic bomb and Oppenheimer.',
        sourceUrl: 'https://www.rottentomatoes.com/m/oppenheimer_2023',
        pageTitle: 'Oppenheimer (2023) | Rotten Tomatoes'
      }
    })
    const clue = 'atomic bomb movie review'
    expect(isGenericOnlyHitAgainstSpecificClue(clue, weekly)).toBe(true)
    expect(isGenericOnlyHitAgainstSpecificClue(clue, oppenheimer)).toBe(false)
  })

  it('泛词 clue 仅凭 pageTitle 命中时阻断 Top Pick', () => {
    expect(recallTopPickBlockedByGenericPageTitleGate('movie review I saved', ['pageTitle'])).toBe(
      true
    )
    expect(recallTopPickBlockedByGenericPageTitleGate('weekly review', ['pageTitle'])).toBe(false)
    expect(
      recallTopPickBlockedByGenericPageTitleGate('movie review I saved', ['textExcerpt'])
    ).toBe(false)
  })

  it('movie review I saved 不得仅凭 Weekly review 页名升 Top1', () => {
    const weekly = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'This week: popup empty-state tiers and library browse.',
        sourceUrl: 'https://notes.example.com/weekly-review',
        pageTitle: 'Weekly review'
      }
    })
    const oppenheimer = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText:
          'A powerful, visually spectacular drama that demands your full concentration, Oppenheimer is unmistakably the work of writer-director Christopher Nolan.',
        sourceUrl: 'https://www.rottentomatoes.com/m/oppenheimer_2023',
        pageTitle: 'Oppenheimer (2023) | Rotten Tomatoes'
      }
    })

    const vague = recallByKeyword([weekly, oppenheimer], 'movie review I saved')
    expect(vague.outcome).toBe('need_a_clue')
    expect(vague.topPick).toBeNull()
    expect(vague.alsoPossible.some(match => match.item.id === weekly.id)).toBe(true)

    const specific = recallByKeyword([weekly], 'weekly review')
    expect(specific.outcome).toBe('top_pick')
    expect(specific.topPick?.item.id).toBe(weekly.id)
  })

  it('Gregory Peck million pound note 1954 应 Top1 英文摘录', () => {
    const peck = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText:
          'The Million Pound Note (1954) is a classic Gregory Peck comedy about a man handed a banknote he cannot spend.',
        sourceUrl: 'https://en.wikipedia.org/wiki/The_Million_Pound_Note',
        pageTitle: 'The Million Pound Note - Wikipedia'
      }
    })

    const result = recallByKeyword([peck], 'Gregory Peck million pound note 1954')
    expect(result.outcome).toBe('top_pick')
    expect(result.topPick?.item.id).toBe(peck.id)
  })
})
