/**
 * 环境变量单一契约源（Batch B）。
 * 键表 / 生产 secret 组 / wrangler 差异允许表 / KEY_META。
 * 本文件只含键名与元数据，永不含 secret 值。
 */

/** @type {readonly string[]} */
export const SHARED_OPTIONAL_KEYS = Object.freeze([
  'DODO_PAYMENTS_API_KEY',
  'DODO_PAYMENTS_WEBHOOK_KEY',
  'DODO_PAYMENTS_ENVIRONMENT',
  'DODO_PRODUCT_ID_PRO_MONTHLY',
  'DODO_PRODUCT_ID_PRO_ANNUAL',
  'DODO_PRODUCT_ID_FOUNDING_MONTHLY',
  'DODO_PRODUCT_ID_FOUNDING_ANNUAL',
  'BILLING_FOUNDING_ENABLED',
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
  'ALIYUN_DM_ENDPOINT',
  'EVAL_MINT_TOKEN'
])

/** @type {readonly string[]} */
export const EXTENSION_KEYS = Object.freeze([
  'VITE_API_BASE_URL',
  'VITE_WEBSITE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_CLOUDFLARE_WORKER_URL',
  'VITE_RUNTIME_ENV'
])

/** @type {readonly string[]} */
export const WORKER_KEYS = Object.freeze([
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'WEBSITE_URL',
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
  'ALIYUN_DM_ENDPOINT',
  'EVAL_MINT_TOKEN'
])

/** @type {readonly [string, string][]} */
export const WEBSITE_KEYS = Object.freeze([
  ['PUBLIC_API_BASE_URL', 'PUBLIC_API_BASE_URL'],
  ['PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
  ['PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'],
  ['PUBLIC_WEBSITE_URL', 'WEBSITE_URL'],
  // Turnstile sitekey；Secret 进 Worker（TURNSTILE_SECRET_KEY）与 Supabase Attack Protection
  ['PUBLIC_TURNSTILE_SITE_KEY', 'PUBLIC_TURNSTILE_SITE_KEY']
])

/** @type {readonly string[]} */
export const LEGACY_SHARED_FALLBACK_KEYS = Object.freeze([
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
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
])

/** @type {Readonly<{ development: readonly string[], production: readonly string[] }>} */
export const LEGACY_PROFILE_KEYS = Object.freeze({
  development: Object.freeze([
    'WEBSITE_URL',
    'VITE_WEBSITE_URL',
    'VITE_API_BASE_URL',
    'VITE_CLOUDFLARE_WORKER_URL'
  ]),
  production: Object.freeze([])
})

/** 允许从 process.env 读入的源键（Pages Git 构建无本地 env 文件时用）。 */
export const PROCESS_ENV_SOURCE_KEYS = Object.freeze([
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
  ])
])

/** 本地调参键：仅经 worker/.dev.vars.local 覆盖层合并进生成产物。 */
export const WORKER_OPTIONAL_KEYS = Object.freeze([
  'AI_CLUE_DAILY_LIMIT',
  'AI_ENRICHMENT_PROXY_ENABLED',
  'AI_ENRICHMENT_DAILY_LIMIT',
  'AI_GS_CLUE_SAMPLES_PROXY_ENABLED',
  'AI_GS_CLUE_SAMPLES_DAILY_LIMIT',
  'AI_EMBED_DAILY_LIMIT',
  'AI_EMBED_FREE_DAILY_LIMIT',
  'AI_HOSTED_FREE_MONTHLY_QUOTA',
  'AI_HOSTED_FREE_DAILY_CAP',
  'AI_HOSTED_DAILY_CAP',
  'AI_HOSTED_ANONYMOUS_LIFETIME_QUOTA',
  'AI_EMBED_ANONYMOUS_LIFETIME_LIMIT',
  'AI_HOSTED_MODEL_NLU',
  'AI_HOSTED_MODEL_NLG',
  'AI_HOSTED_MODEL_ENRICHMENT',
  'AI_HOSTED_MODEL_GS_SAMPLES',
  'AI_HOSTED_MODEL_EXTRACT',
  'AI_DREAMING_FREE_DAILY_CAP',
  'AI_DREAMING_FREE_MONTHLY_QUOTA',
  'AI_DREAMING_PRO_DAILY_CAP',
  'AI_DREAMING_PRO_MONTHLY_QUOTA',
  'AI_EXTRACT_FREE_DAILY_CAP',
  'AI_EXTRACT_FREE_MONTHLY_QUOTA',
  'AI_EXTRACT_PRO_DAILY_CAP',
  'AI_EXTRACT_PRO_MONTHLY_QUOTA',
  'AI_ROUTING_MODE',
  'AI_GATEWAY_TOKEN',
  'SUBSCRIPTION_RECONCILE_SCHEDULED_ENABLED'
])

/** @type {readonly string[]} */
export const WORKER_BINDINGS = Object.freeze(['AI', 'EMAIL', 'AI_USAGE_KV', 'AI_QUOTA_LEDGER'])

/** @type {readonly string[]} */
export const LEGACY_ENV_KEYS = Object.freeze([])

export const PRODUCTION_SECRET_GROUPS = Object.freeze({
  core: Object.freeze([
    'SUPABASE_SERVICE_ROLE_KEY',
    'DEEPSEEK_API_KEY',
    'TURNSTILE_SECRET_KEY'
  ]),
  dodo: Object.freeze([
    'DODO_PAYMENTS_API_KEY',
    'DODO_PAYMENTS_WEBHOOK_KEY',
    'DODO_PRODUCT_ID_PRO_MONTHLY',
    'DODO_PRODUCT_ID_PRO_ANNUAL'
  ]),
  dodoFounding: Object.freeze([
    'DODO_PRODUCT_ID_FOUNDING_MONTHLY',
    'DODO_PRODUCT_ID_FOUNDING_ANNUAL'
  ]),
  optional: Object.freeze([
    'ALIYUN_DM_ACCESS_KEY_ID',
    'ALIYUN_DM_ACCESS_KEY_SECRET',
    'AI_GATEWAY_TOKEN',
    'OPENAI_API_KEY',
    'GOOGLE_AI_API_KEY',
    'GROQ_API_KEY',
    'EVAL_MINT_TOKEN'
  ])
})

/** 生产 secret 全集（名称对账 / 未知 WARN）。 */
export const PRODUCTION_SECRET_NAME_SET = Object.freeze(
  new Set([
    ...PRODUCTION_SECRET_GROUPS.core,
    ...PRODUCTION_SECRET_GROUPS.dodo,
    ...PRODUCTION_SECRET_GROUPS.dodoFounding,
    ...PRODUCTION_SECRET_GROUPS.optional
  ])
)

export const WRANGLER_VAR_DIFF_ALLOWLIST = Object.freeze({
  productionOnly: Object.freeze(['AI_CLUE_PROXY_ENABLED']),
  valueDiffs: Object.freeze([])
})

/** @type {readonly string[]} */
export const CRITICAL_WRANGLER_EQUAL_KEYS = Object.freeze([
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'DODO_PAYMENTS_ENVIRONMENT',
  'AI_PROVIDER',
  'AI_HOSTED_MODEL',
  'AI_HOSTED_MONTHLY_QUOTA'
])

/** @typedef {'public' | 'secret' | 'config'} KeyCategory */
/** @typedef {{ key: string, category: KeyCategory, targets: string, authority: string }} KeyMetaRow */

/** @type {Readonly<Record<string, Partial<KeyMetaRow>>>} */
const KEY_META_OVERRIDES = Object.freeze({
  SUPABASE_URL: {
    category: 'public',
    targets: 'shared → extension/worker/website',
    authority: 'Worker 以 wrangler [vars] 为权威；本地 shared 与 Pages 机密须匹配'
  },
  SUPABASE_ANON_KEY: {
    category: 'public',
    targets: 'shared → extension/worker/website',
    authority: 'Worker 以 wrangler [vars] 为权威；本地 shared 与 Pages 机密须匹配；须为 publishable/anon'
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    category: 'secret',
    targets: 'shared → worker',
    authority: '仅 Worker secret / 本地 shared；禁止进扩展与官网'
  },
  TURNSTILE_SECRET_KEY: {
    category: 'secret',
    targets: 'shared → worker',
    authority: 'Worker 必需 secret；与 Supabase Attack Protection 使用同一 secret'
  },
  PUBLIC_TURNSTILE_SITE_KEY: {
    category: 'public',
    targets: 'shared → website',
    authority: '公开 sitekey；同步 website/.env / Pages'
  },
  DODO_PAYMENTS_ENVIRONMENT: {
    category: 'config',
    targets: 'shared → worker；wrangler production.vars',
    authority: '生产以 wrangler [env.production.vars] 为权威；dev-env 校验 API key 前缀'
  },
  EVAL_MINT_TOKEN: {
    category: 'secret',
    targets: 'shared optional → worker production secret',
    authority: '可选；Actions 评测 mint；缺失时 mint 端点 503'
  },
  AI_ROUTING_MODE: {
    category: 'config',
    targets: 'worker/.dev.vars.local（可选）',
    authority: '本地覆盖层；勿手改生成的 .dev.vars'
  },
  AI_GATEWAY_TOKEN: {
    category: 'secret',
    targets: 'worker optional / production secret',
    authority: '可选；Authenticated Gateway 时需要'
  }
})

/** @type {ReadonlySet<string>} */
const SECRET_KEYS = new Set([
  ...PRODUCTION_SECRET_GROUPS.core,
  ...PRODUCTION_SECRET_GROUPS.dodo,
  ...PRODUCTION_SECRET_GROUPS.dodoFounding,
  ...PRODUCTION_SECRET_GROUPS.optional
])

/** @type {ReadonlySet<string>} */
const PUBLIC_KEYS = new Set([
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'PUBLIC_API_BASE_URL',
  'PUBLIC_SUPABASE_URL',
  'PUBLIC_SUPABASE_ANON_KEY',
  'PUBLIC_WEBSITE_URL',
  'PUBLIC_TURNSTILE_SITE_KEY',
  'WEBSITE_URL',
  'VITE_API_BASE_URL',
  'VITE_WEBSITE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_CLOUDFLARE_WORKER_URL',
  'VITE_RUNTIME_ENV'
])

/**
 * @param {string} key
 * @returns {KeyCategory}
 */
function defaultCategory(key) {
  if (PUBLIC_KEYS.has(key) || key.startsWith('VITE_') || key.startsWith('PUBLIC_')) return 'public'
  if (SECRET_KEYS.has(key) || /(_SECRET|_KEY|CLIENT_SECRET)$/u.test(key)) return 'secret'
  return 'config'
}

/**
 * @param {string} key
 * @returns {string}
 */
function defaultTargets(key) {
  if (EXTENSION_KEYS.includes(key)) return 'extension runtime'
  if (WEBSITE_KEYS.some(([t]) => t === key)) return 'website'
  if (WORKER_OPTIONAL_KEYS.includes(key)) return 'worker/.dev.vars.local → worker/.dev.vars'
  if (WORKER_KEYS.includes(key) || SHARED_OPTIONAL_KEYS.includes(key)) {
    return 'shared/profile → worker'
  }
  if (LEGACY_PROFILE_KEYS.development.includes(key)) return 'profile'
  return 'source'
}

/**
 * @param {string} key
 * @returns {string}
 */
function defaultAuthority(key) {
  if (key === 'SUPABASE_URL' || key === 'SUPABASE_ANON_KEY') {
    return 'wrangler [vars]（Worker）；本地 shared / Pages 须匹配'
  }
  if (key === 'DODO_PAYMENTS_ENVIRONMENT') {
    return 'wrangler [env.production.vars]（生产）；development 默认 test_mode'
  }
  if (WORKER_OPTIONAL_KEYS.includes(key)) {
    return '本地 worker/.dev.vars.local 覆盖；生成产物 .dev.vars'
  }
  if (SECRET_KEYS.has(key)) {
    return '本地源文件 → 生成 / Worker secrets（永不入库）'
  }
  return '本地源文件 → 生成文件'
}

/** 源键 ∪ worker 键（含可选 / 网站目标键）的文档表行。 */
export const KEY_META = Object.freeze(
  [
    ...new Set([
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'PUBLIC_TURNSTILE_SITE_KEY',
      ...SHARED_OPTIONAL_KEYS,
      ...EXTENSION_KEYS,
      ...WORKER_KEYS,
      ...WORKER_OPTIONAL_KEYS,
      ...WEBSITE_KEYS.map(([targetKey]) => targetKey),
      ...LEGACY_PROFILE_KEYS.development,
      ...LEGACY_PROFILE_KEYS.production
    ])
  ]
    .sort((a, b) => a.localeCompare(b))
    .map(key => {
      const override = KEY_META_OVERRIDES[key] || {}
      return Object.freeze({
        key,
        category: /** @type {KeyCategory} */ (override.category || defaultCategory(key)),
        targets: override.targets || defaultTargets(key),
        authority: override.authority || defaultAuthority(key)
      })
    })
)

/** .env.example 须覆盖的源键（shared + profile + website 源键）。 */
export const EXAMPLE_SOURCE_KEYS = Object.freeze([
  ...new Set([
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'PUBLIC_TURNSTILE_SITE_KEY',
    ...SHARED_OPTIONAL_KEYS,
    ...LEGACY_PROFILE_KEYS.development,
    ...LEGACY_PROFILE_KEYS.production,
    ...WEBSITE_KEYS.map(([, sourceKey]) => sourceKey)
  ])
])
