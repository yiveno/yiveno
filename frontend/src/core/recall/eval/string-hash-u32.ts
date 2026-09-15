/**
 * 轻量确定性字符串哈希：FNV-1a 32-bit；无依赖、可在浏览器与 Node 双跑。
 * 专给 fake embedding 做种子推导用，不需要加密强度。
 */

/** FNV-1a 32-bit offset basis。 */
const FNV_OFFSET_BASIS = 0x811c9dc5
/** FNV-1a 32-bit prime。 */
const FNV_PRIME = 0x01000193

export function stringHashU32(input: string): number {
  let hash = FNV_OFFSET_BASIS
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i) & 0xff
    hash = Math.imul(hash, FNV_PRIME) >>> 0
  }
  return hash >>> 0
}
