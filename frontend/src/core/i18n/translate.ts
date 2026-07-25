/**
 * 可注入的翻译函数（core 无 chrome 依赖）。
 * infrastructure `t` 满足此签名。
 */
export type TranslateFn = (key: string, substitutions?: string | string[]) => string
