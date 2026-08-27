import { describe, expect, it } from 'vitest'

import { parseNetscapeBookmarksHtml } from '@/core/memory/parse-netscape-bookmarks-html'
import { parseRaindropCsv } from '@/core/memory/parse-raindrop-csv'
import { parseRaindropJson } from '@/core/memory/parse-raindrop-json'
import {
  ThirdPartyCorpusParseError,
  parseThirdPartyCorpusExport
} from '@/core/memory/parse-third-party-corpus-export'

describe('parse-third-party-corpus-export', () => {
  it('解析 Netscape HTML（Raindrop / Pocket）', () => {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><A HREF="https://example.com/a" ADD_DATE="1720000000" TAGS="work">Alpha</A>
    <DT><A HREF="https://example.com/b" ADD_DATE="1720001000">Beta</A>
</DL><p>`
    const items = parseNetscapeBookmarksHtml(html)
    expect(items).toHaveLength(2)
    expect(items[0]?.title).toBe('Alpha')
    expect(items[0]?.url).toBe('https://example.com/a')
    expect(items[0]?.note).toBe('work')
    expect(items[0]?.createdAt).toBe(new Date(1720000000 * 1000).toISOString())
  })

  it('解析 Raindrop CSV', () => {
    const csv = `id,title,link,created,excerpt,tags
1,Alpha,https://example.com/a,2024-01-01T00:00:00.000Z,note a,tag1
2,Beta,https://example.com/b,2024-02-01T00:00:00.000Z,,`
    const items = parseRaindropCsv(csv)
    expect(items).toHaveLength(2)
    expect(items[0]?.remoteId).toBe('1')
    expect(items[0]?.note).toContain('note a')
  })

  it('解析 Raindrop JSON items', () => {
    const json = JSON.stringify({
      items: [
        {
          _id: 42,
          title: 'Runbook',
          link: 'https://example.com/runbook',
          created: '2024-03-01T12:00:00.000Z',
          excerpt: 'deploy'
        }
      ]
    })
    const items = parseRaindropJson(json)
    expect(items).toHaveLength(1)
    expect(items[0]?.remoteId).toBe('42')
    expect(items[0]?.note).toBe('deploy')
  })

  it('入口：空文件抛 EMPTY；超限抛 TOO_MANY', () => {
    expect(() =>
      parseThirdPartyCorpusExport({ source: 'pocket', content: '<html></html>' })
    ).toThrow(ThirdPartyCorpusParseError)

    const manyLinks = Array.from({ length: 51 }, (_, i) => {
      return `<DT><A HREF="https://example.com/i${i}">Item ${i}</A>`
    }).join('\n')
    expect(() =>
      parseThirdPartyCorpusExport({
        source: 'raindrop',
        content: `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n${manyLinks}`
      })
    ).toThrow(/TOO_MANY|ThirdPartyCorpusParseError/)
  })
})
