/**
 * Mermaid 图表清单与宿主 MD 解析（供 sync-diagrams / check 共用）
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
export const REGISTRY_PATH = join(root, 'docs/diagrams/registry.json')
export const CACHE_DIR = join(root, 'docs/diagrams/.cache')
export const BRIEF_PATH = join(CACHE_DIR, 'SYNC-BRIEF.md')

export const ALLOWED_KINDS = new Set(['flowchart', 'sequence', 'state', 'mindmap', 'er'])
export const ALLOWED_STATUS = new Set(['implemented', 'designed', 'planned'])

/** kind → 源码首行允许的关键字（去指令后） */
export const KIND_KEYWORDS = {
  flowchart: ['flowchart', 'graph'],
  sequence: ['sequencediagram'],
  state: ['statediagram', 'statediagram-v2'],
  mindmap: ['mindmap'],
  er: ['erdiagram']
}

const ANCHOR_RE =
  /<!--\s*diagram:\s*id=([a-z0-9][a-z0-9._-]*)\s+kind=([a-z0-9-]+)\s+status=([a-z0-9-]+)\s*-->/gi

/**
 * @typedef {{ id: string, kind: string, status: string, title: string, doc: string, codePaths?: string[], docPaths?: string[], notes?: string }} DiagramEntry
 * @typedef {{ version: number, updated?: string, diagrams: DiagramEntry[] }} DiagramRegistry
 */

export function readText(absPath) {
  return readFileSync(absPath, 'utf8')
}

/** @returns {DiagramRegistry} */
export function loadRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    throw new Error(`缺少清单：${rel(REGISTRY_PATH)}`)
  }
  const raw = JSON.parse(readText(REGISTRY_PATH))
  if (!raw || !Array.isArray(raw.diagrams)) {
    throw new Error('registry.json 须含 diagrams 数组')
  }
  return raw
}

export function rel(absPath) {
  return relative(root, absPath).split('\\').join('/')
}

export function absFromRepo(repoPath) {
  return join(root, repoPath)
}

/** 路径存在：文件，或目录非空（至少能 stat） */
export function pathExists(repoPath) {
  const abs = absFromRepo(repoPath)
  return existsSync(abs)
}

/**
 * 提取宿主 MD 中全部 diagram 锚点 + 紧随的 mermaid fence
 * @returns {{ id: string, kind: string, status: string, source: string, line: number }[]}
 */
export function extractAnchoredDiagrams(markdown, fileLabel = '') {
  const results = []
  const lines = markdown.split('\n')
  for (let i = 0; i < lines.length; i++) {
    ANCHOR_RE.lastIndex = 0
    const m = ANCHOR_RE.exec(lines[i])
    if (!m) continue
    const id = m[1]
    const kind = m[2].toLowerCase()
    const status = m[3].toLowerCase()
    // 下一非空行应为 ```mermaid
    let j = i + 1
    while (j < lines.length && lines[j].trim() === '') j++
    if (j >= lines.length || !/^```mermaid\s*$/i.test(lines[j].trim())) {
      results.push({
        id,
        kind,
        status,
        source: '',
        line: i + 1,
        error: `${fileLabel}:${i + 1} 锚点后缺少 \`\`\`mermaid fence`
      })
      continue
    }
    const start = j + 1
    let end = start
    while (end < lines.length && !/^```\s*$/.test(lines[end])) end++
    if (end >= lines.length) {
      results.push({
        id,
        kind,
        status,
        source: '',
        line: i + 1,
        error: `${fileLabel}:${i + 1} mermaid fence 未闭合`
      })
      continue
    }
    const source = lines.slice(start, end).join('\n').trim()
    results.push({ id, kind, status, source, line: i + 1 })
  }
  return results
}

/** 未锚定的 ```mermaid 块（行号） */
export function findUnanchoredMermaid(markdown) {
  const lines = markdown.split('\n')
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    if (!/^```mermaid\s*$/i.test(lines[i].trim())) continue
    // 向上找最近非空行是否为 diagram 锚点
    let k = i - 1
    while (k >= 0 && lines[k].trim() === '') k--
    if (
      k < 0 ||
      !/<!--\s*diagram:\s*id=[a-z0-9][a-z0-9._-]*\s+kind=[a-z0-9-]+\s+status=[a-z0-9-]+\s*-->/i.test(
        lines[k]
      )
    ) {
      hits.push(i + 1)
    }
  }
  return hits
}

/**
 * 结构级语法检查（不引入 mermaid DOM 依赖）
 * @returns {string[]} errors
 */
export function validateMermaidStructure(source, kind, label) {
  const errors = []
  if (!source || !source.trim()) {
    errors.push(`${label}: 图源为空`)
    return errors
  }
  const body = source
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('%%'))
  if (body.length === 0) {
    errors.push(`${label}: 无有效行`)
    return errors
  }
  const first = body[0].toLowerCase().replace(/\s+/g, '')
  const allowed = KIND_KEYWORDS[kind]
  if (!allowed) {
    errors.push(`${label}: 未知 kind=${kind}`)
    return errors
  }
  const ok = allowed.some(k => first.startsWith(k))
  if (!ok) {
    errors.push(
      `${label}: kind=${kind} 但首行不像 ${allowed.join('|')}（实际：${body[0].slice(0, 48)}）`
    )
  }
  // 粗检：方括号 / 花括号未闭合（忽略字符串内）
  const openSq = (source.match(/\[/g) || []).length
  const closeSq = (source.match(/\]/g) || []).length
  if (openSq !== closeSq) {
    errors.push(`${label}: [] 数量不平衡（${openSq} vs ${closeSq}）`)
  }
  if (
    kind === 'sequence' &&
    !/(->>|-->>|--x|-\))/i.test(source) &&
    !/participant\s+/i.test(source)
  ) {
    errors.push(`${label}: sequence 未见 participant 或消息箭头`)
  }
  if (kind === 'state' && !/\[\*\]|-->/i.test(source)) {
    errors.push(`${label}: state 未见 [*] 或转移箭头`)
  }
  if (kind === 'er' && !/\|\|--|--o\{|\}o--/i.test(source)) {
    errors.push(`${label}: er 未见关系连线`)
  }
  return errors
}

/** 仓库相对路径规范化（去前导 ./、统一 /） */
export function normalizeRepoPath(repoPath) {
  return String(repoPath || '')
    .trim()
    .replace(/^\.\//, '')
    .split('\\')
    .join('/')
    .replace(/\/+$/, '')
}

/**
 * 变更路径是否命中 registry 登记路径（文件等值，或落在登记目录下，或登记文件落在已删目录前缀下）。
 * @param {string} changedPath
 * @param {string} registeredPath
 */
export function pathMatchesRegistered(changedPath, registeredPath) {
  const c = normalizeRepoPath(changedPath)
  const r = normalizeRepoPath(registeredPath)
  if (!c || !r) return false
  if (c === r) return true
  if (c.startsWith(`${r}/`)) return true
  if (r.startsWith(`${c}/`)) return true
  return false
}

/**
 * 将变更路径对照一张图的 codePaths / doc / docPaths。
 * @returns {{ kind: 'code' | 'doc', registeredPath: string }[]}
 */
export function matchDiagramPaths(changedPath, entry) {
  /** @type {{ kind: 'code' | 'doc', registeredPath: string }[]} */
  const hits = []
  for (const p of entry.codePaths || []) {
    if (pathMatchesRegistered(changedPath, p)) {
      hits.push({ kind: 'code', registeredPath: normalizeRepoPath(p) })
    }
  }
  const docTargets = [entry.doc, ...(entry.docPaths || [])].filter(Boolean)
  for (const p of docTargets) {
    if (pathMatchesRegistered(changedPath, p)) {
      hits.push({ kind: 'doc', registeredPath: normalizeRepoPath(p) })
    }
  }
  return hits
}

/** 图表 tooling 元路径（变更时标 meta，非业务语义命中） */
export const DIAGRAM_META_PATH_PREFIXES = [
  'docs/diagrams/registry.json',
  'docs/diagrams/README.md',
  'docs/engineering/Yiveno-Mermaid图表规范.md',
  'scripts/sync-diagrams.mjs',
  'scripts/lib/mermaid-diagrams.mjs',
  'scripts/diagram-change-impact.mjs'
]

/** @param {string} changedPath */
export function isDiagramMetaPath(changedPath) {
  const c = normalizeRepoPath(changedPath)
  return DIAGRAM_META_PATH_PREFIXES.some(
    p => c === p || c.startsWith(`${normalizeRepoPath(p)}/`)
  )
}

/** 关联路径最新 mtime（秒） */
export function latestMtimeMs(repoPaths) {
  let latest = 0
  for (const p of repoPaths || []) {
    const abs = absFromRepo(p)
    if (!existsSync(abs)) continue
    const st = statSync(abs)
    if (st.isFile()) {
      latest = Math.max(latest, st.mtimeMs)
      continue
    }
    if (st.isDirectory()) {
      latest = Math.max(latest, walkLatestMtime(abs))
    }
  }
  return latest
}

function walkLatestMtime(dir, depth = 0) {
  if (depth > 6) return 0
  let latest = 0
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name.startsWith('.')) continue
    const p = join(dir, ent.name)
    try {
      if (ent.isDirectory()) {
        latest = Math.max(latest, walkLatestMtime(p, depth + 1))
      } else if (ent.isFile() && /\.(ts|vue|js|mjs|md)$/.test(ent.name)) {
        latest = Math.max(latest, statSync(p).mtimeMs)
      }
    } catch {
      /* ignore */
    }
  }
  return latest
}
