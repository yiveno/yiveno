/**
 * Indexed Fuzzy：预计算 abbreviation → canonical form 映射字典。
 *
 * 设计原则（ADR-005 边界）：
 * - 仅闭合技术缩写集（js→javascript；fe→frontend；ai→artificial intelligence 等）——通用技术词汇，非内容别名。
 * - 仅常见技术词形变化（javascripts→javascript；apis→api 等）——不依赖用户个人词表。
 * - 禁止：拼写纠错表（recat→react 属于技术词拼写，可保留；accomodate→accommodate 等日常拼写错误不属 Yiveno 域）。
 *
 * 实现方式（SymSpell 思想，静态字典）：
 * - 预计算，非运行时 Levenshtein → T0 成本。
 * - 查询时 O(1) 字典查表 → 多路召回取并集。
 * - 不对全库做字符串距离计算。
 *
 * 集成点：Omnibox → `getFuzzyVariants` → `filterKeywordMatchesBeforeCollapse({ fuzzyExpandTokens })`。
 */

import { normalizeRecallText } from '@/core/recall/keyword-filter'

/**
 * 单条 Fuzzy 映射：key = 变体，value = 规范形式列表（支持多对一）。
 * 值列表按优先级排序（第一个为主推荐）。
 */
type FuzzyMapping = readonly [variant: string, canonical: string]

/**
 * Fuzzy 词表（按 key 首字母分组）。
 *
 * 覆盖范围：
 * - 技术缩写 / 简写（T0 常见）
 * - 技术词形变化归一（单复数等，T0）
 */
const FUZZY_ENTRIES: readonly FuzzyMapping[] = [
  // ===== 技术缩写（T0 · 行业通用，不涉及 Yiveno 内容别名）=====
  ['js', 'javascript'],
  ['ts', 'typescript'],
  ['py', 'python'],
  ['rb', 'ruby'],
  ['rs', 'rust'],
  ['go', 'golang'],
  ['fe', 'frontend'],
  ['be', 'backend'],
  ['fs', 'fullstack'],
  ['db', 'database'],
  ['sql', 'sql'],
  ['nosql', 'nosql'],
  ['api', 'api'],
  ['rest', 'rest'],
  ['graphql', 'graphql'],
  ['http', 'http'],
  ['tcp', 'tcp'],
  ['udp', 'udp'],
  ['dns', 'dns'],
  ['css', 'css'],
  ['html', 'html'],
  ['dom', 'dom'],
  ['json', 'json'],
  ['xml', 'xml'],
  ['yaml', 'yaml'],
  ['toml', 'toml'],
  ['md', 'markdown'],
  ['cli', 'cli'],
  ['gui', 'gui'],
  ['sdk', 'sdk'],
  ['ide', 'ide'],
  ['lsp', 'lsp'],
  ['ai', 'artificial intelligence'],
  ['ml', 'machine learning'],
  ['llm', 'llm'],
  ['rag', 'rag'],
  ['nlp', 'nlp'],
  ['cv', 'computer vision'],
  ['ui', 'ui'],
  ['ux', 'ux'],
  ['seo', 'seo'],
  ['pwa', 'pwa'],
  ['ssr', 'ssr'],
  ['csr', 'csr'],
  ['ssg', 'ssg'],
  ['cdn', 'cdn'],
  ['dns', 'dns'],
  ['tls', 'tls'],
  ['ssl', 'ssl'],
  ['oauth', 'oauth'],
  ['jwt', 'jwt'],
  ['sso', 'sso'],
  ['crud', 'crud'],
  ['orm', 'orm'],
  ['tdd', 'tdd'],
  ['bdd', 'bdd'],
  ['ci', 'ci'],
  ['cd', 'cd'],
  ['devops', 'devops'],
  ['git', 'git'],
  ['npm', 'npm'],
  ['pnpm', 'pnpm'],
  ['yarn', 'yarn'],
  ['k8s', 'kubernetes'],
  ['kube', 'kubernetes'],
  ['docker', 'docker'],
  ['aws', 'aws'],
  ['gcp', 'gcp'],
  ['azure', 'azure'],
  ['cf', 'cloudflare'],
  ['kv', 'kv'],
  ['d1', 'd1'],
  ['r2', 'r2'],
  ['wasm', 'wasm'],
  ['webassembly', 'webassembly'],
  ['sw', 'service worker'],
  ['sw', 'software'],
  ['cw', 'chrome extension'],
  ['ext', 'extension'],
  ['mv3', 'manifest v3'],
  ['mv2', 'manifest v2'],
  ['posix', 'posix'],
  ['cli', 'cli'],
  ['tui', 'tui'],
  ['regex', 'regex'],
  ['regexp', 'regex'],
  ['env', 'environment'],
  ['cfg', 'config'],
  ['conf', 'config'],
  ['argv', 'argv'],
  ['stdin', 'stdin'],
  ['stdout', 'stdout'],
  ['stderr', 'stderr'],
  ['pid', 'pid'],
  ['uid', 'uid'],
  ['gid', 'gid'],
  ['mac', 'mac'],
  ['ipv4', 'ipv4'],
  ['ipv6', 'ipv6'],
  ['url', 'url'],
  ['uri', 'uri'],
  ['urn', 'urn'],
  ['ascii', 'ascii'],
  ['unicode', 'unicode'],
  ['utf', 'utf'],
  ['utf8', 'utf8'],
  ['utf16', 'utf16'],
  ['i18n', 'i18n'],
  ['l10n', 'l10n'],
  ['a11y', 'a11y'],
  ['g11y', 'g11y'],

  // ===== 技术词形变化归一（单复数等）=====
  ['javascripts', 'javascript'],
  ['pythons', 'python'],
  ['rubys', 'ruby'],
  ['frontends', 'frontend'],
  ['backends', 'backend'],
  ['fullstacks', 'fullstack'],
  ['databases', 'database'],
  ['apis', 'api'],
  ['urls', 'url'],

  // ===== 框架 / 库常见变体（技术文档高频）=====
  ['reactjs', 'react'],
  ['react.js', 'react'],
  ['recat', 'react'],
  ['reaact', 'react'],
  ['reacct', 'react'],
  ['nodejs', 'node'],
  ['node.js', 'node'],

  // ===== Chrome Extension =====
  ['chromex', 'chrome extension'],
  ['extention', 'extension'],
  ['extesion', 'extension'],

  // ===== Web Vitals =====
  ['webvitals', 'web vitals'],
  ['corewebvitals', 'core web vitals'],
  ['cls', 'cls'],
  ['lcp', 'lcp'],
  ['fid', 'fid'],
  ['inp', 'inp'],
  ['ttfb', 'ttfb'],
  ['fp', 'first paint'],
  ['fcp', 'fcp']
]

/**
 * 构建 O(1) 查找表：key = 归一化后的变体，value = 规范形式列表。
 * 加载时构建一次，后续查表 O(1)。
 */
function buildFuzzyMap(entries: readonly FuzzyMapping[]): Map<string, readonly string[]> {
  const map = new Map<string, readonly string[]>()
  for (const [variant, canonical] of entries) {
    const normalized = normalizeRecallText(variant)
    const existing = map.get(normalized)
    if (existing) {
      // 多对一：保留第一个出现的主推荐
      if (!existing.includes(canonical)) {
        map.set(normalized, [existing[0]!, canonical])
      }
    } else {
      map.set(normalized, [canonical])
    }
  }
  return map
}

const FUZZY_MAP = buildFuzzyMap(FUZZY_ENTRIES)

/**
 * 对单个 token 做 fuzzy 展开。
 * @returns 规范形式列表（**原始 token 始终首位**；有映射时再附 canonical）。
 */
function expandToken(token: string): string[] {
  const normalized = normalizeRecallText(token)
  const mapped = FUZZY_MAP.get(normalized)
  if (!mapped || mapped.length === 0) {
    return [normalized]
  }
  const out = [normalized]
  for (const canonical of mapped) {
    const c = normalizeRecallText(canonical)
    if (c && !out.includes(c)) {
      out.push(c)
    }
  }
  return out
}

/**
 * 对完整 query 做 fuzzy 展开。
 *
 * 策略：按 token 独立展开后取笛卡尔积，限制展开总量（防组合爆炸）。
 * - 短 query（1-2 tokens）：全量展开
 * - 长 query（3+ tokens）：仅对每个 token 单独展开（不加笛卡尔积）
 *
 * @param query 用户原始 query
 * @param maxVariants 展开上限（防性能问题）
 * @returns query 变体列表（归一化）
 */
export function fuzzyExpandQuery(query: string, maxVariants = 8): string[] {
  const tokens = query.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) {
    return []
  }

  const expanded: string[][] = tokens.map(token => expandToken(token))

  if (tokens.length <= 2) {
    // 短 query：生成所有变体组合（笛卡尔积）
    const cartesian = cartesianProduct(expanded)
    return cartesian.slice(0, maxVariants).map(variant => variant.join(' '))
  } else {
    // 长 query：每个 token 独立归一，不做组合
    return [
      tokens
        .map(token => {
          const ex = expandToken(token)
          return ex[0]
        })
        .join(' ')
    ]
  }
}

/**
 * 笛卡尔积（用于短 query 的 fuzzy 变体展开）。
 */
function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  return arrays.reduce<T[][]>((acc, curr) => acc.flatMap(x => curr.map(y => [...x, y])), [[]])
}

/**
 * 对单条 query 返回其 fuzzy 展开的归一化 query 列表。
 * 第一项 = 原始 query（不变）；后续 = 展开变体。
 *
 * @param query 用户输入的 clue
 * @param maxExpand 最大展开数（不含原始 query）
 */
export function getFuzzyVariants(query: string, maxExpand = 8): string[] {
  const normalized = normalizeRecallText(query)
  if (!normalized) {
    return []
  }
  // 硬保证：原 clue（归一化）恒为 [0]；hybrid/omnibox 用 slice(1) 作展开
  const seen = new Set<string>([normalized])
  const result: string[] = [normalized]
  for (const v of fuzzyExpandQuery(normalized, maxExpand + 1)) {
    if (seen.has(v)) continue
    seen.add(v)
    result.push(v)
    if (result.length > maxExpand + 1) break
  }
  return result
}
