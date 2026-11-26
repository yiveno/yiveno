/**
 * 合成 Clue 解析评分（纯函数 · 不调 LLM）。
 *
 * 口径（Stage 1 已定）：
 * - 核心：intent、topic（topic 语义分由外部 judge 注入）
 * - C 类只看 intent
 * - type：实际 null/空 或 ⊆ expected 候选集 → 过
 * - certainty：只记录不扣分
 * - 20 条 certainty 全 low 是已知常态，不当事故
 */

import type { RecallRelativeTimeLabel } from '@/core/recall/parse-recall-clue-lexicon'
import type { RecallClueIntent, RecallObjectType } from '@/core/recall/parse-recall-clue-types'
import type {
  ClueChainCaseScore,
  ClueChainExpected,
  ClueChainFieldScore,
  ClueChainParseRunCase,
  ClueChainTopicJudgeResult
} from '@/core/recall/eval/clue-chain/types'

const ALL_PAST_TIME_LABELS: readonly RecallRelativeTimeLabel[] = [
  'yesterday',
  'day_before_yesterday',
  'last_week',
  'recent',
  'a_while_ago',
  'last_month',
  'few_months_ago',
  'long_ago'
]

/**
 * 测试集中文时间短语 → 可接受的产品 timeLabel 候选（仅 harness）。
 * 「之前/以前」= 任意过去窗（不含 today）。
 */
const TIME_PHRASE_CANDIDATES: Record<string, readonly RecallRelativeTimeLabel[] | 'any_past'> = {
  之前: 'any_past',
  以前: 'any_past',
  前段时间: ['a_while_ago', 'few_months_ago', 'recent'],
  前几天: ['recent'],
  最近: ['recent'],
  去年: ['long_ago', 'few_months_ago'],
  前年: ['long_ago'],
  上个月: ['last_month'],
  更早: ['few_months_ago', 'long_ago', 'a_while_ago'],
  现在: ['today', 'recent'],
  今天: ['today'],
  明天: ['today', 'recent'],
  上次: ['recent', 'a_while_ago', 'last_week', 'last_month'],
  其他时间: 'any_past'
}

/**
 * 中文 type 碎片 → 产品 objectType 候选（仅 harness）。
 * 无闭集对应的碎片映射为空数组 → 仅允许实际 null。
 */
const TYPE_TOKEN_MAP: Record<string, readonly RecallObjectType[]> = {
  视频: ['video'],
  文章: ['article'],
  歌曲: ['song'],
  电影: ['video'],
  纪录片: ['video'],
  教程: ['article'],
  新闻: ['article'],
  帖子: ['article'],
  书籍: ['article'],
  网站: ['page'],
  工具: ['page', 'code'],
  商品: [],
  地点: ['page'],
  功能: [],
  测评: ['article'],
  评测: ['article'],
  科普: ['article'],
  生活科普: ['article'],
  商品对比: [],
  内容: [],
  具体形式不明: []
}

function splitAlternatives(raw: string): string[] {
  return raw
    .split(/或|、|,|，|\//)
    .map(part => part.trim())
    .filter(part => part.length > 0)
}

/** 展开 expected.time 为可接受 timeLabel 集合；null expected → 要求无时间。 */
export function expandExpectedTimeCandidates(
  expectedTime: string | null
): { kind: 'none' } | { kind: 'any_past' } | { kind: 'set'; labels: Set<RecallRelativeTimeLabel> } {
  if (expectedTime == null || expectedTime.trim() === '') {
    return { kind: 'none' }
  }
  const parts = splitAlternatives(expectedTime)
  const labels = new Set<RecallRelativeTimeLabel>()
  let anyPast = false
  for (const part of parts) {
    const mapped = TIME_PHRASE_CANDIDATES[part]
    if (mapped === 'any_past') {
      anyPast = true
      continue
    }
    if (mapped) {
      for (const label of mapped) {
        labels.add(label)
      }
      continue
    }
    // 未登记短语：保守当作 any_past（避免 harness 因词表不全误杀）
    anyPast = true
  }
  if (anyPast) {
    return { kind: 'any_past' }
  }
  return { kind: 'set', labels }
}

/** 展开 expected.type 为 objectType 候选集（可空 = 只允 null）。 */
export function expandExpectedTypeCandidates(expectedType: string | null): Set<RecallObjectType> {
  const out = new Set<RecallObjectType>()
  if (expectedType == null || expectedType.trim() === '') {
    return out
  }
  for (const part of splitAlternatives(expectedType)) {
    const direct = TYPE_TOKEN_MAP[part]
    if (direct) {
      for (const value of direct) {
        out.add(value)
      }
      continue
    }
    // 尝试子串命中已知 token（如「商品对比或测评」已拆；残留长串再扫）
    for (const [token, values] of Object.entries(TYPE_TOKEN_MAP)) {
      if (part.includes(token)) {
        for (const value of values) {
          out.add(value)
        }
      }
    }
  }
  return out
}

/** intent：recall ↔ recall；non_recall ↔ 非 recall。 */
export function scoreIntent(
  expected: ClueChainExpected['intent'],
  actual: RecallClueIntent | null | undefined
): ClueChainFieldScore {
  const resolved: RecallClueIntent = actual ?? 'recall'
  const isRecall = resolved === 'recall'
  const passed = expected === 'recall' ? isRecall : !isRecall
  return {
    field: 'intent',
    scored: true,
    passed,
    detail: `期望 ${expected}，实际 ${resolved}`
  }
}

/** time：确定性候选集比对。 */
export function scoreTime(
  expectedTime: string | null,
  actualLabel: string | null | undefined
): ClueChainFieldScore {
  const expanded = expandExpectedTimeCandidates(expectedTime)
  const actual = actualLabel ?? null
  if (expanded.kind === 'none') {
    const passed = actual == null
    return {
      field: 'time',
      scored: true,
      passed,
      detail: passed ? '期望无时间，实际无' : `期望无时间，实际 ${actual}`
    }
  }
  if (actual == null) {
    return {
      field: 'time',
      scored: true,
      passed: false,
      detail: `期望 ${expectedTime}，实际无 timeLabel`
    }
  }
  if (expanded.kind === 'any_past') {
    const passed = (ALL_PAST_TIME_LABELS as readonly string[]).includes(actual)
    return {
      field: 'time',
      scored: true,
      passed,
      detail: passed
        ? `期望模糊过去「${expectedTime}」，实际 ${actual}`
        : `期望模糊过去「${expectedTime}」，实际 ${actual}（非过去窗）`
    }
  }
  const passed = expanded.labels.has(actual as RecallRelativeTimeLabel)
  return {
    field: 'time',
    scored: true,
    passed,
    detail: `期望 ${expectedTime} → [${[...expanded.labels].join(',')}]，实际 ${actual}`
  }
}

/**
 * type 宽松：实际无类型 → 过；有类型则每个实际类型须落在候选集。
 * 候选集为空（如纯「商品」）→ 仅无类型算过。
 */
export function scoreType(
  expectedType: string | null,
  actualTypes: readonly RecallObjectType[] | null | undefined
): ClueChainFieldScore {
  const actual = actualTypes ?? []
  if (actual.length === 0) {
    return {
      field: 'type',
      scored: true,
      passed: true,
      detail: `期望 ${expectedType ?? 'null'}，实际 null（宽松通过）`
    }
  }
  const candidates = expandExpectedTypeCandidates(expectedType)
  if (candidates.size === 0) {
    return {
      field: 'type',
      scored: true,
      passed: false,
      detail: `期望 ${expectedType ?? 'null'}（无闭集候选），实际 [${actual.join(',')}]`
    }
  }
  const leaked = actual.filter(value => !candidates.has(value))
  const passed = leaked.length === 0
  return {
    field: 'type',
    scored: true,
    passed,
    detail: passed
      ? `期望 ${expectedType} → [${[...candidates].join(',')}]，实际 [${actual.join(',')}]`
      : `期望候选 [${[...candidates].join(',')}]，实际越界 [${leaked.join(',')}]`
  }
}

/**
 * 实体别名组（仅 harness · 解析 terms 侧互认）。
 * 同组不同语言/形式互认；别名可为多 token；绝不回退到原 clue。
 */
const ENTITY_ALIAS_GROUPS: readonly (readonly string[])[] = [
  ['apple', '苹果'],
  ['微信公众号', '公众号', 'gongzhonghao'],
  ['小红书', 'xiaohongshu'],
  ['菜籽油', 'rapeseed'],
  ['抖音', 'douyin'],
  ['福建', 'fujian'],
  ['浙江', 'zhejiang'],
  ['敦煌', 'dunhuang'],
  ['日本', 'japan'],
  ['新疆', 'xinjiang'],
  ['内蒙古', 'inner mongolia'],
  ['淘宝', 'taobao'],
  ['华为', 'huawei'],
  ['秦始皇', 'qin shihuang'],
  ['汉武帝', 'han wudi']
]

/** 按空白 / 标点拆成小写 token（保留字母数字与 CJK）。 */
export function tokenizeEntitySurface(raw: string): string[] {
  return raw
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map(part => part.trim())
    .filter(part => part.length > 0)
}

/** 大小写 / 空白 / 标点归一（保留字母数字与 CJK；整串压扁）。 */
export function normalizeEntityToken(raw: string): string {
  return tokenizeEntitySurface(raw).join('')
}

/** 期望实体 → 可接受表面形式（含自身与同组别名；可多 token）。 */
export function expandEntityAliasForms(entity: string): string[] {
  const normalized = normalizeEntityToken(entity)
  if (!normalized) {
    return []
  }
  const forms = new Set<string>([entity])
  for (const group of ENTITY_ALIAS_GROUPS) {
    const normalizedGroup = group.map(normalizeEntityToken).filter(Boolean)
    if (normalizedGroup.includes(normalized)) {
      for (const alias of group) {
        if (alias.trim().length > 0) {
          forms.add(alias)
        }
      }
    }
  }
  return [...forms]
}

/** 期望实体 → 归一后可接受的别名集合（含自身；整串 needle，供子串补充）。 */
export function expandEntityAliasNeedles(entity: string): string[] {
  return expandEntityAliasForms(entity).map(normalizeEntityToken).filter(Boolean)
}

/**
 * 期望实体是否出现在解析 token 集 / 整串 haystack 中。
 * 先 token-set（实体全部 token 均在集合），再整串归一子串；别名同规。
 */
export function entityPresentInParsedTerms(
  entity: string,
  tokenSet: ReadonlySet<string>,
  haystackJoined: string
): boolean {
  for (const form of expandEntityAliasForms(entity)) {
    const tokens = tokenizeEntitySurface(form)
    if (tokens.length > 0 && tokens.every(token => tokenSet.has(token))) {
      return true
    }
    const needle = normalizeEntityToken(form)
    if (needle && haystackJoined.includes(needle)) {
      return true
    }
  }
  return false
}

/**
 * entities：期望实体须出现在**解析出的** contentTerms / topic / exclude / objectTypeOther 中。
 * token-set + 别名 + 整串子串补充；禁止用原 clue 文本兜底。
 */
export function scoreEntities(
  expectedEntities: readonly string[],
  haystackParts: readonly (string | null | undefined)[]
): ClueChainFieldScore {
  if (expectedEntities.length === 0) {
    return {
      field: 'entities',
      scored: true,
      passed: true,
      detail: '期望无实体'
    }
  }
  const parts = haystackParts.filter(
    (part): part is string => typeof part === 'string' && part.length > 0
  )
  const tokenSet = new Set<string>()
  for (const part of parts) {
    for (const token of tokenizeEntitySurface(part)) {
      tokenSet.add(token)
    }
  }
  const haystackJoined = parts
    .map(normalizeEntityToken)
    .filter(part => part.length > 0)
    .join('\u0000')
  const missing = expectedEntities.filter(
    entity => !entityPresentInParsedTerms(entity, tokenSet, haystackJoined)
  )
  const passed = missing.length === 0
  return {
    field: 'entities',
    scored: true,
    passed,
    detail: passed
      ? `实体齐全 [${expectedEntities.join(', ')}]`
      : `缺少实体 [${missing.join(', ')}]`
  }
}

/** topic：必须注入语义 judge；禁止精确字符串匹配当通过条件。 */
export function scoreTopicFromJudge(
  judge: ClueChainTopicJudgeResult | null,
  category: string
): ClueChainFieldScore {
  if (category === 'C') {
    return { field: 'topic', scored: false, reason: 'C 类不计 topic' }
  }
  if (!judge) {
    return {
      field: 'topic',
      scored: true,
      passed: false,
      detail: '缺少 topic judge 结果'
    }
  }
  return {
    field: 'topic',
    scored: true,
    passed: judge.match,
    detail: judge.reason
  }
}

function fieldPassed(field: ClueChainFieldScore): boolean | null {
  if (!field.scored) {
    return null
  }
  return field.passed
}

/**
 * 对单条 runner 输出 + topic judge 评分。
 * C：只看 intent；其余：intent + topic 为核心通过条件（time/type/entities 记入字段但不挡 core）。
 *
 * 说明：提示词把 intent/topic 定为核心项；time/type/entities 确定性比对用于聚类与报告，
 * corePassed 以 intent+topic（C 仅 intent）为准，与过关门禁一致。
 */
export function scoreClueChainCase(
  run: ClueChainParseRunCase,
  topicJudge: ClueChainTopicJudgeResult | null
): ClueChainCaseScore {
  const fields: ClueChainFieldScore[] = []

  if (run.skipped || run.timedOut || run.error || !run.parsed) {
    const intentFail: ClueChainFieldScore = {
      field: 'intent',
      scored: true,
      passed: false,
      detail: run.error ?? (run.timedOut ? '超时' : run.skipped ? '跳过' : '无 parsed')
    }
    fields.push(intentFail)
    if (run.category !== 'C') {
      fields.push({
        field: 'topic',
        scored: true,
        passed: false,
        detail: '解析失败，topic 未评'
      })
    } else {
      fields.push({ field: 'topic', scored: false, reason: 'C 类不计 topic' })
    }
    fields.push(
      { field: 'time', scored: false, reason: '解析失败未评' },
      { field: 'type', scored: false, reason: '解析失败未评' },
      { field: 'entities', scored: false, reason: '解析失败未评' }
    )
    return {
      id: run.id,
      category: run.category,
      note: run.note,
      corePassed: false,
      fields,
      certaintyRecord: {
        expected: run.expected.certainty,
        actual: run.confidenceActual
      }
    }
  }

  fields.push(scoreIntent(run.expected.intent, run.intentActual))
  fields.push(scoreTopicFromJudge(topicJudge, run.category))

  if (run.category === 'C') {
    fields.push(
      { field: 'time', scored: false, reason: 'C 类不计' },
      { field: 'type', scored: false, reason: 'C 类不计' },
      { field: 'entities', scored: false, reason: 'C 类不计' }
    )
  } else {
    fields.push(scoreTime(run.expected.time, run.timeLabelActual))
    fields.push(scoreType(run.expected.type, run.objectTypesActual))
    // 只查解析 terms；禁止把原 clue 拼进 haystack（否则实体虚高）
    fields.push(
      scoreEntities(run.expected.entities, [
        ...run.contentTermsActual,
        ...run.topicTermsActual,
        ...run.excludeContentTermsActual,
        run.objectTypeOtherActual
      ])
    )
  }

  const intentOk = fieldPassed(fields.find(f => f.field === 'intent')!) === true
  const topicField = fields.find(f => f.field === 'topic')!
  const topicOk = run.category === 'C' ? true : fieldPassed(topicField) === true
  const corePassed = intentOk && topicOk

  return {
    id: run.id,
    category: run.category,
    note: run.note,
    corePassed,
    fields,
    certaintyRecord: {
      expected: run.expected.certainty,
      actual: run.confidenceActual
    }
  }
}
