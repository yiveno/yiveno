/**
 * 只读 MCP Background handlers（§5.10.5）。
 */

import {
  McpRecallError,
  mcpRecallEvidenceLocal
} from '@/application/recall/mcp-recall-evidence-service'
import type { McpBackgroundResponse } from '@/core/messaging/mcp-messages'
import { parseMcpRecallEvidencePayload } from '@/core/messaging/mcp-messages'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

/** MCP_RECALL_EVIDENCE：本机 Hybrid → detail export。 */
export async function handleMcpRecallEvidence(payload: unknown): Promise<McpBackgroundResponse> {
  const startedAt = flowStart('Mcp', '消息分发')
  try {
    const input = parseMcpRecallEvidencePayload(payload)
    const result = await mcpRecallEvidenceLocal(input)
    flowOk('Mcp', '消息分发', startedAt, { itemCount: result.pack.items.length })
    return {
      ok: true,
      pack: result.pack,
      markdown: result.markdown,
      backend: result.backend
    }
  } catch (error) {
    if (error instanceof McpRecallError) {
      flowFail('Mcp', '消息分发', startedAt, error)
      return { ok: false, errorCode: error.errorCode, error: error.message }
    }
    flowFail('Mcp', '消息分发', startedAt, error)
    return {
      ok: false,
      errorCode: 'MCP_OPERATION_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}
