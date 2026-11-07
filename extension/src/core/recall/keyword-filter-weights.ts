/**
 * 关键词 Filter 字段权重与打分系数（从 keyword-filter 机械抽出）。
 * **禁止**在本波改数值——CURRENT 冻结召回核心调参。
 */

/** 纳入候选的最低分数。 */
export const RECALL_MIN_MATCH_SCORE = 10

/** Top Pick 最低分数。 */
export const RECALL_TOP_PICK_MIN_SCORE = 18

export const FIELD_WEIGHTS: Record<string, number> = {
  title: 24,
  textExcerpt: 18,
  /** 划词前后文：可召回但不得与正文同权，避免「上下文沾边」压过主文直含。 */
  excerptContext: 8,
  /** 摘录出处页名（非摘录自身标题）；须单字段即可达 Top Pick 阈值。 */
  pageTitle: 20,
  summary: 16,
  domain: 14,
  url: 10,
  keywords: 12,
  tags: 12,
  /** 用户自拟附注：寻回意图强信号，权重大于标题。 */
  note: 26
}

/**
 * Omnibox / 短锚点快跳：抬标题·域名·附注·URL，压长正文与前后文。
 * 减轻 `d`/`gi` 类短 token 在正文里的噪声命中（ADR-007 soft rank 同档）。
 */
export const OMNIBOX_FIELD_WEIGHTS: Record<string, number> = {
  ...FIELD_WEIGHTS,
  title: 28,
  note: 30,
  domain: 18,
  url: 14,
  pageTitle: 22,
  textExcerpt: 12,
  excerptContext: 4,
  summary: 12
}

/** 中文/无空格脚本 ngram 命中相对字段权重的系数。 */
export const NGRAM_SCORE_FACTOR = 0.5

/** 模糊命中（编辑距离 ≤1）相对字段权重的系数。 */
export const FUZZY_SCORE_FACTOR = 0.6

/** 仅 bigram 命中时，按命中字段数给的抬升，避免「检查」类有效词过不了 Top Pick。 */
export const NGRAM_FIELD_BONUS = 4

/**
 * 标题/摘录正文出现非 ngram 命中时的额外分。
 * 保证「主文含词」稳定压过「仅上下文沾边」（含行为加权后仍优先）。
 */
export const PRIMARY_CONTENT_HIT_BONUS = 16

/** 主文贴合度加成上限（密度 / 起首 / 近全等，语言无关）。 */
export const PRIMARY_MATCH_QUALITY_CAP = 30

/**
 * 同一 note 字段命中 ≥2 个「内容向」term（长度≥5）时，每多一词的抬升。
 * 让「disagree + section」类多锚点附注压过单共享词（如 newsletter）沾边。
 */
export const NOTE_MULTI_TERM_HIT_BONUS = 16

/** 计入 note 多词覆盖的最小 term 长度（避开 with/from 等短粘着词）。 */
export const NOTE_COVERAGE_TERM_MIN_LEN = 5

/**
 * 全字段内容词覆盖：线索 ≥2 个内容 term 且条目命中 ≥2 时抬升。
 * 防「paper」单泛词 + 强语义压过「dpr+arxiv」多锚（通解，非专名表）。
 */
export const CONTENT_MULTI_TERM_HIT_BONUS = 16

/** 覆盖率加成上限尺度：hitCount/queryCount * 本值。 */
export const CONTENT_COVERAGE_RATIO_SCALE = 30

/** 计入全字段覆盖的最小 term 长度（含 dpr 类 3 字母缩写）。 */
export const CONTENT_COVERAGE_TERM_MIN_LEN = 3

/** 行为信号（打开次数/近因）对关键词分的最大加成，避免压过强词面命中。 */
export const RECALL_BEHAVIOR_BOOST_CAP = 12

/**
 * 大小写贴合软加权上限。
 * 仅微调并列顺序；不得压过主文/域名等词面差。命中门槛仍忽略大小写。
 */
export const RECALL_CASE_FIT_BOOST_CAP = 6

/** 否定反馈（dismiss）对分数的最大扣减。 */
export const RECALL_DISMISS_PENALTY_CAP = 10

/**
 * 形态缩写（CamelCase / 多词首字母）写入倒排与精排命中的长度上限。
 * 过长缩写噪声大，不入库、不参与短词形态命中。
 */
export const RECALL_ORTHOGRAPHIC_ACRONYM_MAX_LEN = 3
