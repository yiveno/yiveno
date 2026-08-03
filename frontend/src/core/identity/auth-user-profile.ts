/**
 * 从 Supabase / OAuth user_metadata 提取展示用头像与名称。
 * Google 常见 `avatar_url` 或 `picture`；名称常见 `name` / `full_name`。
 */

/** 读取非空字符串字段。 */
function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

/**
 * 提取头像 URL。
 * @returns 未找到时 undefined
 */
export function extractAvatarUrlFromUserMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | undefined {
  if (!metadata) {
    return undefined
  }
  return (
    readNonEmptyString(metadata.avatar_url) ??
    readNonEmptyString(metadata.picture) ??
    readNonEmptyString(metadata.avatarUrl)
  )
}

/**
 * 提取展示名。
 * @returns 未找到时 undefined
 */
export function extractDisplayNameFromUserMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | undefined {
  if (!metadata) {
    return undefined
  }
  return (
    readNonEmptyString(metadata.name) ??
    readNonEmptyString(metadata.full_name) ??
    readNonEmptyString(metadata.display_name) ??
    readNonEmptyString(metadata.displayName)
  )
}
