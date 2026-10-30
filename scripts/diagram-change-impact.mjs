#!/usr/bin/env bun
/**
 * 图表变更感知：Git diff（或显式路径）→ registry codePaths/doc 映射 → Agent 复核清单
 *
 * **不**改 Mermaid；**不**判定语义对错；**不**改变 docs:check-diagrams 职责。
 *
 * 用法：
 *   bun run docs:diagram-impact --base HEAD
 *   bun run docs:diagram-impact --base origin/main
 *   bun run docs:diagram-impact --base HEAD --id runtime.omnibox-offline-recall
 *   bun run docs:diagram-impact --paths extension/src/background/listeners/omnibox.ts
 *   bun run docs:diagram-impact --paths A:foo.ts D:bar.ts M:baz.ts
 *   bun run docs:diagram-impact --base HEAD --json
 *   bun run docs:diagram-impact --base HEAD --write-brief
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import {
  BRIEF_PATH,
  CACHE_DIR,
  isDiagramMetaPath,
  loadRegistry,
  matchDiagramPaths,
  normalizeRepoPath,
  rel
} from './lib/mermaid-diagrams.mjs'
import { join } from 'node:path'

const IMPACT_BRIEF_PATH = join(CACHE_DIR, 'DIAGRAM-CHANGE-IMPACT.md')

const args = process.argv.slice(2)

function flagValue(name) {
  const i = args.indexOf(name)
  if (i < 0) return null
  return args[i + 1] ?? null
}

function hasFlag(name) {
  return args.includes(name)
}

function fail(msg) {
  console.error(`❌ ${msg}`)
}

/** 去掉 git 偶发包裹引号（quotepath 已关时多为 no-op） */
function unquoteGitPath(p) {
  const s = String(p || '').trim()
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\(.)/g, '$1')
  }
  return s
}

function usage() {
  console.log(`用法:
  bun run docs:diagram-impact --base <git-ref> [--id <diagram-id>] [--json] [--write-brief]
  bun run docs:diagram-impact --paths <path|STATUS:path>... [--id <diagram-id>] [--json] [--write-brief]

说明:
  --base     与当前工作区（含已暂存/未暂存已跟踪文件）对比的 Git 起点；并附带未跟踪文件
  --paths    跳过 git，显式变更列表（可用 A:/M:/D: 前缀模拟增改删）
  --id       只分析/输出该图
  --json     机器可读 JSON 到 stdout
  --write-brief  写入 docs/diagrams/.cache/DIAGRAM-CHANGE-IMPACT.md（gitignore）

纪律:
  命中 ≠ 语义过时；未命中 ≠ 无影响（无 import 图，间接依赖不可伪装成确定结论）
`)
}

/**
 * @typedef {{ path: string, status: string }} ChangedFile
 * @typedef {{ id: string, title: string, doc: string, status: string, hitKinds: string[], reasons: { path: string, gitStatus: string, matchKind: string, registeredPath: string }[] }} ImpactedDiagram
 */

/** @returns {ChangedFile[]} */
function parseExplicitPaths(rawList) {
  /** @type {ChangedFile[]} */
  const out = []
  for (const raw of rawList) {
    const m = /^(A|M|D|R|T|U|\?):(.+)$/i.exec(raw)
    if (m) {
      out.push({ status: m[1].toUpperCase(), path: normalizeRepoPath(m[2]) })
    } else {
      out.push({ status: 'M', path: normalizeRepoPath(raw) })
    }
  }
  return out.filter(x => x.path)
}

/** @param {string} base */
function collectGitChanges(base) {
  /** @type {ChangedFile[]} */
  const changed = []
  const seen = new Set()

  function add(status, path) {
    const p = normalizeRepoPath(path)
    if (!p || seen.has(p)) return
    seen.add(p)
    changed.push({ status, path: p })
  }

  // quotepath=false：中文/空格路径保持字面，避免 \"octal\" 误匹配
  const diff = spawnSync(
    'git',
    ['-c', 'core.quotepath=false', 'diff', '--name-status', '--diff-filter=ACDMRTUXB', base],
    {
      encoding: 'utf8',
      cwd: process.cwd()
    }
  )
  if (diff.status !== 0) {
    throw new Error(
      `git diff 失败（base=${base}）：${(diff.stderr || diff.stdout || '').trim() || `exit ${diff.status}`}`
    )
  }
  for (const line of (diff.stdout || '').split('\n')) {
    if (!line.trim()) continue
    // name-status: M\tpath | R100\told\tnew | C...\told\tnew
    const parts = line.split('\t')
    const statusRaw = parts[0] || ''
    const status = statusRaw[0] || '?'
    if (parts.length >= 3 && (status === 'R' || status === 'C')) {
      add('D', unquoteGitPath(parts[1]))
      add('A', unquoteGitPath(parts[2]))
      continue
    }
    if (parts[1]) add(status, unquoteGitPath(parts[1]))
  }

  const untracked = spawnSync(
    'git',
    ['-c', 'core.quotepath=false', 'ls-files', '--others', '--exclude-standard'],
    {
      encoding: 'utf8',
      cwd: process.cwd()
    }
  )
  if (untracked.status === 0) {
    for (const line of (untracked.stdout || '').split('\n')) {
      if (line.trim()) add('A', unquoteGitPath(line.trim()))
    }
  }

  return changed
}

/**
 * @param {ChangedFile[]} changed
 * @param {import('./lib/mermaid-diagrams.mjs').DiagramRegistry} registry
 * @param {string | null} idFilter
 */
function analyze(changed, registry, idFilter) {
  const entries = idFilter
    ? registry.diagrams.filter(d => d.id === idFilter)
    : registry.diagrams

  if (idFilter && entries.length === 0) {
    throw new Error(`registry 中无 id=${idFilter}`)
  }

  /** @type {Map<string, ImpactedDiagram>} */
  const impacted = new Map()
  /** @type {{ path: string, status: string }[]} */
  const metaHits = []
  /** @type {{ path: string, status: string }[]} */
  const unmatched = []

  for (const file of changed) {
    if (isDiagramMetaPath(file.path)) {
      metaHits.push(file)
      continue
    }

    let any = false
    for (const entry of entries) {
      const hits = matchDiagramPaths(file.path, entry)
      if (hits.length === 0) continue
      any = true
      let row = impacted.get(entry.id)
      if (!row) {
        row = {
          id: entry.id,
          title: entry.title,
          doc: entry.doc,
          status: entry.status,
          hitKinds: [],
          reasons: []
        }
        impacted.set(entry.id, row)
      }
      for (const h of hits) {
        if (!row.hitKinds.includes(h.kind)) row.hitKinds.push(h.kind)
        row.reasons.push({
          path: file.path,
          gitStatus: file.status,
          matchKind: h.kind,
          registeredPath: h.registeredPath
        })
      }
    }

    // 仅在全量分析时收集 unmatched（--id 过滤时未命中不代表全局无关）
    if (!any && !idFilter) {
      unmatched.push(file)
    }
  }

  const impactedList = [...impacted.values()].sort((a, b) => a.id.localeCompare(b.id))

  return {
    baseMode: true,
    changedCount: changed.length,
    impacted: impactedList,
    meta: metaHits,
    unmatched,
    disclaimer: {
      hitMeans: '命中只表示 registry 路径映射触发复核建议，不等于图语义已过时',
      missMeans:
        '未命中只表示未列入 codePaths/docPaths；不排除间接 import / 跨模块影响（本工具无依赖图，不作确定性间接结论）',
      indirect: '不输出伪装成确定的「间接依赖」边；请人工/Agent 结合命中图与 unmatched 列表判断'
    }
  }
}

function buildMarkdownReport(result, { base, pathsMode, idFilter, commandLine }) {
  const now = new Date().toISOString()
  const lines = []
  lines.push('# 图表变更感知 · Agent Impact Brief')
  lines.push('')
  lines.push(`> 生成：${now}`)
  lines.push(`> 命令：\`${commandLine}\``)
  lines.push(`> 输入：${pathsMode ? '显式 --paths' : `--base ${base}`}${idFilter ? ` · filter id=${idFilter}` : ''}`)
  lines.push('> **不**自动改 Mermaid；**不**判定语义正确性。')
  lines.push('')
  lines.push('## 纪律')
  lines.push('')
  lines.push(`- ${result.disclaimer.hitMeans}`)
  lines.push(`- ${result.disclaimer.missMeans}`)
  lines.push(`- ${result.disclaimer.indirect}`)
  lines.push('- 复核后若需改图：按 `docs:sync-diagrams --id <id>` Brief 纪律改宿主 Mermaid → `docs:check-diagrams`')
  lines.push('')
  lines.push(`## 摘要`)
  lines.push('')
  lines.push(`- 变更文件数：${result.changedCount}`)
  lines.push(`- 直接命中图：${result.impacted.length}`)
  lines.push(`- tooling meta 变更：${result.meta.length}`)
  lines.push(`- 未匹配变更：${result.unmatched.length}${idFilter ? '（--id 模式下不枚举全局 unmatched）' : ''}`)
  lines.push('')

  if (result.impacted.length === 0) {
    lines.push('## 命中图表')
    lines.push('')
    lines.push('_（无）_')
    lines.push('')
  } else {
    lines.push('## 命中图表（建议复核）')
    lines.push('')
    for (const d of result.impacted) {
      lines.push(`### \`${d.id}\``)
      lines.push('')
      lines.push(`- **title：** ${d.title}`)
      lines.push(`- **status：** ${d.status}`)
      lines.push(`- **宿主：** \`${d.doc}\``)
      lines.push(`- **命中类型：** ${d.hitKinds.join(', ')}`)
      lines.push('- **原因：**')
      for (const r of d.reasons) {
        lines.push(
          `  - \`${r.gitStatus}\` \`${r.path}\` → ${r.matchKind} 登记 \`${r.registeredPath}\``
        )
      }
      lines.push('')
    }
  }

  if (result.meta.length) {
    lines.push('## tooling / meta（非业务图语义）')
    lines.push('')
    for (const m of result.meta) {
      lines.push(`- \`${m.status}\` \`${m.path}\``)
    }
    lines.push('')
  }

  if (!idFilter) {
    lines.push('## 未匹配变更')
    lines.push('')
    if (result.unmatched.length === 0) {
      lines.push('_（无）_')
    } else {
      lines.push('下列路径未命中任何图的 codePaths/doc/docPaths。**不可**据此断言无图表影响。')
      lines.push('')
      const capped = result.unmatched.slice(0, 80)
      for (const u of capped) {
        lines.push(`- \`${u.status}\` \`${u.path}\``)
      }
      if (result.unmatched.length > capped.length) {
        lines.push(`- … 另有 ${result.unmatched.length - capped.length} 条省略`)
      }
    }
    lines.push('')
  }

  lines.push('## Agent 下一步')
  lines.push('')
  lines.push('1. 对每个命中 id：打开宿主 MD 中对应 Mermaid，对照本次 diff 中的命中文件')
  lines.push('2. 仅在行为/契约相对图有差异时改图；无差异则在对话注明「已复核无改」')
  lines.push('3. `bun run docs:check-diagrams`')
  lines.push('4. 重大同步写 `docs/diagrams/reports/`')
  lines.push('')
  return lines.join('\n')
}

function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage()
    process.exit(0)
  }

  const base = flagValue('--base')
  const idFilter = flagValue('--id')
  const wantJson = hasFlag('--json')
  const writeBrief = hasFlag('--write-brief')

  const pathIdx = args.indexOf('--paths')
  /** @type {string[]} */
  const pathArgs = []
  if (pathIdx >= 0) {
    for (let i = pathIdx + 1; i < args.length; i++) {
      if (args[i].startsWith('--')) break
      pathArgs.push(args[i])
    }
  }

  if (!base && pathArgs.length === 0) {
    fail('须指定 --base <ref> 或 --paths …')
    usage()
    process.exit(1)
  }

  let registry
  try {
    registry = loadRegistry()
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e))
    process.exit(1)
  }

  /** @type {ChangedFile[]} */
  let changed
  const pathsMode = pathArgs.length > 0
  try {
    changed = pathsMode ? parseExplicitPaths(pathArgs) : collectGitChanges(/** @type {string} */ (base))
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e))
    process.exit(1)
  }

  let result
  try {
    result = analyze(changed, registry, idFilter)
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e))
    process.exit(1)
  }

  const commandLine = `bun run docs:diagram-impact${base ? ` --base ${base}` : ''}${
    pathArgs.length ? ` --paths ${pathArgs.join(' ')}` : ''
  }${idFilter ? ` --id ${idFilter}` : ''}`

  const payload = {
    generatedAt: new Date().toISOString(),
    base: pathsMode ? null : base,
    pathsMode,
    idFilter,
    ...result
  }

  if (wantJson) {
    console.log(JSON.stringify(payload, null, 2))
  } else {
    const md = buildMarkdownReport(payload, {
      base: base || '(paths)',
      pathsMode,
      idFilter,
      commandLine
    })
    console.log(md)
    if (writeBrief) {
      mkdirSync(CACHE_DIR, { recursive: true })
      writeFileSync(IMPACT_BRIEF_PATH, md, 'utf8')
      console.error(`✅ 已写 Impact Brief：${rel(IMPACT_BRIEF_PATH)}（gitignore）`)
      console.error(`   （SYNC-BRIEF 仍由 docs:sync-diagrams 生成：${rel(BRIEF_PATH)}）`)
    }
  }

  if (!wantJson) {
    console.error(
      `\n✅ diagram-impact：变更 ${changed.length} · 命中图 ${result.impacted.length} · meta ${result.meta.length} · unmatched ${result.unmatched.length}`
    )
  }
}

main()
