#!/usr/bin/env bun
/**
 * 代码 ↔ 文档一致性门禁（doc-vs-code consistency）：
 *
 * 校验活跃权威文档中的关键承诺在当前代码中可被验证。
 * 设计为「轻量级、纯静态」检查，避免假阳性。
 *
 * 当前校验项（2026-09-17 初始版）：
 *   C1. core/ 中无 `chrome.*` / `indexedDB.*` 直接调用（ADR-004 / 项目架构铁律）
 *   C2. frontend/src/infrastructure/indexeddb/manager.ts 是唯一持有 `indexedDB.open` 的文件
 *   C3. Omnibox 入口分轨：omnibox listener 调用 `recallWithClue(..., { entry: 'omnibox' })`（ADR-007）
 *   C4. Side Panel manifest：无 `default_popup`，`side_panel.default_path = "sidepanel.html"`（ADR-001）
 *   C5. 闭集产品槽位词典：RECALL_OBJECT_TYPE_LEXICON / RECALL_BEHAVIOR_LEXICON / RECALL_TIME_LEXICON 存在
 *        （不是内容别名表，而是产品文档明示的闭合槽位；ADR-005）
 *   C6. ADR-012 翻牌句 `_Why should things just be things?_` 未出现在产品代码（仅文档预留）
 *
 * 设计原则：
 *   - 每次跑 < 5s
 *   - 失败信息明确指向修复路径
 *   - 不替代 `doc:check`（message type 漂移门禁）
 *   - 不替代 `typecheck` / `test:run`
 *
 * 用法：
 *   bun ./scripts/check-doc-code-consistency.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const checks = []

function check(id, description, fn) {
  checks.push({ id, description, fn })
}

function read(rel) {
  const abs = join(root, rel)
  if (!existsSync(abs)) {
    throw new Error(`文件不存在: ${rel}`)
  }
  return readFileSync(abs, 'utf8')
}

function walkFiles(dirAbs, predicate) {
  const out = []
  if (!existsSync(dirAbs)) return out
  for (const entry of readdirSync(dirAbs, { withFileTypes: true })) {
    const next = join(dirAbs, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkFiles(next, predicate))
    } else if (predicate(entry.name)) {
      out.push(next)
    }
  }
  return out
}

/**
 * 去掉注释（单行 + 多行），保留代码本体。
 */
function stripComments(source) {
  // 去掉 /** ... */ 多行注释
  let result = source.replace(/\/\*[\s\S]*?\*\//g, '')
  // 去掉 // 单行注释（保留字符串内的 //；最简化：行级去掉 // 后的内容）
  result = result
    .split('\n')
    .map(line => {
      // 找到不在字符串内的 //
      let inString = false
      let stringChar = ''
      for (let i = 0; i < line.length - 1; i++) {
        const c = line[i]
        if (inString) {
          if (c === stringChar && line[i - 1] !== '\\') {
            inString = false
          }
        } else {
          if (c === '"' || c === "'" || c === '`') {
            inString = true
            stringChar = c
          } else if (c === '/' && line[i + 1] === '/') {
            return line.slice(0, i)
          }
        }
      }
      return line
    })
    .join('\n')
  return result
}

/** C1: core/ 中无 chrome.* / indexedDB.* 直接调用 */
check('C1', 'core/ 无 Chrome/IndexedDB 直接调用（ADR-004 / 架构铁律）', () => {
  const coreDir = join(root, 'frontend/src/core')
  const files = walkFiles(
    coreDir,
    n => n.endsWith('.ts') && !n.endsWith('.d.ts') && !n.endsWith('.test.ts')
  )
  const violations = []
  // 允许 chrome.* 作为字符串或类型引用，但禁止实际 API 调用形式：chrome.xxx.yyy(...)
  // 简化：扫描 `chrome.<api>` 后是否跟标识符 + ( 或 . （即链式属性）
  const re =
    /\bchrome\.(storage|tabs|bookmarks|runtime|windows|i18n)\.(?:[a-z][A-Za-z]*\s*\(|\s*[a-z][A-Za-z]*\s*\.)/g
  const indexedDBRe = /\bindexedDB\.(open|deleteDatabase)\s*\(/g

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const code = stripComments(source)
    let m
    while ((m = re.exec(code)) !== null) {
      const lineNum = code.slice(0, m.index).split('\n').length
      violations.push(`  ${file.replace(root + '/', '')}:${lineNum}: ${m[0].replace(/\s+/g, ' ')}`)
    }
    while ((m = indexedDBRe.exec(code)) !== null) {
      const lineNum = code.slice(0, m.index).split('\n').length
      violations.push(`  ${file.replace(root + '/', '')}:${lineNum}: ${m[0]}`)
    }
  }
  return violations.length === 0 ? null : violations
})

/** C2: indexedDB.open 仅在 manager.ts */
check('C2', 'indexedDB.open 仅在 infrastructure/indexeddb/manager.ts', () => {
  const violations = []
  const re = /indexedDB\.open\(/g
  const searchDirs = ['frontend/src']
  for (const dir of searchDirs) {
    const dirAbs = join(root, dir)
    const files = walkFiles(dirAbs, n => n.endsWith('.ts') && !n.endsWith('.test.ts'))
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      const code = stripComments(src)
      let m
      while ((m = re.exec(code)) !== null) {
        if (!file.endsWith('infrastructure/indexeddb/manager.ts')) {
          const lineNum = code.slice(0, m.index).split('\n').length
          violations.push(`  ${file.replace(root + '/', '')}:${lineNum}: indexedDB.open`)
        }
      }
    }
  }
  return violations.length === 0 ? null : violations
})

/** C3: Omnibox listener 必须带 entry: 'omnibox' */
check('C3', 'Omnibox listener 调用 recallWithClue 时必须带 entry: omnibox（ADR-007）', () => {
  const file = join(root, 'frontend/src/background/listeners/omnibox.ts')
  const source = readFileSync(file, 'utf8')
  const hasEntryFlag = /recallWithClue\([^)]*\{\s*[^}]*entry:\s*['"]omnibox['"]/s.test(source)
  return hasEntryFlag ? null : [`  ${file.replace(root + '/', '')} 缺少 entry: 'omnibox'`]
})

/** C4: manifest.json 配置 */
check('C4', 'Side Panel manifest 配置正确（ADR-001）', () => {
  const file = join(root, 'frontend/public/manifest.json')
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  const errors = []
  if (manifest.default_popup) {
    errors.push(`  ${file.replace(root + '/', '')}: 仍有 default_popup（应仅保留 side_panel）`)
  }
  if (!manifest.side_panel || manifest.side_panel.default_path !== 'sidepanel.html') {
    errors.push(`  ${file.replace(root + '/', '')}: side_panel.default_path 应为 "sidepanel.html"`)
  }
  if (!Array.isArray(manifest.permissions) || !manifest.permissions.includes('sidePanel')) {
    errors.push(`  ${file.replace(root + '/', '')}: permissions 缺少 sidePanel`)
  }
  return errors.length === 0 ? null : errors
})

/** C5: 闭集产品槽位词典存在 */
check('C5', '闭集产品槽位词典存在（RECALL_OBJECT_TYPE_LEXICON 等；ADR-005）', () => {
  const file = join(root, 'frontend/src/core/recall/parse-recall-clue-lexicon.ts')
  if (!existsSync(file)) {
    return [`  ${file.replace(root + '/', '')}: 不存在`]
  }
  const source = readFileSync(file, 'utf8')
  const required = ['RECALL_OBJECT_TYPE_LEXICON', 'RECALL_BEHAVIOR_LEXICON', 'RECALL_TIME_LEXICON']
  const missing = required.filter(name => !source.includes(`export const ${name}`))
  return missing.length === 0
    ? null
    : missing.map(name => `  ${file.replace(root + '/', '')}: 缺少 export const ${name}`)
})

/** C6: 翻牌句不在代码中出现 */
check('C6', 'ADR-012 翻牌句未出现在产品代码（仅文档预留）', () => {
  const codeDirs = ['frontend/src', 'website/src', 'packages']
  const violations = []
  for (const dir of codeDirs) {
    const dirAbs = join(root, dir)
    const files = walkFiles(dirAbs, n => /\.(ts|vue|astro|js|mjs|cjs|tsx|jsx)$/.test(n))
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      // 翻转检测：精确匹配翻转句英文（避免误伤代码中的同名词）
      if (src.includes('Why should things just be things')) {
        violations.push(`  ${file.replace(root + '/', '')}`)
      }
    }
  }
  return violations.length === 0 ? null : violations
})

const errors = []
const passed = []

for (const { id, description, fn } of checks) {
  try {
    const result = fn()
    if (result === null) {
      passed.push({ id, description })
    } else {
      errors.push({ id, description, violations: result })
    }
  } catch (err) {
    errors.push({ id, description, violations: [`  异常: ${err.message}`] })
  }
}

if (errors.length > 0) {
  console.error('❌ doc-vs-code consistency 校验失败:\n')
  for (const { id, description, violations } of errors) {
    console.error(`[${id}] ${description}`)
    for (const v of violations) console.error(v)
    console.error('')
  }
  console.error(
    '修复：以上违规说明文档承诺与代码实现不一致；同步调整代码或更新对应文档（产品文档 §0/§4 或 ADR）。'
  )
  process.exit(1)
}

console.log(`✅ doc-vs-code consistency ok（${passed.length} 项通过）`)
for (const { id, description } of passed) {
  console.log(`   ${id} · ${description}`)
}
