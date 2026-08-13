/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_BASE_URL?: string
  readonly PUBLIC_SUPABASE_URL?: string
  readonly PUBLIC_SUPABASE_ANON_KEY?: string
  readonly PUBLIC_WEBSITE_URL?: string
  /** Paddle.js client token（sandbox 以 test_ 开头） */
  readonly PUBLIC_PADDLE_CLIENT_TOKEN?: string
  /** 必须为 sandbox | production；未设置应 fail loud */
  readonly PUBLIC_PADDLE_ENV?: string
  readonly PUBLIC_PADDLE_PRICE_PRO_MONTHLY?: string
  readonly PUBLIC_PADDLE_PRICE_PRO_YEARLY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
