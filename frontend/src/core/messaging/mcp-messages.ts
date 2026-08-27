import { z } from 'zod'

import type { McpEvidencePack } from '@/core/recall/mcp-tool-schema'
import type { BackgroundMessageScope } from '@/core/messaging/constants'

const mcpRecallEvidencePayloadSchema = z.object({
  clue: z.string().trim().min(1).max(500),
  limit: z.number().int().min(1).max(5).optional()
})

export const McpErrorCodeSchema = z.enum([
  'MCP_DISABLED', // Settings 未开启只读 MCP
  'MCP_INVALID_ARGS', // 参数非法
  'MCP_NO_MATCH', // 无线索命中
  'MCP_OPERATION_FAILED' // 其它失败
])

export type McpErrorCode = z.infer<typeof McpErrorCodeSchema>

/** 本机只读 MCP 召回（§5.10.5）。 */
export type McpRecallEvidenceMessage = {
  scope: BackgroundMessageScope
  type: 'MCP_RECALL_EVIDENCE'
  payload: z.infer<typeof mcpRecallEvidencePayloadSchema>
}

export type McpRecallEvidenceSuccessResponse = {
  ok: true
  pack: McpEvidencePack
  markdown: string
  backend: 'local_hybrid'
}

export type McpRecallEvidenceErrorResponse = {
  ok: false
  errorCode: McpErrorCode
  error?: string
}

export type McpBackgroundMessage = McpRecallEvidenceMessage

export type McpBackgroundResponse =
  | McpRecallEvidenceSuccessResponse
  | McpRecallEvidenceErrorResponse

export function parseMcpRecallEvidencePayload(value: unknown) {
  return mcpRecallEvidencePayloadSchema.parse(value)
}
