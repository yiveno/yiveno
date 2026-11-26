/**
 * 线索处理网关（Gate A）：值不值得继续花资源。
 * 只拦硬噪音；灰区一律放行。不调 LLM，与 lexical/semantic 门禁（Gate B）职责拆开。
 */

/**
 * 网关结论。
 * - reject_noise：硬噪音，不继续理解 / 扫库
 * - proceed：放行，交给门禁（lexical / semantic）
 */
export type ClueProcessingDisposition =
  | 'reject_noise' // 拒绝：判定为噪音
  | 'proceed' // 放行：继续处理

/**
 * 拒绝原因（供流水线 log；proceed 时为 null）。
 * - empty：trim 后为空 / 纯空白
 * - pure_symbol：无字母也无数字（如 `!!!`）
 * - digit_mash：数字糊（如 `123123`，低多样性或重复单元）
 * - keyboard_mash：砸键盘 / 无空白字母糊（如 `asdasd`）
 */
export type ClueProcessingRejectReason =
  | 'empty' // 空线索
  | 'pure_symbol' // 纯符号
  | 'digit_mash' // 数字糊
  | 'keyboard_mash' // 键盘砸键 / 字母糊

export interface ClueProcessingDecision {
  /** 网关结论：reject_noise | proceed */
  disposition: ClueProcessingDisposition
  /** reject 时非 null；proceed 时为 null */
  rejectReason: ClueProcessingRejectReason | null
}

function isUrlLike(raw: string): boolean {
  const trimmed = raw.trim()
  if (/^(https?:\/\/|www\.)/i.test(trimmed)) {
    return true
  }
  return /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed)
}

/** 明显口语信号：有则优先放行，避免误伤长句里夹杂怪词。 */
const NATURAL_LANGUAGE_SIGNAL =
  /\b(i|i'm|i've|i'd|could you|can you|please|forgot|forgotten|remember|looking for|came across|the one|that i|help me|about a|recently)\b/i

const QWERTY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const

const KEY_POS = (() => {
  const map = new Map<string, { row: number; col: number }>()
  QWERTY_ROWS.forEach((row, rowIndex) => {
    for (let col = 0; col < row.length; col += 1) {
      map.set(row[col]!, { row: rowIndex, col })
    }
  })
  return map
})()

/** CJK 字母（汉 / 平假名 / 片假名）：这些文字天生不用空格分词。 */
const CJK_LETTERS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u

function lettersOnly(raw: string): string {
  return raw.replace(/[^\p{L}]/gu, '')
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '')
}

/** 只保留拉丁字母（键盘邻接启发式的样本面）。 */
function latinLettersOnly(raw: string): string {
  return raw.replace(/[^a-zA-Z]/g, '').toLowerCase()
}

/**
 * 拉丁键盘启发式是否可启用。
 * 样本太少、或含 CJK 且拉丁不占主导 → fail-open（避免中文长句夹 BBC/CNN 被邻接比误杀）。
 */
function shouldApplyLatinKeyboardHeuristics(allLetters: string): boolean {
  const latin = latinLettersOnly(allLetters)
  if (latin.length < 6) {
    return false
  }
  if (CJK_LETTERS.test(allLetters) && latin.length / allLetters.length < 0.5) {
    return false
  }
  return true
}

/** 相邻字母在 QWERTY 上曼哈顿距离 ≤1 的比例（仅统计双方都是字母键的对）。 */
function keyboardAdjacentRatio(letters: string): number {
  const lower = letters.toLowerCase()
  let adjacent = 0
  let counted = 0
  for (let i = 0; i < lower.length - 1; i += 1) {
    const a = KEY_POS.get(lower[i]!)
    const b = KEY_POS.get(lower[i + 1]!)
    if (!a || !b) {
      continue
    }
    counted += 1
    if (Math.abs(a.row - b.row) + Math.abs(a.col - b.col) <= 1) {
      adjacent += 1
    }
  }
  return counted === 0 ? 0 : adjacent / counted
}

/** 整段由短单元重复构成（如 asdasd / ababab）。 */
function hasRepeatedUnit(token: string): boolean {
  if (token.length < 6) {
    return false
  }
  const maxUnit = Math.floor(token.length / 2)
  for (let unitLen = 2; unitLen <= maxUnit; unitLen += 1) {
    if (token.length % unitLen !== 0) {
      continue
    }
    const unit = token.slice(0, unitLen)
    if (unit.repeat(token.length / unitLen) === token) {
      return true
    }
  }
  return false
}

/** 字符多样性低（unique 比 ≤ 0.5）。 */
function hasLowDiversity(token: string): boolean {
  if (token.length < 6) {
    return false
  }
  return new Set(token).size / token.length <= 0.5
}

/** 低字符多样性或整段重复单元（如 asdasd / 123123）。 */
function isRepetitiveMash(token: string): boolean {
  return hasRepeatedUnit(token) || hasLowDiversity(token)
}

function isDigitMash(raw: string): boolean {
  if (!/^[\d\s\-_.]+$/.test(raw)) {
    return false
  }
  const digits = digitsOnly(raw)
  if (digits.length < 6) {
    return false
  }
  return isRepetitiveMash(digits) || /(.)\1{3,}/.test(digits)
}

/**
 * 键盘砸键 / 无空白字母糊。
 * 保守：宁可漏拦，不误伤 poem / 专名 / URL / 口语。
 */
function isKeyboardMash(raw: string): boolean {
  if (isUrlLike(raw)) {
    return false
  }
  if (NATURAL_LANGUAGE_SIGNAL.test(raw) || raw.includes('?')) {
    return false
  }
  const letters = lettersOnly(raw).toLowerCase()
  if (letters.length < 6) {
    return false
  }

  const hasWhitespace = /\s/.test(raw)
  const tokens = raw
    .split(/[\s;|,/\\_+.-]+/)
    .map(part => part.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase())
    .filter(Boolean)

  // 多词且存在「像正常英文词」的 token → 放行
  const normalLooking = tokens.filter(token => {
    if (token.length < 2 || token.length > 32) {
      return false
    }
    if (!/^[a-z]+$/i.test(token)) {
      return false
    }
    if (isRepetitiveMash(token)) {
      return false
    }
    if (!/[aeiouy]/i.test(token)) {
      return false
    }
    // 过长辅音簇不像正常词
    if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(token)) {
      return false
    }
    return keyboardAdjacentRatio(token) < 0.55
  })

  if (hasWhitespace && normalLooking.length >= 1 && tokens.length >= 2) {
    return false
  }

  // 多词全糊才走本分支；单 token 由下方收紧分支判定（否则 sweetest/banana 低多样性会被误拦）
  if (
    tokens.length >= 2 &&
    tokens.every(token => /^[a-z]+$/i.test(token) && isRepetitiveMash(token))
  ) {
    return true
  }

  // 多段乱输：去空白后整串仍符合单串判定（P0 噪声防御）。
  // - 重复分支加 5+ 辅音簇条件：纯靠低多样性会误伤真短语（sweet street / deer street / free street 去空白后 unique 比 ≤ 0.5）。
  // - 邻接分支阈值 0.7、下限 12 字母：能走到本分支的真短语邻接比实测最高 0.4（sweet dreams），邻接分支拦住的乱输最低 0.73（asdf zxcv qwer）。注意邻接是曼哈顿距离（对角不算），不要按切比雪夫重算。
  // - 拉丁启发式须样本充足且拉丁占主导：中文长句夹 BBC/CNN 时 lettersOnly 把 CJK+拉丁拼在一起，邻接比只看拉丁对会虚高。
  // - 短多词砸键（asdf zxcv）：每段 ≥4 且段内邻接高、无正常词 → 拦；不要求拼接后 ≥12。
  const latin = latinLettersOnly(letters)
  const latinHeuristicsOk = shouldApplyLatinKeyboardHeuristics(letters)
  if (hasWhitespace) {
    if (
      latinHeuristicsOk &&
      tokens.length >= 2 &&
      normalLooking.length === 0 &&
      tokens.every(
        token => /^[a-z]+$/i.test(token) && token.length >= 4 && keyboardAdjacentRatio(token) >= 0.7
      )
    ) {
      return true
    }
    if (
      latinHeuristicsOk &&
      latin.length >= 10 &&
      isRepetitiveMash(latin) &&
      /[bcdfghjklmnpqrstvwxz]{5,}/i.test(latin)
    ) {
      return true
    }
    if (latinHeuristicsOk && latin.length >= 12 && keyboardAdjacentRatio(latin) >= 0.7) {
      return true
    }
  }

  if (!hasWhitespace) {
    // 超长无空白字母串：硬噪音——但只对拉丁串生效。
    // 中文/日文天生不用空格，任何 ≥28 字的中文线索都会撞上这条（R10 压测 p07，
    // 探针 8 已证实）；含 CJK 字母即豁免本分支，宁可漏拦、不误伤（Gate A 保守原则）。
    // 韩文用空格分词，不豁免；混合串含任一 CJK 即豁免（fail-open 安全方向）。
    if (letters.length >= 28 && !CJK_LETTERS.test(letters)) {
      return true
    }
    // 中长无空白 + 高键盘邻接：只在拉丁样本充足且占主导时启用
    if (latinHeuristicsOk && latin.length >= 12 && keyboardAdjacentRatio(latin) >= 0.45) {
      return true
    }
    // 无空白长串重复：须拉丁占主导；纯中文叠字 / 中文+短缩写放行
    if (latinHeuristicsOk && latin.length >= 10 && isRepetitiveMash(latin)) {
      return true
    }
    // 短串但整段重复（asdasd）：须含拉丁；低多样性须同时高邻接（sweetest/banana 是真词）
    if (
      tokens.length === 1 &&
      /[a-z]/i.test(tokens[0]!) &&
      (hasRepeatedUnit(tokens[0]!) ||
        (hasLowDiversity(tokens[0]!) && keyboardAdjacentRatio(tokens[0]!) >= 0.45))
    ) {
      return true
    }
    // 分号等切开后每段都不像正常词，且整体邻接偏高
    if (
      latinHeuristicsOk &&
      tokens.length >= 3 &&
      latin.length >= 16 &&
      normalLooking.length === 0 &&
      keyboardAdjacentRatio(latin) >= 0.35
    ) {
      return true
    }
  }

  return false
}

/**
 * 决定是否继续理解 / 扫库。
 * - reject_noise：空、纯符号、数字糊、键盘砸键
 * - proceed：其余（含真短词、URL、口语）
 */
export function selectClueProcessingDisposition(clue: string): ClueProcessingDecision {
  const raw = clue.trim()
  if (!raw) {
    return { disposition: 'reject_noise', rejectReason: 'empty' }
  }

  if (!/[\p{L}\p{N}]/u.test(raw)) {
    return { disposition: 'reject_noise', rejectReason: 'pure_symbol' }
  }

  if (isDigitMash(raw)) {
    return { disposition: 'reject_noise', rejectReason: 'digit_mash' }
  }

  if (isKeyboardMash(raw)) {
    return { disposition: 'reject_noise', rejectReason: 'keyboard_mash' }
  }

  return { disposition: 'proceed', rejectReason: null }
}
