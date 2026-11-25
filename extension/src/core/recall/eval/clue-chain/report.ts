/**
 * 合成 Clue 解析报告：通过率、失败聚类、最差 10 条、过关门禁。
 */

import type {
  ClueChainCaseScore,
  ClueChainFailureCluster,
  ClueChainFieldScore,
  ClueChainParseReport,
  ClueChainParseRunCase,
  ClueChainPassRates,
  ClueChainReportSummary,
  ClueChainTopicJudgeResult,
  ClueChainWorstCase
} from '@/core/recall/eval/clue-chain/types'

/** A 类 topic ≥90%；整体 topic ≥85%；C 类 intent = 100%。 */
export const CLUE_CHAIN_TOPIC_A_GATE = 0.9
export const CLUE_CHAIN_TOPIC_OVERALL_GATE = 0.85
export const CLUE_CHAIN_INTENT_C_GATE = 1

function rate(passed: number, scored: number): ClueChainPassRates {
  return {
    scored,
    passed,
    rate: scored === 0 ? 1 : passed / scored
  }
}

function isScoredPass(field: ClueChainFieldScore | undefined): boolean | null {
  if (!field || !field.scored) {
    return null
  }
  return field.passed
}

function findField(score: ClueChainCaseScore, name: string): ClueChainFieldScore | undefined {
  return score.fields.find(field => field.field === name)
}

export function aggregateClueChainSummary(
  rows: Array<{ run: ClueChainParseRunCase; score: ClueChainCaseScore }>
): ClueChainReportSummary {
  let parseOk = 0
  let parseFailed = 0
  let timedOut = 0
  let skipped = 0

  let corePassed = 0
  let coreScored = 0

  let intentPassed = 0
  let intentScored = 0
  let topicPassed = 0
  let topicScored = 0
  let topicAPassed = 0
  let topicAScored = 0
  let intentCPassed = 0
  let intentCScored = 0
  let timePassed = 0
  let timeScored = 0
  let typePassed = 0
  let typeScored = 0
  let entitiesPassed = 0
  let entitiesScored = 0

  for (const { run, score } of rows) {
    if (run.skipped) {
      skipped += 1
    }
    if (run.timedOut) {
      timedOut += 1
    }
    if (run.parsed && !run.error && !run.timedOut) {
      parseOk += 1
    } else if (!run.skipped) {
      parseFailed += 1
    }

    coreScored += 1
    if (score.corePassed) {
      corePassed += 1
    }

    const intent = isScoredPass(findField(score, 'intent'))
    if (intent !== null) {
      intentScored += 1
      if (intent) {
        intentPassed += 1
      }
    }
    if (run.category === 'C' && intent !== null) {
      intentCScored += 1
      if (intent) {
        intentCPassed += 1
      }
    }

    const topic = isScoredPass(findField(score, 'topic'))
    if (topic !== null) {
      topicScored += 1
      if (topic) {
        topicPassed += 1
      }
      if (run.category === 'A') {
        topicAScored += 1
        if (topic) {
          topicAPassed += 1
        }
      }
    }

    const time = isScoredPass(findField(score, 'time'))
    if (time !== null) {
      timeScored += 1
      if (time) {
        timePassed += 1
      }
    }
    const type = isScoredPass(findField(score, 'type'))
    if (type !== null) {
      typeScored += 1
      if (type) {
        typePassed += 1
      }
    }
    const entities = isScoredPass(findField(score, 'entities'))
    if (entities !== null) {
      entitiesScored += 1
      if (entities) {
        entitiesPassed += 1
      }
    }
  }

  const intentCategoryC = rate(intentCPassed, intentCScored)
  const topicCategoryA = rate(topicAPassed, topicAScored)
  const topicOverall = rate(topicPassed, topicScored)

  const gateC = intentCategoryC.scored === 0 || intentCategoryC.rate >= CLUE_CHAIN_INTENT_C_GATE
  const gateA = topicCategoryA.scored === 0 || topicCategoryA.rate >= CLUE_CHAIN_TOPIC_A_GATE
  const gateTopic = topicOverall.scored === 0 || topicOverall.rate >= CLUE_CHAIN_TOPIC_OVERALL_GATE

  return {
    totalCases: rows.length,
    parseOk,
    parseFailed,
    timedOut,
    skipped,
    core: rate(corePassed, coreScored),
    intent: rate(intentPassed, intentScored),
    topic: topicOverall,
    topicCategoryA,
    intentCategoryC,
    time: rate(timePassed, timeScored),
    type: rate(typePassed, typeScored),
    entities: rate(entitiesPassed, entitiesScored),
    gates: {
      intentCategoryC: gateC,
      topicCategoryA: gateA,
      topicOverall: gateTopic,
      allPassed: gateC && gateA && gateTopic
    }
  }
}

/** 失败按 category + note 聚类（区分整类机制 vs 个例）。 */
export function clusterClueChainFailures(
  rows: Array<{ run: ClueChainParseRunCase; score: ClueChainCaseScore }>
): ClueChainFailureCluster[] {
  const map = new Map<string, ClueChainFailureCluster>()
  for (const { run, score } of rows) {
    if (score.corePassed) {
      continue
    }
    const failedFields = score.fields
      .filter(field => field.scored && !field.passed)
      .map(field => field.field)
      .sort()
    const key = `${run.category}::${run.note}::${failedFields.join('+') || 'core'}`
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
      existing.ids.push(run.id)
      continue
    }
    map.set(key, {
      key,
      category: run.category,
      note: run.note,
      count: 1,
      ids: [run.id],
      fields: failedFields
    })
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

/** 最差 10 条：失败字段数优先，其次 id。 */
export function pickWorstClueChainCases(
  rows: Array<{ run: ClueChainParseRunCase; score: ClueChainCaseScore }>,
  limit = 10
): ClueChainWorstCase[] {
  const failed = rows
    .filter(row => !row.score.corePassed)
    .map(row => {
      const failedFields = row.score.fields.filter(field => field.scored && !field.passed)
      return {
        id: row.run.id,
        category: row.run.category,
        clue: row.run.clue,
        note: row.run.note,
        failedFields: failedFields.map(field => field.field),
        details: failedFields.map(field => field.detail),
        failCount: failedFields.length
      }
    })
    .sort(
      (a, b) =>
        b.failCount - a.failCount ||
        a.category.localeCompare(b.category) ||
        a.id.localeCompare(b.id)
    )
  return failed.slice(0, limit).map(({ failCount: _failCount, ...rest }) => rest)
}

export function buildClueChainParseReport(input: {
  head: string
  startedAt: string
  finishedAt: string
  fixtureFiles: string[]
  llm: ClueChainParseReport['llm']
  rows: Array<{
    run: ClueChainParseRunCase
    score: ClueChainCaseScore
    topicJudge: ClueChainTopicJudgeResult | null
  }>
}): ClueChainParseReport {
  const summary = aggregateClueChainSummary(input.rows)
  return {
    schemaVersion: 1,
    kind: 'clue-chain-parse',
    head: input.head,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    fixtureFiles: input.fixtureFiles,
    llm: input.llm,
    summary,
    clusters: clusterClueChainFailures(input.rows),
    worst10: pickWorstClueChainCases(input.rows),
    cases: input.rows
  }
}

/** 终端可读摘要。 */
export function formatClueChainReportConsole(report: ClueChainParseReport): string {
  const s = report.summary
  const pct = (r: ClueChainPassRates) => `${(r.rate * 100).toFixed(1)}% (${r.passed}/${r.scored})`
  const lines = [
    `[clue-chain] head=${report.head}`,
    `[clue-chain] parse ok=${s.parseOk} fail=${s.parseFailed} timeout=${s.timedOut} skip=${s.skipped}`,
    `[clue-chain] core=${pct(s.core)} intent=${pct(s.intent)} topic=${pct(s.topic)}`,
    `[clue-chain] gates: C-intent=${pct(s.intentCategoryC)} ${s.gates.intentCategoryC ? 'OK' : 'FAIL'} | A-topic=${pct(s.topicCategoryA)} ${s.gates.topicCategoryA ? 'OK' : 'FAIL'} | topic=${pct(s.topic)} ${s.gates.topicOverall ? 'OK' : 'FAIL'} | all=${s.gates.allPassed ? 'PASS' : 'FAIL'}`,
    `[clue-chain] time=${pct(s.time)} type=${pct(s.type)} entities=${pct(s.entities)} (certainty 只记录不扣分)`,
    `[clue-chain] clusters=${report.clusters.length} worst10=${report.worst10.map(w => w.id).join(',')}`
  ]
  for (const cluster of report.clusters.slice(0, 12)) {
    lines.push(
      `  cluster[${cluster.count}] ${cluster.category} fields=${cluster.fields.join('+') || '-'} note=${cluster.note} ids=${cluster.ids.join(',')}`
    )
  }
  return lines.join('\n')
}
