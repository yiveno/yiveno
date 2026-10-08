#!/usr/bin/env bun
/**
 * 从 docs/product/CURRENT.md 同步 session-boot.mdc 的「当下」块（消灭手双写）。
 *
 *   bun run sync:ide-boot        # 写入
 *   bun run sync:ide-boot --check  # 仅校验，漂移则 exit 1
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const CURRENT_PATH = join(root, 'docs/product/CURRENT.md')
const SESSION_BOOT_PATH = join(root, '.cursor/rules/session-boot.mdc')

const START = '<!-- SYNC:IDE_BOOT:START -->'
const END = '<!-- SYNC:IDE_BOOT:END -->'

function parseCurrent(md) {
  const date = md.match(/最后更新[\s\S]{0,24}(\d{4}-\d{2}-\d{2})/)?.[1]
  if (!date) {
    throw new Error('CURRENT.md 缺少「最后更新：YYYY-MM-DD」')
  }

  const wave = md.match(/## 当前波次[\s\S]*?(?=\n## )/)?.[0] ?? ''
  const pickRow = label => {
    const m = wave.match(new RegExp(`\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*([^|\\n]+?)\\s*\\|`))
    return m?.[1]?.trim() ?? ''
  }

  const scope = md.match(/## 本周做 \/ 不做[\s\S]*?(?=\n## )/)?.[0] ?? ''
  const listItems = block => [...block.matchAll(/^- (.+)$/gm)].map(m => m[1].trim()).filter(Boolean)

  const doPart = scope.split('**不做：**')[0] ?? ''
  const dontPart = scope.split('**不做：**')[1] ?? ''
  const weekDo = listItems(doPart.replace(/^[\s\S]*?\*\*做：\*\*\s*/m, ''))
  const weekDont = listItems(dontPart)

  const compress = items => items.join('；').replace(/\s+/g, ' ').trim()

  const cap = md.match(/## 能力真相[\s\S]*?(?=\n## )/)?.[0] ?? ''
  const shippedRaw = cap.match(/\*\*已上线[^*]*\*\*[^\n]*/)?.[0] ?? ''
  const shipped = shippedRaw
    .replace(/\*\*/g, '')
    .replace(/^已上线[^：]*：/, '')
    .replace(/——.*$/, '')
    .trim()
  const notReady = cap.match(/\*\*未达对外门槛：\*\*([^\n]+)/)?.[1]?.trim() ?? ''
  const inProgress = cap.match(/\*\*进行中：\*\*([^\n]+)/)?.[1]?.trim() ?? ''

  const abilityParts = []
  if (shipped) abilityParts.push(`${shipped}（详表 \`产品文档 §1\`）`)
  if (notReady) abilityParts.push(notReady)
  if (inProgress) abilityParts.push(`进行中：${inProgress}`)

  return {
    date,
    mainline: pickRow('主线'),
    parallel: pickRow('并行'),
    weekDo: compress(weekDo),
    weekDont: compress(weekDont),
    ability: abilityParts.join('。').replace(/。。/g, '。')
  }
}

function buildSyncBlock(parsed) {
  return `${START}
**最后更新：** ${parsed.date}

> **每会话首条：** 用户应粘贴 [\`AGENT-TASK-BRIEF.template.md\`](../../docs/product/AGENT-TASK-BRIEF.template.md)（In/Out/验收/禁止）。

## 当下

| 项 | 内容 |
| --- | --- |
| **主线** | ${parsed.mainline} |
| **并行** | ${parsed.parallel} |
| **本周做** | ${parsed.weekDo} |
| **本周不做** | ${parsed.weekDont} |

**能力速查：** ${parsed.ability}
${END}`
}

function syncSessionBoot(checkOnly) {
  const current = readFileSync(CURRENT_PATH, 'utf8')
  const parsed = parseCurrent(current)
  const block = buildSyncBlock(parsed)

  const boot = readFileSync(SESSION_BOOT_PATH, 'utf8')
  if (!boot.includes(START) || !boot.includes(END)) {
    throw new Error(`session-boot.mdc 缺少 ${START} / ${END} 标记`)
  }

  const next = boot.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block)

  if (checkOnly) {
    if (next !== boot) {
      console.error('❌ session-boot.mdc 与 CURRENT.md 不同步；请运行: bun run sync:ide-boot')
      process.exit(1)
    }
    console.log(`✅ session-boot 已与 CURRENT 同步（${parsed.date}）`)
    return
  }

  if (next === boot) {
    console.log(`✅ session-boot 已是最新（${parsed.date}）`)
    return
  }

  writeFileSync(SESSION_BOOT_PATH, next)
  console.log(`✅ 已同步 session-boot.mdc ← CURRENT.md（${parsed.date}）`)
}

const checkOnly = process.argv.includes('--check')
syncSessionBoot(checkOnly)
