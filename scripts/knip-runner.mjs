import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const dir = mkdtempSync(join(tmpdir(), 'knip-runner-'))
writeFileSync(
  join(dir, 'package.json'),
  JSON.stringify(
    {
      name: 'knip-runner',
      private: true,
      type: 'module',
      devDependencies: {
        knip: '^6.14.2'
      }
    },
    null,
    2
  )
)

const install = spawnSync('bun', ['install'], { cwd: dir, stdio: 'inherit' })
if (install.status !== 0) process.exit(install.status ?? 1)

const run = spawnSync('bunx', ['knip', '-D', process.cwd(), ...process.argv.slice(2)], {
  cwd: dir,
  stdio: 'inherit'
})

process.exit(run.status ?? 1)
