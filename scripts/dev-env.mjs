#!/usr/bin/env bun
/**
 * 环境同步 / 硬门检查。
 *
 * 调用方须使用 `bun --no-env-file`（见根 / website / extension / worker package.json），
 * 否则 Bun 会自动灌入 `.env.development.local` 等，经 process.env 合并后污染 production profile。
 * Pages 后台机密仍在 process.env，不受 --no-env-file 影响。
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const envSharedPath = path.join(repoRoot, '.env.shared.local')
const envLegacyDevPath = path.join(repoRoot, '.env.local')
const envDevelopmentPath = path.join(repoRoot, '.env.development.local')
const envProductionPath = path.join(repoRoot, '.env.production.local')
const workerEnvPath = path.join(repoRoot, 'worker', '.dev.vars')
const websiteEnvPath = path.join(repoRoot, 'website', '.env')
const extensionRuntimeDir = path.join(repoRoot, '.env.runtime')

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
    DODO_PAYMENTS_ENVIRONMENT: 'live_mode',
    VITE_RUNTIME_ENV: 'prod'
  }
}

const SHARED_OPTIONAL_KEYS = [
  'AUTH_GOOGLE_CLIENT_ID',
  'AUTH_GOOGLE_CLIENT_SECRET',
  'AUTH_MICROSOFT_CLIENT_ID',
  'AUTH_MICROSOFT_CLIENT_SECRET',
  'AUTH_GOOGLE_AUTH_URL',
  'AUTH_GOOGLE_TOKEN_URL',
  'AUTH_GOOGLE_USERINFO_URL',
  'AUTH_MICROSOFT_AUTH_URL',
  'AUTH_MICROSOFT_TOKEN_URL',
  'AUTH_MICROSOFT_USERINFO_URL',
  'DODO_PAYMENTS_API_KEY',
  'DODO_PAYMENTS_WEBHOOK_KEY',
  'DODO_PAYMENTS_ENVIRONMENT',
  'DODO_PRODUCT_ID_PRO_MONTHLY',
  'DODO_PRODUCT_ID_PRO_ANNUAL',
  'DODO_PRODUCT_ID_FOUNDING_MONTHLY',
  'DODO_PRODUCT_ID_FOUNDING_ANNUAL',
  'BILLING_FOUNDING_ENABLED',
  'REDIRECT_URI_ALLOWLIST',
  'DEEPSEEK_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_AI_API_KEY',
  'GROQ_API_KEY',
  'TURNSTILE_SECRET_KEY',
  'AI_HOSTED_QUOTA_EXEMPT_USER_IDS',
  'ALIYUN_DM_ACCESS_KEY_ID',
  'ALIYUN_DM_ACCESS_KEY_SECRET',
  'ALIYUN_DM_ACCOUNT_NAME',
  'ALIYUN_DM_FROM_ALIAS',
  'ALIYUN_DM_REPLY_ADDRESS',
  'ALIYUN_DM_REGION_ID',
  'ALIYUN_DM_ENDPOINT'
]

const EXTENSION_KEYS = [
  'VITE_API_BASE_URL',
  'VITE_WEBSITE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_CLOUDFLARE_WORKER_URL',
  'VITE_RUNTIME_ENV'
]

const WORKER_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'WEBSITE_URL',
  'JWT_SECRET',
  'AUTH_GOOGLE_CLIENT_ID',
  'AUTH_GOOGLE_CLIENT_SECRET',
  'AUTH_MICROSOFT_CLIENT_ID',
  'AUTH_MICROSOFT_CLIENT_SECRET',
  'AUTH_GOOGLE_AUTH_URL',
  'AUTH_GOOGLE_TOKEN_URL',
  'AUTH_GOOGLE_USERINFO_URL',
  'AUTH_MICROSOFT_AUTH_URL',
  'AUTH_MICROSOFT_TOKEN_URL',
  'AUTH_MICROSOFT_USERINFO_URL',
  'REDIRECT_URI_ALLOWLIST',
  'DEEPSEEK_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_AI_API_KEY',
  'GROQ_API_KEY',
  'TURNSTILE_SECRET_KEY',
  'AI_HOSTED_QUOTA_EXEMPT_USER_IDS',
  'DODO_PAYMENTS_API_KEY',
  'DODO_PAYMENTS_WEBHOOK_KEY',
  'DODO_PAYMENTS_ENVIRONMENT',
  'DODO_PRODUCT_ID_PRO_MONTHLY',
  'DODO_PRODUCT_ID_PRO_ANNUAL',
  'DODO_PRODUCT_ID_FOUNDING_MONTHLY',
  'DODO_PRODUCT_ID_FOUNDING_ANNUAL',
  'BILLING_FOUNDING_ENABLED',
  'ALIYUN_DM_ACCESS_KEY_ID',
  'ALIYUN_DM_ACCESS_KEY_SECRET',
  'ALIYUN_DM_ACCOUNT_NAME',
  'ALIYUN_DM_FROM_ALIAS',
  'ALIYUN_DM_REPLY_ADDRESS',
  'ALIYUN_DM_REGION_ID',
  'ALIYUN_DM_ENDPOINT'
]

const WEBSITE_KEYS = [
  ['PUBLIC_API_BASE_URL', 'PUBLIC_API_BASE_URL'],
  ['PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
  ['PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'],
  ['PUBLIC_WEBSITE_URL', 'WEBSITE_URL'],
  // Turnstile 公钥；Secret 只进 Supabase Dashboard，不同步进官网
  ['PUBLIC_TURNSTILE_SITE_KEY', 'PUBLIC_TURNSTILE_SITE_KEY']
]

const SOURCE_FILE_MAP = {
  development: envDevelopmentPath,
  production: envProductionPath
}

const LEGACY_SHARED_FALLBACK_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AUTH_GOOGLE_CLIENT_ID',
  'AUTH_GOOGLE_CLIENT_SECRET',
  'AUTH_MICROSOFT_CLIENT_ID',
  'AUTH_MICROSOFT_CLIENT_SECRET',
  'AUTH_GOOGLE_AUTH_URL',
  'AUTH_GOOGLE_TOKEN_URL',
  'AUTH_GOOGLE_USERINFO_URL',
  'AUTH_MICROSOFT_AUTH_URL',
  'AUTH_MICROSOFT_TOKEN_URL',
  'AUTH_MICROSOFT_USERINFO_URL',
  'DODO_PAYMENTS_API_KEY',
  'DODO_PAYMENTS_WEBHOOK_KEY',
  'DODO_PAYMENTS_ENVIRONMENT',
  'DODO_PRODUCT_ID_PRO_MONTHLY',
  'DODO_PRODUCT_ID_PRO_ANNUAL',
  'DODO_PRODUCT_ID_FOUNDING_MONTHLY',
  'DODO_PRODUCT_ID_FOUNDING_ANNUAL',
  'BILLING_FOUNDING_ENABLED',
  'REDIRECT_URI_ALLOWLIST',
  'ALIYUN_DM_ACCESS_KEY_ID',
  'ALIYUN_DM_ACCESS_KEY_SECRET',
  'ALIYUN_DM_ACCOUNT_NAME',
  'ALIYUN_DM_FROM_ALIAS',
  'ALIYUN_DM_REPLY_ADDRESS',
  'ALIYUN_DM_REGION_ID',
  'ALIYUN_DM_ENDPOINT'
]

const LEGACY_PROFILE_KEYS = {
  development: [
    'WEBSITE_URL',
    'VITE_WEBSITE_URL',
    'VITE_API_BASE_URL',
    'VITE_CLOUDFLARE_WORKER_URL',
    'JWT_SECRET'
  ],
  production: ['JWT_SECRET']
}

/** 允许从 process.env 读入的源键（Pages Git 构建无本地 env 文件时用）。 */
const PROCESS_ENV_SOURCE_KEYS = [
  ...new Set([
    ...SHARED_OPTIONAL_KEYS,
    ...EXTENSION_KEYS,
    ...WORKER_KEYS,
    ...LEGACY_SHARED_FALLBACK_KEYS,
    ...LEGACY_PROFILE_KEYS.development,
    ...LEGACY_PROFILE_KEYS.production,
    ...WEBSITE_KEYS.flatMap(([targetKey, sourceKey]) => [targetKey, sourceKey]),
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'PUBLIC_TURNSTILE_SITE_KEY',
    'JWT_SECRET'
  ])
]

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

function normalizeEnv(profile, sourceEnv, workerEnv, websiteEnv) {
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

  // 兼容 Pages 旧机密名：PUBLIC_SUPABASE_* 可作为 SUPABASE_* 别名来源（硬门 getChecks 亦有回退）
  setIfMissing(normalized, 'SUPABASE_URL', normalized.PUBLIC_SUPABASE_URL)
  setIfMissing(normalized, 'SUPABASE_ANON_KEY', normalized.PUBLIC_SUPABASE_ANON_KEY)

  if (profile === 'development') {
    setIfMissing(normalized, 'SUPABASE_URL', workerEnv.SUPABASE_URL)
    setIfMissing(normalized, 'SUPABASE_ANON_KEY', workerEnv.SUPABASE_ANON_KEY)
    setIfMissing(normalized, 'SUPABASE_SERVICE_ROLE_KEY', workerEnv.SUPABASE_SERVICE_ROLE_KEY)
    setIfMissing(normalized, 'JWT_SECRET', workerEnv.JWT_SECRET)
  }

  setIfMissing(normalized, 'VITE_SUPABASE_URL', normalized.SUPABASE_URL)
  setIfMissing(normalized, 'VITE_SUPABASE_ANON_KEY', normalized.SUPABASE_ANON_KEY)
  setIfMissing(normalized, 'DODO_PAYMENTS_ENVIRONMENT', defaults.DODO_PAYMENTS_ENVIRONMENT)
  normalized.VITE_RUNTIME_ENV = defaults.VITE_RUNTIME_ENV

  for (const key of SHARED_OPTIONAL_KEYS) {
    setIfMissing(normalized, key, workerEnv[key])
  }

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

function buildWorkerEnvFile(env) {
  const output = {}
  for (const key of WORKER_KEYS) {
    if (env[key]) output[key] = env[key]
  }
  return renderEnvFile('Worker Runtime (development)', WORKER_KEYS, output)
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

async function writeFileIfChanged(filePath, content) {
  try {
    const current = await fs.readFile(filePath, 'utf8')
    if (current === content) return false
  } catch {}

  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf8')
  return true
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
  return ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET']
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
    oauth: [
      'AUTH_GOOGLE_CLIENT_ID',
      'AUTH_GOOGLE_CLIENT_SECRET',
      'AUTH_MICROSOFT_CLIENT_ID',
      'AUTH_MICROSOFT_CLIENT_SECRET'
    ].filter(key => !env[key]),
    dodo: [
      'DODO_PAYMENTS_API_KEY',
      'DODO_PAYMENTS_WEBHOOK_KEY',
      'DODO_PRODUCT_ID_PRO_MONTHLY',
      'DODO_PRODUCT_ID_PRO_ANNUAL'
    ].filter(key => !env[key])
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

  // 官网生产硬门：PUBLIC_SUPABASE_* / Turnstile sitekey 任一空则失败。
  // 值来自合并后 env（通常 .env.shared.local → WEBSITE_KEYS 映射）；展示一律脱敏，禁止刷密钥。
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
 * 公开键角色门 / Turnstile 撞 secret / service_role 校验。
 * 只输出键名与角色结论，绝不打印值。
 * @param {Record<string, string>} env
 * @param {{ target: string, profile: string }} options
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

  if (
    needsWorkerSecrets &&
    options.profile === 'production' &&
    env.JWT_SECRET &&
    env.JWT_SECRET.length < 32
  ) {
    console.log('WARN JWT_SECRET length < 32')
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

  const securityOk = printSecurityGates(env, { target, profile })

  if (profile === 'production' && hasUnsafeProductionValues(env)) {
    console.log('ERR production profile contains localhost / 127.0.0.1')
  }

  if (missing.required.length) console.log(`ERR required missing: ${missing.required.join(', ')}`)
  else if (target === 'website' || target === 'extension')
    console.log(`OK required ${target} secrets complete`)
  else console.log('OK required worker secrets complete')

  if (missing.oauth.length) console.log(`WARN oauth missing: ${missing.oauth.join(', ')}`)
  else console.log('OK oauth credentials complete')

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
 * check 只读：用「仅文件源」渲染期望内容，与磁盘比对（process.env 覆盖不改写磁盘期望，避免负例/临时覆盖误判 stale）。
 * 无本地源文件时跳过（Pages Git 构建场景）。
 * @returns {Promise<boolean>}
 */
async function verifyGeneratedFiles(options, fileOnlyNormalized) {
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
      expected: buildWorkerEnvFile(fileOnlyNormalized)
    })
  }

  if (targets.has('website')) {
    comparisons.push({
      rel: 'website/.env',
      path: websiteEnvPath,
      expected: buildWebsiteEnvFile(options.profile, fileOnlyNormalized)
    })
  }

  // production + worker：无生成文件，跳过
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
    console.log(
      `OK generated files match (${comparisons.map(item => item.rel).join(', ')})`
    )
  } else if (ok) {
    console.log('OK generated file check skipped (no applicable files for target/profile)')
  }

  return ok
}

async function sync(options) {
  const sourceEnv = await loadSourceEnv(options.profile)
  const workerEnv = await readEnvFile(workerEnvPath)
  const normalizedEnv = normalizeEnv(options.profile, sourceEnv, workerEnv, {})

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
    const updated = await writeFileIfChanged(workerEnvPath, buildWorkerEnvFile(normalizedEnv))
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

  const sourceEnv = await loadSourceEnv(options.profile)
  const fileOnlySourceEnv = await loadSourceEnv(options.profile, { applyProcessEnv: false })
  const workerEnv = await readEnvFile(workerEnvPath)
  const normalizedEnv = normalizeEnv(options.profile, sourceEnv, workerEnv, {})
  const fileOnlyNormalized = normalizeEnv(options.profile, fileOnlySourceEnv, workerEnv, {})

  const staleOk = await verifyGeneratedFiles(options, fileOnlyNormalized)
  const checkOk = printCheck(options.profile, normalizedEnv, { target: options.target })
  return staleOk && checkOk
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
