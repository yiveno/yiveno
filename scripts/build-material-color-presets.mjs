/**
 * 将项目根目录 Material Theme Builder 导出（每套文件夹内 light.css / dark.css，
 * 选择器为 .light / .dark）转换为 design-tokens 使用的
 * data-color-preset + data-theme 结构，写入 packages/design-tokens/css/presets/
 *
 * 映射：Twilight → preset id `violet`（与 color-presets.ts 一致）
 *
 * 用法：在仓库根目录 `bun scripts/build-material-color-presets.mjs`
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const OUT_DIR = join(
  REPO_ROOT,
  'packages/design-tokens/css/presets'
)

/** @typedef {{ folder: string, presetId: string, titleZh: string, isDefault?: boolean }} Row */
const ROWS = /** @type {const} */ ([
  { folder: 'Skyline', presetId: 'default', titleZh: '晴空（默认）', isDefault: true },
  { folder: 'Ocean', presetId: 'ocean', titleZh: '碧海' },
  { folder: 'Forest', presetId: 'forest', titleZh: '森雾' },
  { folder: 'Ember', presetId: 'ember', titleZh: '琥珀' },
  { folder: 'Twilight', presetId: 'violet', titleZh: '暮紫' },
  { folder: 'Slate', presetId: 'slate', titleZh: '岩灰' }
])

/**
 * @param {string} css
 * @param {'light' | 'dark'} kind
 */
function extractBlock(css, kind) {
  const re =
    kind === 'light'
      ? /\.light\s*\{([\s\S]*)\}\s*$/m
      : /\.dark\s*\{([\s\S]*)\}\s*$/m
  const m = css.trim().match(re)
  if (!m) {
    throw new Error(`无法解析 ${kind} 块（需为 .light { } / .dark { }）`)
  }
  return m[1].trim()
}

/**
 * @param {Row} row
 */
function buildPresetCss(row) {
  const lightPath = join(REPO_ROOT, row.folder, 'light.css')
  const darkPath = join(REPO_ROOT, row.folder, 'dark.css')
  const lightBody = extractBlock(readFileSync(lightPath, 'utf8'), 'light')
  const darkBody = extractBlock(readFileSync(darkPath, 'utf8'), 'dark')

  const head = `/**
 * Material 色板预设：${row.presetId}（${row.titleZh}）
 * 由 Material Theme Builder 导出经 scripts/build-material-color-presets.mjs 转换。
 * 勿手改生成体；更新时改根目录 ${row.folder}/light|dark.css 后重新运行脚本。
 */

`

  if (row.isDefault) {
    return (
      head +
      `/* 亮色：未设置 data-color-preset 或显式 default（兼容旧页面） */
:root:not([data-color-preset]),
:root[data-color-preset='default'] {
${indent(lightBody)}
}

/* 系统暗色：未强制浅色 */
@media (prefers-color-scheme: dark) {
  :root:not([data-color-preset]):not([data-theme='light']),
  :root[data-color-preset='default']:not([data-theme='light']) {
${indent(darkBody)}
  }
}

/* 用户强制暗色（含浅色 OS） */
:root:not([data-color-preset])[data-theme='dark'],
:root[data-color-preset='default'][data-theme='dark'] {
${indent(darkBody)}
}
`
    )
  }

  return (
    head +
    `/* 亮色 */
:root[data-color-preset='${row.presetId}'] {
${indent(lightBody)}
}

@media (prefers-color-scheme: dark) {
  :root[data-color-preset='${row.presetId}']:not([data-theme='light']) {
${indent(darkBody)}
  }
}

:root[data-color-preset='${row.presetId}'][data-theme='dark'] {
${indent(darkBody)}
}
`
  )
}

/** @param {string} body */
function indent(body) {
  return body
    .split('\n')
    .map(line => (line.trim() === '' ? '' : '  ' + line))
    .join('\n')
}

mkdirSync(OUT_DIR, { recursive: true })

for (const row of ROWS) {
  const name = row.isDefault ? 'default' : row.presetId
  const out = join(OUT_DIR, `${name}.css`)
  writeFileSync(out, buildPresetCss(row), 'utf8')
  console.log('written', out)
}

console.log('done')
