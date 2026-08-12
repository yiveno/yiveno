/**
 * 将 Vite 产物整理为 Chrome 扩展可加载的 dist/ 布局。
 *
 * - popup.html / settings.html 放到 dist 根目录
 * - 修正 HTML 内 ../../../ 资源引用为 ./
 * - 仅复制扩展运行所需的 public 白名单资产（不含 models / 营销 logo）
 */
const fs = require('fs')
const path = require('path')

const frontendDir = path.resolve(__dirname, '..')
const distDir = path.resolve(frontendDir, '..', 'dist')
const publicDir = path.join(frontendDir, 'public')

function copyIfPresent(source, destination) {
  if (fs.existsSync(source)) {
    fs.cpSync(source, destination, { recursive: true })
  }
}

function removeIfPresent(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true })
  }
}

/** 将嵌套页面 HTML 平铺到 dist 根目录并修正资源路径。 */
function flattenPageHtml(page) {
  const source = path.join(distDir, 'src', 'pages', page, 'index.html')
  const destination = path.join(distDir, `${page}.html`)

  if (!fs.existsSync(source)) {
    console.warn(`[clean-dist] 跳过 ${page}：未找到 ${source}`)
    return
  }

  const html = fs
    .readFileSync(source, 'utf8')
    .replace(/(?:\.\.\/){3}/g, './')
    .replace(/src="\/([^"]+)"/g, 'src="./$1"')
    .replace(/href="\/([^"]+)"/g, 'href="./$1"')

  const missingCss = [...html.matchAll(/href="(\.\/assets\/[^"]+\.css)"/g)]
    .map(match => match[1])
    .filter(href => !fs.existsSync(path.join(distDir, href.slice(2))))

  if (missingCss.length > 0) {
    console.warn(
      `[clean-dist] 跳过平铺 ${page}.html：缺少 ${missingCss.join(', ')}（保留上一版，避免坏链）`
    )
    return
  }

  fs.writeFileSync(destination, html, 'utf8')
}

/** 清除 Vite/历史构建可能残留的非扩展资产。 */
function purgeNonExtensionAssets() {
  for (const name of [
    'models',
    'logo.png',
    'logo.webp',
    'logo-dark.png',
    'logo-dark.webp',
    'favicon.ico',
    'favicon-16x16.png',
    'favicon-32x32.png'
  ]) {
    removeIfPresent(path.join(distDir, name))
  }
}

function finalizeExtensionDist() {
  if (!fs.existsSync(distDir)) {
    console.warn('[clean-dist] dist/ 不存在，跳过')
    return
  }

  copyIfPresent(path.join(publicDir, 'manifest.json'), path.join(distDir, 'manifest.json'))
  copyIfPresent(path.join(publicDir, 'images'), path.join(distDir, 'images'))
  copyIfPresent(path.join(publicDir, '_locales'), path.join(distDir, '_locales'))
  copyIfPresent(path.join(publicDir, 'offscreen.html'), path.join(distDir, 'offscreen.html'))

  /** 仅保留 en；空目录或非 en locale 会导致 Chrome 在对应 UI 语言下加载失败。 */
  const localesDir = path.join(distDir, '_locales')
  if (fs.existsSync(localesDir)) {
    for (const entry of fs.readdirSync(localesDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'en') {
        continue
      }
      fs.rmSync(path.join(localesDir, entry.name), { recursive: true, force: true })
      console.warn(`[clean-dist] 已移除非 en locale 目录: _locales/${entry.name}`)
    }
  }

  flattenPageHtml('popup')
  flattenPageHtml('settings')
  flattenPageHtml('detail')
  flattenPageHtml('library')
  purgeNonExtensionAssets()

  const nestedSrcDir = path.join(distDir, 'src')
  if (fs.existsSync(nestedSrcDir)) {
    fs.rmSync(nestedSrcDir, { recursive: true, force: true })
  }

  console.log(
    '[clean-dist] 扩展产物已就绪：popup.html / settings.html / detail.html / library.html / manifest.json'
  )
}

module.exports = { finalizeExtensionDist }

if (require.main === module) {
  finalizeExtensionDist()
}
