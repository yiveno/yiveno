/**
 * Vitest 工程 ambient：tsconfig.vitest 只 include 测试文件，
 * 被测模块拉入时需要 Vite ImportMeta / ?raw（与 src/env.d.ts 对齐）。
 */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_WEBSITE_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*?raw' {
  const src: string
  export default src
}
