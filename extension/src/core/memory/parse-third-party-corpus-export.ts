/**
 * 第三方语料导出解析入口（Raindrop / Pocket · §5.10.6）。
 */

import { parseNetscapeBookmarksHtml } from '@/core/memory/parse-netscape-bookmarks-html'
import { parseRaindropCsv } from '@/core/memory/parse-raindrop-csv'
import { parseRaindropJson } from '@/core/memory/parse-raindrop-json'
import {
  THIRD_PARTY_CORPUS_IMPORT_MAX_ITEMS,
  type ParsedThirdPartyBookmark,
  type ThirdPartyCorpusSource
} from '@/core/memory/third-party-corpus-source'

export type ThirdPartyCorpusExportFormat = 'html' | 'csv' | 'json'

export class ThirdPartyCorpusParseError extends Error {
  readonly errorCode:
    | 'THIRD_PARTY_IMPORT_INVALID_FORMAT'
    | 'THIRD_PARTY_IMPORT_EMPTY'
    | 'THIRD_PARTY_IMPORT_TOO_MANY_ITEMS'

  constructor(
    errorCode:
      | 'THIRD_PARTY_IMPORT_INVALID_FORMAT'
      | 'THIRD_PARTY_IMPORT_EMPTY'
      | 'THIRD_PARTY_IMPORT_TOO_MANY_ITEMS',
    message?: string
  ) {
    super(message ?? errorCode)
    this.name = 'ThirdPartyCorpusParseError'
    this.errorCode = errorCode
  }
}

function detectFormat(content: string): ThirdPartyCorpusExportFormat {
  const trimmed = content.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json'
  }
  if (/<!DOCTYPE\s+NETSCAPE-Bookmark-file-1/i.test(trimmed) || /<DT>\s*<A\b/i.test(trimmed)) {
    return 'html'
  }
  const firstLine = trimmed.split(/\r?\n/, 1)[0]?.toLowerCase() ?? ''
  if (firstLine.includes('link') && firstLine.includes(',')) {
    return 'csv'
  }
  return 'html'
}

function parseByFormat(
  source: ThirdPartyCorpusSource,
  format: ThirdPartyCorpusExportFormat,
  content: string
): ParsedThirdPartyBookmark[] {
  if (format === 'json') {
    if (source !== 'raindrop') {
      throw new ThirdPartyCorpusParseError('THIRD_PARTY_IMPORT_INVALID_FORMAT')
    }
    return parseRaindropJson(content)
  }
  if (format === 'csv') {
    if (source !== 'raindrop') {
      throw new ThirdPartyCorpusParseError('THIRD_PARTY_IMPORT_INVALID_FORMAT')
    }
    return parseRaindropCsv(content)
  }
  return parseNetscapeBookmarksHtml(content)
}

/** 解析导出文件并限制条数（2–50 由导入服务再校验；此处只截断上限）。 */
export function parseThirdPartyCorpusExport(input: {
  source: ThirdPartyCorpusSource
  content: string
  format?: ThirdPartyCorpusExportFormat
}): ParsedThirdPartyBookmark[] {
  const format = input.format ?? detectFormat(input.content)
  const parsed = parseByFormat(input.source, format, input.content)
  if (parsed.length === 0) {
    throw new ThirdPartyCorpusParseError('THIRD_PARTY_IMPORT_EMPTY')
  }
  if (parsed.length > THIRD_PARTY_CORPUS_IMPORT_MAX_ITEMS) {
    throw new ThirdPartyCorpusParseError('THIRD_PARTY_IMPORT_TOO_MANY_ITEMS')
  }
  return parsed
}
