import type { TranslateFn } from '@/core/i18n/translate'

/** Unit-test English table aligned with a subset of en messages. */
const EN: Record<string, string> = {
  popup_empty_no_memory_title: 'Save a first trace',
  popup_empty_no_memory_body_importing:
    "Bookmarks are importing. You can still save a sentence you'd want to find again.",
  popup_empty_no_memory_body:
    'Highlight a sentence you want to keep (or use Save selection). Then come back and recall it in your own words.',
  popup_capture_first_title: 'Save a line first',
  popup_capture_first_body:
    'Highlight a sentence on any page—or save the demo line on Getting Started—then recall it in your own words.',
  popup_capture_first_body_importing:
    'Your bookmarks are importing. Save one excerpt first—it is the fastest way to see how recall works.',
  popup_empty_library_empty_title: 'Nothing saved yet',
  popup_empty_library_empty_body:
    "There isn't a matching trace in your library yet. Save an excerpt or note first, then come back in your own words.",
  popup_no_match_title_with_clue: 'No match for "$1"',
  popup_no_match_title: 'No matching memory yet',
  popup_no_match_body:
    "There isn't a matching trace in your library yet. Try a shorter clue or save a trace first.",
  popup_welcome_title: 'What are you trying to find?',
  popup_welcome_body:
    "Use whatever clue you remember to find something you've already saved - a page, excerpt, or note.",
  explain_field_title: 'title',
  explain_field_text_excerpt: 'excerpt',
  explain_field_excerpt_context: 'context',
  explain_field_page_title: 'page title',
  explain_field_summary: 'summary',
  explain_field_domain: 'domain',
  explain_field_url: 'url',
  explain_field_keywords: 'keywords',
  explain_field_tags: 'tags',
  explain_field_note: 'note',
  explain_field_short_title: 'title',
  explain_field_short_text_excerpt: 'excerpt',
  explain_field_short_excerpt_context: 'context',
  explain_field_short_page_title: 'page',
  explain_field_short_summary: 'summary',
  explain_field_short_domain: 'domain',
  explain_field_short_url: 'url',
  explain_field_short_keywords: 'keywords',
  explain_field_short_tags: 'tags',
  explain_field_short_note: 'note',
  explain_content_related: 'content-related',
  explain_reason_field_contains: '$1 contains "$2"',
  explain_reason_field_related: '$1 related',
  explain_secondary_also: 'also matched: $1',
  explain_reason_joiner: '; ',
  explain_list_separator: ', ',
  explain_clue_echo: 'Based on "$1"',
  explain_matched_prefix: 'Matched: $1',
  type_label_bookmark: 'Bookmark',
  type_label_excerpt: 'Excerpt',
  omnibox_type_bookmark: 'Y·Bookmark',
  omnibox_type_excerpt: 'Y·Excerpt',
  omnibox_duplicate_count: '$1 total',
  command_title_open_recall: 'Open Recall (side panel)',
  command_title_open_library: 'Open Library',
  command_title_open_settings: 'Open Settings',
  command_title_save_selection: 'Save Selected Text',
  command_title_save_selection_with_note: 'Save Selected Text With Note',
  command_shortcut_unset: 'Not set'
}

/** Replace `$1` / `$2` placeholders using substitutions. */
export const testTranslateEn: TranslateFn = (key, substitutions) => {
  let text = EN[key] ?? key
  const values =
    substitutions === undefined
      ? []
      : Array.isArray(substitutions)
        ? substitutions
        : [substitutions]
  values.forEach((value, index) => {
    text = text.split(`$${index + 1}`).join(value)
  })
  return text
}
