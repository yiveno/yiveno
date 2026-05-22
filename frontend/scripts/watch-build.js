#!/usr/bin/env bun

/**
 * Chrome扩展热更新构建脚本
 * 监听源文件变化，自动重新构建并更新dist目录
 */

import { exec, execSync, spawn } from 'child_process'
import { readFileSync, watch } from 'fs'
import path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

// 统一脚本日志：作用域化代理到自定义logger
import loggerMod from './logger.cjs'
const { createLogger } = loggerMod
const __scriptLogger__ = createLogger('WatchBuild')
// 使用脚本级日志器，不代理 console 以避免递归

// 配置选项
// 默认跳过 ESLint（专注热更新与快速编译）；
// 如需在热构建中开启 ESLint，显式设置环境变量 SKIP_ESLINT=false。
const SKIP_ESLINT = process.env.SKIP_ESLINT !== 'false'
// 热构建默认连接到 Cloudflare 本地服务 (https://localhost:8787，强制 HTTPS 避免 CSP 限制)

const srcDir = path.join(process.cwd(), 'src')
const publicDir = path.join(process.cwd(), 'public')
const rootDir = path.join(process.cwd(), '../')
const distDir = path.join(rootDir, 'dist')
// ⚠️ 重要：Vite 从项目根目录读取 .env.development，所以我们也应该从根目录读取
const projectRoot = rootDir // 项目根目录（包含 vite.config.ts 的目录）

let buildProcess = null
let isBuilding = false
let buildQueue = false
// 追踪最近变更的文件类型（用于判断是否需要重新加载扩展）
let lastChangedFiles = {
  needsReload: false, // 是否需要重新加载扩展
  files: [] // 变更的文件列表
}

__scriptLogger__.info(
  `🚀 启动Chrome扩展热更新模式 ${SKIP_ESLINT ? '' : '(集成ESLint自动修复与严格检查)'}...`
)
__scriptLogger__.info('✨ 构建流程:')
if (!SKIP_ESLINT) {
  __scriptLogger__.info('  1. 🔍 ESLint 自动修复代码')
  __scriptLogger__.info('  2. ✅ ESLint 严格检查 (不通过则阻止构建)')
  __scriptLogger__.info('  3. 🔨 Vite 构建项目')
  __scriptLogger__.info('  4. 🧹 清理构建产物')
} else {
  __scriptLogger__.info('  1. 🔨 Vite 构建项目 (跳过ESLint)')
  __scriptLogger__.info('  2. 🧹 清理构建产物')
}
__scriptLogger__.info('📁 监听目录:')
__scriptLogger__.info('  - src/')
__scriptLogger__.info('  - public/')
__scriptLogger__.info('  - *.html')
__scriptLogger__.info('  - background.js (根目录)')
__scriptLogger__.info('')

__scriptLogger__.info('⚙️ 构建目标服务选择:')
__scriptLogger__.info('  - 默认: Cloudflare 本地 (https://localhost:8787)')
__scriptLogger__.info(
  '  - 如需使用线上 Worker，请设置 VITE_API_BASE_URL/VITE_CLOUDFLARE_WORKER_URL'
)
__scriptLogger__.info('')

function getBuildEnv() {
  const env = { ...process.env }

  // 🔒 先清除 process.env 中的 HTTP 配置（从根源解决问题）
  // 避免 HTTP 值污染后续逻辑
  if (env.VITE_API_BASE_URL?.startsWith('http://')) {
    delete env.VITE_API_BASE_URL
  }
  if (env.VITE_CLOUDFLARE_WORKER_URL?.startsWith('http://')) {
    delete env.VITE_CLOUDFLARE_WORKER_URL
  }

  // ⚠️ 重要：Vite 会自动读取项目根目录的 .env 文件（基础配置）
  // 我们也从项目根目录读取，确保 watch-build.js 和 Vite 读取的是同一个文件
  // 优先级：.env.local > .env.development/.env.production > .env
  // 但由于我们已经整合到 .env，现在主要从 .env 读取
  const envBasePath = path.join(projectRoot, '.env')
  __scriptLogger__.info(`🔍 读取环境变量文件: ${envBasePath}`)
  try {
    const envContent = readFileSync(envBasePath, 'utf-8')
    const envLines = envContent.split('\n')
    for (const line of envLines) {
      const trimmed = line.trim()
      // 跳过注释和空行
      if (!trimmed || trimmed.startsWith('#')) continue
      // 解析 KEY="VALUE" 或 KEY=VALUE 格式
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (match) {
        const key = match[1]
        let value = match[2]
        // 移除引号
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        // 🔒 如果值是 HTTP，转换为 HTTPS（不允许 HTTP）
        if (value.startsWith('http://')) {
          value = value.replace('http://', 'https://')
          __scriptLogger__.warn(`⚠️  .env 中的 HTTP 已转换为 HTTPS: ${key}=${value}`)
        }
        // ✅ 优先使用文件中的值（覆盖进程环境变量）
        // 特别是对于 VITE_API_BASE_URL 和 VITE_CLOUDFLARE_WORKER_URL
        // 注意：开发环境的 API URL 不应该从 .env 读取，由下面逻辑自动设置
        if (key === 'VITE_API_BASE_URL' || key === 'VITE_CLOUDFLARE_WORKER_URL') {
          // 开发环境时，这些值由脚本自动管理，不覆盖
          // 生产环境时，使用 .env 中的值
          if (process.env.NODE_ENV === 'production') {
            env[key] = value
          }
        } else if (!env[key]) {
          // 其他配置（如 VITE_CLOUDFLARE_MODE）可以从 .env 读取
          env[key] = value
        }
      }
    }
  } catch {
    // 文件不存在或读取失败，忽略（使用默认值）
  }

  // 智能检测后端运行模式
  const cfLocal = 'https://localhost:8787'
  const cfRemote = 'https://acuitybookmarks.cqw547847.workers.dev'

  // 优先级 1: 显式设置的环境变量（最高优先级）
  // 🔒 如果环境变量是 HTTP，先转换为 HTTPS
  let cfUrl = env.VITE_CLOUDFLARE_WORKER_URL || env.VITE_API_BASE_URL
  if (cfUrl && cfUrl.startsWith('http://')) {
    cfUrl = cfUrl.replace('http://', 'https://')
    __scriptLogger__.warn(`⚠️  环境变量中的 HTTP 已转换为 HTTPS: ${cfUrl}`)
  }

  // 优先级 2: 检查 VITE_USE_REMOTE 环境变量
  if (!cfUrl) {
    if (process.env.VITE_USE_REMOTE === 'true') {
      cfUrl = cfRemote
      __scriptLogger__.info('🔍 检测到 VITE_USE_REMOTE=true，使用远程 Worker')
    } else if (process.env.VITE_USE_REMOTE === 'false') {
      cfUrl = cfLocal
      __scriptLogger__.info('🔍 检测到 VITE_USE_REMOTE=false，使用本地服务')
    }
  }

  // 优先级 3: 尝试检测后端服务运行模式（检查进程）
  if (!cfUrl) {
    try {
      // 检查是否有 wrangler 进程在运行
      const processes = execSync('ps aux | grep wrangler | grep -v grep || true', {
        encoding: 'utf8'
      })

      if (processes.includes('--remote')) {
        // ⚠️ 重要：--remote 模式的本地代理是 HTTP，Chrome Extension 需要 HTTPS
        // 因此直接使用远程 Worker URL，不通过本地代理
        cfUrl = cfRemote
        __scriptLogger__.info('🔍 自动检测：后端运行在远程模式（--remote）')
        __scriptLogger__.info('   → 使用远程 Worker URL（避免本地 HTTP 代理的 HTTPS 问题）')
      } else if (processes.includes('--local')) {
        cfUrl = cfLocal
        __scriptLogger__.info('🔍 自动检测：后端运行在本地模式（--local），使用本地 HTTPS 服务')
      } else {
        // 默认使用本地（开发环境最常见）
        cfUrl = cfLocal
        __scriptLogger__.info('🔍 未检测到后端进程，默认使用本地服务')
      }
    } catch {
      // 检测失败，使用默认值
      cfUrl = cfLocal
      __scriptLogger__.info('🔍 自动检测失败，默认使用本地服务')
    }
  }

  // 🔒 强制 HTTPS：如果检测到 HTTP，自动转换为 HTTPS
  if (cfUrl.startsWith('http://')) {
    cfUrl = cfUrl.replace('http://', 'https://')
    __scriptLogger__.warn(`⚠️  检测到 HTTP 地址，已自动转换为 HTTPS: ${cfUrl}`)
  }

  // 如果仍然是 HTTP（127.0.0.1 或 localhost），强制使用 HTTPS
  if (cfUrl.includes('127.0.0.1:8787') && !cfUrl.startsWith('https://')) {
    cfUrl = 'https://127.0.0.1:8787'
  }
  if (cfUrl.includes('localhost:8787') && !cfUrl.startsWith('https://')) {
    cfUrl = 'https://localhost:8787'
  }

  // 🔒 强制覆盖：确保最终注入的值是 HTTPS（最高优先级）
  // 这一步会覆盖 .env.development 文件中的任何 HTTP 值
  env.VITE_API_BASE_URL = cfUrl // 统一注入
  env.VITE_CLOUDFLARE_WORKER_URL = cfUrl // 同步注入，便于代码读取
  env.VITE_CLOUDFLARE_MODE = 'true' // 显式告知前端处于 Cloudflare 模式
  env.VITE_HOT_BUILD = 'true' // 通知前端处于热构建模式，保留日志
  env.VITE_RUNTIME_ENV = 'dev'
  env.NODE_ENV = env.NODE_ENV || 'production'

  // 显示检测结果
  const mode = cfUrl.includes('localhost') || cfUrl.includes('127.0.0.1') ? '本地' : '远程'
  __scriptLogger__.info(`🌐 构建目标服务: Cloudflare ${mode} (${env.VITE_API_BASE_URL})`)
  __scriptLogger__.info(`   ✅ 已强制覆盖环境变量为 HTTPS（优先级高于 .env.development）`)
  // 🔍 调试：显示最终注入的环境变量值
  __scriptLogger__.info(
    `   🔍 最终注入的环境变量: VITE_API_BASE_URL=${env.VITE_API_BASE_URL}, VITE_CLOUDFLARE_WORKER_URL=${env.VITE_CLOUDFLARE_WORKER_URL}`
  )

  return env
}

// 获取构建产物大小
async function getBuildSize() {
  try {
    const { stdout } = await execAsync(`du -sh "${distDir}"`)
    return stdout.trim().split('\t')[0]
  } catch (_error) {
    __scriptLogger__.warn(
      '⚠️ 无法获取构建产物大小:',
      _error && _error.message ? _error.message : String(_error)
    )
    return '未知'
  }
}

// ESLint 修复函数
async function runESLintFix() {
  __scriptLogger__.info('🔍 执行 ESLint 修复...')
  const eslintStartTime = Date.now()

  try {
    // 使用与 CI 完全一致的脚本与规则执行 ESLint 修复
    const eslintProcess = spawn('bun', ['run', 'lint:fix'], {
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, CI: process.env.CI || 'true' }
    })

    let eslintOutput = ''
    eslintProcess.stdout.on('data', data => {
      eslintOutput += data.toString()
    })

    eslintProcess.stderr.on('data', data => {
      eslintOutput += data.toString()
    })

    await new Promise(resolve => {
      eslintProcess.on('close', code => {
        const eslintDuration = Date.now() - eslintStartTime

        if (code === 0) {
          __scriptLogger__.info(`✅ ESLint 修复完成! 耗时: ${eslintDuration}ms`)
          resolve()
        } else {
          __scriptLogger__.warn(`⚠️ ESLint 修复阶段检测到问题: ${eslintDuration}ms`)
          if (eslintOutput.trim()) {
            __scriptLogger__.info('📋 ESLint 输出:')
            __scriptLogger__.info(eslintOutput.trim())
          }
          resolve() // 进入严格检查环节，由严格检查决定是否继续
        }
      })

      eslintProcess.on('error', error => {
        __scriptLogger__.warn('⚠️ ESLint 执行失败:', error.message)
        resolve() // 即使ESLint失败也继续构建
      })
    })
  } catch (_error) {
    __scriptLogger__.warn(
      '⚠️ ESLint 修复过程中出错:',
      _error && _error.message ? _error.message : String(_error)
    )
    // 不中断构建流程，进入严格检查环节
  }
}

// ESLint 严格检查函数（失败则阻止后续构建）
async function runESLintCheck() {
  __scriptLogger__.info('✅ 执行 ESLint 严格检查...')
  const start = Date.now()
  try {
    const checkProcess = spawn('bun', ['run', 'lint:check'], {
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, CI: process.env.CI || 'true' }
    })

    let output = ''
    checkProcess.stdout.on('data', d => (output += d.toString()))
    checkProcess.stderr.on('data', d => (output += d.toString()))

    const result = await new Promise(resolve => {
      checkProcess.on('close', code => resolve({ code }))
      checkProcess.on('error', () => resolve({ code: 1 }))
    })

    const cost = Date.now() - start
    if (result.code === 0) {
      __scriptLogger__.info(`✅ ESLint 严格检查通过! 耗时: ${cost}ms`)
      return true
    }

    __scriptLogger__.error(`❌ ESLint 严格检查失败! 耗时: ${cost}ms`)
    if (output.trim()) {
      __scriptLogger__.info('📋 ESLint 输出:')
      __scriptLogger__.info(output.trim())
    }
    return false
  } catch (_error) {
    __scriptLogger__.error(
      '❌ 执行 ESLint 严格检查时发生错误:',
      _error && _error.message ? _error.message : String(_error)
    )
    return false
  }
}

// 构建函数
// 清理 Vite 缓存
async function cleanViteCache() {
  try {
    const viteCacheDir = path.join(process.cwd(), 'node_modules', '.vite')
    const { existsSync, rmSync } = await import('fs')
    if (existsSync(viteCacheDir)) {
      __scriptLogger__.info('🧹 清理 Vite 缓存...')
      rmSync(viteCacheDir, { recursive: true, force: true })
      __scriptLogger__.info('✅ Vite 缓存已清理')
    }
  } catch (error) {
    __scriptLogger__.warn('⚠️ 清理 Vite 缓存失败:', error.message)
    // 不中断构建流程
  }
}

async function build() {
  if (isBuilding) {
    buildQueue = true
    return
  }

  isBuilding = true

  // 每次构建前清理 Vite 缓存，确保使用最新的环境变量
  await cleanViteCache()

  __scriptLogger__.info('🔨 检测到文件变化，开始构建流程...')

  const totalStartTime = Date.now()

  try {
    // 步骤1: 执行 ESLint 修复 (可选)
    if (!SKIP_ESLINT) {
      await runESLintFix()
      const ok = await runESLintCheck()
      if (!ok) {
        __scriptLogger__.error('🛑 阻止后续构建：请先修复以上 ESLint 问题后重试。')
        __scriptLogger__.info('💡 若需暂时跳过，可使用脚本: `bun run build:hot:no-lint`')
        throw new Error('ESLint 检查未通过')
      }
    } else {
      __scriptLogger__.info('⏭️  跳过 ESLint 修复...')
    }

    // 步骤2: 执行构建
    __scriptLogger__.info('🔨 开始 Vite 构建...')
    const buildStartTime = Date.now()

    // 使用bun运行构建命令（根据参数设置 API 基础地址）
    buildProcess = spawn('bun', ['run', 'build'], {
      stdio: 'pipe',
      shell: true,
      env: getBuildEnv()
    })

    let output = ''
    buildProcess.stdout.on('data', data => {
      output += data.toString()
    })

    buildProcess.stderr.on('data', data => {
      output += data.toString()
    })

    await new Promise((resolve, reject) => {
      buildProcess.on('close', async code => {
        if (code === 0) {
          const buildDuration = Date.now() - buildStartTime
          const totalDuration = Date.now() - totalStartTime
          const buildSize = await getBuildSize()
          __scriptLogger__.info(`✅ Vite 构建完成! 耗时: ${buildDuration}ms`)
          __scriptLogger__.info(
            `🎯 总构建流程耗时: ${totalDuration}ms ${SKIP_ESLINT ? '(仅构建)' : '(ESLint + 构建)'}`
          )
          __scriptLogger__.info(`📦 构建产物大小: ${buildSize}`)
          __scriptLogger__.info('🔄 Chrome扩展已更新')

          // 根据变更的文件类型给出明确的提示
          if (lastChangedFiles.needsReload) {
            __scriptLogger__.warn('⚠️  需要重新加载扩展')
            __scriptLogger__.warn(`   📋 变更的文件: ${lastChangedFiles.files.join(', ')}`)
            __scriptLogger__.warn('   📋 步骤：chrome://extensions/ → 找到扩展 → 点击刷新按钮')
          } else {
            __scriptLogger__.info('✅ 刷新页面即可看到更新')
            if (lastChangedFiles.files.length > 0) {
              __scriptLogger__.info(
                `   📝 变更的文件: ${lastChangedFiles.files.slice(0, 3).join(', ')}${lastChangedFiles.files.length > 3 ? '...' : ''}`
              )
            }
          }

          // 重置追踪状态
          lastChangedFiles = { needsReload: false, files: [] }

          __scriptLogger__.info('')
          resolve()
        } else {
          __scriptLogger__.error('❌ Vite 构建失败:')
          __scriptLogger__.error(output)
          reject(new Error(`构建失败，退出码: ${code}`))
        }
      })
    })
  } catch (error) {
    __scriptLogger__.error('❌ 构建错误:', error.message)
  } finally {
    isBuilding = false
    buildProcess = null

    // 如果构建期间有新的变化，重新构建
    if (buildQueue) {
      buildQueue = false
      setTimeout(build, 100)
    }
  }
}

// 防抖函数
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

const debouncedBuild = debounce(build, 300)

// 监听src目录
watch(srcDir, { recursive: true }, (eventType, filename) => {
  if (
    filename &&
    (filename.endsWith('.vue') ||
      filename.endsWith('.ts') ||
      filename.endsWith('.js') ||
      filename.endsWith('.css'))
  ) {
    __scriptLogger__.info(`📝 文件变化: src/${filename}`)

    // 判断是否需要重新加载扩展
    // background scripts 和 content scripts 需要重新加载扩展
    const needsReload =
      filename.includes('/background/') ||
      filename.includes('/background.ts') ||
      filename.includes('/content/')

    // 记录变更的文件
    lastChangedFiles.needsReload = lastChangedFiles.needsReload || needsReload
    lastChangedFiles.files.push(`src/${filename}`)

    debouncedBuild()
  }
})

// 监听public目录
watch(publicDir, { recursive: true }, (eventType, filename) => {
  if (filename) {
    __scriptLogger__.info(`📝 文件变化: public/${filename}`)

    // manifest.json 必须重新加载扩展
    const needsReload = filename.includes('manifest.json')

    if (needsReload) {
      __scriptLogger__.warn('⚠️  manifest.json 已更新！')
    }

    // 记录变更的文件
    lastChangedFiles.needsReload = lastChangedFiles.needsReload || needsReload
    lastChangedFiles.files.push(`public/${filename}`)

    debouncedBuild()
  }
})

// 监听HTML文件
const htmlFiles = [
  'popup.html',
  'management.html',
  'debug-management.html',
  'management.html',
  'debug-panel.html'
]
htmlFiles.forEach(htmlFile => {
  const htmlPath = path.join(process.cwd(), htmlFile)
  try {
    watch(htmlPath, () => {
      __scriptLogger__.info(`📝 文件变化: ${htmlFile}`)
      // HTML 文件变更只需刷新页面
      lastChangedFiles.files.push(htmlFile)
      debouncedBuild()
    })
  } catch {
    // 文件可能不存在，忽略
  }
})

// 监听 frontend 目录的 background.js
const backgroundPath = path.join(process.cwd(), 'background.js')
try {
  watch(backgroundPath, () => {
    __scriptLogger__.info('📝 文件变化: background.js')
    // background.js 必须重新加载扩展
    lastChangedFiles.needsReload = true
    lastChangedFiles.files.push('background.js')
    debouncedBuild()
  })
} catch {
  __scriptLogger__.warn('⚠️ 无法监听 background.js，请确保文件存在')
}

// 监听 .env.development 文件变化（环境变量配置）
// ⚠️ 重要：监听项目根目录的 .env.development，与 Vite 保持一致
const envDevPath = path.join(projectRoot, '.env.development')
try {
  watch(envDevPath, () => {
    __scriptLogger__.info('📝 文件变化: .env.development')
    __scriptLogger__.info('   🔄 环境变量配置已更新，重新构建...')
    // 环境变量变化需要重新构建，因为 Vite 在构建时读取环境变量
    debouncedBuild()
  })
  __scriptLogger__.info('✅ 已监听 .env.development 文件变化')
} catch {
  __scriptLogger__.warn('⚠️ 无法监听 .env.development，文件可能不存在')
}

// 初始构建
__scriptLogger__.info(`🔨 执行初始构建流程 ${SKIP_ESLINT ? '(仅 Vite)' : '(ESLint + Vite)'}...`)
build()

// 处理进程退出
process.on('SIGINT', () => {
  __scriptLogger__.info('\n🛑 停止热更新...')
  if (buildProcess) {
    buildProcess.kill()
  }
  process.exit(0)
})

__scriptLogger__.info('👀 正在监听文件变化... (Ctrl+C 退出)')
