/**
 * Markdown 汇总报告（两轨分开、冲突子集单列、门槛逐条、种子与 nowMs）。
 */

import type { BehaviorAblationRunReport } from '@/core/recall/eval/behavior-ablation/types'

function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`
}

function num(n: number | null): string {
  if (n === null) return 'n/a'
  return n.toFixed(4)
}

export function formatBehaviorAblationMarkdown(report: BehaviorAblationRunReport): string {
  const lines: string[] = []
  lines.push('# 行为层消融 · 首轮报告')
  lines.push('')
  lines.push('## Meta')
  lines.push('')
  lines.push(`- seed: \`${report.meta.seed}\``)
  lines.push(`- bootstrapSeed: \`${report.meta.bootstrapSeed}\``)
  lines.push(`- nowMs: \`${report.meta.nowMs}\``)
  lines.push(`- datasetVersion: \`${report.meta.datasetVersion}\``)
  lines.push(`- runAt: \`${report.meta.runAtIso}\``)
  lines.push(
    `- reproducibility: identical=${report.meta.reproducibility.identical} (A=\`${report.meta.reproducibility.runAHash.slice(0, 12)}\` B=\`${report.meta.reproducibility.runBHash.slice(0, 12)}\`)`
  )
  lines.push(`- LLM 次要臂: ${report.meta.llmArm} — ${report.meta.llmArmNote}`)
  lines.push('')

  lines.push('## 生产轨（机制①+②）')
  lines.push('')
  lines.push('| 臂 | n | R@1 | R@3 | R@5 | MRR | meanRank | miss | falseOpen | nonEmpty |')
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const arm of ['OFF', 'ON-prod', 'ON-beh', 'ON-cond'] as const) {
    const m = report.prod.arms[arm]
    lines.push(
      `| ${arm} | ${m.n} | ${pct(m.recallAt1)} | ${pct(m.recallAt3)} | ${pct(m.recallAt5)} | ${num(m.mrr)} | ${num(m.meanRank)} | ${pct(m.missRate)} | ${pct(m.falseOpenRate)} | ${pct(m.candidateNonEmptyRate)} |`
    )
  }
  lines.push('')
  lines.push('### ON-prod − OFF')
  lines.push('')
  const d = report.prod.deltas.onProdMinusOff
  lines.push(`- R@1 delta=${num(d.r1.delta)} CI95=[${num(d.r1.ci95Lower)}, ${num(d.r1.ci95Upper)}]`)
  lines.push(
    `- MRR delta=${num(d.mrr.delta)} CI95=[${num(d.mrr.ci95Lower)}, ${num(d.mrr.ci95Upper)}]`
  )
  lines.push(
    `- falseOpen delta=${num(d.falseOpen.delta)} CI95=[${num(d.falseOpen.ci95Lower)}, ${num(d.falseOpen.ci95Upper)}]`
  )
  const mc = report.prod.deltas.mcnemarR1
  lines.push(`- McNemar R@1: b=${mc.b} c=${mc.c} chi2=${num(mc.chi2)} p≈${num(mc.pApprox)}`)
  lines.push('')
  lines.push('### 排名变化最大 10 条（OFF → ON-prod）')
  lines.push('')
  lines.push('| taskId | offRank | onProdRank | delta(off-on) |')
  lines.push('| --- | ---: | ---: | ---: |')
  for (const row of report.prod.worstRankDeltas) {
    lines.push(
      `| ${row.taskId} | ${row.offRank ?? 'miss'} | ${row.onProdRank ?? 'miss'} | ${row.delta} |`
    )
  }
  lines.push('')

  lines.push('## 机制轨（冲突子集 · 行为压陈述）')
  lines.push('')
  lines.push('| 臂 | n | R@1 | R@3 | R@5 | MRR | meanRank | miss | falseOpen | nonEmpty |')
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const arm of ['B-on', 'B-off'] as const) {
    const m = report.mech.arms[arm]
    lines.push(
      `| ${arm} | ${m.n} | ${pct(m.recallAt1)} | ${pct(m.recallAt3)} | ${pct(m.recallAt5)} | ${num(m.mrr)} | ${num(m.meanRank)} | ${pct(m.missRate)} | ${pct(m.falseOpenRate)} | ${pct(m.candidateNonEmptyRate)} |`
    )
  }
  lines.push('')
  const md = report.mech.deltas.bOnMinusBOff
  lines.push(
    `- B-on−B-off R@1 delta=${num(md.r1.delta)} CI95=[${num(md.r1.ci95Lower)}, ${num(md.r1.ci95Upper)}]`
  )
  lines.push('')

  lines.push('## 冻结门槛判定')
  lines.push('')
  lines.push('| id | 过/不过 | observed | threshold | detail |')
  lines.push('| --- | --- | ---: | ---: | --- |')
  for (const g of report.gates) {
    lines.push(
      `| ${g.id} | ${g.passed ? 'PASS' : 'FAIL'} | ${num(g.observed)} | ${num(g.threshold)} | ${g.detail} |`
    )
  }
  lines.push('')
  lines.push(`**全部门槛：** ${report.gatesAllPassed ? 'PASS' : 'FAIL'}`)
  lines.push('')
  lines.push('> 本报告只陈述数值与过/不过；不改门槛、不给专利建议。')
  lines.push('')
  return lines.join('\n')
}
