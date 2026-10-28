import type { TranslateFn } from '@/core/i18n/translate'

/** Unit-test English table aligned with a subset of en messages. */
const EN: Record<string, string> = {
  popup_empty_no_memory_title: 'Nothing in your library yet',
  popup_empty_no_memory_body_importing:
    'Your bookmarks are syncing in. You can also highlight a line to keep—once it’s saved, recall it in your own words.',
  popup_empty_no_memory_body_prefix: ' ',
  popup_empty_no_memory_body_suffix:
    ', or highlight a line to save. Then come back and recall it in your own words.',
  popup_empty_no_memory_body:
    'Sync your bookmarks, or highlight a line to save. Then come back and recall it in your own words.',
  popup_empty_no_memory_body_ingest_on_empty:
    'Bookmark sync is on, but your library is still empty. Save a highlight (or open Getting Started), then recall it in your own words.',
  popup_empty_import_bookmarks: 'Sync bookmarks',
  popup_empty_import_bookmarks_aria: 'Open Settings to turn on bookmark sync',
  popup_capture_first_title: 'Save a line first',
  popup_capture_first_body:
    'Highlight a sentence on any page—or save the demo line on Getting Started—then recall it in your own words.',
  popup_capture_first_body_importing:
    'Your bookmarks are syncing in. Save one excerpt first—it is the fastest way to see how recall works.',
  popup_empty_library_empty_title: 'Nothing saved yet',
  popup_empty_library_empty_body_prefix: 'Your library is empty. ',
  popup_empty_library_empty_body_suffix:
    ' or save an excerpt first, then try again in your own words.',
  popup_empty_library_empty_body:
    'Your library is empty. Sync bookmarks or save an excerpt first, then try again in your own words.',
  popup_empty_library_empty_body_importing:
    'Your bookmarks are still syncing in. Save an excerpt if you want something to recall right away.',
  popup_empty_library_empty_body_ingest_on_empty:
    'Your library is still empty. Save a highlight, then come back with any clue in your own words.',
  popup_no_match_title_with_clue: 'No match for "$1"',
  popup_no_match_title: 'No matching memory yet',
  popup_no_match_body: 'Nothing close enough turned up. Try another detail that stuck with you.',
  popup_welcome_title: 'What do you want to recall?',
  popup_welcome_body: 'Say it however you remember—any detail works.',
  popup_idle_paradigm_hint: 'Try saying it like…',
  popup_idle_paradigm_content_time: 'that article I saved yesterday about caching',
  popup_idle_paradigm_note: 'something I noted about the pricing page',
  popup_idle_paradigm_saved_when: 'the page I saved this morning',
  popup_idle_paradigm_fill_aria: 'Fill clue: $1',
  popup_greeting_morning: 'Good morning',
  popup_greeting_afternoon: 'Good afternoon',
  popup_greeting_evening: 'Good evening',
  popup_greeting_night: 'Good night',
  popup_greeting_morning_named: 'Good morning, $1',
  popup_greeting_afternoon_named: 'Good afternoon, $1',
  popup_greeting_evening_named: 'Good evening, $1',
  popup_greeting_night_named: 'Good night, $1',
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
  explain_field_embedding: 'related meaning',
  explain_field_hybrid_rrf: 'overall fit',
  explain_field_constraint_neighborhood: 'type match',
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
  explain_field_short_embedding: 'meaning',
  explain_field_short_hybrid_rrf: 'overall fit',
  explain_field_short_constraint_neighborhood: 'type',
  explain_content_related: 'Related to your clue',
  explain_reason_constraint_neighborhood: 'Fits this type in your library',
  explain_reason_field_contains: 'Found “$2” in $1',
  explain_reason_field_related: 'Related via $1',
  explain_secondary_also: 'Also: $1',
  explain_reason_joiner: '; ',
  explain_list_separator: ', ',
  explain_clue_echo: 'Based on "$1"',
  explain_matched_prefix: 'Found in: $1',
  type_label_bookmark: 'Bookmark',
  type_label_excerpt: 'Excerpt',
  omnibox_default_suggestion: 'Tip: Title, site, or note keyword. Fuzzy → Side Panel',
  omnibox_default_suggestion_with_shortcut:
    'Tip: Title, site, or note keyword. Fuzzy → Side Panel ($1)',
  omnibox_no_match: 'No quick match — open Side Panel to recall this',
  omnibox_no_match_with_shortcut: 'No quick match — open Side Panel to recall this ($1)',
  omnibox_switch_track: 'Not what you wanted? Open Side Panel',
  omnibox_switch_track_with_shortcut: 'Not what you wanted? Open Side Panel ($1)',
  omnibox_type_bookmark: 'Bookmark',
  omnibox_type_excerpt: 'Excerpt',
  omnibox_duplicate_count: '$1 similar',
  recall_card_saved: 'Saved $1',
  recall_card_saved_just_now: 'Just saved',
  recall_card_match_reason_aria: 'Why this fits: $1',
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
