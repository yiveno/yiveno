/**
 * lint-staged 配置
 * 只检查暂存区的文件，大幅提升提交速度
 *
 * ESLint 必须在各 workspace 目录下运行，才能与 eslint.config.js 的 cwd 感知规则一致。
 */

import path from 'node:path'

const ESLINT_CMD = 'bunx eslint --no-cache --fix --max-warnings 0 --no-warn-ignored'
const STYLELINT_CMD = 'bunx stylelint --no-cache --fix'
const PRETTIER_CMD = 'bunx prettier --write'

/** wrangler types 生成物：不进 ESLint / Prettier（体积大且会被下次 types:gen 覆盖） */
function isGeneratedWorkerTypes(repoPath) {
  return repoPath === 'backend/worker-configuration.d.ts'
}

/** 转义 shell 路径参数 */
function quotePath(filePath) {
  return `"${filePath.replace(/"/g, '\\"')}"`
}

/** 将 lint-staged 传入的绝对/相对路径统一为仓库相对路径 */
function toRepoRelative(file) {
  return path.relative(process.cwd(), file).split(path.sep).join('/')
}

/** 将暂存文件按 workspace 分组，返回各组内的 workspace 相对路径 */
function groupByWorkspace(filenames) {
  const groups = {
    frontend: [],
    backend: [],
    website: [],
    root: []
  }

  for (const file of filenames) {
    const repoPath = toRepoRelative(file)
    if (isGeneratedWorkerTypes(repoPath)) continue

    if (repoPath.startsWith('frontend/')) {
      groups.frontend.push(repoPath.slice('frontend/'.length))
    } else if (repoPath.startsWith('backend/')) {
      groups.backend.push(repoPath.slice('backend/'.length))
    } else if (repoPath.startsWith('website/')) {
      groups.website.push(repoPath.slice('website/'.length))
    } else {
      groups.root.push(repoPath)
    }
  }

  return groups
}

/** 在对应 workspace 目录运行 ESLint */
function eslintByWorkspace(filenames) {
  const groups = groupByWorkspace(filenames)
  const commands = []

  if (groups.frontend.length > 0) {
    commands.push(`cd frontend && ${ESLINT_CMD} ${groups.frontend.map(quotePath).join(' ')}`)
  }
  if (groups.backend.length > 0) {
    commands.push(`cd backend && ${ESLINT_CMD} ${groups.backend.map(quotePath).join(' ')}`)
  }
  if (groups.website.length > 0) {
    commands.push(`cd website && ${ESLINT_CMD} ${groups.website.map(quotePath).join(' ')}`)
  }
  if (groups.root.length > 0) {
    commands.push(`${ESLINT_CMD} ${groups.root.map(quotePath).join(' ')}`)
  }

  return commands
}

/** design-tokens 为 token 源（含 hex 品牌色），不走 app Stylelint */
function isDesignTokenCss(repoPath) {
  return repoPath.startsWith('packages/design-tokens/')
}

/** @yiveno/probe Console 为 DEV 工具台；Stylelint 用 website 宽松档（无扩展 token 硬规则） */
function isProbePackage(repoPath) {
  return repoPath.startsWith('packages/yiveno-probe/')
}

/** 在对应 workspace 目录运行 Stylelint */
function stylelintByWorkspace(filenames) {
  const lintable = filenames.filter(file => !isDesignTokenCss(toRepoRelative(file)))
  if (lintable.length === 0) return []

  const groups = groupByWorkspace(lintable)
  const commands = []

  if (groups.frontend.length > 0) {
    commands.push(`cd frontend && ${STYLELINT_CMD} ${groups.frontend.map(quotePath).join(' ')}`)
  }
  if (groups.website.length > 0) {
    commands.push(`cd website && ${STYLELINT_CMD} ${groups.website.map(quotePath).join(' ')}`)
  }

  const probeFromRoot = groups.root.filter(isProbePackage)
  const otherRoot = groups.root.filter(file => !isProbePackage(file))
  if (probeFromRoot.length > 0) {
    commands.push(
      `cd website && ${STYLELINT_CMD} --config ./stylelint.config.js ${probeFromRoot
        .map(file => quotePath(`../${file}`))
        .join(' ')}`
    )
  }
  if (otherRoot.length > 0) {
    commands.push(`${STYLELINT_CMD} ${otherRoot.map(quotePath).join(' ')}`)
  }

  return commands
}

function prettierWrite(filenames) {
  const files = filenames.filter(file => !isGeneratedWorkerTypes(toRepoRelative(file)))
  if (files.length === 0) return []
  return [`${PRETTIER_CMD} ${files.map(quotePath).join(' ')}`]
}

export default {
  '**/*.{ts,tsx,js,jsx}': filenames => [
    ...eslintByWorkspace(filenames),
    ...prettierWrite(filenames)
  ],

  '**/*.vue': filenames => [
    ...eslintByWorkspace(filenames),
    ...stylelintByWorkspace(filenames),
    ...prettierWrite(filenames)
  ],

  '**/*.{css,scss}': filenames => [...stylelintByWorkspace(filenames), ...prettierWrite(filenames)],

  '**/*.{json,md}': filenames => prettierWrite(filenames),

  // website：根 format 含 .astro；提交时也走同一 Prettier + prettier-plugin-astro
  '**/*.astro': filenames => prettierWrite(filenames)
}
