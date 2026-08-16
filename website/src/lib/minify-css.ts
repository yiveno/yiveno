import { transformSync } from 'esbuild'

/** 构建时压缩内联 CSS（?raw 不会走 Vite css minify） */
export function minifyCss(code: string): string {
  return transformSync(code, { loader: 'css', minify: true }).code
}
