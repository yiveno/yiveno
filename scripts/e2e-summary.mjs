#!/usr/bin/env bun
/**
 * Summarize latest E2E artifacts into Markdown.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(process.cwd())
const artifacts = path.join(root, 'artifacts')

function pickLatestByPrefix(dir, prefix) {
  const files = dir.filter(f => f.startsWith(prefix)).sort()
  return files[files.length - 1]
}

async function main() {
  try {
  const logsDir = path.join(artifacts, 'logs')
  const perfDir = path.join(artifacts, 'performance')
    const logs = await fs.readdir(logsDir)
    const latestLog = pickLatestByPrefix(logs, '')
    const logPath = latestLog ? path.join(logsDir, latestLog) : null
    const logJson = logPath ? JSON.parse(await fs.readFile(logPath, 'utf-8')) : null

  const latestPerfSummary = (await fs.readdir(perfDir).catch(() => [])).filter(f => f.endsWith('_summary.json')).sort().at(-1)

    let md = '# E2E Summary\n\n'
    if (logJson) {
      md += `Tag: ${logJson.tag}\\n\\n`
      md += 'Steps:\n'
      for (const s of logJson.steps) {
        md += `- ${s.name}: ${s.status}${s.durationMs ? ` (${s.durationMs}ms)` : ''}\n`
      }
    } else {
      md += 'No logs found.\n'
    }

    if (latestPerfSummary) {
      md += `\nPerformance: artifacts/performance/${latestPerfSummary}\n`
    }

    console.log(md)
  } catch (e) {
    console.error('Failed to summarize:', e)
    process.exit(1)
  }
}

main()
