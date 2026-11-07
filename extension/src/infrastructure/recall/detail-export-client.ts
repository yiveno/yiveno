import type {
  ExportDetailExportSuccessResponse,
  MemoryErrorCode
} from '@/core/messaging/memory-messages'
import {
  copyTextToClipboard,
  downloadTextFile
} from '@/infrastructure/browser/clipboard-and-download'
import { exportDetailExport } from '@/infrastructure/messaging/background-client'

function isExportDetailExportSuccess(
  response: Awaited<ReturnType<typeof exportDetailExport>>
): response is ExportDetailExportSuccessResponse {
  return response.ok && 'pack' in response && 'markdown' in response
}

function detailExportFilename(format: 'json' | 'markdown'): string {
  const date = new Date().toISOString().slice(0, 10)
  return format === 'json' ? `yiveno-detail-export-${date}.json` : `yiveno-detail-export-${date}.md`
}

async function fetchDetailExport(
  ids: string[]
): Promise<
  | { ok: true; pack: ExportDetailExportSuccessResponse['pack']; markdown: string }
  | { ok: false; errorCode: MemoryErrorCode }
> {
  const response = await exportDetailExport({ ids })
  if (!isExportDetailExportSuccess(response)) {
    return {
      ok: false,
      errorCode: response.ok ? 'DETAIL_EXPORT_OPERATION_FAILED' : response.errorCode
    }
  }
  return { ok: true, pack: response.pack, markdown: response.markdown }
}

/** 经 Background 构建并触发浏览器下载。 */
export async function downloadDetailExport(
  ids: string[],
  format: 'json' | 'markdown'
): Promise<{ ok: true } | { ok: false; errorCode: MemoryErrorCode }> {
  const fetched = await fetchDetailExport(ids)
  if (!fetched.ok) {
    return fetched
  }
  if (format === 'json') {
    downloadTextFile({
      filename: detailExportFilename('json'),
      content: JSON.stringify(fetched.pack, null, 2),
      mimeType: 'application/json;charset=utf-8'
    })
  } else {
    downloadTextFile({
      filename: detailExportFilename('markdown'),
      content: fetched.markdown,
      mimeType: 'text/markdown;charset=utf-8'
    })
  }
  return { ok: true }
}

/** 经 Background 构建并写入剪贴板。 */
export async function copyDetailExportToClipboard(
  ids: string[],
  format: 'json' | 'markdown'
): Promise<{ ok: true } | { ok: false; errorCode: MemoryErrorCode }> {
  const fetched = await fetchDetailExport(ids)
  if (!fetched.ok) {
    return fetched
  }
  const content = format === 'json' ? JSON.stringify(fetched.pack, null, 2) : fetched.markdown
  const copied = await copyTextToClipboard(content)
  if (!copied) {
    return { ok: false, errorCode: 'DETAIL_EXPORT_OPERATION_FAILED' }
  }
  return { ok: true }
}
