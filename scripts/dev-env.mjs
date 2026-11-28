#!/usr/bin/env bun
/**
 * 环境同步 / 硬门检查。
 *
 * 调用方须使用 `bun --no-env-file`（见根 / website / extension / worker package.json），
 * 否则 Bun 会自动灌入 `.env.development.local` 等，经 process.env 合并后污染 production profile。
 * Pages 后台机密仍在 process.env，不受 --no-env-file 影响。
 *
 * 生成文件为纯输出：不从 worker/.dev.vars 回填源 env。
 * 本地调参写 worker/.dev.vars.local（仅 WORKER_OPTIONAL_KEYS）。
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import {
  SHARED_OPTIONAL_KEYS,
  EXTENSION_KEYS,
  WORKER_KEYS,
  WEBSITE_KEYS,
  LEGACY_SHARED_FALLBACK_KEYS,
  LEGACY_PROFILE_KEYS,
  PROCESS_ENV_SOURCE_KEYS,
  WORKER_OPTIONAL_KEYS,
  PRODUCTION_SECRET_GROUPS
} from './env-manifest.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..')
const envSharedPath = path.join(repoRoot, '.env.shared.local')
const envLegacyDevPath = path.join(repoRoot, '.env.local')
const envDevelopmentPath = path.join(repoRoot, '.env.development.local')
const envProductionPath = path.join(repoRoot, '.env.production.local')
const workerEnvPath = path.join(repoRoot, 'worker', '.dev.vars')
const workerEnvLocalPath = path.join(repoRoot, 'worker', '.dev.vars.local')
const websiteEnvPath = path.join(repoRoot, 'website', '.env')
const extensionRuntimeDir = path.join(repoRoot, '.env.runtime')
const wranglerTomlPath = path.join(repoRoot, 'worker', 'wrangler.toml')

const PROFILES = /** @type {const} */ (['development', 'production'])
const VALID_TARGETS = /** @type {const} */ (['all', 'extension', 'website', 'worker'])

const PROFILE_DEFAULTS = {
  development: {
    WEBSITE_URL: 'http://localhost:3001',
    VITE_WEBSITE_URL: 'http://localhost:3001',
    VITE_API_BASE_URL: 'http://localhost:8787',
    VITE_CLOUDFLARE_WORKER_URL: 'http://localhost:8787',
    PUBLIC_API_BASE_URL: 'http://localhost:8787',
    DODO_PAYMENTS_ENVIRONMENT: 'test_mode',
    VITE_RUNTIME_ENV: 'dev'
  },
  production: {
    WEBSITE_URL: 'https://yiveno.com',
    VITE_WEBSITE_URL: 'https://yiveno.com',
    VITE_API_BASE_URL: 'https://api.yiveno.com',
    VITE_CLOUDFLARE_WORKER_URL: 'https://api.yiveno.com',
    PUBLIC_API_BASE_URL: 'https://api.yiveno.com',
    VITE_RUNTIME_ENV: 'prod'
  }
}

const SOURCE_FILE_MAP = {
  development: envDevelopmentPath,
  production: envProductionPath
}

const WORKER_OPTIONAL_KEY_SET = new Set(WORKER_OPTIONAL_KEYS)
const WORKER_KEY_SET = new Set(WORKER_KEYS)

/**
 * 判定 Supabase key 角色。
 * @param {string | undefined} value
 * @returns {'publishable' | 'anon' | 'service_role' | 'invalid'}
 */
function classifySupabaseKeyRole(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return 'invalid'
  if (raw.startsWith('sb_publishable_')) return 'publishable'
  if (raw.startsWith('sb_secret_')) return 'service_role'

  const parts = raw.split('.')
  if (parts.length !== 3) return 'invalid'

  try {
    let b64 = parts[1].replace(/-/gu, '+').replace(/_/gu, '/')
    while (b64.length % 4 !== 0) b64 += '='
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
    if (payload?.role === 'anon') return 'anon'
    if (payload?.role === 'service_role') return 'service_role'
    return 'invalid'
  } catch {
    return 'invalid'
  }
}

function isPublicSupabaseRole(role) {
  return role === 'publishable' || role === 'anon'
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const options = {
    command: 'sync',
    profile: 'development',
    target: 'all',
    quiet: false
  }

  for (const arg of args) {
    if (arg === 'sync' || arg === 'check') {
      options.command = arg
      continue
    }
    if (arg.startsWith('--profile=')) {
      options.profile = arg.split('=')[1] || options.profile
      continue
    }
    if (arg.startsWith('--target=')) {
      options.target = arg.split('=')[1] || options.target
      continue
    }
    if (arg === '--quiet') {
      options.quiet = true
    }
  }

  if (!PROFILES.includes(/** @type {'development' | 'production'} */ (options.profile))) {
    throw new Error(`Unsupported profile: ${options.profile}`)
  }

  if (!VALID_TARGETS.includes(/** @type {(typeof VALID_TARGETS)[number]} */ (options.target))) {
    throw new Error(`Unsupported target: ${options.target}`)
  }

  return /** @type {{command:'sync'|'check', profile:'development'|'production', target:(typeof VALID_TARGETS)[number], quiet:boolean}} */ (
    options
  )
}

async function readEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return parseEnv(raw)
  } catch {
    return {}
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function parseEnv(text) {
  /** @type {Record<string, string>} */
  const result = {}
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index < 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim()
    result[key] = unquote(value)
  }
  return result
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    const inner = value.slice(1, -1)
    return value.startsWith('"') ? inner.replace(/\\"/gu, '"') : inner
  }
  return value
}

function serializeValue(value) {
  return JSON.stringify(value ?? '')
}

function setIfMissing(record, key, value) {
  if (!record[key] && value) {
    record[key] = value
  }
}

function getProfileSourcePath(profile) {
  return SOURCE_FILE_MAP[profile]
}

/**
 * 解析 wrangler.toml 某 vars 段内的字符串键值（只取 "…" 字面量）。
 * @param {string} raw
 * @param {string} sectionHeader 如 `[vars]` 或 `[env.production.vars]`
 * @returns {Record<string, string> | null} 段不存在返回 null（fail-closed 由调用方处理）
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

/**
 * @returns {Promise<{ topVars: Record<string, string>, productionVars: Record<string, string> }>}
 */
async function loadWranglerAuthority() {
  let raw
  try {
    raw = await fs.readFile(wranglerTomlPath, 'utf8')
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`wrangler.toml read failed: ${reason}`)
  }
  const topVars = parseWranglerVarsSection(raw, '[vars]')
  const productionVars = parseWranglerVarsSection(raw, '[env.production.vars]')
  if (!topVars) throw new Error('wrangler.toml missing [vars] section')
  if (!productionVars) throw new Error('wrangler.toml missing [env.production.vars] section')
  return { topVars, productionVars }
}

/**
 * 从 process.env 拾取白名单键；仅非空字符串覆盖文件值（空串 / 未设忽略）。
 * 本地无相关环境变量时结果与只读文件一致。
 */
function pickProcessEnvOverrides() {
  /** @type {Record<string, string>} */
  const result = {}
  for (const key of PROCESS_ENV_SOURCE_KEYS) {
    const raw = process.env[key]
    if (typeof raw !== 'string') continue
    const value = raw.trim()
    if (!value) continue
    result[key] = value
  }
  return result
}

/**
 * @param {'development' | 'production'} profile
 * @param {{ applyProcessEnv?: boolean }} [options]
 */
async function loadSourceEnv(profile, options = {}) {
  const applyProcessEnv = options.applyProcessEnv !== false
  const legacyEnv = await readEnvFile(envLegacyDevPath)
  const sharedEnv = {
    ...pickEnv(legacyEnv, LEGACY_SHARED_FALLBACK_KEYS),
    ...(await readEnvFile(envSharedPath))
  }
  const profileEnv = {
    ...pickEnv(legacyEnv, LEGACY_PROFILE_KEYS[profile]),
    ...(await readEnvFile(getProfileSourcePath(profile)))
  }
  // 文件在前，process.env 非空覆盖——供 Pages Git 构建无本地 env 文件时注入
  return {
    ...sharedEnv,
    ...profileEnv,
    ...(applyProcessEnv ? pickProcessEnvOverrides() : {})
  }
}

function pickEnv(env, keys) {
  /** @type {Record<string, string>} */
  const result = {}
  for (const key of keys) {
    if (env[key]) result[key] = env[key]
  }
  return result
}

/**
 * 纯源 env 归一化（不读 worker/.dev.vars）。
 * @param {'development' | 'production'} profile
 * @param {Record<string, string>} sourceEnv
 * @param {{ productionDodoEnvironment?: string }} [wranglerHints]
 */
function normalizeEnv(profile, sourceEnv, wranglerHints = {}) {
  const normalized = { ...sourceEnv }
  const defaults = PROFILE_DEFAULTS[profile]

  setIfMissing(normalized, 'WEBSITE_URL', defaults.WEBSITE_URL)
  setIfMissing(normalized, 'VITE_WEBSITE_URL', normalized.WEBSITE_URL || defaults.VITE_WEBSITE_URL)
  setIfMissing(
    normalized,
    'VITE_API_BASE_URL',
    sourceEnv.VITE_CLOUDFLARE_WORKER_URL || defaults.VITE_API_BASE_URL
  )
  setIfMissing(
    normalized,
    'VITE_CLOUDFLARE_WORKER_URL',
    normalized.VITE_API_BASE_URL || defaults.VITE_CLOUDFLARE_WORKER_URL
  )
  setIfMissing(
    normalized,
    'PUBLIC_API_BASE_URL',
    normalized.VITE_API_BASE_URL || defaults.PUBLIC_API_BASE_URL
  )

  // 兼容 Pages 旧机密名：PUBLIC_SUPABASE_* 可作为 SUPABASE_* 别名来源
  setIfMissing(normalized, 'SUPABASE_URL', normalized.PUBLIC_SUPABASE_URL)
  setIfMissing(normalized, 'SUPABASE_ANON_KEY', normalized.PUBLIC_SUPABASE_ANON_KEY)

  setIfMissing(normalized, 'VITE_SUPABASE_URL', normalized.SUPABASE_URL)
  setIfMissing(normalized, 'VITE_SUPABASE_ANON_KEY', normalized.SUPABASE_ANON_KEY)

  if (profile === 'development') {
    setIfMissing(normalized, 'DODO_PAYMENTS_ENVIRONMENT', defaults.DODO_PAYMENTS_ENVIRONMENT)
  } else {
    const fromWrangler = (wranglerHints.productionDodoEnvironment || '').trim()
    setIfMissing(normalized, 'DODO_PAYMENTS_ENVIRONMENT', fromWrangler || 'test_mode')
  }

  normalized.VITE_RUNTIME_ENV = defaults.VITE_RUNTIME_ENV

  for (const key of SHARED_OPTIONAL_KEYS) {
    if (!(key in normalized)) normalized[key] = ''
  }

  return normalized
}

function renderEnvFile(title, keys, env, includeEmpty = false) {
  const lines = ['# Auto-generated by scripts/dev-env.mjs', `# ${title}`]
  for (const key of keys) {
    const value = env[key]
    if (!includeEmpty && !value) continue
    lines.push(`${key}=${serializeValue(value)}`)
  }
  return `${lines.join('\n')}\n`
}

function buildExtensionEnvFile(profile, env) {
  return renderEnvFile(`Extension Runtime (${profile})`, EXTENSION_KEYS, env)
}

/**
 * @param {Record<string, string>} env 源归一化 env（WORKER_KEYS）
 * @param {Record<string, string>} optionalOverlay 仅 WORKER_OPTIONAL_KEYS
 */
function buildWorkerEnvFile(env, optionalOverlay = {}) {
  /** @type {Record<string, string>} */
  const output = {}
  for (const key of WORKER_KEYS) {
    if (env[key]) output[key] = env[key]
  }
  for (const key of WORKER_OPTIONAL_KEYS) {
    if (optionalOverlay[key]) output[key] = optionalOverlay[key]
  }
  const orderedKeys = [...WORKER_KEYS, ...WORKER_OPTIONAL_KEYS.filter(k => output[k])]
  return renderEnvFile('Worker Runtime (development)', orderedKeys, output)
}

function buildWebsiteEnvFile(profile, env) {
  /** @type {Record<string,string>} */
  const websiteEnv = {}
  for (const [targetKey, sourceKey] of WEBSITE_KEYS) {
    if (env[sourceKey]) websiteEnv[targetKey] = env[sourceKey]
  }
  return renderEnvFile(
    `Website Runtime (${profile})`,
    WEBSITE_KEYS.map(([key]) => key),
    websiteEnv
  )
}

/**
 * @param {string} filePath
 * @param {string} content
 * @param {{ mode?: number }} [options]
 */
async function writeFileIfChanged(filePath, content, options = {}) {
  let changed = false
  try {
    const current = await fs.readFile(filePath, 'utf8')
    if (current !== content) {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, content, 'utf8')
      changed = true
    }
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, 'utf8')
    changed = true
  }

  if (typeof options.mode === 'number') {
    await fs.chmod(filePath, options.mode)
  }

  return changed
}

function isLocalHttp(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/u.test(url)
}

function isRemoteHttps(url) {
  return /^https:\/\//u.test(url) && !/localhost|127\.0\.0\.1/u.test(url)
}

/**
 * 按 target 返回必需键。
 * @param {string} target
 */
function getRequiredKeysForTarget(target) {
  if (target === 'website' || target === 'extension') {
    return ['SUPABASE_URL', 'SUPABASE_ANON_KEY']
  }
  return ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
}

/**
 * @param {Record<string, string>} env
 * @param {{ target?: string }} [options]
 */
function getMissing(env, options = {}) {
  const target = options.target || 'all'
  const requiredKeys = getRequiredKeysForTarget(target)
  return {
    required: requiredKeys.filter(key => !env[key]),
    dodo: [...PRODUCTION_SECRET_GROUPS.dodo].filter(key => !env[key])
  }
}

function getChecks(profile, env) {
  if (profile === 'development') {
    return [
      ['WEBSITE_URL', env.WEBSITE_URL, isLocalHttp(env.WEBSITE_URL || '')],
      ['VITE_WEBSITE_URL', env.VITE_WEBSITE_URL, isLocalHttp(env.VITE_WEBSITE_URL || '')],
      ['VITE_API_BASE_URL', env.VITE_API_BASE_URL, isLocalHttp(env.VITE_API_BASE_URL || '')],
      ['SUPABASE_URL', env.SUPABASE_URL, isRemoteHttps(env.SUPABASE_URL || '')],
      ['VITE_SUPABASE_URL', env.VITE_SUPABASE_URL, isRemoteHttps(env.VITE_SUPABASE_URL || '')]
    ]
  }

  const publicSupabaseUrl = (env.PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '').trim()
  const publicSupabaseAnonKey = (env.PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '').trim()
  const turnstileSiteKey = (env.PUBLIC_TURNSTILE_SITE_KEY || '').trim()
  return [
    ['WEBSITE_URL', env.WEBSITE_URL, isRemoteHttps(env.WEBSITE_URL || '')],
    ['VITE_WEBSITE_URL', env.VITE_WEBSITE_URL, isRemoteHttps(env.VITE_WEBSITE_URL || '')],
    ['VITE_API_BASE_URL', env.VITE_API_BASE_URL, isRemoteHttps(env.VITE_API_BASE_URL || '')],
    ['SUPABASE_URL', env.SUPABASE_URL, isRemoteHttps(env.SUPABASE_URL || '')],
    ['VITE_SUPABASE_URL', env.VITE_SUPABASE_URL, isRemoteHttps(env.VITE_SUPABASE_URL || '')],
    [
      'PUBLIC_SUPABASE_URL',
      publicSupabaseUrl ? '(set)' : '(missing)',
      publicSupabaseUrl.length > 0 && isRemoteHttps(publicSupabaseUrl)
    ],
    [
      'PUBLIC_SUPABASE_ANON_KEY',
      publicSupabaseAnonKey ? '(set)' : '(missing)',
      publicSupabaseAnonKey.length > 0
    ],
    [
      'PUBLIC_TURNSTILE_SITE_KEY',
      turnstileSiteKey ? '(set)' : '(missing)',
      turnstileSiteKey.length > 0
    ]
  ]
}

function hasUnsafeProductionValues(env) {
  const candidates = [
    env.WEBSITE_URL,
    env.VITE_WEBSITE_URL,
    env.VITE_API_BASE_URL,
    env.VITE_CLOUDFLARE_WORKER_URL
  ].filter(Boolean)
  return candidates.some(value => /localhost|127\.0\.0\.1/u.test(value))
}

/**
 * 校验覆盖层：仅允许 WORKER_OPTIONAL_KEYS；WORKER_KEYS / 未知键 → ERR（只列键名）。
 * @param {Record<string, string>} overlay
 * @returns {{ ok: boolean, badKeys: string[] }}
 */
function validateWorkerOptionalOverlay(overlay) {
  const badKeys = Object.keys(overlay).filter(
    key => WORKER_KEY_SET.has(key) || !WORKER_OPTIONAL_KEY_SET.has(key)
  )
  return { ok: badKeys.length === 0, badKeys: badKeys.sort() }
}

/**
 * 公开键角色门 / Turnstile / Dodo / Supabase wrangler 权威。
 * 只输出键名与结论，绝不打印值。
 * @param {Record<string, string>} env
 * @param {{ target: string, profile: string, wranglerTopVars?: Record<string, string> | null, wranglerError?: string | null }} options
 * @returns {boolean}
 */
function printSecurityGates(env, options) {
  let ok = true
  const target = options.target
  const needsWorkerSecrets = target === 'worker' || target === 'all'

  const anonRole = classifySupabaseKeyRole(env.SUPABASE_ANON_KEY)
  if (env.SUPABASE_ANON_KEY) {
    if (isPublicSupabaseRole(anonRole)) {
      console.log(`OK  SUPABASE_ANON_KEY role=${anonRole}`)
    } else {
      console.log(`ERR SUPABASE_ANON_KEY invalid role=${anonRole}`)
      ok = false
    }
  }

  const viteAnonRole = classifySupabaseKeyRole(env.VITE_SUPABASE_ANON_KEY)
  if (env.VITE_SUPABASE_ANON_KEY) {
    if (isPublicSupabaseRole(viteAnonRole)) {
      console.log(`OK  VITE_SUPABASE_ANON_KEY role=${viteAnonRole}`)
    } else {
      console.log(`ERR VITE_SUPABASE_ANON_KEY invalid role=${viteAnonRole}`)
      ok = false
    }
  }

  if (needsWorkerSecrets && env.SUPABASE_SERVICE_ROLE_KEY) {
    const serviceRole = classifySupabaseKeyRole(env.SUPABASE_SERVICE_ROLE_KEY)
    if (serviceRole !== 'service_role') {
      console.log(`ERR SUPABASE_SERVICE_ROLE_KEY invalid role=${serviceRole}`)
      ok = false
    } else if (
      env.SUPABASE_ANON_KEY &&
      env.SUPABASE_SERVICE_ROLE_KEY === env.SUPABASE_ANON_KEY
    ) {
      console.log('ERR SUPABASE_SERVICE_ROLE_KEY must not equal SUPABASE_ANON_KEY')
      ok = false
    } else {
      console.log('OK  SUPABASE_SERVICE_ROLE_KEY role=service_role')
    }
  }

  const siteKey = (env.PUBLIC_TURNSTILE_SITE_KEY || '').trim()
  const turnstileSecret = (env.TURNSTILE_SECRET_KEY || '').trim()
  if (siteKey && turnstileSecret && siteKey === turnstileSecret) {
    console.log('ERR PUBLIC_TURNSTILE_SITE_KEY must not equal TURNSTILE_SECRET_KEY')
    ok = false
  }

  // Supabase 权威门：合并后值须匹配 wrangler [vars]（只报键名）
  if (options.wranglerError) {
    console.log(`ERR wrangler authority: ${options.wranglerError}`)
    ok = false
  } else if (options.wranglerTopVars) {
    for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY']) {
      const expected = (options.wranglerTopVars[key] || '').trim()
      const actual = (env[key] || '').trim()
      if (actual && expected && actual !== expected) {
        console.log(`ERR ${key} does not match wrangler authority`)
        ok = false
      }
    }
  }

  // Dodo 门（target=worker|all）
  if (needsWorkerSecrets) {
    const dodoEnv = (env.DODO_PAYMENTS_ENVIRONMENT || '').trim()
    if (dodoEnv && dodoEnv !== 'test_mode' && dodoEnv !== 'live_mode') {
      console.log('ERR DODO_PAYMENTS_ENVIRONMENT must be test_mode or live_mode')
      ok = false
    }

    const apiKey = (env.DODO_PAYMENTS_API_KEY || '').trim()
    if (apiKey) {
      const expectedPrefix = dodoEnv === 'live_mode' ? 'dodo_live_' : 'dodo_test_'
      if (apiKey.startsWith('dodo_live_') || apiKey.startsWith('dodo_test_')) {
        if (!apiKey.startsWith(expectedPrefix)) {
          console.log(
            `ERR DODO_PAYMENTS_API_KEY prefix does not match DODO_PAYMENTS_ENVIRONMENT (expected ${expectedPrefix})`
          )
          ok = false
        }
      } else if (dodoEnv === 'live_mode') {
        // 无标签：live_mode 必须挡门（expected dodo_live_）；test_mode 仍 WARN
        console.log(
          `ERR DODO_PAYMENTS_API_KEY unexpected prefix family (expected ${expectedPrefix})`
        )
        ok = false
      } else {
        // 非 dodo_test_/dodo_live_ 族：test_mode 不挡门，但提示（本地遗留格式）
        console.log(
          `WARN DODO_PAYMENTS_API_KEY unexpected prefix family (expected ${expectedPrefix})`
        )
      }
    }

    const webhookKey = (env.DODO_PAYMENTS_WEBHOOK_KEY || '').trim()
    if (webhookKey && !webhookKey.startsWith('whsec_')) {
      console.log('ERR DODO_PAYMENTS_WEBHOOK_KEY must start with whsec_')
      ok = false
    }

    const dodoGroup = [...PRODUCTION_SECRET_GROUPS.dodo]
    const dodoMissing = dodoGroup.filter(key => !(env[key] || '').trim())
    if (dodoEnv === 'live_mode' && dodoMissing.length) {
      console.log(`ERR live_mode dodo missing: ${dodoMissing.join(', ')}`)
      ok = false
    }

    const founding = [...PRODUCTION_SECRET_GROUPS.dodoFounding]
    const foundingPresent = founding.filter(key => (env[key] || '').trim())
    const foundingMissing = founding.filter(key => !(env[key] || '').trim())
    if (foundingPresent.length > 0 && foundingMissing.length > 0) {
      console.log(
        `ERR founding product ids partial: present=${foundingPresent.join(', ')}; missing=${foundingMissing.join(', ')}`
      )
      ok = false
    }
    if ((env.BILLING_FOUNDING_ENABLED || '').trim() === 'true' && foundingMissing.length) {
      console.log(`ERR BILLING_FOUNDING_ENABLED=true requires: ${founding.join(', ')}`)
      ok = false
    }
  }

  return ok
}

function printProcessEnvOverrides(overrideKeys) {
  if (!overrideKeys.length) return
  console.log(`process.env overrides: ${overrideKeys.join(', ')}`)
}

function printCheck(profile, env, options = {}) {
  const target = options.target || 'all'
  const missing = getMissing(env, { target })
  const targetLabel = target === 'all' ? '' : `, target=${target}`
  console.log(`Env Check (${profile}${targetLabel})`)

  for (const [key, value, ok] of getChecks(profile, env)) {
    console.log(`${ok ? 'OK ' : 'ERR'} ${key}=${value || '(missing)'}`)
  }

  const securityOk = printSecurityGates(env, {
    target,
    profile,
    wranglerTopVars: options.wranglerTopVars,
    wranglerError: options.wranglerError
  })

  if (profile === 'production' && hasUnsafeProductionValues(env)) {
    console.log('ERR production profile contains localhost / 127.0.0.1')
  }

  if (missing.required.length) console.log(`ERR required missing: ${missing.required.join(', ')}`)
  else if (target === 'website' || target === 'extension')
    console.log(`OK required ${target} secrets complete`)
  else console.log('OK required worker secrets complete')

  // test_mode 且 dodo 组全缺 → 保持 WARN；部分缺仍 WARN（live 缺由 security 门 ERR）
  if (missing.dodo.length) console.log(`WARN dodo missing: ${missing.dodo.join(', ')}`)
  else console.log('OK dodo credentials complete')

  return (
    securityOk &&
    missing.required.length === 0 &&
    !getChecks(profile, env).some(([, , ok]) => !ok) &&
    !(profile === 'production' && hasUnsafeProductionValues(env))
  )
}

/**
 * check 只读：用「仅文件源」渲染期望内容，与磁盘比对。
 * @returns {Promise<boolean>}
 */
async function verifyGeneratedFiles(options, fileOnlyNormalized, optionalOverlay) {
  const hasLocalSources =
    (await pathExists(envSharedPath)) ||
    (await pathExists(getProfileSourcePath(options.profile))) ||
    (await pathExists(envLegacyDevPath))

  if (!hasLocalSources) {
    console.log('OK generated file check skipped (no local env source files)')
    return true
  }

  /** @type {Array<{ rel: string, path: string, expected: string }>} */
  const comparisons = []
  const targets = new Set(
    options.target === 'all'
      ? ['extension', 'website', ...(options.profile === 'development' ? ['worker'] : [])]
      : [options.target]
  )

  if (targets.has('extension')) {
    const extensionEnvPath = path.join(extensionRuntimeDir, `.env.${options.profile}`)
    comparisons.push({
      rel: path.relative(repoRoot, extensionEnvPath),
      path: extensionEnvPath,
      expected: buildExtensionEnvFile(options.profile, fileOnlyNormalized)
    })
  }

  if (targets.has('worker') && options.profile === 'development') {
    comparisons.push({
      rel: 'worker/.dev.vars',
      path: workerEnvPath,
      expected: buildWorkerEnvFile(fileOnlyNormalized, optionalOverlay)
    })
  }

  if (targets.has('website')) {
    comparisons.push({
      rel: 'website/.env',
      path: websiteEnvPath,
      expected: buildWebsiteEnvFile(options.profile, fileOnlyNormalized)
    })
  }

  let ok = true
  for (const item of comparisons) {
    try {
      const current = await fs.readFile(item.path, 'utf8')
      if (current !== item.expected) {
        console.log(`ERR generated file stale: ${item.rel} (run env:sync first)`)
        ok = false
      }
    } catch {
      console.log(`ERR generated file stale: ${item.rel} (missing; run env:sync first)`)
      ok = false
    }
  }

  if (ok && comparisons.length) {
    console.log(`OK generated files match (${comparisons.map(item => item.rel).join(', ')})`)
  } else if (ok) {
    console.log('OK generated file check skipped (no applicable files for target/profile)')
  }

  return ok
}

async function sync(options) {
  let wranglerHints = {}
  try {
    const { productionVars } = await loadWranglerAuthority()
    wranglerHints = {
      productionDodoEnvironment: productionVars.DODO_PAYMENTS_ENVIRONMENT || ''
    }
  } catch {
    // sync 时 wrangler 失败不阻断写入；check 会 fail-closed
  }

  const sourceEnv = await loadSourceEnv(options.profile)
  const normalizedEnv = normalizeEnv(options.profile, sourceEnv, wranglerHints)
  const optionalOverlay =
    options.profile === 'development' && (await pathExists(workerEnvLocalPath))
      ? await readEnvFile(workerEnvLocalPath)
      : {}

  const targets = new Set(
    options.target === 'all'
      ? ['extension', 'website', ...(options.profile === 'development' ? ['worker'] : [])]
      : [options.target]
  )

  const changed = []

  if (targets.has('extension')) {
    const extensionEnvPath = path.join(extensionRuntimeDir, `.env.${options.profile}`)
    const updated = await writeFileIfChanged(
      extensionEnvPath,
      buildExtensionEnvFile(options.profile, normalizedEnv)
    )
    if (updated) changed.push(path.relative(repoRoot, extensionEnvPath))
  }

  if (targets.has('worker') && options.profile === 'development') {
    // 永不写入 .dev.vars.local；仅生成 .dev.vars 并 chmod 0600
    const updated = await writeFileIfChanged(
      workerEnvPath,
      buildWorkerEnvFile(normalizedEnv, optionalOverlay),
      { mode: 0o600 }
    )
    if (updated) changed.push('worker/.dev.vars')
  }

  if (targets.has('website')) {
    const updated = await writeFileIfChanged(
      websiteEnvPath,
      buildWebsiteEnvFile(options.profile, normalizedEnv)
    )
    if (updated) changed.push('website/.env')
  }

  if (!options.quiet) {
    if (changed.length) console.log(`synced env files: ${changed.join(', ')}`)
    else console.log('env files already up to date')
    printProcessEnvOverrides(Object.keys(pickProcessEnvOverrides()).sort())
  }

  return normalizedEnv
}

async function runCheck(options) {
  const overrideKeys = Object.keys(pickProcessEnvOverrides()).sort()
  printProcessEnvOverrides(overrideKeys)

  /** @type {Record<string, string> | null} */
  let wranglerTopVars = null
  /** @type {string | null} */
  let wranglerError = null
  /** @type {string} */
  let productionDodoEnvironment = ''
  try {
    const authority = await loadWranglerAuthority()
    wranglerTopVars = authority.topVars
    productionDodoEnvironment = authority.productionVars.DODO_PAYMENTS_ENVIRONMENT || ''
  } catch (error) {
    wranglerError = error instanceof Error ? error.message : String(error)
  }

  const sourceEnv = await loadSourceEnv(options.profile)
  const fileOnlySourceEnv = await loadSourceEnv(options.profile, { applyProcessEnv: false })
  const wranglerHints = { productionDodoEnvironment }
  const normalizedEnv = normalizeEnv(options.profile, sourceEnv, wranglerHints)
  const fileOnlyNormalized = normalizeEnv(options.profile, fileOnlySourceEnv, wranglerHints)

  const optionalOverlay =
    options.profile === 'development' && (await pathExists(workerEnvLocalPath))
      ? await readEnvFile(workerEnvLocalPath)
      : {}

  let overlayOk = true
  if (Object.keys(optionalOverlay).length) {
    const validation = validateWorkerOptionalOverlay(optionalOverlay)
    if (!validation.ok) {
      console.log(
        `ERR worker/.dev.vars.local invalid keys (WORKER_KEYS belong in source files): ${validation.badKeys.join(', ')}`
      )
      overlayOk = false
    }
  }

  const staleOk = await verifyGeneratedFiles(options, fileOnlyNormalized, optionalOverlay)
  const checkOk = printCheck(options.profile, normalizedEnv, {
    target: options.target,
    wranglerTopVars,
    wranglerError
  })
  return overlayOk && staleOk && checkOk
}

async function main() {
  const options = parseArgs(process.argv)

  if (options.command === 'check') {
    const ok = await runCheck(options)
    process.exit(ok ? 0 : 1)
  }

  await sync(options)
}

await main()
