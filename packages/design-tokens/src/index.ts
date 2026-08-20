/**
 * @yiveno/design-tokens
 *
 * Yiveno 设计令牌包。
 * **品牌权威：** `css/brand.css` + `src/brand.ts`（Ink/Paper/Sage + Product Roles）。
 * Material Theme 路径保留供扩展过渡，不作品牌标准。
 */

export * from './brand'
export * from './colors'
export * from './spacing'
export * from './typography'
export * from './animations'
export * from './effects'
export * from './css-vars'

/** @deprecated 请改用 `./brand`；保留 re-export 以免旧路径瞬间断裂 */
export * from './color-presets'

export { brandCore as default } from './brand'
