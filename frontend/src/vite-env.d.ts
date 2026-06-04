/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_WEBSITE_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SHARE_BASE_URL?: string
  readonly VITE_GUMROAD_PRODUCT_URL?: string
  readonly VITE_GUMROAD_MANAGE_URL?: string
  readonly VITE_CRAWLER_MODE?: 'local' | 'hybrid' | 'serverless'
  readonly VITE_CRAWLER_CONCURRENCY?: string
  readonly VITE_CRAWLER_PER_DOMAIN_CONCURRENCY?: string
  readonly VITE_CRAWLER_BATCH_SIZE?: string
  readonly VITE_CRAWLER_BATCH_INTERVAL_MS?: string
  readonly VITE_CRAWLER_DAILY_LIMIT?: string
  readonly VITE_CRAWLER_USE_IDLE_SCHEDULING?: 'true' | 'false'
  readonly VITE_CRAWLER_IDLE_DELAY_MS?: string
  readonly VITE_AI_INITIAL_PROMPTS?: string
  readonly VITE_LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error'
  readonly VITE_LOG_CONSOLE?: 'true' | 'false'
  readonly VITE_RUNTIME_ENV?: 'dev' | 'prod'
  readonly VITE_HOT_BUILD?: string
  readonly VITE_USE_REMOTE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}
