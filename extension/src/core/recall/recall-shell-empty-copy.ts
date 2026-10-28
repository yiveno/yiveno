/**
 * Recall 壳空状态 / 恢复文案选择（纯函数；文案经注入的 translate）。
 * i18n key 仍用 `popup_*` 前缀（遗留）；现行消费方为 Side Panel。
 *
 * 可见截断（宽度 / 省略号）交给 UI CSS；此处只归一空白与病态安全上限。
 */
import type { TranslateFn } from '@/core/i18n/translate'

/** 空态标题插值病态安全上限（非布局宽度）。 */
const NO_MATCH_CLUE_SAFETY_MAX = 200

/** Recall 壳侧记忆库是否已有可检内容。 */
export type RecallShellLibraryState =
  | 'unknown' // 尚未判定
  | 'empty' // 空库
  | 'ready' // 有条目可找回

/**
 * 空库时书签灌库燃料提示（决定文案分流，不单独挡 composer）。
 * - ingest_off：未开灌库（关 GS / Continue without）
 * - importing：已开且 bulk 进行中（pending/running）
 * - ingest_on_empty：已开但库仍空（无书签 / 失败 / 已完成 0）
 */
export type RecallShellBookmarkFuel =
  | 'ingest_off' // 未开书签灌库
  | 'importing' // 已开且导入进行中
  | 'ingest_on_empty' // 已开但库仍空

/** 空态正文片段：可内嵌「打开 Settings 书签开关」链接。 */
export type RecallShellTextSegment =
  { kind: 'text'; text: string } | { kind: 'open_bookmark_ingest_settings'; text: string }

export interface RecallShellEmptyCopy {
  title: string
  /** 纯文本（片段拼接）；测试 / a11y 回退 */
  body: string
  /** 有「导入」可点链时提供；UI 优先渲染片段 */
  bodySegments?: RecallShellTextSegment[]
}

/** 归一空白；超安全上限才尾省略。 */
function normalizeClueForCopy(clue: string): string {
  const trimmed = clue.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= NO_MATCH_CLUE_SAFETY_MAX) {
    return trimmed
  }
  return `${trimmed.slice(0, NO_MATCH_CLUE_SAFETY_MAX - 1).trimEnd()}…`
}

function joinTextSegments(segments: RecallShellTextSegment[]): string {
  return segments.map(segment => segment.text).join('')
}

/**
 * 由灌库开关 + 导入状态推导空库燃料态。
 * 开关关时忽略导入状态（避免从未导入的残留 pending 误导文案）。
 */
export function resolveRecallShellBookmarkFuel(input: {
  bookmarkIngestEnabled: boolean
  importStatus?: 'pending' | 'running' | 'completed' | 'failed' | null | undefined
}): RecallShellBookmarkFuel {
  if (!input.bookmarkIngestEnabled) {
    return 'ingest_off'
  }
  if (input.importStatus === 'running' || input.importStatus === 'pending') {
    return 'importing'
  }
  return 'ingest_on_empty'
}

/** 空库 Idle：未开灌库时展示「导入书签」CTA（非 Capture-first）。 */
export function shouldShowRecallEmptyImportCta(input: {
  library: RecallShellLibraryState
  captureFirst: boolean
  bookmarkFuel: RecallShellBookmarkFuel
}): boolean {
  return input.library === 'empty' && !input.captureFirst && input.bookmarkFuel === 'ingest_off'
}

/** 空库 Idle：已开灌库但仍空时，提供回 GS 的软后路（划存 / 看导入）。 */
export function shouldShowRecallEmptySetupCta(input: {
  library: RecallShellLibraryState
  captureFirst: boolean
  bookmarkFuel: RecallShellBookmarkFuel
}): boolean {
  return (
    input.library === 'empty' && !input.captureFirst && input.bookmarkFuel === 'ingest_on_empty'
  )
}

/** 推入文本片段；仅跳过空串，保留故意的空白前缀（en Idle 链前空格）。 */
function pushTextSegment(segments: RecallShellTextSegment[], text: string): void {
  if (text.length === 0) {
    return
  }
  segments.push({ kind: 'text', text })
}

/** 未开灌库：Idle 正文（「导入书签」可链到 Settings 开关）。 */
function idleIngestOffSegments(translate: TranslateFn): RecallShellTextSegment[] {
  const segments: RecallShellTextSegment[] = []
  pushTextSegment(segments, translate('popup_empty_no_memory_body_prefix'))
  segments.push({
    kind: 'open_bookmark_ingest_settings',
    text: translate('popup_empty_import_bookmarks')
  })
  pushTextSegment(segments, translate('popup_empty_no_memory_body_suffix'))
  return segments
}

/** 未开灌库：空库 no_match 正文（同上链接）。 */
function noMatchIngestOffSegments(translate: TranslateFn): RecallShellTextSegment[] {
  const segments: RecallShellTextSegment[] = []
  pushTextSegment(segments, translate('popup_empty_library_empty_body_prefix'))
  segments.push({
    kind: 'open_bookmark_ingest_settings',
    text: translate('popup_empty_import_bookmarks')
  })
  pushTextSegment(segments, translate('popup_empty_library_empty_body_suffix'))
  return segments
}

function idleBodyForFuel(
  fuel: RecallShellBookmarkFuel,
  translate: TranslateFn
): Pick<RecallShellEmptyCopy, 'body' | 'bodySegments'> {
  if (fuel === 'ingest_off') {
    const bodySegments = idleIngestOffSegments(translate)
    return { body: joinTextSegments(bodySegments), bodySegments }
  }
  if (fuel === 'importing') {
    return { body: translate('popup_empty_no_memory_body_importing') }
  }
  return { body: translate('popup_empty_no_memory_body_ingest_on_empty') }
}

function noMatchEmptyBodyForFuel(
  fuel: RecallShellBookmarkFuel,
  translate: TranslateFn
): Pick<RecallShellEmptyCopy, 'body' | 'bodySegments'> {
  if (fuel === 'ingest_off') {
    const bodySegments = noMatchIngestOffSegments(translate)
    return { body: joinTextSegments(bodySegments), bodySegments }
  }
  if (fuel === 'importing') {
    return { body: translate('popup_empty_library_empty_body_importing') }
  }
  return { body: translate('popup_empty_library_empty_body_ingest_on_empty') }
}

/** idle 区引导（有库时不展示额外空态块，除非仍在安装引导 Capture-first 阶段）。 */
export function getRecallShellIdleEmptyCopy(
  library: RecallShellLibraryState,
  translate: TranslateFn,
  options: {
    captureFirst?: boolean
    /** 空库燃料分流；缺省按未开灌库（双路径引导）。 */
    bookmarkFuel?: RecallShellBookmarkFuel
  } = {}
): RecallShellEmptyCopy | null {
  const bookmarkFuel = options.bookmarkFuel ?? 'ingest_off'

  if (options.captureFirst) {
    return {
      title: translate('popup_capture_first_title'),
      body:
        bookmarkFuel === 'importing'
          ? translate('popup_capture_first_body_importing')
          : translate('popup_capture_first_body')
    }
  }

  if (library !== 'empty') {
    return null
  }

  const bodyPart = idleBodyForFuel(bookmarkFuel, translate)
  return {
    title: translate('popup_empty_no_memory_title'),
    body: bodyPart.body,
    ...(bodyPart.bodySegments ? { bodySegments: bodyPart.bodySegments } : {})
  }
}

/**
 * no_match 区文案。
 * 诚实终局：不附带「缩短再试」等暗示「换查询或许还有」的补救 CTA。
 * 空库时按书签灌库燃料分流（与 Idle 同口径）。
 */
export function getRecallShellNoMatchCopy(
  input: {
    library: RecallShellLibraryState
    clue: string
    /** 空库燃料分流；缺省按未开灌库。 */
    bookmarkFuel?: RecallShellBookmarkFuel
  },
  translate: TranslateFn
): RecallShellEmptyCopy {
  const clueLabel = normalizeClueForCopy(input.clue)
  const bookmarkFuel = input.bookmarkFuel ?? 'ingest_off'

  if (input.library === 'empty') {
    const bodyPart = noMatchEmptyBodyForFuel(bookmarkFuel, translate)
    return {
      title: translate('popup_empty_library_empty_title'),
      body: bodyPart.body,
      ...(bodyPart.bodySegments ? { bodySegments: bodyPart.bodySegments } : {})
    }
  }

  return {
    title: clueLabel
      ? translate('popup_no_match_title_with_clue', clueLabel)
      : translate('popup_no_match_title'),
    body: translate('popup_no_match_body')
  }
}
