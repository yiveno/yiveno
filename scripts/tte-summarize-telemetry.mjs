#!/usr/bin/env bun
/**
 * TTE 遥测缓冲汇总（研究用 · 非运行时）。
 * 输入：chrome.storage.local 导出的 JSON（{ events: RecallTelemetryEvent[] }）
 *
 * 用法：
 *   bun run tte:summarize -- path/to/P001-telemetry-export.json
 *   cat export.json | bun run tte:summarize
 */

import { readFileSync } from 'node:fs'

const ECS_PASS = 4
const TIMEOUT_MS = 180_000

function parseInput(argv) {
  const path = argv[2]
  if (path && path !== '--') {
    return readFileSync(path, 'utf8')
  }
  return readFileSync(0, 'utf8')
}

/** 支持整段 JSON 或 JSONL（每行一条事件）。 */
function parseEventsPayload(raw) {
  const trimmed = raw.trim()
  if (!trimmed) {
    return []
  }
  if (trimmed.startsWith('{') && !trimmed.includes('\n{')) {
    const payload = JSON.parse(trimmed)
    return Array.isArray(payload) ? payload : payload.events
  }
  return trimmed
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line))
}

function parseAt(iso) {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function median(sorted) {
  return percentile(sorted, 50)
}

function summarizeByTask(events) {
  const byTask = new Map()
  for (const event of events) {
    const taskKey = event.taskId
    if (!taskKey) continue
    const list = byTask.get(taskKey) ?? []
    list.push(event)
    byTask.set(taskKey, list)
  }

  const rows = []
  for (const [taskId, taskEvents] of byTask) {
    const sorted = [...taskEvents].sort((a, b) => (parseAt(a.at) ?? 0) - (parseAt(b.at) ?? 0))
    const t0 = sorted.find(e => e.type === 'clue_submitted')
    const t0Ms = t0 ? parseAt(t0.at) : null

    let tteV = null
    let tteC = null
    let maxEcs = 0
    let confirmed = null
    let timedOut = false

    for (const e of sorted) {
      if (e.type === 'evidence_visible' && typeof e.ecs === 'number') {
        maxEcs = Math.max(maxEcs, e.ecs)
        if (t0Ms !== null && tteV === null && e.ecs >= ECS_PASS) {
          tteV = (parseAt(e.at) ?? 0) - t0Ms
        }
      }
      if (e.type === 'source_opened' && t0Ms !== null && tteC === null) {
        tteC = (parseAt(e.at) ?? 0) - t0Ms
      }
      if (e.type === 'user_confirmed') {
        if (e.label) {
          confirmed = e.label
        } else if (e.confirmed === 'yes') {
          confirmed = 'target'
        } else if (e.confirmed === 'no') {
          confirmed = 'none_in_results'
        } else {
          confirmed = e.confirmed ?? null
        }
      }
      if (e.type === 'task_timeout') {
        timedOut = true
      }
    }

    const success =
      !timedOut &&
      tteV !== null &&
      tteV <= TIMEOUT_MS &&
      maxEcs >= ECS_PASS &&
      confirmed === 'target'

    rows.push({
      taskId,
      tteVSec: tteV !== null ? (tteV / 1000).toFixed(1) : '—',
      tteCSec: tteC !== null ? (tteC / 1000).toFixed(1) : '—',
      maxEcs,
      confirmed: confirmed ?? '—',
      successAt180: success ? 'yes' : 'no'
    })
  }

  return rows
}

function main() {
  const raw = parseInput(process.argv)
  let events
  try {
    events = parseEventsPayload(raw)
  } catch {
    console.error('无效 JSON / JSONL')
    process.exit(1)
  }

  if (!Array.isArray(events)) {
    console.error('期望 { events: [...] }、事件数组或 JSONL')
    process.exit(1)
  }

  const rows = summarizeByTask(events)
  if (rows.length === 0) {
    console.log('无按 taskId 分组的事件（须含 clue_submitted）')
    process.exit(0)
  }

  const tteVNums = rows
    .map(r => Number.parseFloat(r.tteVSec))
    .filter(n => Number.isFinite(n))
    .sort((a, b) => a - b)
  const successCount = rows.filter(r => r.successAt180 === 'yes').length

  console.log('## TTE 汇总（研究用 · 非 Beta 宣称）\n')
  console.log('| taskId | TTE-V (s) | TTE-C (s) | max ECS | confirmed | Success@180 |')
  console.log('| --- | ---: | ---: | ---: | --- | --- |')
  for (const r of rows) {
    console.log(
      `| ${r.taskId} | ${r.tteVSec} | ${r.tteCSec} | ${r.maxEcs} | ${r.confirmed} | ${r.successAt180} |`
    )
  }

  console.log('')
  console.log(`任务数: ${rows.length}`)
  if (tteVNums.length > 0) {
    console.log(`TTE-V P50: ${median(tteVNums)}s · P90: ${percentile(tteVNums, 90)}s`)
  }
  console.log(
    `Success@180 (ECS≥${ECS_PASS} + confirmed=target): ${successCount}/${rows.length} (${Math.round((successCount / rows.length) * 100)}%)`
  )
  console.log('\n注：须配合 gold match 与人工 ECS；脚本不判定 gold id。')
}

main()
