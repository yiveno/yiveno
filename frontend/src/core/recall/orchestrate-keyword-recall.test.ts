import { describe, expect, it } from 'vitest'

import {
  RECALL_ORCHESTRATION_OBJECT_TYPE_BOOST,
  applyParsedClueScoreBoosts,
  buildFilterClueFromParsed,
  memoryItemInTimeRange,
  memoryItemMatchesObjectType,
  recallByKeywordWithParsedClue
} from '@/core/recall/orchestrate-keyword-recall'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import { recallByKeyword } from '@/core/recall/build-recall-result'
import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'

const OWNER = '11111111-1111-4111-8111-111111111111'
const PROFILE = '22222222-2222-4222-8222-222222222222'
const NOW_MS = Date.parse('2026-07-28T12:00:00.000Z')

describe('buildFilterClueFromParsed', () => {
  it('优先用 contentTerms', () => {
    const parsed = parseRecallClue('yesterday saved a poem about Li Bai', { nowMs: NOW_MS })
    expect(buildFilterClueFromParsed(parsed)).toBe('li bai')
  })

  it('无 contentTerms 时回退到对象类型词面（canonical English）', () => {
    const parsed = parseRecallClue("the article I didn't finish reading a while ago", {
      nowMs: NOW_MS
    })
    expect(parsed.contentTerms).toEqual([])
    expect(buildFilterClueFromParsed(parsed)).toBe('article')
  })

  it('content terms pass through without topic alias expansion', () => {
    const parsed = parseRecallClue('wwii related video', { nowMs: NOW_MS })
    expect(buildFilterClueFromParsed(parsed)).toBe('wwii')
  })
})

describe('memoryItemInTimeRange / objectType', () => {
  it('按 createdAt / lastOpenedAt 判断时间窗', () => {
    const parsed = parseRecallClue('yesterday poem', { nowMs: NOW_MS })
    const inRange = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-27T08:00:00.000Z',
      payload: {
        selectedText: 'Li Bai poem',
        sourceUrl: 'https://poem.example/li',
        pageTitle: 'Li Bai'
      }
    })
    const outOfRange = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-20T08:00:00.000Z',
      payload: {
        selectedText: 'Li Bai poem',
        sourceUrl: 'https://poem.example/old',
        pageTitle: 'Old poem'
      }
    })

    expect(parsed.timeRange).toBeDefined()
    expect(memoryItemInTimeRange(inRange, parsed.timeRange!)).toBe(true)
    expect(memoryItemInTimeRange(outOfRange, parsed.timeRange!)).toBe(false)
  })

  it('tags slug 或正文含类型词可匹配 objectType', () => {
    const tagged = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: { title: 'Note', url: 'https://example.com/a' },
      clues: { tags: ['poem'] }
    })
    const titled = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: { title: 'Li Bai poem', url: 'https://example.com/b' }
    })

    expect(memoryItemMatchesObjectType(tagged, 'poem')).toBe(true)
    expect(memoryItemMatchesObjectType(titled, 'poem')).toBe(true)
  })

  it('clip 仅线索侧认 video；标题/关键词里的 clip 不作条目证据', () => {
    const clipTitled = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        selectedText: 'Retries without a stable request key',
        sourceUrl: 'https://linear.app/blog/x',
        pageTitle: 'Perf checklist: clip 1201',
        domain: 'linear.app'
      },
      clues: { keywords: ['clip'] }
    })
    const youtube = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'Design critique rituals',
        url: 'https://www.youtube.com/watch?v=abc',
        domain: 'youtube.com'
      },
      clues: { tags: ['video'], keywords: ['video', 'youtube', 'watch', 'clip'] }
    })

    expect(parseRecallClue('that clip I saved', { nowMs: NOW_MS }).objectTypes).toEqual(['video'])
    expect(memoryItemMatchesObjectType(clipTitled, 'video')).toBe(false)
    expect(memoryItemMatchesObjectType(youtube, 'video')).toBe(true)

    const result = recallByKeywordWithParsedClue([clipTitled, youtube], 'video', {
      nowMs: NOW_MS
    })
    const ids = [result.topPick, ...result.alsoPossible].filter(Boolean).map(m => m!.item.id)
    expect(ids).toContain(youtube.id)
    expect(ids).not.toContain(clipTitled.id)
  })
})

describe('applyParsedClueScoreBoosts', () => {
  it('时间窗内条目不再靠时间软加成（已硬过滤）；类型仍可加成', () => {
    const parsed = parseRecallClue('yesterday Li Bai poem', { nowMs: NOW_MS })
    const item = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-27T10:00:00.000Z',
      payload: {
        selectedText: 'Li Bai poem',
        sourceUrl: 'https://poem.example/x',
        pageTitle: 'poem'
      }
    })
    const boosted = applyParsedClueScoreBoosts(
      { item, score: 20, matchedFields: ['textExcerpt'] },
      parsed
    )
    expect(boosted.score).toBe(20 + RECALL_ORCHESTRATION_OBJECT_TYPE_BOOST)
  })

  it('零分不加结构化加成', () => {
    const parsed = parseRecallClue('yesterday poem', { nowMs: NOW_MS })
    const item = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-27T10:00:00.000Z',
      payload: {
        selectedText: 'irrelevant',
        sourceUrl: 'https://poem.example/y',
        pageTitle: 'poem'
      }
    })
    const boosted = applyParsedClueScoreBoosts({ item, score: 0, matchedFields: [] }, parsed)
    expect(boosted.score).toBe(0)
  })
})

describe('recallByKeywordWithParsedClue', () => {
  it('剥离时间词后靠内容词命中，且窗内条目压过窗外同内容', () => {
    const inRange = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-27T09:00:00.000Z',
      payload: {
        selectedText: 'Li Bai poem',
        sourceUrl: 'https://poem.example/new',
        pageTitle: 'poem'
      }
    })
    const outOfRange = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-06-01T09:00:00.000Z',
      payload: {
        selectedText: 'Li Bai poem',
        sourceUrl: 'https://poem.example/old',
        pageTitle: 'poem'
      }
    })

    const result = recallByKeywordWithParsedClue(
      [outOfRange, inRange],
      'yesterday saved a poem about Li Bai',
      { nowMs: NOW_MS }
    )

    expect(result.outcome).toBe('top_pick')
    expect(result.topPick?.item.id).toBe(inRange.id)
    expect(result.clue).toBe('yesterday saved a poem about Li Bai')
  })

  it('纯关键词线索行为不劣于旧 recallByKeyword（同 Top）', () => {
    const item = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'Cloudflare Workers Guide',
        url: 'https://developers.cloudflare.com/workers/'
      }
    })
    const clue = 'Cloudflare Workers'
    const orchestrated = recallByKeywordWithParsedClue([item], clue, { nowMs: NOW_MS })
    const baseline = recallByKeyword([item], clue, { nowMs: NOW_MS })
    expect(orchestrated.topPick?.item.id).toBe(baseline.topPick?.item.id)
    expect(orchestrated.outcome).toBe(baseline.outcome)
  })

  it('The recently collected bookmark → 近因书签邻域（不搜 collected）', () => {
    const recent = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-28T10:00:00.000Z',
      payload: {
        title: 'Interview notes on X',
        url: 'https://x.com/example/status/1'
      }
    })
    const older = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-20T10:00:00.000Z',
      payload: {
        title: 'Older bookmark',
        url: 'https://example.com/old'
      }
    })
    const excerpt = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-28T11:00:00.000Z',
      payload: {
        selectedText: 'collected thoughts',
        sourceUrl: 'https://blog.example/collected',
        pageTitle: 'collected'
      }
    })

    const result = recallByKeywordWithParsedClue(
      [older, excerpt, recent],
      'The recently collected bookmark',
      { nowMs: NOW_MS }
    )

    expect(result.outcome).toBe('top_pick')
    expect(result.topPick?.item.id).toBe(recent.id)
    expect(result.topPick?.item.id).not.toBe(excerpt.id)
    expect(result.alsoPossible.every(match => match.item.type === 'bookmark')).toBe(true)
  })

  it('just saved bookmarks：按 Chrome dateAdded 近因，不按灌库时刻', () => {
    const recentlyStarred = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-28T11:00:00.000Z',
      payload: {
        title: '码良 on X: 面试官…',
        url: 'https://x.com/cxjwin/status/2090241406707065055',
        chromeCreatedAt: '2026-07-28T10:30:00.000Z'
      }
    })
    // 老书签：灌库时刻很新，但 Chrome 星标很久以前
    const oldChromeButFreshIngest = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-28T11:59:00.000Z',
      payload: {
        title: 'HTML Standard',
        url: 'https://html.spec.whatwg.org/',
        chromeCreatedAt: '2020-01-01T00:00:00.000Z'
      }
    })

    const result = recallByKeywordWithParsedClue(
      [oldChromeButFreshIngest, recentlyStarred],
      'just saved bookmarks',
      { nowMs: NOW_MS }
    )

    expect(result.outcome).toBe('top_pick')
    expect(result.topPick?.item.id).toBe(recentlyStarred.id)
    expect(result.alsoPossible.every(m => m.item.id !== oldChromeButFreshIngest.id)).toBe(true)
  })

  it('just saved → 无类型也出近因邻域（最新优先）', () => {
    const recentBookmark = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-28T10:00:00.000Z',
      payload: {
        title: 'Interview notes on X',
        url: 'https://x.com/example/status/2'
      }
    })
    const newerExcerpt = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-28T11:00:00.000Z',
      payload: {
        selectedText: 'a saved line',
        sourceUrl: 'https://blog.example/line',
        pageTitle: 'Blog'
      }
    })
    const old = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-06-01T10:00:00.000Z',
      payload: {
        title: 'Ancient',
        url: 'https://example.com/ancient'
      }
    })

    const result = recallByKeywordWithParsedClue(
      [old, recentBookmark, newerExcerpt],
      'just saved',
      {
        nowMs: NOW_MS
      }
    )

    expect(result.outcome).toBe('top_pick')
    expect(result.topPick?.item.id).toBe(newerExcerpt.id)
    expect(result.alsoPossible.some(match => match.item.id === recentBookmark.id)).toBe(true)
    expect(result.topPick?.item.id).not.toBe(old.id)
  })

  it('附注指向且条目有 note 时更易胜出', () => {
    const withNote = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-27T10:00:00.000Z',
      payload: { title: 'deploy guide', url: 'https://docs.example/deploy' },
      clues: { note: 'my note: deploy is great' }
    })
    const withoutNote = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-27T09:00:00.000Z',
      payload: { title: 'deploy mirror', url: 'https://mirror.example/deploy' }
    })

    const result = recallByKeywordWithParsedClue(
      [withoutNote, withNote],
      'yesterday my note about deploy',
      { nowMs: NOW_MS }
    )
    expect(result.topPick?.item.id).toBe(withNote.id)
  })

  it('对象类型 tags 可获得类型加成', () => {
    const parsed = parseRecallClue('article', { nowMs: NOW_MS })
    const item = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: { title: 'some article', url: 'https://blog.example/a' },
      clues: { tags: ['article'] }
    })
    const boosted = applyParsedClueScoreBoosts(
      { item, score: 20, matchedFields: ['title'] },
      parsed
    )
    expect(boosted.score).toBe(20 + RECALL_ORCHESTRATION_OBJECT_TYPE_BOOST)
  })

  it('有 timeRange 时窗外同类不得成为 Top Pick（时间硬过滤）', () => {
    const outOfRange = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-06-01T09:00:00.000Z',
      payload: {
        title: 'Some youtube video',
        url: 'https://www.youtube.com/watch?v=REwnP79bbXo'
      },
      clues: { tags: ['video'] }
    })

    const yesterdayClue = 'The video I watched yesterday'
    expect(parseRecallClue(yesterdayClue, { nowMs: NOW_MS }).timeRange?.label).toBe('yesterday')
    const yesterday = recallByKeywordWithParsedClue([outOfRange], yesterdayClue, {
      nowMs: NOW_MS
    })
    expect(yesterday.outcome).toBe('no_match')
    expect(yesterday.topPick).toBeNull()

    const todayClue = 'The videos I watched today'
    expect(parseRecallClue(todayClue, { nowMs: NOW_MS }).timeRange?.label).toBe('today')
    const today = recallByKeywordWithParsedClue([outOfRange], todayClue, {
      nowMs: NOW_MS
    })
    expect(today.outcome).toBe('no_match')

    const noTime = recallByKeywordWithParsedClue([outOfRange], 'videos', { nowMs: NOW_MS })
    expect(parseRecallClue('videos', { nowMs: NOW_MS }).timeRange).toBeUndefined()
    expect(noTime.outcome).not.toBe('no_match')
    expect(noTime.topPick?.item.id ?? noTime.alsoPossible[0]?.item.id).toBe(outOfRange.id)
  })

  it('low 置信时间不硬空：窗外仍可因字面进邻域（ADR-011）', () => {
    // NOW=2026-07-28；a_while_ago ≈ 3–30 日前 → 窗外用更旧条目
    const outOfRange = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-01-15T09:00:00.000Z',
      payload: {
        title: 'Postgres EXPLAIN deep dive',
        url: 'https://www.postgresql.org/docs/current/using-explain.html'
      },
      clues: { tags: ['article'] }
    })

    const clue = 'something about postgres explain from a while ago'
    const parsed = parseRecallClue(clue, { nowMs: NOW_MS })
    expect(parsed.timeRange?.label).toBe('a_while_ago')
    expect(parsed.timeConfidence).toBe('low')
    expect(memoryItemInTimeRange(outOfRange, parsed.timeRange!)).toBe(false)

    const result = recallByKeywordWithParsedClue([outOfRange], clue, { nowMs: NOW_MS })
    expect(result.outcome).not.toBe('no_match')
    expect(result.topPick?.item.id ?? result.alsoPossible[0]?.item.id).toBe(outOfRange.id)
  })

  it('lastOpenedAt 落在时间窗内也算命中（watched）', () => {
    const item = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-06-01T09:00:00.000Z',
      payload: {
        title: 'Opened yesterday video',
        url: 'https://www.youtube.com/watch?v=opened'
      },
      clues: {
        tags: ['video'],
        lastOpenedAt: '2026-07-27T15:00:00.000Z'
      }
    })
    const result = recallByKeywordWithParsedClue([item], 'The video I watched yesterday', {
      nowMs: NOW_MS
    })
    expect(result.outcome).not.toBe('no_match')
    expect(result.topPick?.item.id ?? result.alsoPossible[0]?.item.id).toBe(item.id)
  })

  it('literal WWII in title is recallable without topic seed', () => {
    const item = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'WWII documentary — BBC News',
        url: 'https://www.youtube.com/watch?v=wwii-doc'
      }
    })
    expect(item.clues.tags).toContain('video')
    expect(item.clues.keywords).not.toEqual(expect.arrayContaining(['wwii']))

    const english = recallByKeywordWithParsedClue([item], 'wwii related video', {
      nowMs: NOW_MS
    })
    expect(english.outcome).not.toBe('no_match')
    expect(english.topPick?.item.id ?? english.alsoPossible[0]?.item.id).toBe(item.id)
  })

  it('literal Changchun in title is recallable without economy topic seed', () => {
    const item = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'Will Changchun become a bankrupt capital city as growth slows?',
        url: 'https://www.youtube.com/watch?v=_weXNUQ5NS4'
      }
    })
    const result = recallByKeywordWithParsedClue([item], 'changchun city video', {
      nowMs: NOW_MS
    })
    expect(result.outcome).not.toBe('no_match')
    expect(result.topPick?.item.id ?? result.alsoPossible[0]?.item.id).toBe(item.id)
  })

  it('零锚点助手发令（play songs I like）无歌类痕迹 → 诚实 no_match', () => {
    const noise = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'Notes on gardening tips',
        url: 'https://www.smithsonianmag.com/probe/excerpt/21'
      }
    })
    const result = recallByKeywordWithParsedClue(
      [noise],
      'play some songs I like from my playlist',
      { nowMs: NOW_MS }
    )
    expect(result.outcome).toBe('no_match')
    expect(result.topPick).toBeNull()
  })

  it('零锚点：bored / recommend movie → 诚实 no_match（禁当推荐引擎）', () => {
    const noise = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'Font pairing ideas for editorial sites',
        url: 'https://www.typewolf.com/tips/font-pairing-editorial'
      }
    })
    const video = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'Design critique rituals',
        url: 'https://www.youtube.com/watch?v=yivenoDesignCritique01'
      },
      clues: { tags: ['video'] }
    })
    expect(
      recallByKeywordWithParsedClue([noise, video], 'i feel bored pick something fun for me', {
        nowMs: NOW_MS
      }).outcome
    ).toBe('no_match')
    expect(
      recallByKeywordWithParsedClue(
        [noise, video],
        'recommend a good movie I should watch tonight',
        { nowMs: NOW_MS }
      ).outcome
    ).toBe('no_match')
  })

  it('非找回生活助手：天气 / 点餐 → no_match；有记忆锚的 weather 线索仍可扫', () => {
    const attention = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'The Attention Economy Is a Lie',
        url: 'https://www.theatlantic.com/yiveno-probe/attention-economy-myth/'
      }
    })
    const cooking = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'campfire cooking (#330)',
        url: 'https://www.bbc.com/probe/329'
      }
    })
    const weatherArticle = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'Climate weather patterns research notes',
        url: 'https://www.nature.com/articles/weather-patterns-probe'
      }
    })
    expect(
      recallByKeywordWithParsedClue(
        [attention, cooking],
        'what is the weather going to be like tomorrow',
        { nowMs: NOW_MS }
      ).outcome
    ).toBe('no_match')
    expect(
      recallByKeywordWithParsedClue([attention, cooking], 'order me some pizza for dinner', {
        nowMs: NOW_MS
      }).outcome
    ).toBe('no_match')
    const savedWeather = recallByKeywordWithParsedClue(
      [weatherArticle],
      'weather patterns article I saved',
      { nowMs: NOW_MS }
    )
    expect(savedWeather.outcome).not.toBe('no_match')
    expect(savedWeather.topPick?.item.id ?? savedWeather.alsoPossible[0]?.item.id).toBe(
      weatherArticle.id
    )
  })

  it('非找回：摘要 / 行程 / 写码 → no_match；有记忆锚仍可扫', () => {
    const hiking = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'Notes on weekend hiking trails',
        url: 'https://www.example.com/probe/hiking'
      }
    })
    const promises = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'Using promises - JavaScript | MDN',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises'
      }
    })
    const newsClip = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'Latest news roundup I clipped',
        url: 'https://www.example.com/probe/news-roundup'
      }
    })
    expect(
      recallByKeywordWithParsedClue(
        [hiking, promises, newsClip],
        'summarize the latest news for me',
        {
          nowMs: NOW_MS
        }
      ).outcome
    ).toBe('no_match')
    expect(
      recallByKeywordWithParsedClue([hiking, promises], 'plan a weekend trip to seattle for me', {
        nowMs: NOW_MS
      }).outcome
    ).toBe('no_match')
    expect(
      recallByKeywordWithParsedClue(
        [hiking, promises],
        'write a python script that renames my files',
        { nowMs: NOW_MS }
      ).outcome
    ).toBe('no_match')
    const savedNews = recallByKeywordWithParsedClue([newsClip], 'latest news roundup I saved', {
      nowMs: NOW_MS
    })
    expect(savedNews.outcome).not.toBe('no_match')
    expect(savedNews.topPick?.item.id ?? savedNews.alsoPossible[0]?.item.id).toBe(newsClip.id)
  })
})
