/**
 * 扩展 manifest host_permissions：开发包含本地 Worker，商店包剔除。
 * 改此处须同步 `scripts/clean-dist.cjs` 与 `CHROMEWEBSTORE.md`。
 */

/** 开发专用：本地 Cloudflare Worker API。 */
export const EXTENSION_LOCAL_DEV_API_HOST_PERMISSION = 'http://localhost:8787/*' as const

/** 商店 / production dist 允许的 host_permissions。 */
export const EXTENSION_CWS_HOST_PERMISSIONS_PRODUCTION = [
  'https://*.supabase.co/*',
  'https://api.yiveno.com/*'
] as const

/** 源码 public/manifest.json（开发 unpacked）允许的 host_permissions。 */
export const EXTENSION_CWS_HOST_PERMISSIONS_DEVELOPMENT = [
  ...EXTENSION_CWS_HOST_PERMISSIONS_PRODUCTION,
  EXTENSION_LOCAL_DEV_API_HOST_PERMISSION
] as const

export type ExtensionManifestBuildProfile = 'development' | 'production'

/** 按构建 profile 解析 manifest host_permissions。 */
export function resolveExtensionManifestHostPermissions(
  profile: ExtensionManifestBuildProfile
): readonly string[] {
  return profile === 'production'
    ? EXTENSION_CWS_HOST_PERMISSIONS_PRODUCTION
    : EXTENSION_CWS_HOST_PERMISSIONS_DEVELOPMENT
}

/** 写入 manifest 的 host_permissions（不改动其它字段）。 */
export function applyExtensionManifestHostPermissions<T extends { host_permissions?: string[] }>(
  manifest: T,
  profile: ExtensionManifestBuildProfile
): T {
  return {
    ...manifest,
    host_permissions: [...resolveExtensionManifestHostPermissions(profile)]
  }
}
