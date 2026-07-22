/**
 * 将 Vite 产物整理为 Chrome 扩展可加载的 dist/ 布局。
 *
 * - popup.html / settings.html 放到 dist 根目录
 * - 修正 HTML 内 ../../../ 资源引用为 ./
 * - 复制 manifest、icons、locales、offscreen.html
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

  fs.writeFileSync(destination, html, 'utf8')
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

  flattenPageHtml('popup')
  flattenPageHtml('settings')

  const nestedSrcDir = path.join(distDir, 'src')
  if (fs.existsSync(nestedSrcDir)) {
    fs.rmSync(nestedSrcDir, { recursive: true, force: true })
  }

  console.log('[clean-dist] 扩展产物已就绪：popup.html / settings.html / manifest.json')
}

module.exports = { finalizeExtensionDist }

if (require.main === module) {
  finalizeExtensionDist()
}
