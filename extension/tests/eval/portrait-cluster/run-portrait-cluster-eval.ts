/**
 * portrait_cluster 语义评测运行器（DeepSeek 直连；每组 1 次调用）。
 * 本批只交付资产；手动跑：`cd extension && bun run portrait-cluster:eval`
 */

import { buildPortraitClusterMessages } from '@/core/portrait/portrait-cluster-prompt'
import { completeOpenAiCompatibleChat } from '@/core/recall/understand/openai-compatible-chat'
import { PORTRAIT_CLUSTER_EVAL_CASES } from './cases'
import { scorePortraitClusterCase, summarizePortraitClusterScores } from './score'

export async function runPortraitClusterEval(): Promise<void> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
  if (!apiKey) {
    console.error('缺少 DEEPSEEK_API_KEY，无法跑真实 LLM 评测')
    process.exitCode = 1
    return
  }

  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '')
  const model = process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat'

  const rows = []
  for (const caseRow of PORTRAIT_CLUSTER_EVAL_CASES) {
    const messages = buildPortraitClusterMessages(caseRow.values)
    const text = await completeOpenAiCompatibleChat(
      {
        apiKey,
        baseUrl,
        model,
        maxTokens: 512,
        temperature: 0
      },
      messages
    )
    const scored = scorePortraitClusterCase(caseRow, text)
    rows.push(scored)
    console.log(
      JSON.stringify({
        id: caseRow.id,
        pass: scored.pass,
        reasons: scored.reasons,
        preview: text.slice(0, 160)
      })
    )
  }

  const summary = summarizePortraitClusterScores(rows)
  console.log(
    JSON.stringify({
      passed: summary.passed,
      failed: summary.failed,
      total: summary.total
    })
  )
  if (summary.failed > 0) {
    process.exitCode = 1
  }
}
