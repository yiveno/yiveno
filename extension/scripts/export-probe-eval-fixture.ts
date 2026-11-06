/**
 * 导出 Probe M4 冻结夹具 JSON（精选 researcher + 关键词路径基线）。
 * 用法：`cd extension && bun run probe-eval:export-fixture`
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildProbeGeneratedFixture } from '@yiveno/probe'

import { runProbeGeneratedEval } from '@/core/recall/eval/probe-generated-eval'

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

export async function runExportProbeEvalFixture(): Promise<void> {
  const draft = buildProbeGeneratedFixture({
    personas: ['researcher'],
    baseline: { top1Rate: 0, inTop3Rate: 0, judged: 0 }
  })
  const report = runProbeGeneratedEval(draft)
  const fixture = buildProbeGeneratedFixture({
    personas: ['researcher'],
    baseline: {
      top1Rate: round4(report.top1Rate),
      inTop3Rate: round4(report.inTop3Rate),
      judged: report.judged
    }
  })

  const here = dirname(fileURLToPath(import.meta.url))
  const outDir = resolve(here, '../src/core/recall/eval/fixtures')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, `${fixture.meta.id}.json`)
  writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8')

  console.info('[probe-eval:export-fixture] wrote', outPath)
  console.info(
    `[probe-eval:export-fixture] baseline top1=${fixture.meta.baseline.top1Rate} inTop3=${fixture.meta.baseline.inTop3Rate} judged=${fixture.meta.baseline.judged} cases=${fixture.cases.length} items=${fixture.items.length}`
  )
}
