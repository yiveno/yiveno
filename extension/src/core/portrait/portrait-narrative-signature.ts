/**
 * 画像叙事缓存签名：参与摘要的 factId + state + inPortrait 排序拼接后哈希。
 */

/** FNV-1a 32-bit → 8 位 hex（同步、无 WebCrypto 依赖）。 */
export function hashPortraitSignatureMaterial(material: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < material.length; i += 1) {
    h ^= material.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export type PortraitFactSignaturePart = {
  factId: string
  state: string
  inPortrait: boolean
}

/**
 * 构建事实签名。同集合同签名；批准/忽略改变 inPortrait 或成员后签名变化。
 */
export function buildPortraitFactSignature(parts: readonly PortraitFactSignaturePart[]): string {
  const lines = parts
    .map(p => `${p.factId}\0${p.state}\0${p.inPortrait ? '1' : '0'}`)
    .sort((a, b) => a.localeCompare(b))
  return hashPortraitSignatureMaterial(lines.join('\n'))
}
