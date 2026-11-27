/**
 * 画像叙事 / 聚类缓存签名：事实材料 + system prompt 版本哈希。
 * system 文案变化 → 签名变化 → 旧缓存自然失效（无迁移）。
 */

import { hashPromptSystemMaterial } from '@/core/ai/prompt-system-hash'

/** FNV-1a 32-bit → 8 位 hex（同步、无 WebCrypto 依赖）；与 prompt 版本哈希同算法。 */
export function hashPortraitSignatureMaterial(material: string): string {
  return hashPromptSystemMaterial(material)
}

export type PortraitFactSignaturePart = {
  factId: string
  state: string
  inPortrait: boolean
}

/**
 * 构建缓存签名。同集合同签名；批准/忽略改变 inPortrait 或成员后签名变化；
 * systemPrompt 文案变化亦改变签名。
 */
export function buildPortraitFactSignature(
  parts: readonly PortraitFactSignaturePart[],
  systemPrompt: string
): string {
  const lines = parts
    .map(p => `${p.factId}\0${p.state}\0${p.inPortrait ? '1' : '0'}`)
    .sort((a, b) => a.localeCompare(b))
  const factHash = hashPortraitSignatureMaterial(lines.join('\n'))
  const promptHash = hashPortraitSignatureMaterial(systemPrompt)
  return hashPortraitSignatureMaterial(`${factHash}\0${promptHash}`)
}
