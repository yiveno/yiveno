/**
 * 将 Vite 产物整理为 Chrome 扩展可加载的 dist/ 布局。
 *
 * - sidepanel.html / settings.html 等到 dist 根目录
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
  flattenHtmlFile(source, destination, page)
}

/** DEV-only：`src/dev/<name>/index.html` → dist 根 `<name>.html`。 */
function flattenDevHtml(name) {
  const source = path.join(distDir, 'src', 'dev', name, 'index.html')
  const destination = path.join(distDir, `${name}.html`)
  flattenHtmlFile(source, destination, name)
}

function flattenHtmlFile(source, destination, label) {
  if (!fs.existsSync(source)) {
    console.warn(`[clean-dist] 跳过 ${label}：未找到 ${source}`)
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
      `[clean-dist] 跳过平铺 ${label}.html：缺少 ${missingCss.join(', ')}（保留上一版，避免坏链）`
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

/** 同步 manifest / _locales / images 等 public 白名单到 dist（不依赖 Vite 图）。 */
function syncExtensionPublicAssets() {
  if (!fs.existsSync(distDir)) {
    console.warn('[clean-dist] dist/ 不存在，跳过 public 同步')
    return
  }

  copyIfPresent(path.join(publicDir, 'manifest.json'), path.join(distDir, 'manifest.json'))
  copyIfPresent(path.join(publicDir, 'images'), path.join(distDir, 'images'))
  copyIfPresent(path.join(publicDir, '_locales'), path.join(distDir, '_locales'))
  copyIfPresent(path.join(publicDir, 'offscreen.html'), path.join(distDir, 'offscreen.html'))

  /**
   * 仅保留已接线产品 locale（en / zh_CN）。
   * 其它目录（空壳或实验）会在对应 Chrome UI 语言下加载失败，故剔除。
   */
  const allowedLocales = new Set(['en', 'zh_CN'])
  const localesDir = path.join(distDir, '_locales')
  if (fs.existsSync(localesDir)) {
    for (const entry of fs.readdirSync(localesDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || allowedLocales.has(entry.name)) {
        continue
      }
      fs.rmSync(path.join(localesDir, entry.name), { recursive: true, force: true })
      console.warn(`[clean-dist] 已移除未支持 locale 目录: _locales/${entry.name}`)
    }
  }
}

/** production dist：剔除 localhost Worker host（与 extension-manifest-profile.ts 同步）。 */
const EXTENSION_CWS_HOST_PERMISSIONS_PRODUCTION = [
  'https://*.supabase.co/*',
  'https://api.yiveno.com/*'
]

function applyDistManifestHostProfile(distManifestPath) {
  if (process.env.NODE_ENV !== 'production') {
    return
  }
  if (!fs.existsSync(distManifestPath)) {
    return
  }

  const manifest = JSON.parse(fs.readFileSync(distManifestPath, 'utf8'))
  manifest.host_permissions = [...EXTENSION_CWS_HOST_PERMISSIONS_PRODUCTION]
  fs.writeFileSync(distManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log('[clean-dist] production manifest: 已移除 localhost API host_permissions')
}

function finalizeExtensionDist() {
  if (!fs.existsSync(distDir)) {
    console.warn('[clean-dist] dist/ 不存在，跳过')
    return
  }

  syncExtensionPublicAssets()
  applyDistManifestHostProfile(path.join(distDir, 'manifest.json'))

  flattenPageHtml('sidepanel')
  flattenPageHtml('settings')
  flattenPageHtml('detail')
  flattenPageHtml('library')
  flattenPageHtml('getting-started')

  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction) {
    // CWS / production：确保无 DEV Probe Console 残留
    removeIfPresent(path.join(distDir, 'probe-console.html'))
    removeIfPresent(path.join(distDir, 'probe_console.js'))
    removeIfPresent(path.join(distDir, 'probe-console.js'))
  } else {
    flattenDevHtml('probe-console')
  }

  purgeNonExtensionAssets()

  const nestedSrcDir = path.join(distDir, 'src')
  if (fs.existsSync(nestedSrcDir)) {
    fs.rmSync(nestedSrcDir, { recursive: true, force: true })
  }

  // 移除历史 popup 产物，避免误加载
  removeIfPresent(path.join(distDir, 'popup.html'))
  removeIfPresent(path.join(distDir, 'popup.js'))

  const readyParts = [
    'sidepanel.html',
    'settings.html',
    'detail.html',
    'library.html',
    'getting-started.html',
    'manifest.json'
  ]
  if (!isProduction) {
    readyParts.splice(5, 0, 'probe-console.html')
  }
  console.log(`[clean-dist] 扩展产物已就绪：${readyParts.join(' / ')}`)
}

module.exports = { finalizeExtensionDist, syncExtensionPublicAssets, applyDistManifestHostProfile }

if (require.main === module) {
  finalizeExtensionDist()
}
