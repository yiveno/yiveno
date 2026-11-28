#!/usr/bin/env bun
/**
 * Worker 生产部署前置：对账 wrangler secret list（只取名称，永不打印值）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  PRODUCTION_SECRET_GROUPS,
  PRODUCTION_SECRET_NAME_SET
} from '../../scripts/env-manifest.mjs'

const CORE_REQUIRED = PRODUCTION_SECRET_GROUPS.core
const DODO_GROUP = PRODUCTION_SECRET_GROUPS.dodo
const DODO_FOUNDING = PRODUCTION_SECRET_GROUPS.dodoFounding
const OPTIONAL = PRODUCTION_SECRET_GROUPS.optional

const workerRoot = path.resolve(import.meta.dirname, '..')
const wranglerTomlPath = path.join(workerRoot, 'wrangler.toml')

function readProductionDodoEnvironment() {
  try {
    const raw = fs.readFileSync(wranglerTomlPath, 'utf8')
    // 仅扫 [env.production.vars] 段内的 DODO_PAYMENTS_ENVIRONMENT
    const prodVarsMatch = raw.match(/\[env\.production\.vars\]([\s\S]*?)(?=\n\[|\n\[\[|$)/u)
    if (!prodVarsMatch) return ''
    const block = prodVarsMatch[1]
    const envMatch = block.match(/^\s*DODO_PAYMENTS_ENVIRONMENT\s*=\s*"([^"]*)"/mu)
    return envMatch ? envMatch[1].trim() : ''
  } catch {
    return ''
  }
}

function parseSecretNames(stdout) {
  const text = stdout.trim()
  if (!text) return []

  // wrangler 可能输出 JSON 数组，或表格
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => (typeof item === 'string' ? item : item?.name))
          .filter(name => typeof name === 'string' && name.length > 0)
      }
    } catch {
      // fall through
    }
  }

  /** @type {string[]} */
  const names = []
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('─') || trimmed.startsWith('┌') || trimmed.startsWith('└'))
      continue
    if (/^name\b/iu.test(trimmed) || /^Secret Name/iu.test(trimmed)) continue
    // 表格行：│ NAME │ 或纯名称
    const cell = trimmed.replace(/^\│\s*/u, '').replace(/\s*│.*$/u, '').trim()
    if (!cell || cell === 'Type' || cell === 'digest') continue
    // 跳过明显非 secret 名的装饰
    if (/^[-=+|]+$/u.test(cell)) continue
    if (/^[A-Z][A-Z0-9_]*$/u.test(cell)) names.push(cell)
  }
  return [...new Set(names)]
}

function main() {
  console.log('Worker prod secrets check (names only)')

  const result = spawnSync(
    'bunx',
    ['wrangler', 'secret', 'list', '--env', 'production'],
    {
      cwd: workerRoot,
      encoding: 'utf8',
      env: process.env
    }
  )

  if (result.error) {
    console.log(`ERR secret list failed: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    const reason = (result.stderr || result.stdout || 'unknown error').trim().split('\n')[0]
    console.log(`ERR secret list failed: ${reason || `exit ${result.status}`}`)
    process.exit(1)
  }

  const present = new Set(parseSecretNames(result.stdout || ''))
  let failed = false

  const missingCore = CORE_REQUIRED.filter(name => !present.has(name))
  if (missingCore.length) {
    console.log(`ERR core secrets missing: ${missingCore.join(', ')}`)
    failed = true
  } else {
    console.log(`OK core secrets: ${CORE_REQUIRED.join(', ')}`)
  }

  const dodoPresent = DODO_GROUP.filter(name => present.has(name))
  const dodoMissing = DODO_GROUP.filter(name => !present.has(name))
  const dodoEnv = readProductionDodoEnvironment()

  if (dodoPresent.length > 0 && dodoMissing.length > 0) {
    console.log(
      `ERR dodo group partial: present=${dodoPresent.join(', ')}; missing=${dodoMissing.join(', ')}`
    )
    failed = true
  } else if (dodoPresent.length === 0) {
    if (dodoEnv === 'live_mode') {
      console.log(`ERR dodo group missing under live_mode: ${DODO_GROUP.join(', ')}`)
      failed = true
    } else {
      console.log(`WARN dodo group all missing: ${DODO_GROUP.join(', ')}`)
    }
  } else {
    console.log(`OK dodo group: ${DODO_GROUP.join(', ')}`)
  }

  const foundingPresent = DODO_FOUNDING.filter(name => present.has(name))
  const foundingMissing = DODO_FOUNDING.filter(name => !present.has(name))
  if (foundingPresent.length > 0 && foundingMissing.length > 0) {
    console.log(
      `ERR founding group partial: present=${foundingPresent.join(', ')}; missing=${foundingMissing.join(', ')}`
    )
    failed = true
  } else if (foundingPresent.length === DODO_FOUNDING.length) {
    console.log(`OK founding group: ${DODO_FOUNDING.join(', ')}`)
  } else {
    console.log(`OK founding group absent (optional)`)
  }

  // EVAL_MINT_TOKEN：评测 schedule 需要；缺失只 WARN
  if (!present.has('EVAL_MINT_TOKEN')) {
    console.log('WARN EVAL_MINT_TOKEN missing (recall-real-eval schedule needs it)')
  } else {
    console.log('OK EVAL_MINT_TOKEN present')
  }

  for (const name of OPTIONAL) {
    if (name === 'EVAL_MINT_TOKEN') continue
    if (!present.has(name)) {
      // 其它 optional 静默；未知组在下方 WARN
    }
  }

  const unknown = [...present].filter(name => !PRODUCTION_SECRET_NAME_SET.has(name)).sort()
  if (unknown.length) {
    console.log(`WARN unknown secrets (not in manifest production set): ${unknown.join(', ')}`)
  }

  process.exit(failed ? 1 : 0)
}

main()
