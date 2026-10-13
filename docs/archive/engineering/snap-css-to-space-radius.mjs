/**
 * 将 extension 样式里偏离 brand 阶梯的间距/圆角，收到**既有** --space-* / --radius-*。
 * 不发明字号 token；1–2px 发丝光学微调保留（由 stylelint 白名单）。
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 归档：一次性 spacing/radius 对齐脚本（原 `scripts/snap-css-to-space-radius.mjs`）。按需：`bun docs/archive/engineering/snap-css-to-space-radius.mjs` */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../extension/src')

const SPACE_SCALE = [4, 8, 12, 16, 24, 32, 48, 64]
const SPACE = {
  4: 'var(--space-2xs)',
  8: 'var(--space-xs)',
  12: 'var(--space-sm)',
  16: 'var(--space-md)',
  24: 'var(--space-lg)',
  32: 'var(--space-xl)',
  48: 'var(--space-2xl)',
  64: 'var(--space-3xl)',
  // 精确组合（仍只用既有阶梯，不新造档）
  40: 'calc(var(--space-xl) + var(--space-xs))'
}

const RADIUS = {
  4: 'var(--radius-xs)',
  8: 'var(--radius-sm)',
  10: 'var(--radius)',
  12: 'var(--radius-lg)',
  16: 'var(--radius-xl)',
  // 大圆角：收到既有档，不新增
  20: 'var(--radius-xl)',
  28: 'var(--radius-full)',
  2: 'var(--radius-xs)'
}

/** @param {number} n */
function nearestSpace(n) {
  if (SPACE[n]) return SPACE[n]
  const hit = SPACE_SCALE.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best))
  return SPACE[hit]
}

/** @param {number} n @param {boolean} neg */
function mapSpace(n, neg) {
  // 发丝：保留，交给门禁白名单
  if (n === 1 || n === 2) return null
  const expr = nearestSpace(n)
  return neg ? `calc(-1 * ${expr})` : expr
}

/** @param {number} n @param {boolean} neg */
function mapRadius(n, neg) {
  if (n === 1) return null
  let expr = RADIUS[n]
  if (!expr) {
    const scale = [4, 8, 10, 12, 16]
    const hit = scale.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best))
    expr = RADIUS[hit]
  }
  return neg ? `calc(-1 * ${expr})` : expr
}

const declRe = /(?<prop>(?:padding|margin|gap|border-radius)(?:-[a-z]+)?)\s*:\s*(?<val>[^;{]+);/gi

/**
 * @param {string} css
 */
function transformCss(css) {
  let changed = 0
  const next = css.replace(declRe, (full, prop, val) => {
    if (/\bvar\(/.test(val)) {
      // 已有 token 的声明里仍可能混有裸 px（如 padding: 4px 6px）
    }
    const base = prop.match(/^(padding|margin|gap|border-radius)/i)?.[1]?.toLowerCase()
    if (!base) return full
    const newVal = val.replace(/(-?)(\d+)px\b/g, (m, sign, num) => {
      const n = Number(num)
      const mapped =
        base === 'border-radius' ? mapRadius(n, sign === '-') : mapSpace(n, sign === '-')
      if (!mapped) return m
      changed += 1
      return mapped
    })
    if (newVal === val) return full
    return `${prop}: ${newVal.trim()};`
  })
  return { css: next, changed }
}

/** @param {string} dir */
async function walk(dir) {
  const out = []
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...(await walk(p)))
    else if (/\.(vue|css)$/.test(ent.name)) out.push(p)
  }
  return out
}

let filesTouched = 0
let replacements = 0

for (const file of await walk(root)) {
  const raw = await readFile(file, 'utf8')
  if (file.endsWith('.css')) {
    const { css, changed } = transformCss(raw)
    if (changed > 0) {
      await writeFile(file, css)
      filesTouched += 1
      replacements += changed
      console.log(`${path.relative(root, file)} · ${changed}`)
    }
    continue
  }
  let fileChanged = 0
  const next = raw.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (block, inner) => {
    const { css, changed } = transformCss(inner)
    fileChanged += changed
    return block.replace(inner, css)
  })
  if (fileChanged > 0) {
    await writeFile(file, next)
    filesTouched += 1
    replacements += fileChanged
    console.log(`${path.relative(root, file)} · ${fileChanged}`)
  }
}

console.log(`done: ${filesTouched} files, ${replacements} snaps → existing space/radius`)
