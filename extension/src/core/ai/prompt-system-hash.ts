/**
 * Prompt 版本哈希（FNV-1a 32-bit → 8 位 hex）。
 * 供 parse 缓存键 / 画像签名等「system 文案变化 → 键失效」共用；同步、无 WebCrypto。
 */

/** FNV-1a 32-bit → 8 位 hex。 */
export function hashPromptSystemMaterial(material: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < material.length; i += 1) {
    h ^= material.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
