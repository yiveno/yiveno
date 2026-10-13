#!/usr/bin/env bun
/**
 * 本地一键绿检（开发自检，非 CI 替代）。
 * 顺序：typecheck:extension → knip:extension → test:must → doc:check
 * 任一步失败即 exit 1；合入前仍须 pre-push / CI 全量。
 *
 * 用法：bun run dev:check
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const steps = [
  { name: 'typecheck:extension', cmd: ['bun', 'run', 'typecheck:extension'] },
  { name: 'knip:extension', cmd: ['bun', 'run', 'knip:extension'] },
  { name: 'test:must', cmd: ['bun', 'run', 'test:must'] },
  { name: 'doc:check', cmd: ['bun', 'run', 'doc:check'] }
]

console.log('🔍 dev:check — 本地绿检（非 CI 全量）\n')

for (const step of steps) {
  console.log(`── ${step.name} ──`)
  const started = Date.now()
  const result = spawnSync(step.cmd[0], step.cmd.slice(1), {
    cwd: root,
    stdio: 'inherit',
    env: process.env
  })
  const ms = Date.now() - started
  if (result.status !== 0) {
    console.error(`\n❌ dev:check 失败于 ${step.name}（${ms}ms）`)
    process.exit(result.status ?? 1)
  }
  console.log(`✅ ${step.name}（${ms}ms）\n`)
}

console.log('🎉 dev:check 全绿（合入前仍跑 pre-push / CI 全量）')
