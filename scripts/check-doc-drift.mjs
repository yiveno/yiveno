#!/usr/bin/env bun
/**
 * 文档 ↔ 代码漂移门禁：
 * 1. background message type：registry ↔ handler ↔ messaging schema
 * 2. 产品文档 §4 核心 type 表 ⊆ registry
 * 3. CURRENT.md 存在且含更新日期
 * 4. session-boot.mdc「当下」块与 CURRENT 同步（sync-ide-boot --check）
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const REGISTRY_PATH = join(root, 'docs/engineering/background-message-types.registry')
const HANDLER_PATH = join(root, 'frontend/src/background/handlers/message-handler.ts')
const PRODUCT_DOC_PATH = join(root, 'docs/product/Yiveno-产品文档-v4.0.md')
const CURRENT_PATH = join(root, 'docs/product/CURRENT.md')
const SYNC_SCRIPT = join(root, 'scripts/sync-ide-boot.mjs')

const MESSAGING_SCHEMA_FILES = [
  'frontend/src/core/messaging/background-messages.ts',
  'frontend/src/core/messaging/memory-messages.ts',
  'frontend/src/core/messaging/recall-messages.ts',
  'frontend/src/core/messaging/import-messages.ts',
  'frontend/src/core/messaging/settings-messages.ts',
  'frontend/src/core/messaging/commands-messages.ts',
  'frontend/src/core/messaging/account-sync-messages.ts',
  'frontend/src/core/messaging/mcp-messages.ts',
  'frontend/src/core/messaging/debug-messages.ts'
].map(p => join(root, p))

function read(path) {
  return readFileSync(path, 'utf8')
}

function loadRegistry(path) {
  return read(path)
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
}

function extractHandlerTypes(source) {
  const types = new Set()
  for (const match of source.matchAll(/case\s+'([A-Z][A-Z0-9_]+)':/g)) {
    types.add(match[1])
  }
  return types
}

function extractSchemaTypes(files) {
  const types = new Set()
  const re = /type:\s*'([A-Z][A-Z0-9_]+)'/g
  for (const file of files) {
    const source = read(file)
    for (const match of source.matchAll(re)) {
      types.add(match[1])
    }
  }
  return types
}

function extractProductDocSection4Types(source) {
  const start = source.indexOf('## 4. 消息协议（Normative）')
  if (start < 0) {
    throw new Error('产品文档缺少 §4 消息协议')
  }
  const slice = source.slice(start, start + 4000)
  // 表头列宽随 prettier 可能变化；只锚定 type / 用途 列名
  const tableStart = slice.search(/\|\s*type\s*\|\s*用途/)
  if (tableStart < 0) {
    throw new Error('产品文档 §4 缺少 type 表')
  }
  const tableEnd = slice.indexOf('\n\n新增能力', tableStart)
  const table = tableEnd > tableStart ? slice.slice(tableStart, tableEnd) : slice.slice(tableStart)
  const types = new Set()
  for (const match of table.matchAll(/\|\s*`([A-Z][A-Z0-9_]+)`\s*\|/g)) {
    types.add(match[1])
  }
  return types
}

function diffOnlyIn(a, b) {
  return [...a].filter(x => !b.has(x)).sort()
}

function extractLastUpdatedDate(text) {
  const match = text.match(/最后更新[\s\S]{0,24}(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? null
}

function checkCurrent(path) {
  const errors = []
  if (!existsSync(path)) {
    errors.push('缺少 docs/product/CURRENT.md')
    return errors
  }
  const text = read(path)
  if (!extractLastUpdatedDate(text)) {
    errors.push('CURRENT.md 缺少「最后更新：YYYY-MM-DD」')
  }
  return errors
}

const errors = []

if (!existsSync(REGISTRY_PATH)) {
  errors.push(`缺少 registry: ${REGISTRY_PATH}`)
} else {
  const registry = new Set(loadRegistry(REGISTRY_PATH))
  const handler = extractHandlerTypes(read(HANDLER_PATH))
  const schema = extractSchemaTypes(MESSAGING_SCHEMA_FILES)
  const docCore = extractProductDocSection4Types(read(PRODUCT_DOC_PATH))

  const registryOnly = diffOnlyIn(registry, handler)
  const handlerOnly = diffOnlyIn(handler, registry)
  if (registryOnly.length > 0) {
    errors.push(`registry 多出（handler 无）: ${registryOnly.join(', ')}`)
  }
  if (handlerOnly.length > 0) {
    errors.push(`handler 有但 registry 缺: ${handlerOnly.join(', ')}`)
  }

  const handlerNotInSchema = diffOnlyIn(handler, schema)
  if (handlerNotInSchema.length > 0) {
    errors.push(`handler case 在 messaging schema 中无 type 定义: ${handlerNotInSchema.join(', ')}`)
  }

  const docNotInRegistry = diffOnlyIn(docCore, registry)
  if (docNotInRegistry.length > 0) {
    errors.push(`产品文档 §4 核心 type 未在 registry 登记: ${docNotInRegistry.join(', ')}`)
  }
}

errors.push(...checkCurrent(CURRENT_PATH))

/** 双线程暗线基建：权威文件 + core 脚手架必须存在（口子门禁）。 */
const DUAL_THREAD_REQUIRED_PATHS = [
  'docs/product/Yiveno-双线程发展原则.md',
  'docs/engineering/暗线基建-失败归因与受控适应.md',
  'docs/archive/research/dual-thread-notes/_TEMPLATE.md',
  'docs/archive/research/dual-thread-notes/README.md',
  'frontend/src/core/recall/dual-thread/recall-failure-attribution.ts',
  'frontend/src/core/recall/dual-thread/recall-adaptation-config.ts',
  'frontend/src/core/recall/dual-thread/dual-thread-aggregate.ts'
]
for (const rel of DUAL_THREAD_REQUIRED_PATHS) {
  const abs = join(root, rel)
  if (!existsSync(abs)) {
    errors.push(`暗线基建缺失: ${rel}`)
  }
}

if (errors.length > 0) {
  console.error('❌ doc-drift 校验失败:')
  for (const line of errors) {
    console.error(`  - ${line}`)
  }
  console.error(
    '\n修复：新增 message type 时同步 registry、core/messaging/*、message-handler、产品文档 §4（若属核心表）。'
  )
  process.exit(1)
}

const syncCheck = spawnSync(process.execPath, [SYNC_SCRIPT, '--check'], {
  cwd: root,
  stdio: 'inherit'
})
if (syncCheck.status !== 0) {
  process.exit(syncCheck.status ?? 1)
}

const registryCount = existsSync(REGISTRY_PATH) ? loadRegistry(REGISTRY_PATH).length : 0
const currentDate = extractLastUpdatedDate(read(CURRENT_PATH)) ?? '?'
console.log(
  `✅ doc-drift ok（registry ${registryCount} types · CURRENT ${currentDate} · session-boot synced · §4 core ⊆ registry）`
)
