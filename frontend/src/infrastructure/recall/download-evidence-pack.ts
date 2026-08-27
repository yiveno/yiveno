import type {
  ExportEvidencePackSuccessResponse,
  MemoryErrorCode
} from '@/core/messaging/memory-messages'
import { downloadTextFile } from '@/infrastructure/browser/download-text-file'
import { exportEvidencePack } from '@/infrastructure/messaging/background-client'

function isExportEvidencePackSuccess(
  response: Awaited<ReturnType<typeof exportEvidencePack>>
): response is ExportEvidencePackSuccessResponse {
  return response.ok && 'pack' in response && 'markdown' in response
}

function evidencePackFilename(format: 'json' | 'markdown'): string {
  const date = new Date().toISOString().slice(0, 10)
  return format === 'json' ? `yiveno-evidence-pack-${date}.json` : `yiveno-evidence-pack-${date}.md`
}

/** 经 Background 构建 pack 并触发浏览器下载。 */
export async function downloadEvidencePackExport(
  ids: string[],
  format: 'json' | 'markdown'
): Promise<{ ok: true } | { ok: false; errorCode: MemoryErrorCode }> {
  const response = await exportEvidencePack({ ids })
  if (!isExportEvidencePackSuccess(response)) {
    return {
      ok: false,
      errorCode: response.ok ? 'EVIDENCE_PACK_OPERATION_FAILED' : response.errorCode
    }
  }
  if (format === 'json') {
    downloadTextFile({
      filename: evidencePackFilename('json'),
      content: JSON.stringify(response.pack, null, 2),
      mimeType: 'application/json;charset=utf-8'
    })
  } else {
    downloadTextFile({
      filename: evidencePackFilename('markdown'),
      content: response.markdown,
      mimeType: 'text/markdown;charset=utf-8'
    })
  }
  return { ok: true }
}
