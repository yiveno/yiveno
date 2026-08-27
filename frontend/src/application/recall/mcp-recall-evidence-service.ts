/**
 * 只读 MCP：本机 Hybrid 召回 → evidence pack（§5.10.5）。
 */

import { memoryItemService } from '@/application/memory/memory-item-service'
import { recallService } from '@/application/recall/recall-service'
import {
  mapMemoryItemToEvidencePackItem,
  renderEvidencePackMarkdown,
  type EvidencePack
} from '@/core/recall/evidence-pack'
import {
  buildMcpEvidencePack,
  McpRecallEvidenceArgsSchema,
  type McpEvidencePack
} from '@/core/recall/mcp-tool-schema'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

export class McpRecallError extends Error {
  readonly errorCode: 'MCP_DISABLED' | 'MCP_INVALID_ARGS' | 'MCP_NO_MATCH' | 'MCP_OPERATION_FAILED'

  constructor(
    errorCode: 'MCP_DISABLED' | 'MCP_INVALID_ARGS' | 'MCP_NO_MATCH' | 'MCP_OPERATION_FAILED',
    message?: string
  ) {
    super(message ?? errorCode)
    this.name = 'McpRecallError'
    this.errorCode = errorCode
  }
}

/** 本机 MCP 召回：须 Settings 开启；走同一 recallService。 */
export async function mcpRecallEvidenceLocal(rawArgs: unknown): Promise<{
  pack: McpEvidencePack
  markdown: string
  backend: 'local_hybrid'
}> {
  const startedAt = flowStart('Mcp', '本机召回')
  const settings = await getUserSettings()
  if (!settings.mcpReadOnlyEnabled) {
    flowFail('Mcp', '本机召回', startedAt, new Error('disabled'))
    throw new McpRecallError('MCP_DISABLED')
  }

  const parsed = McpRecallEvidenceArgsSchema.safeParse(rawArgs)
  if (!parsed.success) {
    flowFail('Mcp', '本机召回', startedAt, parsed.error)
    throw new McpRecallError('MCP_INVALID_ARGS')
  }

  const limit = parsed.data.limit ?? 3
  try {
    const result = await recallService.recallWithClue(parsed.data.clue)
    const ranked: typeof result.alsoPossible = []
    if (result.topPick) {
      ranked.push(result.topPick)
    }
    ranked.push(...result.alsoPossible)
    const matches = ranked.slice(0, Math.min(limit, 5))
    if (matches.length === 0) {
      flowOk('Mcp', '本机召回', startedAt, { reason: 'no_match' })
      throw new McpRecallError('MCP_NO_MATCH')
    }

    const items = []
    for (const match of matches) {
      const item = await memoryItemService.getById(match.item.id)
      if (item && !item.deletedAt) {
        items.push(item)
      }
    }
    if (items.length === 0) {
      throw new McpRecallError('MCP_NO_MATCH')
    }

    const pack = buildMcpEvidencePack(items.map(mapMemoryItemToEvidencePackItem))
    // Markdown 复用：临时包成 EvidencePack 形状（≥2 时）或手写简版
    const markdown =
      pack.items.length >= 2
        ? renderEvidencePackMarkdown(pack as EvidencePack)
        : renderSingleItemMarkdown(pack)

    flowOk('Mcp', '本机召回', startedAt, {
      itemCount: pack.items.length,
      backend: 'local_hybrid'
    })
    return { pack, markdown, backend: 'local_hybrid' }
  } catch (error) {
    if (error instanceof McpRecallError) {
      throw error
    }
    flowFail('Mcp', '本机召回', startedAt, error)
    throw new McpRecallError(
      'MCP_OPERATION_FAILED',
      error instanceof Error ? error.message : String(error)
    )
  }
}

function renderSingleItemMarkdown(pack: McpEvidencePack): string {
  const item = pack.items[0]
  if (!item) {
    return '# Yiveno Evidence Pack\n\n(empty)\n'
  }
  if (item.type === 'text_excerpt') {
    return [
      '# Yiveno Evidence Pack',
      '',
      `Exported: ${pack.exportedAt}`,
      '',
      '## 1. Text excerpt',
      '',
      `- **ID:** \`${item.id}\``,
      `- **Source:** [${item.pageTitle}](${item.sourceUrl})`,
      '',
      `> ${item.selectedText}`,
      ''
    ].join('\n')
  }
  return [
    '# Yiveno Evidence Pack',
    '',
    `Exported: ${pack.exportedAt}`,
    '',
    '## 1. Bookmark',
    '',
    `- **ID:** \`${item.id}\``,
    `- **Title:** ${item.title}`,
    `- **URL:** ${item.url}`,
    ''
  ].join('\n')
}
