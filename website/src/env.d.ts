/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_BASE_URL?: string
  readonly PUBLIC_SUPABASE_URL?: string
  readonly PUBLIC_SUPABASE_ANON_KEY?: string
  readonly PUBLIC_WEBSITE_URL?: string
  readonly PUBLIC_GUMROAD_PRODUCT_URL?: string
  readonly PUBLIC_GUMROAD_MANAGE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
