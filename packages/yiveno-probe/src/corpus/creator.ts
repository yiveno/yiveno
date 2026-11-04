/**
 * DEV 召回探针语料 · 创作者 / 设计研究者画像（分群第二优先）。
 */

import type { RecallProbePersonaCorpus } from './types'

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
      clues: [
        { text: 'figma auto layout article I saved for the client deck', type: 'note' },
        { text: 'that help page about auto layout best practices', type: 'verbatim' }
      ]
    },
    {
      key: 'nngroup-ia',
      title: 'Information Architecture 101',
      url: 'https://www.nngroup.com/articles/information-architecture-101/',
      daysAgo: 40,
      clues: [
        { text: 'nielsen norman piece on information architecture', type: 'verbatim' },
        { text: 'IA 101 article from nngroup', type: 'paraphrase' }
      ]
    },
    {
      key: 'typewolf-pairing',
      title: 'Font pairing ideas for editorial sites',
      url: 'https://www.typewolf.com/tips/font-pairing-editorial',
      daysAgo: 6,
      note: 'try for portfolio refresh',
      clues: [
        { text: 'typewolf font pairing for editorial', type: 'verbatim' },
        { text: 'bookmark about font pairing for my portfolio', type: 'note' }
      ]
    },
    {
      key: 'awwwards-case',
      title: 'Case study: Motion systems that stay quiet',
      url: 'https://www.awwwards.com/case-study-motion-systems-quiet/',
      daysAgo: 18,
      clues: [
        { text: 'awwwards case study on quiet motion systems', type: 'verbatim' },
        { text: 'the motion systems case study I bookmarked', type: 'verbatim' }
      ]
    },
    {
      key: 'adobe-color-a11y',
      title: 'Accessible color contrast for brand kits',
      url: 'https://blog.adobe.com/en/publish/accessible-color-contrast-brand',
      daysAgo: 25,
      clues: [
        { text: 'adobe blog on accessible color contrast', type: 'verbatim' },
        { text: 'brand kit contrast article I saved', type: 'verbatim' }
      ]
    },
    {
      key: 'dribbble-shot-ref',
      title: 'Dashboard density without clutter',
      url: 'https://dribbble.com/shots/dashboard-density-without-clutter',
      daysAgo: 2,
      clues: [
        { text: 'dribbble shot about dashboard density', type: 'verbatim' },
        { text: 'the dense dashboard reference from a couple days ago', type: 'temporal' }
      ]
    },
    {
      key: 'smashing-forms',
      title: 'Form design patterns that reduce drop-off',
      url: 'https://www.smashingmagazine.com/2024/form-design-patterns-drop-off/',
      daysAgo: 55,
      note: 'checkout redesign research',
      clues: [
        { text: 'smashing magazine form design patterns', type: 'verbatim' },
        { text: 'article on forms reducing drop-off for checkout', type: 'note' }
      ]
    },
    {
      key: 'youtube-critique',
      title: 'Design critique rituals that do not crush juniors',
      url: 'https://www.youtube.com/watch?v=yivenoDesignCritique01',
      daysAgo: 9,
      clues: [
        { text: 'youtube talk on design critique rituals', type: 'verbatim' },
        { text: 'video about critiques that do not crush juniors', type: 'verbatim' }
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
      clues: [
        { text: 'figma excerpt about hug contents before fill', type: 'paraphrase' },
        { text: 'clip I marked to teach in the workshop', type: 'note' }
      ]
    },
    {
      key: 'ex-ia',
      pageTitle: 'Information Architecture 101',
      sourceUrl: 'https://www.nngroup.com/articles/information-architecture-101/',
      selectedText:
        'Labels fail quietly: users blame themselves before they blame your navigation.',
      daysAgo: 39,
      clues: [
        { text: 'nngroup excerpt about labels failing quietly', type: 'paraphrase' },
        { text: 'IA quote where users blame themselves', type: 'paraphrase' }
      ]
    },
    {
      key: 'ex-forms',
      pageTitle: 'Form design patterns that reduce drop-off',
      sourceUrl: 'https://www.smashingmagazine.com/2024/form-design-patterns-drop-off/',
      selectedText: 'Inline validation should celebrate progress, not only punish mistakes.',
      daysAgo: 54,
      clues: [
        {
          text: 'smashing excerpt about inline validation celebrating progress',
          type: 'paraphrase'
        },
        { text: 'form design clip for checkout redesign', type: 'verbatim' }
      ]
    },
    {
      key: 'ex-motion',
      pageTitle: 'Case study: Motion systems that stay quiet',
      sourceUrl: 'https://www.awwwards.com/case-study-motion-systems-quiet/',
      selectedText: 'Motion that explains hierarchy beats motion that performs personality.',
      daysAgo: 17,
      clues: [
        { text: 'awwwards clip about motion that explains hierarchy', type: 'verbatim' },
        { text: 'quiet motion systems quote I highlighted', type: 'verbatim' }
      ]
    },
    {
      key: 'ex-pure-note-palette',
      pageTitle: 'Draft',
      sourceUrl: 'https://www.figma.com/file/yivenoProbeDraft01',
      selectedText: 'Placeholder frame copy for spacing experiments.',
      daysAgo: 10,
      note: 'steal midnight teal from brand sheet',
      clues: [
        { text: 'figma draft where I noted steal midnight teal', type: 'note' },
        { text: 'clip annotated about midnight teal from brand sheet', type: 'note' }
      ]
    }
  ]
}
