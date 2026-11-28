#!/usr/bin/env bun
/**
 * 环境契约自洽检查（表 / wrangler / Worker 声明键 / 文档标记表 / .env.example）。
 * 永不打印 secret 值。
 *
 * 用法：
 *   bun run env:contract:check
 *   bun run env:docs:sync   → 本脚本 --write-docs
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  SHARED_OPTIONAL_KEYS,
  EXTENSION_KEYS,
  WORKER_KEYS,
  WEBSITE_KEYS,
  LEGACY_SHARED_FALLBACK_KEYS,
  LEGACY_PROFILE_KEYS,
  WORKER_OPTIONAL_KEYS,
  WORKER_BINDINGS,
  LEGACY_ENV_KEYS,
  WRANGLER_VAR_DIFF_ALLOWLIST,
  CRITICAL_WRANGLER_EQUAL_KEYS,
  KEY_META,
  EXAMPLE_SOURCE_KEYS
} from './env-manifest.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..')
const docsEnvPath = path.join(repoRoot, 'docs', 'ENVIRONMENT.md')
const exampleEnvPath = path.join(repoRoot, '.env.example')
const envTsPath = path.join(repoRoot, 'worker', 'src', 'types', 'env.ts')
const workerConfigDtsPath = path.join(repoRoot, 'worker', 'worker-configuration.d.ts')
const defaultWranglerPath = path.join(repoRoot, 'worker', 'wrangler.toml')

const MARKER_START = '<!-- env-manifest:start -->'
const MARKER_END = '<!-- env-manifest:end -->'

const writeDocs = process.argv.includes('--write-docs')

/** @type {string[]} */
const errors = []
/** @type {string[]} */
const notes = []

function fail(message) {
  errors.push(message)
}

/**
 * @param {readonly string[]} keys
 * @param {string} label
 */
function assertNoDupes(keys, label) {
  const seen = new Set()
  const dupes = []
  for (const key of keys) {
    if (seen.has(key)) dupes.push(key)
    seen.add(key)
  }
  if (dupes.length) fail(`${label} has duplicate keys: ${dupes.join(', ')}`)
}

function checkTableSelfConsistency() {
  assertNoDupes(SHARED_OPTIONAL_KEYS, 'SHARED_OPTIONAL_KEYS')
  assertNoDupes(EXTENSION_KEYS, 'EXTENSION_KEYS')
  assertNoDupes(WORKER_KEYS, 'WORKER_KEYS')
  assertNoDupes(WORKER_OPTIONAL_KEYS, 'WORKER_OPTIONAL_KEYS')
  assertNoDupes(LEGACY_SHARED_FALLBACK_KEYS, 'LEGACY_SHARED_FALLBACK_KEYS')
  assertNoDupes(LEGACY_PROFILE_KEYS.development, 'LEGACY_PROFILE_KEYS.development')
  assertNoDupes(LEGACY_PROFILE_KEYS.production, 'LEGACY_PROFILE_KEYS.production')
  assertNoDupes(
    WEBSITE_KEYS.map(([t]) => t),
    'WEBSITE_KEYS targets'
  )

  for (const key of EXTENSION_KEYS) {
    if (!key.startsWith('VITE_')) fail(`EXTENSION_KEYS entry must be VITE_*: ${key}`)
  }

  const websiteTargets = WEBSITE_KEYS.map(([t]) => t)
  for (const key of websiteTargets) {
    if (!key.startsWith('PUBLIC_')) fail(`WEBSITE_KEYS target must be PUBLIC_*: ${key}`)
  }

  for (const key of WORKER_KEYS) {
    if (key.startsWith('PUBLIC_') || key.startsWith('VITE_')) {
      fail(`WORKER_KEYS must not use PUBLIC_/VITE_ prefix: ${key}`)
    }
  }
}

/**
 * @param {string} raw
 * @param {string} sectionHeader
 * @returns {Record<string, string> | null}
 */
function parseWranglerVarsSection(raw, sectionHeader) {
  const escaped = sectionHeader.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const re = new RegExp(`${escaped}([\\s\\S]*?)(?=\\n\\[|\\n\\[\\[|$)`, 'u')
  const match = raw.match(re)
  if (!match) return null
  /** @type {Record<string, string>} */
  const vars = {}
  for (const line of match[1].split(/\r?\n/u)) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*"([^"]*)"/u)
    if (m) vars[m[1]] = m[2]
  }
  return vars
}

function checkWranglerDualSets() {
  const wranglerPath = process.env.ENV_CONTRACT_WRANGLER_PATH
    ? path.resolve(process.env.ENV_CONTRACT_WRANGLER_PATH)
    : defaultWranglerPath

  let raw
  try {
    raw = fs.readFileSync(wranglerPath, 'utf8')
  } catch (error) {
    fail(
      `wrangler.toml read failed: ${error instanceof Error ? error.message : String(error)}`
    )
    return
  }

  const topVars = parseWranglerVarsSection(raw, '[vars]')
  const prodVars = parseWranglerVarsSection(raw, '[env.production.vars]')
  if (!topVars) {
    fail('wrangler missing [vars]')
    return
  }
  if (!prodVars) {
    fail('wrangler missing [env.production.vars]')
    return
  }

  const topKeys = new Set(Object.keys(topVars))
  const prodKeys = new Set(Object.keys(prodVars))
  const productionOnlyAllow = new Set(WRANGLER_VAR_DIFF_ALLOWLIST.productionOnly)
  const valueDiffAllow = new Set(WRANGLER_VAR_DIFF_ALLOWLIST.valueDiffs)

  const onlyInProd = [...prodKeys].filter(k => !topKeys.has(k))
  const onlyInTop = [...topKeys].filter(k => !prodKeys.has(k))

  for (const key of onlyInProd) {
    if (!productionOnlyAllow.has(key)) {
      fail(`wrangler production-only var not allowlisted: ${key}`)
    }
  }
  for (const key of onlyInTop) {
    fail(`wrangler top-only var missing in production: ${key}`)
  }

  for (const key of [...topKeys].filter(k => prodKeys.has(k))) {
    if (topVars[key] === prodVars[key]) continue
    if (valueDiffAllow.has(key)) continue
    if (CRITICAL_WRANGLER_EQUAL_KEYS.includes(key)) {
      fail(`CRITICAL_WRANGLER_EQUAL_KEYS value mismatch: ${key}`)
      continue
    }
    fail(`wrangler var value differs (not allowlisted): ${key}`)
  }

  for (const key of CRITICAL_WRANGLER_EQUAL_KEYS) {
    if (!topKeys.has(key) || !prodKeys.has(key)) {
      fail(`CRITICAL_WRANGLER_EQUAL_KEYS missing in dual sets: ${key}`)
      continue
    }
    if (topVars[key] !== prodVars[key]) {
      fail(`CRITICAL_WRANGLER_EQUAL_KEYS value mismatch: ${key}`)
    }
  }

  const prodAllowlist = prodVars.REDIRECT_URI_ALLOWLIST || ''
  if (/localhost|127\.0\.0\.1/iu.test(prodAllowlist)) {
    fail('REDIRECT_URI_ALLOWLIST production value must not contain localhost')
  }

  // 供声明键检查复用（顶层 ∪ production，含 productionOnly allowlist 键）
  checkWranglerDualSets._wranglerVarKeys = new Set([...topKeys, ...prodKeys])
}

/**
 * 仅从指定 interface / type 体中提取 UPPER_SNAKE 属性名（避免扫到 WebSocket 等噪音）。
 * @param {string} text
 * @param {RegExp[]} blockPatterns
 * @returns {string[]}
 */
function extractEnvKeyNamesFromBlocks(text, blockPatterns) {
  /** @type {string[]} */
  const keys = []
  for (const blockRe of blockPatterns) {
    const blockMatch = text.match(blockRe)
    if (!blockMatch) continue
    const body = blockMatch[1] || ''
    const re = /^\s*(?:readonly\s+)?([A-Z][A-Z0-9_]*)\??\s*:/gmu
    let m
    while ((m = re.exec(body)) !== null) {
      keys.push(m[1])
    }
  }
  return [...new Set(keys)]
}

/**
 * 抽取 env.ts 中 `export type Env = …` 交叉类型内联体属性。
 * @param {string} text
 */
function extractEnvTsKeys(text) {
  return extractEnvKeyNamesFromBlocks(text, [
    /export\s+type\s+Env\s*=\s*[\s\S]*?&\s*\{([\s\S]*?)\n\}/u
  ])
}

/**
 * worker-configuration.d.ts：仅 Env / ProductionEnv / __BaseEnv_Env。
 * @param {string} text
 */
function extractWorkerConfigKeys(text) {
  return extractEnvKeyNamesFromBlocks(text, [
    /interface\s+__BaseEnv_Env\s*\{([\s\S]*?)\n\}/u,
    /interface\s+ProductionEnv\s*\{([\s\S]*?)\n\}/u,
    /interface\s+Env\s+(?:extends\s+[^{]+)?\{([\s\S]*?)\n\}/u
  ])
}

function checkWorkerDeclaredKeys() {
  const wranglerVarKeys =
    checkWranglerDualSets._wranglerVarKeys || new Set()

  let envTsText
  try {
    envTsText = fs.readFileSync(envTsPath, 'utf8')
  } catch (error) {
    fail(`env.ts read failed: ${error instanceof Error ? error.message : String(error)}`)
    return
  }

  /** @type {Set<string>} */
  const declared = new Set(extractEnvTsKeys(envTsText))

  if (fs.existsSync(workerConfigDtsPath)) {
    const dts = fs.readFileSync(workerConfigDtsPath, 'utf8')
    for (const key of extractWorkerConfigKeys(dts)) declared.add(key)
  } else {
    notes.push('skip worker-configuration.d.ts (file missing)')
  }

  const allowedDeclared = new Set([
    ...WORKER_KEYS,
    ...WORKER_OPTIONAL_KEYS,
    ...LEGACY_ENV_KEYS,
    ...wranglerVarKeys,
    ...WORKER_BINDINGS,
    'NODE_ENV'
  ])

  const declaredExtra = [...declared].filter(k => !allowedDeclared.has(k)).sort()
  if (declaredExtra.length) {
    fail(`Worker declared keys not in allowed union: ${declaredExtra.join(', ')}`)
  }

  const requiredInDeclared = new Set([...WORKER_KEYS, ...WORKER_OPTIONAL_KEYS])
  const declaredOrWrangler = new Set([...declared, ...wranglerVarKeys])
  const missing = [...requiredInDeclared].filter(k => !declaredOrWrangler.has(k)).sort()
  if (missing.length) {
    fail(
      `WORKER_KEYS/OPTIONAL missing from declared∪wrangler vars: ${missing.join(', ')}`
    )
  }
}

function renderManifestTable() {
  const lines = [
    '| Key | Category | Targets | Authority |',
    '| --- | --- | --- | --- |'
  ]
  for (const row of KEY_META) {
    lines.push(
      `| \`${row.key}\` | ${row.category} | ${row.targets} | ${row.authority} |`
    )
  }
  return `${lines.join('\n')}\n`
}

function checkOrWriteDocsTable() {
  let text
  try {
    text = fs.readFileSync(docsEnvPath, 'utf8')
  } catch (error) {
    fail(`ENVIRONMENT.md read failed: ${error instanceof Error ? error.message : String(error)}`)
    return
  }

  if (!text.includes(MARKER_START) || !text.includes(MARKER_END)) {
    fail('docs/ENVIRONMENT.md missing env-manifest:start/end markers')
    return
  }

  const generated = renderManifestTable()
  const startIdx = text.indexOf(MARKER_START)
  const endIdx = text.indexOf(MARKER_END)
  if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
    fail('docs/ENVIRONMENT.md env-manifest markers malformed')
    return
  }

  const before = text.slice(0, startIdx + MARKER_START.length)
  const after = text.slice(endIdx)
  const currentInner = text.slice(startIdx + MARKER_START.length, endIdx)
  const expectedBlock = `\n\n${generated}\n`

  if (writeDocs) {
    const next = `${before}${expectedBlock}${after}`
    fs.writeFileSync(docsEnvPath, next, 'utf8')
    notes.push('wrote docs/ENVIRONMENT.md env-manifest table')
    return
  }

  if (currentInner !== expectedBlock) {
    fail(
      'docs/ENVIRONMENT.md env-manifest table out of sync (run bun run env:docs:sync)'
    )
  }
}

function checkEnvExample() {
  if (!fs.existsSync(exampleEnvPath)) {
    fail('.env.example missing')
    return
  }
  const text = fs.readFileSync(exampleEnvPath, 'utf8')
  for (const key of EXAMPLE_SOURCE_KEYS) {
    const re = new RegExp(`^${key}=`, 'mu')
    if (!re.test(text)) fail(`.env.example missing KEY= line: ${key}`)
  }

  for (const needle of ['sb_secret_', 'whsec_', 'dodo_live_', 'dodo_test_']) {
    if (text.includes(needle)) {
      fail(`.env.example must not contain substring: ${needle}`)
    }
  }
}

function main() {
  console.log(`Env contract check${writeDocs ? ' (--write-docs)' : ''}`)

  checkTableSelfConsistency()
  checkWranglerDualSets()
  checkWorkerDeclaredKeys()
  checkOrWriteDocsTable()
  checkEnvExample()

  for (const note of notes) console.log(`NOTE ${note}`)

  if (errors.length) {
    for (const err of errors) console.log(`ERR ${err}`)
    process.exit(1)
  }

  console.log('OK env contract')
  process.exit(0)
}

main()
