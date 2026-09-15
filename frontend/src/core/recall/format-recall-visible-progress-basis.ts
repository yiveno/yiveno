/**
 * 格式化 §7.0 结果页「主要依据」轻解释句。
 */

import type { TranslateFn } from '@/core/i18n/translate'
import type { RecallVisibleProgressBasisKind } from '@/core/recall/visible-progress-basis'

const BASIS_KIND_KEYS: Record<RecallVisibleProgressBasisKind, string> = {
  timing: 'popup_recall_progress_basis_timing',
  source: 'popup_recall_progress_basis_source',
  purpose: 'popup_recall_progress_basis_purpose'
}

/** 将依据维度拼成 Mainly based on: … 句；无维度则返回空串。 */
export function formatRecallVisibleProgressBasis(
  kinds: readonly RecallVisibleProgressBasisKind[],
  translate: TranslateFn
): string {
  if (kinds.length === 0) {
    return ''
  }
  const labels = kinds.map(kind => translate(BASIS_KIND_KEYS[kind]))
  let parts: string
  if (labels.length === 1) {
    parts = labels[0]!
  } else if (labels.length === 2) {
    parts = `${labels[0]} and ${labels[1]}`
  } else {
    const head = labels.slice(0, -1).join(translate('popup_recall_progress_basis_sep'))
    parts = `${head}${translate('popup_recall_progress_basis_sep_last')}${labels[labels.length - 1]}`
  }
  return translate('popup_recall_progress_basis', [parts])
}
