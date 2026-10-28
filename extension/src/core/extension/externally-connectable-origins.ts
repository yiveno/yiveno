/**
 * 官网 external auth handoff 允许来源（与 manifest externally_connectable 同源）。
 * 改此处须同步 `public/manifest.json` 与 `CHROMEWEBSTORE.md`。
 */
export const EXTERNAL_AUTH_HANDOFF_ORIGINS = [
  'https://yiveno.com',
  'https://www.yiveno.com',
  'https://yiveno.cn',
  'https://www.yiveno.cn',
  'http://localhost:3001',
  'https://localhost:3001',
  'http://localhost:3002',
  'https://localhost:3002'
] as const

/** manifest `externally_connectable.matches` 权威表（每条 origin + `/*`）。 */
export const EXTERNAL_AUTH_HANDOFF_MATCH_PATTERNS: readonly string[] =
  EXTERNAL_AUTH_HANDOFF_ORIGINS.map(origin => `${origin}/*`)

const ALLOWED_ORIGIN_SET = new Set<string>(EXTERNAL_AUTH_HANDOFF_ORIGINS)

/** 校验 sender.url 是否来自 manifest externally_connectable 站点。 */
export function isExternallyConnectableOrigin(url: string | undefined): boolean {
  if (!url) {
    return false
  }
  try {
    const { origin } = new URL(url)
    return ALLOWED_ORIGIN_SET.has(origin)
  } catch {
    return false
  }
}
