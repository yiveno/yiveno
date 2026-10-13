#!/usr/bin/env bun
/**
 * Commit message 校验：body 必须覆盖 git diff --cached 每个被改文件。
 *
 * 规则：
 *  1) 首行：Conventional Commits <type>(<scope>): <中文>（已由 commitlint 校验）
 *  2) body：每个被改文件必须在 message 中以方括号索引至少 1 次：
 *     [<repo-relative-path>] 动作: ...
 *
 * 用法：
 *   bun run check:commit-message -- <commit-msg-file>
 *   bun run check:commit-message -- .git/COMMIT_EDITMSG
 *
 * 设计要点：
 *  - 工作区变更集合：优先用 `git diff --cached`（已暂存）；空时回退到
 *    `git diff`（unstaged）——后端 dev task 在 -a 提交时仍能用
 *  - 索引段落正则：`\[(.*?)\]` —— 必须落在仓库根开始的有效路径
 *  - 白名单：merge 自动 message 跳过（"Merge branch …"）
 *  - 白名单：docs 下文档类 commit 允许只列目录（按需扩）
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const SKIP_AUTO_HEADERS = [
  /^Merge branch/i,
  /^Merge pull request #\d+/i,
  /^Revert ".*"/i,
  /^Initial commit/
]

function getMsgFilePath(argv) {
  // 接受以下三种调用形式：
  //  1) bun run check:commit-message -- <file>     → [..., 'check:commit-message', '--', <file>]
  //  2) bun ./scripts/check-commit-message.mjs <file>
  //  3) bunx commitlint ... (不会进这里)
  let argStart = 2
  if (argv[2] === 'run' || argv[2] === '--bun') {
    argStart = 3
  }
  const p = argv[argStart]
  if (!p || p.startsWith('--')) {
    // 找 `--` 分隔符后的第一个
    const i = argv.indexOf('--')
    if (i < 0 || !argv[i + 1]) {
      console.error('用法: bun run check:commit-message -- <commit-msg-file>')
      process.exit(2)
    }
    return argv[i + 1]
  }
  return p
}

function readMsg(absPath) {
  if (!existsSync(absPath)) {
    return ''
  }
  return readFileSync(absPath, 'utf8')
}

function isMergeOrAuto(message) {
  const firstLine = message.split('\n', 1)[0]?.trim() ?? ''
  return SKIP_AUTO_HEADERS.some(re => re.test(firstLine))
}

/** 运行 git 子命令拿字符串数组；失败返回 [] */
function gitLines(args) {
  // -c core.quotepath=false：CJK 路径不转义为 \xxx，方能与 message 索引匹配
  const proc = Bun.spawnSync(['git', '-c', 'core.quotepath=false', ...args], {
    cwd: repoRoot,
    stdout: 'pipe',
    stderr: 'pipe'
  })
  if (proc.exitCode !== 0) return []
  return proc.stdout
    .toString('utf8')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
}

/** 当前工作区所有变更（优先 staged，回退到 unstaged） */
function listChangedFiles() {
  // 注意：直接 get staged - 包括 additions、deletions、renames
  const staged = gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACDMRT'])
  if (staged.length > 0) return staged
  return gitLines(['diff', '--name-only', '--diff-filter=ACDMRT'])
}

/** 把所有方括号索引段提到一个集合：「extension/src/x.ts」、「docs/...」 */
function extractIndexedPaths(message) {
  const set = new Set()
  // 匹配：[path...] —— path 不能包含换行、不允许 [ 字符
  const re = /\[([^\[\]\n]+)\]/g
  let m
  while ((m = re.exec(message)) !== null) {
    const raw = m[1].trim().replace(/\\/g, '/')
    // 仅接受仓库根或绝对路径；过滤误报
    if (
      /^[A-Za-z0-9_./\-\u4e00-\u9fff]+$/u.test(raw) &&
      !raw.includes('..') &&
      (raw.includes('/') || /\.[\w]+$/u.test(raw))
    ) {
      set.add(raw.replace(/^\.\//, ''))
    }
  }
  return set
}

/** 文件是否被索引段覆盖（路径完全匹配或被目录覆盖） */
function isFileCovered(file, indexed) {
  const norm = file.replace(/\\/g, '/')
  if (indexed.has(norm)) return true
  // 目录覆盖：被改文件是该路径下的（少见，仅当一句话描述整目录时）
  for (const idx of indexed) {
    if (idx.endsWith('/') && norm.startsWith(idx)) return true
  }
  return false
}

function main() {
  const msgFile = getMsgFilePath(process.argv)
  // 绝对路径直接用；相对路径相对 repoRoot
  const absMsg = msgFile.startsWith('/') ? msgFile : join(repoRoot, msgFile)
  const message = readFileSync(absMsg, 'utf8')
  if (!message.trim()) {
    console.error('❌ commit message 为空')
    process.exit(1)
  }

  if (isMergeOrAuto(message)) {
    console.log('ℹ️  merge / revert / initial commit，跳过文件覆盖校验')
    process.exit(0)
  }

  const staged = gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACDMRT'])
  const unstaged = gitLines(['diff', '--name-only', '--diff-filter=ACDMRT'])

  if (staged.length === 0) {
    if (unstaged.length > 0) {
      console.error('❌ 无已暂存文件（staged 为空），但 working tree 有改动：')
      console.error(`   💡 请先 \`git add <path>\` 或 \`git add -A\` 暂存要提交的文件，再 commit。`)
      console.error(`   当前未暂存文件数: ${unstaged.length}`)
    } else {
      console.log('ℹ️  无 staged / unstaged 改动，跳过校验')
    }
    process.exit(1)
  }

  const indexed = extractIndexedPaths(message)
  const missing = staged.filter(f => !isFileCovered(f, indexed))

  // 合并未知索引（不在仓库的）提示但不阻断
  const knownChanged = new Set(staged)
  const unknownIndexed = [...indexed].filter(p => !knownChanged.has(p))

  if (missing.length === 0) {
    console.log(
      `✅ 文件覆盖完整（${staged.length} 个文件全部覆盖${unknownIndexed.length ? `；注：${unknownIndexed.length} 个已索引但未在当前 staged` : ''}）`
    )
    process.exit(0)
  }

  console.error('❌ 以下已暂存文件未在 commit message 中记录：')
  for (const f of missing) {
    console.error(`   [${f}] <动作>: <一句话说明>`)
  }
  if (unknownIndexed.length > 0) {
    console.error('')
    console.error('⚠️  以下路径在 message 中索引但不在当前 staged（疑似复制粘贴残留）：')
    for (const p of unknownIndexed) {
      console.error(`   ${p}`)
    }
  }
  console.error('')
  console.error(`💡 格式参考： .cursor/rules/commit-message.mdc`)
  process.exit(1)
}

// 仅在直接调用时执行（被 import 时不触发；支持测试）
if (import.meta.main) {
  main()
}

export { extractIndexedPaths, isFileCovered, listChangedFiles }
