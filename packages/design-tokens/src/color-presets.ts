/**
 * 官方配色预设（色相维度）
 *
 * 与「外观」亮/暗（data-theme）正交；每套预设对应 Material Theme Builder 以 `seedHex`
 * 生成的一整族 M3 变量（含 light + dark）。
 *
 * **产品文档**：`docs/product/AcuityBookmarks-产品文档-v3.0.md` §2.5.5 与本文件保持同步；
 * 增删改预设时请先改此处，再更新文档表格。
 *
 * **CSS 产物**：`packages/design-tokens/css/presets/<id>.css` 由根目录 Builder 导出文件夹经
 * `scripts/build-material-color-presets.mjs` 生成；文件夹名 `Skyline`→`default`，`Twilight`→`violet`，其余 id 同文件夹名（小写）。
 */

/** Builder / `data-color-preset` / 存储用的预设 id */
export const COLOR_PRESET_IDS = ['default', 'ocean', 'forest', 'ember', 'violet', 'slate'] as const

export type ColorPresetId = (typeof COLOR_PRESET_IDS)[number]

/** 单条预设元数据（不含导出 CSS，CSS 由 Builder 合并入仓库） */
export interface ColorPresetDefinition {
  id: ColorPresetId
  /** 中文展示名 */
  nameZh: string
  /** 内部英文名（日志、代码注释） */
  nameEn: string
  /** Material Theme Builder 核心/主色种子（#RRGGBB） */
  seedHex: string
  /** 产品向气质说明（中文） */
  vibeZh: string
}

const HEX6 = /^#[0-9A-Fa-f]{6}$/

function assertHex(label: string, hex: string): string {
  if (!HEX6.test(hex)) {
    throw new Error(`[color-presets] ${label} 非法 seedHex: ${hex}`)
  }
  return hex
}

/**
 * 六套官方配色（顺序即设置页默认展示顺序；`default` 须与当前品牌默认一致）
 */
export const COLOR_PRESET_DEFINITIONS: readonly ColorPresetDefinition[] = [
  {
    id: 'default',
    nameZh: '晴空',
    nameEn: 'Skyline',
    seedHex: assertHex('default', '#3B82F6'),
    vibeZh: '与现有 Logo 蓝一致，默认品牌色'
  },
  {
    id: 'ocean',
    nameZh: '碧海',
    nameEn: 'Ocean',
    seedHex: assertHex('ocean', '#0E7490'),
    vibeZh: '偏青绿，冷静、工具感'
  },
  {
    id: 'forest',
    nameZh: '森雾',
    nameEn: 'Forest',
    seedHex: assertHex('forest', '#047857'),
    vibeZh: '偏祖母绿，自然、长时间阅读'
  },
  {
    id: 'ember',
    nameZh: '琥珀',
    nameEn: 'Ember',
    seedHex: assertHex('ember', '#C2410C'),
    vibeZh: '偏暖橙琥珀，偏活力不是错误红'
  },
  {
    id: 'violet',
    nameZh: '暮紫',
    nameEn: 'Twilight',
    seedHex: assertHex('violet', '#6D28D9'),
    vibeZh: '紫，偏「智能/创意」但不荧光'
  },
  {
    id: 'slate',
    nameZh: '岩灰',
    nameEn: 'Slate',
    seedHex: assertHex('slate', '#475569'),
    vibeZh: '冷灰蓝，克制、贴近系统工具栏'
  }
]

/**
 * 校验字符串是否为已注册的配色预设 id（如来自 chrome.storage）
 */
export function isColorPresetId(value: unknown): value is ColorPresetId {
  return typeof value === 'string' && (COLOR_PRESET_IDS as readonly string[]).includes(value)
}

/**
 * 归一化存储值：非法或缺失时回退到默认预设
 */
export function normalizeColorPresetId(value: unknown): ColorPresetId {
  return isColorPresetId(value) ? value : 'default'
}

/**
 * 按 id 取定义；未知 id 时回退 `default`
 */
export function getColorPresetDefinition(id: unknown): ColorPresetDefinition {
  const normalized = normalizeColorPresetId(id)
  const found = COLOR_PRESET_DEFINITIONS.find(p => p.id === normalized)
  return found ?? COLOR_PRESET_DEFINITIONS[0]!
}
