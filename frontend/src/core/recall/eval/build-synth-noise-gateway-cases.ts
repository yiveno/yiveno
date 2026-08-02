import type { NoiseGatewayCase } from '@/core/recall/eval/noise-gateway-cases'

/** 合成集选项（固定 seed → CI 可复现）。 */
export interface SynthNoiseGatewayOptions {
  /** PRNG 种子 */
  seed?: number
  /** 每个 rejectReason 生成条数（empty/pure_symbol 较少） */
  countPerFamily?: number
}

/** 简单可复现 PRNG（mulberry32）。 */
function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!
}

const QWERTY = 'qwertyuiopasdfghjklzxcvbnm' as const
const SYMBOLS = '!@#$%^&*()[]{};:,.<>?/\\|~`' as const

/** 相邻键游走：高键盘邻接字母糊。 */
function walkKeyboard(rng: () => number, length: number): string {
  const neighbors: Record<string, string> = {
    q: 'wa',
    w: 'qeas',
    e: 'wrds',
    r: 'etdf',
    t: 'ryfg',
    y: 'tugh',
    u: 'yihj',
    i: 'uojk',
    o: 'ipkl',
    p: 'ol',
    a: 'qwsz',
    s: 'awedxz',
    d: 'serfcx',
    f: 'drtgvc',
    g: 'ftyhbv',
    h: 'gyujnb',
    j: 'huiknm',
    k: 'jiolm',
    l: 'kop',
    z: 'asx',
    x: 'zsdc',
    c: 'xdfv',
    v: 'cfgb',
    b: 'vghn',
    n: 'bhjm',
    m: 'njk'
  }
  let ch = pick(rng, QWERTY.split(''))
  let out = ch
  for (let i = 1; i < length; i += 1) {
    const opts = neighbors[ch] ?? QWERTY
    ch = pick(rng, opts.split(''))
    out += ch
  }
  return out
}

/**
 * 按机制合成硬噪音用例（默认 must）。
 * 不生成 proceed；防误伤靠人手金标 + parse-gold。
 */
export function buildSynthNoiseGatewayCases(
  options: SynthNoiseGatewayOptions = {}
): NoiseGatewayCase[] {
  const seed = options.seed ?? 20260731
  const countPerFamily = options.countPerFamily ?? 24
  const rng = createRng(seed)
  const cases: NoiseGatewayCase[] = []

  // empty：少量变体即可
  const empties = ['', ' ', '  ', '\t', '\n', ' \t ']
  empties.forEach((clue, index) => {
    cases.push({
      id: `synth-empty-${index}`,
      clue,
      gate: 'must',
      expect: { disposition: 'reject_noise', rejectReason: 'empty' },
      note: '合成：空白/空串'
    })
  })

  // pure_symbol
  for (let i = 0; i < Math.min(countPerFamily, 16); i += 1) {
    const len = 2 + Math.floor(rng() * 6)
    let clue = ''
    for (let j = 0; j < len; j += 1) {
      clue += pick(rng, SYMBOLS.split(''))
    }
    cases.push({
      id: `synth-symbol-${i}`,
      clue,
      gate: 'must',
      expect: { disposition: 'reject_noise', rejectReason: 'pure_symbol' },
      note: '合成：纯符号'
    })
  }

  // digit_mash：重复单元 / 低多样性
  const digitUnits = ['12', '123', '111', '000', '99', '42']
  for (let i = 0; i < countPerFamily; i += 1) {
    const unit = pick(rng, digitUnits)
    const repeats = 3 + Math.floor(rng() * 4)
    const clue = unit.repeat(repeats)
    cases.push({
      id: `synth-digit-${i}`,
      clue,
      gate: 'must',
      expect: { disposition: 'reject_noise', rejectReason: 'digit_mash' },
      note: '合成：数字重复单元'
    })
  }

  // keyboard_mash：重复音节 + 邻接游走
  const mashUnits = ['asd', 'asdasd', 'qwe', 'zxc', 'jk', 'df']
  for (let i = 0; i < countPerFamily; i += 1) {
    let clue: string
    if (rng() < 0.45) {
      const unit = pick(rng, mashUnits)
      const repeats = 2 + Math.floor(rng() * 4)
      clue = unit.repeat(repeats)
      // 保证足够长，避免短串被网关放行
      if (clue.length < 6) {
        clue = clue.repeat(2)
      }
    } else {
      const len = 12 + Math.floor(rng() * 20)
      clue = walkKeyboard(rng, len)
    }
    cases.push({
      id: `synth-kbd-${i}`,
      clue,
      gate: 'must',
      expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
      note: '合成：键盘砸键 / 字母糊'
    })
  }

  return cases
}
