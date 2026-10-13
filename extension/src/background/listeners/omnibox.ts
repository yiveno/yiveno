import { recallService } from '@/application/recall/recall-service'
import { memoryItemService } from '@/application/memory/memory-item-service'
import { ensureBackgroundBootstrapped } from '@/background/bootstrap-ready'
import {
  getMemoryItemOpenHref,
  tryParseNavigableUrl,
  tryParseOmniboxOpenMemoryId
} from '@/core/recall/memory-open-href'
import { OPEN_RECALL_ACTION_COMMAND } from '@/core/commands/command-ids'
import {
  buildOmniboxHandoffContent,
  escapeOmniboxXml,
  formatOmniboxDefaultSuggestionDescription,
  formatOmniboxNoMatchSuggestionDescription,
  recallResultToOmniboxSuggests,
  tryParseOmniboxHandoffClue
} from '@/core/recall/omnibox-suggest'
import { openRecallSidePanel } from '@/infrastructure/browser/side-panel'
import { navigateTabToUrl } from '@/infrastructure/browser/navigate-tab'
import { t } from '@/infrastructure/i18n/t'
import { logger } from '@/infrastructure/logging/logger'
import { writeRecallPrefill } from '@/infrastructure/storage/first-recall-onboarding-storage'

let listenersRegistered = false
let inputChangedRequestId = 0

/**
 * `_execute_action` 快捷键缓存（Tip/CTA 文案用）。
 * 避免每键 `commands.getAll`；用户改绑后最多 TTL 内仍显示旧键（可接受）。
 */
const OPEN_RECALL_SHORTCUT_CACHE_TTL_MS = 60_000
let openRecallShortcutCache: { value: string; atMs: number } | null = null

/**
 * 最近一次 inputChanged 的快跳结果（同 clue 回车可跳过二次 Recall，尽早开 Panel 保手势）。
 * SW 休眠后为空，则回车路径再跑一轮 Offline lookup。
 */
let lastOmniboxLookup: { clue: string; hasNavigableTopPick: boolean } | null = null

/** 为一次 onInputChanged 分配序号，供过期丢弃与错误兜底使用。 */
function beginOmniboxInputChangedRequest(): number {
  return ++inputChangedRequestId
}

function isStaleOmniboxInputChangedRequest(requestId: number): boolean {
  return requestId !== inputChangedRequestId
}

/** 确保 Background 已启动（SW 禁止动态 import；经 bootstrap-ready 门闩）。 */
async function ensureReady(): Promise<void> {
  await ensureBackgroundBootstrapped()
}

function getDetailPageUrl(): string {
  return chrome.runtime.getURL('detail.html')
}

/**
 * 读 `_execute_action` 的**当前**绑定（用户可在 chrome://extensions/shortcuts 改掉）。
 * 失败或未绑定时返回空串 → 文案省略快捷键，禁止回退到 manifest 建议键。
 */
async function getOpenRecallActionShortcut(): Promise<string> {
  const now = Date.now()
  if (
    openRecallShortcutCache &&
    now - openRecallShortcutCache.atMs < OPEN_RECALL_SHORTCUT_CACHE_TTL_MS
  ) {
    return openRecallShortcutCache.value
  }
  try {
    const commands = await chrome.commands.getAll()
    const command = commands.find(item => item.name === OPEN_RECALL_ACTION_COMMAND)
    const value = command?.shortcut?.trim() ?? ''
    openRecallShortcutCache = { value, atMs: now }
    return value
  } catch (error) {
    logger.warn('Omnibox', '读取 Side Panel 快捷键失败，文案省略快捷键', error)
    openRecallShortcutCache = { value: '', atMs: now }
    return ''
  }
}

async function getDefaultSuggestionDescription(): Promise<string> {
  const shortcut = await getOpenRecallActionShortcut()
  return escapeOmniboxXml(formatOmniboxDefaultSuggestionDescription(shortcut, t))
}

async function getNoMatchSuggestionDescription(): Promise<string> {
  const shortcut = await getOpenRecallActionShortcut()
  return escapeOmniboxXml(formatOmniboxNoMatchSuggestionDescription(shortcut, t))
}

/**
 * 快跳无命中 → 接力 Side Panel。
 * **必须先调 `openRecallSidePanel`（同步启动），禁止先 await storage/bootstrap**——
 * 否则丢掉 Omnibox 确认手势，`sidePanel.open` 会静默失败（表现为点无命中行无反应）。
 * Panel 消费 prefill 后自动提交完整 Recall（与 GS Try it / 划词同路径）。
 */
async function handoffOmniboxClueToSidePanel(clue: string): Promise<void> {
  const opening = openRecallSidePanel()
  try {
    await writeRecallPrefill(clue)
  } catch (error) {
    logger.error('Omnibox', '写入 Side Panel 预填失败', error)
  }
  try {
    await opening
    logger.info('Omnibox', '无快跳命中，已接力 Side Panel', { clueLength: clue.length })
  } catch (error) {
    logger.error('Omnibox', '无快跳命中但打开 Side Panel 失败（预填可能已写入）', error)
  }
}

/** 按 disposition 打开 URL（Omnibox 单次命中，无会话）。 */
async function openUrlByDisposition(
  url: string,
  disposition: 'currentTab' | 'newBackgroundTab' | 'newForegroundTab'
): Promise<void> {
  if (disposition === 'newBackgroundTab') {
    await chrome.tabs.create({ url, active: false })
    return
  }

  await navigateTabToUrl(
    url,
    disposition === 'newForegroundTab' ? 'newForegroundTab' : 'currentTab'
  )
}

/** 尽力记录打开；失败不影响导航。 */
async function recordOpenBestEffort(memoryItemId: string | null | undefined): Promise<void> {
  if (!memoryItemId) {
    return
  }
  try {
    await memoryItemService.recordOpen(memoryItemId)
  } catch (error) {
    logger.error('Omnibox', '记录 Memory 打开失败', error)
  }
}

/**
 * Omnibox 输入变化：离线查找轨（规则 parse + 本机 Filter + Indexed Fuzzy），映射为原生建议。
 *
 * **suggest 只调用一次（硬约束）：** Chromium 对单次 `onInputChanged` 的 `suggest`
 * 回调历史上按 one-shot 消费；若在异步 Recall 前先 `suggest([])`，后续真实结果会被丢弃，
 * 地址栏只剩 default 文案 + 浏览器历史补位——表现为「永远都不进 IndexedDB」。
 * 新键入会换新的 suggest 回调；过期请求用 requestId 丢弃，勿再抢先清空。
 */
async function handleOmniboxInputChanged(
  requestId: number,
  text: string,
  suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void
): Promise<void> {
  const clue = text.trim()

  if (!clue) {
    lastOmniboxLookup = null
    void chrome.omnibox.setDefaultSuggestion({
      description: await getDefaultSuggestionDescription()
    })
    suggest([])
    return
  }

  // Tip 与 lookup 并行：禁止先 await Tip 再开 Recall（短路径优先；仍禁止提前 suggest([])）。
  const tipUpdate = getDefaultSuggestionDescription().then(description => {
    if (isStaleOmniboxInputChangedRequest(requestId)) {
      return
    }
    void chrome.omnibox.setDefaultSuggestion({ description })
  })

  await ensureReady()
  if (isStaleOmniboxInputChangedRequest(requestId)) {
    logger.info('Omnibox', 'inputChanged：bootstrap 后已过期，丢弃', { requestId })
    return
  }

  logger.info('Omnibox', 'inputChanged：开始 Recall', {
    requestId,
    clueLength: clue.length
  })
  const result = await recallService.recallWithClue(clue, { entry: 'omnibox' })
  await tipUpdate.catch(() => undefined)

  if (isStaleOmniboxInputChangedRequest(requestId)) {
    logger.info('Omnibox', 'inputChanged：结果已过期，丢弃', { requestId })
    return
  }

  const detailPageUrl = getDetailPageUrl()
  const topHref = result.topPick
    ? getMemoryItemOpenHref(result.topPick.item, { detailPageUrl }).trim()
    : ''
  const hasNavigableTopPick = Boolean(tryParseNavigableUrl(topHref))
  lastOmniboxLookup = { clue, hasNavigableTopPick }

  logger.info('Omnibox', 'inputChanged：Recall 完成', {
    requestId,
    outcome: result.outcome,
    alsoPossibleCount: result.alsoPossible.length,
    topPickId: result.topPick?.item.id ?? null,
    hasNavigableTopPick
  })

  const openRecallShortcut = await getOpenRecallActionShortcut()
  const suggests = recallResultToOmniboxSuggests(result, {
    detailPageUrl,
    translate: t,
    clue: result.effectiveClue ?? clue,
    openRecallShortcut
  })
  if (suggests.length === 0) {
    // 第 1 行 = default（常驻 Tip，非 CTA）；
    // 第 2 行 = 可点 SuggestResult（无命中 CTA → handoff）；content ≠ 输入字面。
    void chrome.omnibox.setDefaultSuggestion({
      description: await getDefaultSuggestionDescription()
    })
    suggest([
      {
        content: buildOmniboxHandoffContent(clue),
        description: await getNoMatchSuggestionDescription()
      }
    ])
    return
  }

  void chrome.omnibox.setDefaultSuggestion({
    description: await getDefaultSuggestionDescription()
  })
  suggest(suggests)
}

/**
 * 确认输入：选中建议 → 打开 URL；直接回车且有 Top Pick → 打开；
 * 无快跳命中 → 写 prefill + 开 Side Panel（完整 Recall 接力，非 Omnibox 会话）。
 */
async function handleOmniboxInputEntered(
  text: string,
  disposition: 'currentTab' | 'newBackgroundTab' | 'newForegroundTab'
): Promise<void> {
  // 无命中可点行：最先处理，且内部先 open 再 await storage（保手势）
  const handoffClue = tryParseOmniboxHandoffClue(text)
  if (handoffClue) {
    await handoffOmniboxClueToSidePanel(handoffClue)
    return
  }

  const detailPageUrl = getDetailPageUrl()

  // 书签建议：omnibox-open.html?id= → 写回后打开真实 URL（不落占位页）
  const omniboxOpenId = tryParseOmniboxOpenMemoryId(text)
  if (omniboxOpenId) {
    await ensureReady()
    await recordOpenBestEffort(omniboxOpenId)
    const item = await memoryItemService.getById(omniboxOpenId)
    const href = item ? getMemoryItemOpenHref(item, { detailPageUrl }).trim() : ''
    const url = tryParseNavigableUrl(href)
    if (!url) {
      logger.info('Omnibox', '占位建议无法解析目标', { omniboxOpenId })
      return
    }
    await openUrlByDisposition(url, disposition)
    return
  }

  const directUrl = tryParseNavigableUrl(text)
  if (directUrl) {
    // 摘录详情页由 Detail 记录打开；遗留书签直链无 id，此处不写
    await openUrlByDisposition(directUrl, disposition)
    return
  }

  const clue = text.trim()
  if (!clue) {
    return
  }

  // 默认行确认 = 线索字面：仅当有可打开 Top Pick 才快跳。
  // 无命中接力只认第 2 行 handoff SuggestResult（勿在此接力，避免说明行误触）。
  if (lastOmniboxLookup?.clue === clue && !lastOmniboxLookup.hasNavigableTopPick) {
    logger.info('Omnibox', '默认行确认且无快跳命中，忽略（请点无命中 CTA 行）', {
      clueLength: clue.length
    })
    return
  }

  await ensureReady()
  const result = await recallService.recallWithClue(clue, { entry: 'omnibox' })
  const topPick = result.topPick
  const topHref = topPick ? getMemoryItemOpenHref(topPick.item, { detailPageUrl }) : ''
  const url = tryParseNavigableUrl(topHref)

  if (!url) {
    lastOmniboxLookup = { clue, hasNavigableTopPick: false }
    logger.info('Omnibox', '线索确认无 Top Pick，不接力（须点 CTA 行）', {
      clueLength: clue.length
    })
    return
  }

  lastOmniboxLookup = { clue, hasNavigableTopPick: true }

  // 书签在此记；摘录进详情由 Detail 记
  if (topPick?.item.type === 'bookmark') {
    await recordOpenBestEffort(topPick.item.id)
  }
  await openUrlByDisposition(url, disposition)
}

/** 注册 Omnibox 监听器（仅 Background 调用一次）。 */
export function registerOmniboxListeners(): void {
  if (listenersRegistered) {
    return
  }
  listenersRegistered = true

  void getDefaultSuggestionDescription()
    .then(description => {
      void chrome.omnibox.setDefaultSuggestion({ description })
    })
    .catch(error => {
      logger.warn('Omnibox', '注册时设置 default suggestion 失败', error)
    })

  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    const requestId = beginOmniboxInputChangedRequest()
    void handleOmniboxInputChanged(requestId, text, suggest).catch(error => {
      if (isStaleOmniboxInputChangedRequest(requestId)) {
        return
      }
      logger.error('Omnibox', '输入变化处理失败', error)
      suggest([])
    })
  })

  chrome.omnibox.onInputEntered.addListener((text, disposition) => {
    void handleOmniboxInputEntered(
      text,
      disposition as 'currentTab' | 'newBackgroundTab' | 'newForegroundTab'
    ).catch(error => {
      logger.error('Omnibox', '确认输入处理失败', error)
    })
  })

  logger.info('Omnibox', 'Omnibox 找回监听器已注册')
}

/** 测试用：重置监听器注册状态。 */
export function resetOmniboxListenersForTests(): void {
  listenersRegistered = false
  inputChangedRequestId = 0
  lastOmniboxLookup = null
  openRecallShortcutCache = null
}
