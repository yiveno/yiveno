const fs = require('fs')
const path = require('path')

const frontendDir = path.resolve(__dirname, '..')
const distDir = path.resolve(frontendDir, '..', 'dist')
const publicDir = path.join(frontendDir, 'public')

function copyIfPresent(source, destination) {
  if (fs.existsSync(source)) fs.cpSync(source, destination, { recursive: true })
}

copyIfPresent(path.join(publicDir, 'manifest.json'), path.join(distDir, 'manifest.json'))
copyIfPresent(path.join(publicDir, 'images'), path.join(distDir, 'images'))
copyIfPresent(path.join(publicDir, '_locales'), path.join(distDir, '_locales'))
copyIfPresent(path.join(publicDir, 'offscreen.html'), path.join(distDir, 'offscreen.html'))

for (const page of ['popup', 'settings']) {
  const source = path.join(distDir, 'src', 'pages', page, 'index.html')
  const destination = path.join(distDir, `${page}.html`)
  if (fs.existsSync(source)) fs.renameSync(source, destination)
}

const sourceDir = path.join(distDir, 'src')
if (fs.existsSync(sourceDir)) fs.rmSync(sourceDir, { recursive: true, force: true })

