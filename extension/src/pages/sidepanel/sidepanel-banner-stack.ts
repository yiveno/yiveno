/**
 * Side Panel header 横幅优先级与同屏折叠（P1-15）。
 * 纯函数：输入各条显示条件 → 有序活跃列表；同屏最多 2 条，其余进展开行。
 */

/** 横幅身份（按优先级高→低顺序枚举成员即默认序）。 */
export type SidepanelBannerId =
  | 'offline' // 离线状态条
  | 'website_mismatch' // 官网账号与扩展不一致
  | 'sign_out_remap' // 退登回迁提示
  | 'website_connect' // 官网已登录 → Connect 扩展
  | 'post_release' // 冷启动放行后轻条

/** 高→低；全量活跃时按此序取前 cap 条。 */
export const SIDEPANEL_BANNER_PRIORITY: readonly SidepanelBannerId[] = [
  'offline',
  'website_mismatch',
  'sign_out_remap',
  'website_connect',
  'post_release'
] as const

/** 同屏直接渲染条数上限（展开行本身不计入）。 */
export const SIDEPANEL_BANNER_VISIBLE_CAP = 2

/** 各横幅是否活跃。 */
export type SidepanelBannerFlags = Record<SidepanelBannerId, boolean>

/**
 * 按优先级收敛活跃横幅列表（高→低）。
 * 仅包含 `true` 的条；不截断——截断交给 `splitSidepanelBannerStack`。
 */
export function resolveSidepanelBannerStack(flags: SidepanelBannerFlags): SidepanelBannerId[] {
  return SIDEPANEL_BANNER_PRIORITY.filter(id => flags[id])
}

/**
 * 同屏最多 `cap` 条；其余进 overflow（由「更多提示」展开）。
 * `cap` 默认 {@link SIDEPANEL_BANNER_VISIBLE_CAP}。
 */
export function splitSidepanelBannerStack(
  active: readonly SidepanelBannerId[],
  cap: number = SIDEPANEL_BANNER_VISIBLE_CAP
): { visible: SidepanelBannerId[]; overflow: SidepanelBannerId[] } {
  const safeCap = Math.max(0, Math.floor(cap))
  return {
    visible: active.slice(0, safeCap),
    overflow: active.slice(safeCap)
  }
}
