import { z } from 'zod'

const optionalUrlSchema = z
  .string()
  .trim()
  .url()
  .optional()
  .or(z.literal('').transform(() => undefined))

const optionalNumberSchema = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .transform(Number)
  .optional()
  .or(z.literal('').transform(() => undefined))

const optionalBooleanSchema = z
  .enum(['true', 'false'])
  .transform(value => value === 'true')
  .optional()
  .or(z.literal('').transform(() => undefined))

const frontendEnvSchema = z.object({
  VITE_API_BASE_URL: optionalUrlSchema,
  VITE_WEBSITE_URL: optionalUrlSchema,
  VITE_SUPABASE_URL: optionalUrlSchema,
  VITE_SUPABASE_ANON_KEY: z.string().trim().optional(),
  VITE_SHARE_BASE_URL: optionalUrlSchema,
  VITE_GUMROAD_PRODUCT_URL: optionalUrlSchema,
  VITE_GUMROAD_MANAGE_URL: optionalUrlSchema,
  VITE_CRAWLER_MODE: z.enum(['local', 'hybrid', 'serverless']).optional(),
  VITE_CRAWLER_CONCURRENCY: optionalNumberSchema,
  VITE_CRAWLER_PER_DOMAIN_CONCURRENCY: optionalNumberSchema,
  VITE_CRAWLER_BATCH_SIZE: optionalNumberSchema,
  VITE_CRAWLER_BATCH_INTERVAL_MS: optionalNumberSchema,
  VITE_CRAWLER_DAILY_LIMIT: optionalNumberSchema,
  VITE_CRAWLER_USE_IDLE_SCHEDULING: optionalBooleanSchema,
  VITE_CRAWLER_IDLE_DELAY_MS: optionalNumberSchema,
  VITE_AI_INITIAL_PROMPTS: z.string().optional(),
  VITE_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  VITE_LOG_CONSOLE: optionalBooleanSchema,
  VITE_RUNTIME_ENV: z.enum(['dev', 'prod']).optional(),
  VITE_HOT_BUILD: z.string().optional(),
  VITE_USE_REMOTE: z.string().optional()
})

const parsed = frontendEnvSchema.safeParse(import.meta.env)

if (!parsed.success && import.meta.env.DEV) {
  console.warn('[Env] 前端环境变量格式异常', parsed.error.flatten().fieldErrors)
}

const rawEnv = parsed.success ? parsed.data : {}

const runtimeEnv = rawEnv.VITE_RUNTIME_ENV ?? 'dev'

/** dev 构建未注入 VITE_WEBSITE_URL 时默认本地官网，避免误跳生产站 */
const defaultWebsiteUrl = runtimeEnv === 'prod' ? 'https://yiveno.com' : 'http://localhost:3001'

export const frontendEnv = {
  apiBaseUrl: rawEnv.VITE_API_BASE_URL,
  websiteUrl: rawEnv.VITE_WEBSITE_URL ?? defaultWebsiteUrl,
  supabaseUrl: rawEnv.VITE_SUPABASE_URL ?? 'https://ugxgxytykxblctsyulsg.supabase.co',
  supabaseAnonKey:
    rawEnv.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_2FY9uDfqNbLwUYXxgcu8lw_qQ8SEbXo',
  shareBaseUrl: rawEnv.VITE_SHARE_BASE_URL,
  gumroadProductUrl: rawEnv.VITE_GUMROAD_PRODUCT_URL ?? '',
  gumroadManageUrl: rawEnv.VITE_GUMROAD_MANAGE_URL ?? 'https://app.gumroad.com/subscriptions',
  crawlerMode: rawEnv.VITE_CRAWLER_MODE ?? 'local',
  crawlerConcurrency: rawEnv.VITE_CRAWLER_CONCURRENCY ?? 2,
  crawlerPerDomainConcurrency: rawEnv.VITE_CRAWLER_PER_DOMAIN_CONCURRENCY ?? 1,
  crawlerBatchSize: rawEnv.VITE_CRAWLER_BATCH_SIZE ?? 5,
  crawlerBatchIntervalMs: rawEnv.VITE_CRAWLER_BATCH_INTERVAL_MS ?? 1500,
  crawlerDailyLimit: rawEnv.VITE_CRAWLER_DAILY_LIMIT ?? 200,
  crawlerUseIdleScheduling: rawEnv.VITE_CRAWLER_USE_IDLE_SCHEDULING ?? true,
  crawlerIdleDelayMs: rawEnv.VITE_CRAWLER_IDLE_DELAY_MS ?? 3000,
  aiInitialPrompts: rawEnv.VITE_AI_INITIAL_PROMPTS,
  logLevel: rawEnv.VITE_LOG_LEVEL,
  logConsole: rawEnv.VITE_LOG_CONSOLE,
  runtimeEnv,
  hotBuild: Boolean(rawEnv.VITE_HOT_BUILD),
  useRemote: Boolean(rawEnv.VITE_USE_REMOTE)
} as const
