/**
 * @deprecated 多品牌 MD 预设已下线（设计标准 v1.3+）。
 * 品牌色唯一权威：`css/brand.css` / `src/brand.ts`。
 * 扩展：`css/md-sys-brand-alias.css`。
 *
 * 本文件仅保留空导出，避免历史 import 路径瞬间断裂；勿再扩展。
 */

/** @deprecated 已无运行时预设 */
export const COLOR_PRESET_IDS = [] as const

/** @deprecated */
export type ColorPresetId = never

/** @deprecated */
export interface ColorPresetDefinition {
  id: string
  nameZh: string
  nameEn: string
  seedHex: string
  vibeZh: string
}

/** @deprecated 空表 */
export const COLOR_PRESET_DEFINITIONS: readonly ColorPresetDefinition[] = []

/** @deprecated */
export function getColorPresetDefinition(): ColorPresetDefinition | undefined {
  return undefined
}
