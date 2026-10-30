#!/usr/bin/env bun
/**
 * 业务逻辑 Mermaid 图表：清单校验 + Agent 同步 Brief
 *
 * 不调用外部 LLM API。语义审阅由 Cursor Agent 按 Brief 执行。
 *
 * 用法：
 *   bun run docs:sync-diagrams           # 校验 + 写 Brief
 *   bun run docs:sync-diagrams --check   # 仅门禁
 *   bun run docs:sync-diagrams --id <id>
 *   bun run docs:check-diagrams          # = --check
 */
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import {
  ALLOWED_KINDS,
  ALLOWED_STATUS,
  BRIEF_PATH,
  CACHE_DIR,
  REGISTRY_PATH,
  absFromRepo,
  extractAnchoredDiagrams,
  findUnanchoredMermaid,
  latestMtimeMs,
  loadRegistry,
  pathExists,
  readText,
  rel,
  validateMermaidStructure
} from './lib/mermaid-diagrams.mjs'

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const idIdx = args.indexOf('--id')
const idFilter = idIdx >= 0 ? args[idIdx + 1] : null

function fail(msg) {
  console.error(`❌ ${msg}`)
}

function ok(msg) {
  console.log(`✅ ${msg}`)
}

function hostMtime(repoPath) {
  try {
    return statSync(absFromRepo(repoPath)).mtimeMs
  } catch {
    return 0
  }
}

/**
 * @param {{ entry: object, anchor: object, staleHint: boolean }[]} syncRows
 * @param {string | null} filterId
 */
function buildBrief(syncRows, filterId) {
  const now = new Date().toISOString()
  const lines = []
  lines.push('# Mermaid 图表同步 · Agent Brief')
  lines.push('')
  lines.push(`> 生成：${now}`)
  lines.push(
    `> 命令：\`bun run docs:sync-diagrams${filterId ? ` --id ${filterId}` : ''}\``
  )
  lines.push('> **不调用外部 LLM API。** 由本会话 Agent 审代码后改图。')
  lines.push('')
  lines.push('## 纪律')
  lines.push('')
  lines.push('- 真相顺序：现行代码 → 产品文档/ADR → 宿主 MD → 旧图')
  lines.push('- 区分 implemented / designed / planned；推测标「不确定」，禁止瞎补')
  lines.push('- 不改业务代码、不改产品行为；不覆盖无关正文')
  lines.push('- 保持稳定节点/participant id，减小无意义 Diff')
  lines.push('- 改完跑 `bun run docs:check-diagrams`')
  lines.push('')
  lines.push('## 待审图表')
  lines.push('')

  for (const { entry, anchor, staleHint } of syncRows) {
    lines.push(`### \`${entry.id}\``)
    lines.push('')
    lines.push(`- **title：** ${entry.title}`)
    lines.push(`- **kind / status：** ${entry.kind} / ${entry.status}`)
    lines.push(`- **宿主：** \`${entry.doc}\`（约 L${anchor.line}）`)
    lines.push('- **codePaths：**')
    for (const p of entry.codePaths || []) lines.push(`  - \`${p}\``)
    lines.push('- **docPaths：**')
    for (const p of entry.docPaths || []) lines.push(`  - \`${p}\``)
    if (entry.notes) lines.push(`- **notes：** ${entry.notes}`)
    if (staleHint) lines.push('- **提示：** codePaths mtime 新于宿主 MD → 优先核对')
    lines.push('- **审阅清单：**')
    lines.push('  1. 重读 codePaths / docPaths，对照图中节点与边')
    lines.push('  2. 标出：已变逻辑 / 缺节点 / 失效节点 / 与代码不一致 / 需新增图的区域')
    lines.push('  3. 仅修改需要改的 Mermaid；planned 图不得画成已接线')
    lines.push('  4. 不确定性写回宿主 MD 或同步报告，勿擅自补全')
    lines.push('')
  }

  lines.push('## 完成后输出（对话内）')
  lines.push('')
  lines.push('- 检查了哪些模块')
  lines.push('- 发现的差异（有/无）')
  lines.push('- 修改了哪些图（路径 + id）')
  lines.push('- 仍存的不确定性')
  lines.push('- `docs:check-diagrams` 是否通过')
  lines.push('')
  return lines.join('\n')
}

function main() {
  const errors = []
  const warnings = []

  let registry
  try {
    registry = loadRegistry()
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e))
    process.exit(1)
  }

  const entries = idFilter
    ? registry.diagrams.filter(d => d.id === idFilter)
    : registry.diagrams

  if (idFilter && entries.length === 0) {
    fail(`registry 中无 id=${idFilter}`)
    process.exit(1)
  }

  const byId = new Map()
  for (const d of registry.diagrams) {
    if (byId.has(d.id)) errors.push(`registry 重复 id: ${d.id}`)
    byId.set(d.id, d)
    if (!ALLOWED_KINDS.has(d.kind)) errors.push(`${d.id}: kind 非法 ${d.kind}`)
    if (!ALLOWED_STATUS.has(d.status)) errors.push(`${d.id}: status 非法 ${d.status}`)
    if (!d.doc) errors.push(`${d.id}: 缺少 doc`)
    else if (!pathExists(d.doc)) errors.push(`${d.id}: 宿主不存在 ${d.doc}`)
    for (const p of d.codePaths || []) {
      if (!pathExists(p)) errors.push(`${d.id}: codePath 不存在 ${p}`)
    }
    for (const p of d.docPaths || []) {
      if (!pathExists(p)) errors.push(`${d.id}: docPath 不存在 ${p}`)
    }
  }

  const docsNeeded = new Set(entries.map(d => d.doc))
  /** @type {Map<string, ReturnType<typeof extractAnchoredDiagrams>>} */
  const anchorsByDoc = new Map()

  for (const doc of docsNeeded) {
    const md = readText(absFromRepo(doc))
    const anchored = extractAnchoredDiagrams(md, doc)
    anchorsByDoc.set(doc, anchored)

    for (const a of anchored) {
      if (a.error) errors.push(a.error)
    }

    const expectedIds = new Set(entries.filter(e => e.doc === doc).map(e => e.id))
    const foundIds = new Set(anchored.map(a => a.id))
    for (const id of expectedIds) {
      if (!foundIds.has(id)) errors.push(`${doc}: 缺少锚点 id=${id}`)
    }

    const registeredForDoc = new Set(
      registry.diagrams.filter(d => d.doc === doc).map(d => d.id)
    )
    for (const a of anchored) {
      if (!registeredForDoc.has(a.id)) {
        errors.push(`${doc}:${a.line}: 锚点 id=${a.id} 未登记到 registry.json`)
      }
    }

    if (registeredForDoc.size > 0) {
      for (const line of findUnanchoredMermaid(md)) {
        errors.push(`${doc}:${line}: \`\`\`mermaid 缺少前置 <!-- diagram: id=... -->`)
      }
    }
  }

  /** @type {{ entry: object, anchor: object, staleHint: boolean }[]} */
  const syncRows = []

  for (const entry of entries) {
    const anchored = anchorsByDoc.get(entry.doc) || []
    const anchor = anchored.find(a => a.id === entry.id)
    if (!anchor || anchor.error) continue

    if (anchor.kind !== entry.kind) {
      errors.push(`${entry.id}: 锚点 kind=${anchor.kind} ≠ registry kind=${entry.kind}`)
    }
    if (anchor.status !== entry.status) {
      errors.push(
        `${entry.id}: 锚点 status=${anchor.status} ≠ registry status=${entry.status}`
      )
    }

    errors.push(
      ...validateMermaidStructure(
        anchor.source,
        entry.kind,
        `${entry.id} (${entry.doc}:${anchor.line})`
      )
    )

    const codeMtime = latestMtimeMs(entry.codePaths || [])
    const docMtime = hostMtime(entry.doc)
    const staleHint = codeMtime > 0 && docMtime > 0 && codeMtime > docMtime + 60_000
    if (staleHint) {
      warnings.push(`${entry.id}: codePaths 较宿主 MD 更新（提示审阅，非自动失败）`)
    }
    syncRows.push({ entry, anchor, staleHint })
  }

  if (warnings.length) {
    console.log('\n⚠️  提示：')
    for (const w of warnings) console.log(`  - ${w}`)
  }

  if (errors.length) {
    console.log('\n结构校验失败：')
    for (const e of errors) fail(e)
    process.exit(1)
  }

  ok(
    `diagrams 校验通过（${entries.length} 张${idFilter ? ` · id=${idFilter}` : ''}）· ${rel(REGISTRY_PATH)}`
  )

  if (checkOnly) process.exit(0)

  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(BRIEF_PATH, buildBrief(syncRows, idFilter), 'utf8')
  ok(`已写 Agent Brief：${rel(BRIEF_PATH)}（gitignore · 勿提交）`)
  console.log(`
下一步（Cursor Agent）：
  1. 打开 Brief：@${rel(BRIEF_PATH)}
  2. 按其中「必读路径」重审代码与权威文档（勿只信旧图）
  3. 只改确需更新的 Mermaid / 锚点 / registry
  4. bun run docs:check-diagrams
  5. 重大同步写报告到 docs/diagrams/reports/
`)
}

main()
