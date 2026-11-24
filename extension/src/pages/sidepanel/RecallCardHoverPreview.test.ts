/**
 * RecallCardHoverPreview：摘录卡查图优先 sourceUrl（card.url 常为 detail.html）。
 * 用 createApp + 响应式 wrapper（仓内尚无 @vue/test-utils）。
 */
import { createApp, h, nextTick, reactive, type App } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'
import RecallCardHoverPreview from '@/pages/sidepanel/RecallCardHoverPreview.vue'

const getPagePreviewMock = vi.hoisted(() => vi.fn())

vi.mock('@/infrastructure/messaging/background-client', () => ({
  getPagePreview: (...args: unknown[]) => getPagePreviewMock(...args)
}))

vi.mock('@/infrastructure/browser/chrome-favicon', () => ({
  getChromeFaviconUrl: (pageUrl: string) => `mock-favicon://${pageUrl}`
}))

function emptyParts(): RecallCardModel['titleParts'] {
  return []
}

function baseCard(
  partial: Partial<RecallCardModel> & Pick<RecallCardModel, 'id' | 'itemKind' | 'typeLabel'>
): RecallCardModel {
  return {
    title: 'Sample title',
    subtitle: '',
    url: 'https://example.com/page',
    titleParts: emptyParts(),
    subtitleParts: emptyParts(),
    excerptParts: emptyParts(),
    noteParts: emptyParts(),
    ...partial
  }
}

type PreviewProps = {
  card: RecallCardModel
  visible: boolean
  anchorRect: DOMRect | null
  panelRect: DOMRect | null
}

type MountResult = { app: App; root: HTMLElement; state: PreviewProps }

function mountPreview(initial: Partial<PreviewProps> & { card: RecallCardModel }): MountResult {
  const state = reactive<PreviewProps>({
    card: initial.card,
    visible: initial.visible ?? false,
    anchorRect: initial.anchorRect ?? new DOMRect(20, 100, 320, 80),
    panelRect: initial.panelRect ?? new DOMRect(0, 0, 360, 800)
  })
  const root = document.createElement('div')
  document.body.appendChild(root)
  const app = createApp({
    setup() {
      return () =>
        h(RecallCardHoverPreview, {
          card: state.card,
          visible: state.visible,
          anchorRect: state.anchorRect,
          panelRect: state.panelRect
        })
    }
  })
  app.mount(root)
  return { app, root, state }
}

async function showPreview(state: PreviewProps): Promise<void> {
  state.visible = true
  await nextTick()
  // loadPreview 为 async；再等一拍让 getPagePreview 结算
  await Promise.resolve()
  await nextTick()
}

describe('RecallCardHoverPreview 查图 URL', () => {
  const mounts: MountResult[] = []

  beforeEach(() => {
    getPagePreviewMock.mockReset()
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test${path}`
      },
      i18n: {
        getUILanguage: () => 'en',
        getMessage: (key: string) => key
      }
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  afterEach(() => {
    for (const m of mounts.splice(0)) {
      m.app.unmount()
      m.root.remove()
    }
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('摘录卡：detail.html + sourceUrl → getPagePreview(sourceUrl)，Blob 后 ready', async () => {
    const sourceUrl = 'https://news.example.com/article/1'
    getPagePreviewMock.mockResolvedValue({
      ok: true,
      blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
      width: 800,
      height: 500
    })
    const mounted = mountPreview({
      card: baseCard({
        id: 'ex-1',
        itemKind: 'text_excerpt',
        typeLabel: 'Text excerpt',
        url: 'chrome-extension://testid/detail.html?id=ex-1',
        sourceUrl,
        excerpt: 'Saved line'
      })
    })
    mounts.push(mounted)

    await showPreview(mounted.state)

    expect(getPagePreviewMock).toHaveBeenCalledTimes(1)
    expect(getPagePreviewMock).toHaveBeenCalledWith({ url: sourceUrl })
    expect(mounted.root.querySelector('.recall-card-hover-preview__shot img')).not.toBeNull()
    expect(mounted.root.querySelector('.recall-card-hover-preview__fallback')).toBeNull()
  })

  it('书签卡：无 sourceUrl → 仍以 card.url 调用', async () => {
    const bookmarkUrl = 'https://docs.example.com/guide'
    getPagePreviewMock.mockResolvedValue({
      ok: true,
      blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
      width: 800,
      height: 500
    })
    const mounted = mountPreview({
      card: baseCard({
        id: 'bm-1',
        itemKind: 'bookmark',
        typeLabel: 'Bookmark',
        url: bookmarkUrl
      })
    })
    mounts.push(mounted)

    await showPreview(mounted.state)

    expect(getPagePreviewMock).toHaveBeenCalledWith({ url: bookmarkUrl })
    expect(mounted.root.querySelector('.recall-card-hover-preview__shot img')).not.toBeNull()
  })

  it('摘录卡无 sourceUrl（仅 detail URL）→ fallback，不抛错、不发 getPagePreview', async () => {
    const mounted = mountPreview({
      card: baseCard({
        id: 'ex-no-src',
        itemKind: 'text_excerpt',
        typeLabel: 'Text excerpt',
        url: 'chrome-extension://testid/detail.html?id=ex-no-src',
        excerpt: 'No source'
      })
    })
    mounts.push(mounted)

    await expect(showPreview(mounted.state)).resolves.toBeUndefined()
    expect(getPagePreviewMock).not.toHaveBeenCalled()
    expect(mounted.root.querySelector('.recall-card-hover-preview__fallback')).not.toBeNull()
    expect(mounted.root.querySelector('.recall-card-hover-preview__shot')).toBeNull()
  })

  it('getPagePreview 返回 PAGE_PREVIEW_NOT_FOUND → fallback', async () => {
    getPagePreviewMock.mockResolvedValue({
      ok: false,
      errorCode: 'PAGE_PREVIEW_NOT_FOUND'
    })
    const mounted = mountPreview({
      card: baseCard({
        id: 'ex-miss',
        itemKind: 'text_excerpt',
        typeLabel: 'Text excerpt',
        url: 'chrome-extension://testid/detail.html?id=ex-miss',
        sourceUrl: 'https://example.com/miss',
        excerpt: 'Missing shot'
      })
    })
    mounts.push(mounted)

    await showPreview(mounted.state)

    expect(getPagePreviewMock).toHaveBeenCalledWith({ url: 'https://example.com/miss' })
    expect(mounted.root.querySelector('.recall-card-hover-preview__fallback')).not.toBeNull()
    expect(mounted.root.querySelector('.recall-card-hover-preview__shot')).toBeNull()
  })

  it('domainLine：subtitle 空时用 sourceUrl 主机名', async () => {
    getPagePreviewMock.mockResolvedValue({
      ok: false,
      errorCode: 'PAGE_PREVIEW_NOT_FOUND'
    })
    const mounted = mountPreview({
      card: baseCard({
        id: 'ex-domain',
        itemKind: 'text_excerpt',
        typeLabel: 'Text excerpt',
        subtitle: '',
        url: 'chrome-extension://testid/detail.html?id=ex-domain',
        sourceUrl: 'https://wiki.example.org/page',
        excerpt: 'Body'
      })
    })
    mounts.push(mounted)

    await showPreview(mounted.state)

    const domain = mounted.root.querySelector('.recall-card-hover-preview__domain')
    expect(domain?.textContent).toBe('wiki.example.org')
  })
})
