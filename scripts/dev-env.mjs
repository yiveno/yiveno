#!/usr/bin/env bun

import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const envSharedPath = path.join(repoRoot, '.env.shared.local')
const envLegacyDevPath = path.join(repoRoot, '.env.local')
const envDevelopmentPath = path.join(repoRoot, '.env.development.local')
const envProductionPath = path.join(repoRoot, '.env.production.local')
const backendEnvPath = path.join(repoRoot, 'backend', '.dev.vars')
const websiteEnvPath = path.join(repoRoot, 'website', '.env')
const frontendRuntimeDir = path.join(repoRoot, '.env.runtime')

const PROFILES = /** @type {const} */ (['development', 'production'])

const PROFILE_DEFAULTS = {
  development: {
    WEBSITE_URL: 'http://localhost:3001',
    VITE_WEBSITE_URL: 'http://localhost:3001',
    VITE_API_BASE_URL: 'http://localhost:8787',
    VITE_CLOUDFLARE_WORKER_URL: 'http://localhost:8787',
    PUBLIC_API_BASE_URL: 'http://localhost:8787',
    VITE_GUMROAD_MANAGE_URL: 'https://app.gumroad.com/subscriptions',
    VITE_RUNTIME_ENV: 'dev'
  },
  production: {
    WEBSITE_URL: 'https://yiveno.com',
    VITE_WEBSITE_URL: 'https://yiveno.com',
    VITE_API_BASE_URL: 'https://api.yiveno.com',
    VITE_CLOUDFLARE_WORKER_URL: 'https://api.yiveno.com',
    PUBLIC_API_BASE_URL: 'https://api.yiveno.com',
    VITE_GUMROAD_MANAGE_URL: 'https://app.gumroad.com/subscriptions',
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
  'GUMROAD_SELLER_ID',
  'VITE_GUMROAD_PRODUCT_URL',
  'VITE_GUMROAD_MANAGE_URL',
  'REDIRECT_URI_ALLOWLIST',
  'DEEPSEEK_API_KEY'
]

const FRONTEND_KEYS = [
  'VITE_API_BASE_URL',
  'VITE_WEBSITE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_GUMROAD_PRODUCT_URL',
  'VITE_GUMROAD_MANAGE_URL',
  'VITE_CLOUDFLARE_WORKER_URL',
  'VITE_RUNTIME_ENV'
]

const BACKEND_KEYS = [
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
  'GUMROAD_SELLER_ID',
  'REDIRECT_URI_ALLOWLIST',
  'DEEPSEEK_API_KEY'
]

const WEBSITE_KEYS = [
  ['PUBLIC_API_BASE_URL', 'PUBLIC_API_BASE_URL'],
  ['PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
  ['PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'],
  ['PUBLIC_WEBSITE_URL', 'WEBSITE_URL']
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
  'GUMROAD_SELLER_ID',
  'VITE_GUMROAD_PRODUCT_URL',
  'VITE_GUMROAD_MANAGE_URL',
  'REDIRECT_URI_ALLOWLIST'
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

  return /** @type {{command:'sync'|'check', profile:'development'|'production', target:string, quiet:boolean}} */ (
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

async function loadSourceEnv(profile) {
  const legacyEnv = await readEnvFile(envLegacyDevPath)
  const sharedEnv = {
    ...pickEnv(legacyEnv, LEGACY_SHARED_FALLBACK_KEYS),
    ...(await readEnvFile(envSharedPath))
  }
  const profileEnv = {
    ...pickEnv(legacyEnv, LEGACY_PROFILE_KEYS[profile]),
    ...(await readEnvFile(getProfileSourcePath(profile)))
  }
  return {
    ...sharedEnv,
    ...profileEnv
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

function normalizeEnv(profile, sourceEnv, backendEnv, websiteEnv) {
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

  if (profile === 'development') {
    setIfMissing(normalized, 'SUPABASE_URL', backendEnv.SUPABASE_URL)
    setIfMissing(normalized, 'SUPABASE_ANON_KEY', backendEnv.SUPABASE_ANON_KEY)
    setIfMissing(normalized, 'SUPABASE_SERVICE_ROLE_KEY', backendEnv.SUPABASE_SERVICE_ROLE_KEY)
    setIfMissing(normalized, 'JWT_SECRET', backendEnv.JWT_SECRET)
  }

  setIfMissing(normalized, 'VITE_SUPABASE_URL', normalized.SUPABASE_URL)
  setIfMissing(normalized, 'VITE_SUPABASE_ANON_KEY', normalized.SUPABASE_ANON_KEY)
  setIfMissing(normalized, 'VITE_GUMROAD_MANAGE_URL', defaults.VITE_GUMROAD_MANAGE_URL)
  normalized.VITE_RUNTIME_ENV = defaults.VITE_RUNTIME_ENV

  for (const key of SHARED_OPTIONAL_KEYS) {
    setIfMissing(normalized, key, backendEnv[key])
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

function buildFrontendEnvFile(profile, env) {
  return renderEnvFile(`Frontend Runtime (${profile})`, FRONTEND_KEYS, env)
}

function buildBackendEnvFile(env) {
  const output = {}
  for (const key of BACKEND_KEYS) {
    if (env[key]) output[key] = env[key]
  }
  return renderEnvFile('Backend Runtime (development)', BACKEND_KEYS, output)
}

function buildWebsiteEnvFile(profile, env) {
  /** @type {Record<string,string>} */
  const websiteEnv = {}
  for (const [targetKey, sourceKey] of WEBSITE_KEYS) {
    if (env[sourceKey]) websiteEnv[targetKey] = env[sourceKey]
  }
  return renderEnvFile(`Website Runtime (${profile})`, WEBSITE_KEYS.map(([key]) => key), websiteEnv)
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

function getMissing(env) {
  return {
    required: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'].filter(
      key => !env[key]
    ),
    oauth: [
      'AUTH_GOOGLE_CLIENT_ID',
      'AUTH_GOOGLE_CLIENT_SECRET',
      'AUTH_MICROSOFT_CLIENT_ID',
      'AUTH_MICROSOFT_CLIENT_SECRET'
    ].filter(key => !env[key]),
    gumroad: ['VITE_GUMROAD_PRODUCT_URL', 'GUMROAD_SELLER_ID'].filter(key => !env[key])
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

  return [
    ['WEBSITE_URL', env.WEBSITE_URL, isRemoteHttps(env.WEBSITE_URL || '')],
    ['VITE_WEBSITE_URL', env.VITE_WEBSITE_URL, isRemoteHttps(env.VITE_WEBSITE_URL || '')],
    ['VITE_API_BASE_URL', env.VITE_API_BASE_URL, isRemoteHttps(env.VITE_API_BASE_URL || '')],
    ['SUPABASE_URL', env.SUPABASE_URL, isRemoteHttps(env.SUPABASE_URL || '')],
    ['VITE_SUPABASE_URL', env.VITE_SUPABASE_URL, isRemoteHttps(env.VITE_SUPABASE_URL || '')]
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

function printCheck(profile, env) {
  const missing = getMissing(env)
  console.log(`Env Check (${profile})`)

  for (const [key, value, ok] of getChecks(profile, env)) {
    console.log(`${ok ? 'OK ' : 'ERR'} ${key}=${value || '(missing)'}`)
  }

  if (profile === 'production' && hasUnsafeProductionValues(env)) {
    console.log('ERR production profile contains localhost / 127.0.0.1')
  }

  if (missing.required.length) console.log(`ERR required missing: ${missing.required.join(', ')}`)
  else console.log('OK required backend secrets complete')

  if (missing.oauth.length) console.log(`WARN oauth missing: ${missing.oauth.join(', ')}`)
  else console.log('OK oauth credentials complete')

  if (missing.gumroad.length) console.log(`WARN gumroad missing: ${missing.gumroad.join(', ')}`)
  else console.log('OK gumroad credentials complete')

  return (
    missing.required.length === 0 &&
    !getChecks(profile, env).some(([, , ok]) => !ok) &&
    !(profile === 'production' && hasUnsafeProductionValues(env))
  )
}

async function sync(options) {
  const sourceEnv = await loadSourceEnv(options.profile)
  const backendEnv = await readEnvFile(backendEnvPath)
  const normalizedEnv = normalizeEnv(options.profile, sourceEnv, backendEnv, {})

  const targets = new Set(
    options.target === 'all'
      ? ['frontend', 'website', ...(options.profile === 'development' ? ['backend'] : [])]
      : [options.target]
  )

  const changed = []

  if (targets.has('frontend')) {
    const frontendEnvPath = path.join(frontendRuntimeDir, `.env.${options.profile}`)
    const updated = await writeFileIfChanged(
      frontendEnvPath,
      buildFrontendEnvFile(options.profile, normalizedEnv)
    )
    if (updated) changed.push(path.relative(repoRoot, frontendEnvPath))
  }

  if (targets.has('backend') && options.profile === 'development') {
    const updated = await writeFileIfChanged(backendEnvPath, buildBackendEnvFile(normalizedEnv))
    if (updated) changed.push('backend/.dev.vars')
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
  }

  return normalizedEnv
}

async function main() {
  const options = parseArgs(process.argv)
  const normalizedEnv = await sync(options)

  if (options.command === 'check') {
    const ok = printCheck(options.profile, normalizedEnv)
    process.exit(ok ? 0 : 1)
  }
}

await main()
