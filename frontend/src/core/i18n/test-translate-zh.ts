import type { TranslateFn } from '@/core/i18n/translate'

/** 单测用固定中文表（与 zh_CN messages 对齐的子集）。 */
const ZH: Record<string, string> = {
  popup_empty_no_memory_title: '你想找什么？',
  popup_empty_no_memory_body_importing:
    '书签正在导入。你也可以先划一句想留住的——这是最快感受到 Yiveno 的方式。',
  popup_empty_no_memory_body: '在网页划一句你想留住的。准备好之后，哪怕只记得一点，也可以回来找。',
  popup_empty_library_empty_title: '还没有保存的内容',
  popup_empty_library_empty_body:
    '先留下一点属于你的痕迹——一句摘录、一条备注、一个你在意的页面。再随便给点线索试试。',
  popup_no_match_title_with_clue: '没找到和「$1」相关的',
  popup_no_match_title: '还没找到匹配的',
  popup_no_match_body: '试试更短的词，或备注、正文里还记得的片段。也可再划词存一点后再找回。',
  explain_field_title: '标题',
  explain_field_text_excerpt: '正文片段',
  explain_field_excerpt_context: '上下文',
  explain_field_page_title: '出处页名',
  explain_field_summary: '摘要',
  explain_field_domain: '域名',
  explain_field_url: '链接',
  explain_field_keywords: '关键词',
  explain_field_tags: '标签',
  explain_field_note: '备注',
  explain_field_short_title: '标题',
  explain_field_short_text_excerpt: '正文',
  explain_field_short_excerpt_context: '上下文',
  explain_field_short_page_title: '页名',
  explain_field_short_summary: '摘要',
  explain_field_short_domain: '域名',
  explain_field_short_url: '链接',
  explain_field_short_keywords: '关键词',
  explain_field_short_tags: '标签',
  explain_field_short_note: '备注',
  explain_content_related: '内容相关',
  explain_reason_field_contains: '因$1含「$2」',
  explain_reason_field_related: '因$1相关',
  explain_secondary_also: '还匹配：$1',
  explain_reason_joiner: '；',
  explain_list_separator: '、',
  explain_clue_echo: '根据线索「$1」',
  explain_matched_prefix: '匹配：$1',
  type_label_bookmark: '书签',
  type_label_excerpt: '文字片段',
  omnibox_type_bookmark: 'Y·书签',
  omnibox_type_excerpt: 'Y·摘录',
  omnibox_duplicate_count: '共 $1 条',
  command_title_open_recall_popup: '打开找回（Popup）',
  command_title_open_library: '打开记忆库',
  command_title_open_settings: '打开设置',
  command_title_save_selection: '保存选中文字',
  command_title_save_selection_with_note: '保存选中文字并备注',
  command_shortcut_unset: '未设置'
}

/** 将 `$1` / `$2` 模板替换为 substitutions。 */
export const testTranslateZh: TranslateFn = (key, substitutions) => {
  let text = ZH[key] ?? key
  const values =
    substitutions === undefined
      ? []
      : Array.isArray(substitutions)
        ? substitutions
        : [substitutions]
  values.forEach((value, index) => {
    text = text.split(`$${index + 1}`).join(value)
  })
  // 清理残留 `$` 后若写成 `$1` 已被替换；Chrome named `$clue$` 已在表中写成 `$1`
  return text
}
