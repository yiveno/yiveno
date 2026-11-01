#!/usr/bin/env bun
/**
 * §7.0 可见进展体验汇总（与 §5.9 TTE **分计**）。
 * 输入：chrome.storage.local 导出 JSON（{ events: RecallTelemetryEvent[] }）
 *
 * 用法：
 *   bun run progress:summarize -- path/to/telemetry-export.json
 *   cat export.json | bun run progress:summarize
 */

import { readFileSync } from 'node:fs'

function parseInput(argv) {
  const path = argv[2]
  if (path && path !== '--') {
    return readFileSync(path, 'utf8')
  }
  return readFileSync(0, 'utf8')
}

function parseEventsPayload(raw) {
  const trimmed = raw.trim()
  if (!trimmed) {
    return []
  }
  if (trimmed.startsWith('{') && !trimmed.includes('\n{')) {
    const payload = JSON.parse(trimmed)
    return Array.isArray(payload) ? payload : (payload.events ?? [])
  }
  return trimmed
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line))
}

/** 与 extension summarize-visible-progress-telemetry.ts 同口径（脚本自包含，免 workspace 解析）。 */
function summarizeVisibleProgressTelemetry(events) {
  const byTask = new Map()
  for (const event of events) {
    if (!event?.taskId) continue
    const list = byTask.get(event.taskId) ?? []
    list.push(event)
    byTask.set(event.taskId, list)
  }

  let submittedTasks = 0
  let completedWithResult = 0
  let abandonedBeforeResult = 0
  let abandonedWhileProgressRevealed = 0
  let refineEvents = 0
  let resultsWithProgressRevealed = 0
  const byAbandonReason = {
    panel_close: 0,
    new_find: 0,
    superseded_clue: 0
  }

  for (const taskEvents of byTask.values()) {
    const submitted = taskEvents.some(e => e.type === 'clue_submitted')
    if (!submitted) continue
    submittedTasks += 1
    refineEvents += taskEvents.filter(e => e.type === 'clue_refined').length

    const rendered = taskEvents.find(e => e.type === 'result_rendered')
    if (rendered) {
      completedWithResult += 1
      if (rendered.waitProgress?.progressRevealed === true) {
        resultsWithProgressRevealed += 1
      }
      continue
    }

    const abandoned = [...taskEvents].reverse().find(e => e.type === 'wait_abandoned')
    if (abandoned) {
      abandonedBeforeResult += 1
      if (abandoned.reason in byAbandonReason) {
        byAbandonReason[abandoned.reason] += 1
      }
      if (abandoned.waitProgress?.progressRevealed === true) {
        abandonedWhileProgressRevealed += 1
      }
    }
  }

  return {
    submittedTasks,
    completedWithResult,
    abandonedBeforeResult,
    abandonRate: submittedTasks > 0 ? abandonedBeforeResult / submittedTasks : null,
    abandonedWhileProgressRevealed,
    refineEvents,
    refinePerCompletedTask:
      completedWithResult > 0 ? refineEvents / completedWithResult : null,
    byAbandonReason,
    resultsWithProgressRevealed
  }
}

const events = parseEventsPayload(parseInput(process.argv))
const summary = summarizeVisibleProgressTelemetry(events)
console.log(JSON.stringify(summary, null, 2))
console.error(
  [
    '注：本汇总 = 可见进展体验面；禁止当作 §5.9 / TTE 质量达标证据。',
    `tasks=${summary.submittedTasks} abandonRate=${summary.abandonRate ?? 'n/a'} refine=${summary.refineEvents}`
  ].join('\n')
)
