/**
 * DEV 召回探针语料 · 创作者 / 设计研究者画像（分群第二优先）。
 */

import type { RecallProbePersonaCorpus } from '@/infrastructure/debug/recall-probe-corpus-types'

export const CREATOR_PROBE_CORPUS: RecallProbePersonaCorpus = {
  persona: 'creator',
  label: 'Creator / design researcher',
  bookmarks: [
    {
      key: 'figma-auto-layout',
      title: 'Auto layout best practices',
      url: 'https://help.figma.com/hc/en-us/articles/360040451373',
      daysAgo: 12,
      note: 'reuse for client onboarding deck',
      suggestedClues: [
        'figma auto layout article I saved for the client deck',
        'that help page about auto layout best practices'
      ]
    },
    {
      key: 'nngroup-ia',
      title: 'Information Architecture 101',
      url: 'https://www.nngroup.com/articles/information-architecture-101/',
      daysAgo: 40,
      suggestedClues: [
        'nielsen norman piece on information architecture',
        'IA 101 article from nngroup'
      ]
    },
    {
      key: 'typewolf-pairing',
      title: 'Font pairing ideas for editorial sites',
      url: 'https://www.typewolf.com/tips/font-pairing-editorial',
      daysAgo: 6,
      note: 'try for portfolio refresh',
      suggestedClues: [
        'typewolf font pairing for editorial',
        'bookmark about font pairing for my portfolio'
      ]
    },
    {
      key: 'awwwards-case',
      title: 'Case study: Motion systems that stay quiet',
      url: 'https://www.awwwards.com/case-study-motion-systems-quiet/',
      daysAgo: 18,
      suggestedClues: [
        'awwwards case study on quiet motion systems',
        'the motion systems case study I bookmarked'
      ]
    },
    {
      key: 'adobe-color-a11y',
      title: 'Accessible color contrast for brand kits',
      url: 'https://blog.adobe.com/en/publish/accessible-color-contrast-brand',
      daysAgo: 25,
      suggestedClues: [
        'adobe blog on accessible color contrast',
        'brand kit contrast article I saved'
      ]
    },
    {
      key: 'dribbble-shot-ref',
      title: 'Dashboard density without clutter',
      url: 'https://dribbble.com/shots/dashboard-density-without-clutter',
      daysAgo: 2,
      suggestedClues: [
        'dribbble shot about dashboard density',
        'the dense dashboard reference from a couple days ago'
      ]
    },
    {
      key: 'smashing-forms',
      title: 'Form design patterns that reduce drop-off',
      url: 'https://www.smashingmagazine.com/2024/form-design-patterns-drop-off/',
      daysAgo: 55,
      note: 'checkout redesign research',
      suggestedClues: [
        'smashing magazine form design patterns',
        'article on forms reducing drop-off for checkout'
      ]
    },
    {
      key: 'youtube-critique',
      title: 'Design critique rituals that do not crush juniors',
      url: 'https://www.youtube.com/watch?v=yivenoDesignCritique01',
      daysAgo: 9,
      suggestedClues: [
        'youtube talk on design critique rituals',
        'video about critiques that do not crush juniors'
      ]
    }
  ],
  excerpts: [
    {
      key: 'ex-auto-layout',
      pageTitle: 'Auto layout best practices',
      sourceUrl: 'https://help.figma.com/hc/en-us/articles/360040451373',
      selectedText:
        'Hug contents first; only switch to fill once the parent owns a clear width contract.',
      daysAgo: 11,
      note: 'teach in workshop',
      suggestedClues: [
        'figma excerpt about hug contents before fill',
        'clip I marked to teach in the workshop'
      ]
    },
    {
      key: 'ex-ia',
      pageTitle: 'Information Architecture 101',
      sourceUrl: 'https://www.nngroup.com/articles/information-architecture-101/',
      selectedText:
        'Labels fail quietly: users blame themselves before they blame your navigation.',
      daysAgo: 39,
      suggestedClues: [
        'nngroup excerpt about labels failing quietly',
        'IA quote where users blame themselves'
      ]
    },
    {
      key: 'ex-forms',
      pageTitle: 'Form design patterns that reduce drop-off',
      sourceUrl: 'https://www.smashingmagazine.com/2024/form-design-patterns-drop-off/',
      selectedText: 'Inline validation should celebrate progress, not only punish mistakes.',
      daysAgo: 54,
      suggestedClues: [
        'smashing excerpt about inline validation celebrating progress',
        'form design clip for checkout redesign'
      ]
    },
    {
      key: 'ex-motion',
      pageTitle: 'Case study: Motion systems that stay quiet',
      sourceUrl: 'https://www.awwwards.com/case-study-motion-systems-quiet/',
      selectedText: 'Motion that explains hierarchy beats motion that performs personality.',
      daysAgo: 17,
      suggestedClues: [
        'awwwards clip about motion that explains hierarchy',
        'quiet motion systems quote I highlighted'
      ]
    },
    {
      key: 'ex-pure-note-palette',
      pageTitle: 'Draft',
      sourceUrl: 'https://www.figma.com/file/yivenoProbeDraft01',
      selectedText: 'Placeholder frame copy for spacing experiments.',
      daysAgo: 10,
      note: 'steal midnight teal from brand sheet',
      suggestedClues: [
        'figma draft where I noted steal midnight teal',
        'clip annotated about midnight teal from brand sheet'
      ]
    }
  ]
}
