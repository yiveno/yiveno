/**
 * DEV 召回探针语料 · 跨来源研究者画像（首发分群优先）。
 * 每条带 suggestedClues（英语母语口语），供 MCP 探针；禁止当作 runtime 灰名单。
 */

import type { RecallProbePersonaCorpus } from '@/infrastructure/debug/recall-probe-corpus-types'

/** 研究者画像：文章 / 论文页 / 长文站点 + 摘录附注。 */
export const RESEARCHER_PROBE_CORPUS: RecallProbePersonaCorpus = {
  persona: 'researcher',
  label: 'Cross-source researcher',
  bookmarks: [
    {
      key: 'atlantic-attention',
      title: 'The Attention Economy Is a Lie',
      url: 'https://www.theatlantic.com/technology/archive/2024/01/attention-economy-myth/677000/',
      daysAgo: 45,
      note: 'use for intro on focus vs metrics',
      suggestedClues: [
        'that atlantic piece about attention I bookmarked for an intro',
        'the article about attention economy from a while ago'
      ]
    },
    {
      key: 'newyorker-memory',
      title: 'How Memory Works',
      url: 'https://www.newyorker.com/magazine/2023/05/15/how-memory-works',
      daysAgo: 120,
      suggestedClues: [
        'the new yorker essay on how memory works',
        'magazine piece about memory I saved months ago'
      ]
    },
    {
      key: 'nature-climate',
      title: 'Climate tipping points are closer than we thought',
      url: 'https://www.nature.com/articles/d41586-023-00000-0',
      daysAgo: 20,
      note: 'cite in climate brief',
      suggestedClues: [
        'nature article on climate tipping points I noted for a brief',
        'that climate tipping points piece I saved a few weeks ago'
      ]
    },
    {
      key: 'stratechery-aggregation',
      title: 'Aggregation Theory',
      url: 'https://stratechery.com/2015/aggregation-theory/',
      daysAgo: 200,
      suggestedClues: [
        'stratechery aggregation theory bookmark',
        'that old aggregation theory essay'
      ]
    },
    {
      key: 'aeon-boredom',
      title: 'The joy of being bored',
      url: 'https://aeon.co/essays/the-joy-of-being-bored',
      daysAgo: 8,
      suggestedClues: [
        'aeon essay about boredom from last week',
        'something I saved about the joy of being bored'
      ]
    },
    {
      key: 'wired-privacy',
      title: 'Your Phone Is Listening. Sort Of.',
      url: 'https://www.wired.com/story/phone-listening-ads-privacy/',
      daysAgo: 3,
      suggestedClues: [
        'wired story about phones listening that I just saved',
        'the privacy article from a few days ago'
      ]
    },
    {
      key: 'ft-remote-work',
      title: 'The surprising science of remote work',
      url: 'https://www.ft.com/content/remote-work-science-2024',
      daysAgo: 60,
      note: 'compare with my notes on hybrid teams',
      suggestedClues: [
        'ft article on remote work science',
        'financial times piece about remote work I annotated'
      ]
    },
    {
      key: 'guardian-misinfo',
      title: 'How misinformation spreads online',
      url: 'https://www.theguardian.com/technology/2024/misinformation-spreads',
      daysAgo: 15,
      suggestedClues: [
        'guardian article about misinformation',
        'how misinformation spreads — that bookmark'
      ]
    },
    {
      key: 'ssrn-preprint',
      title: 'Working Paper: Measuring Trust in News',
      url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1234567',
      daysAgo: 30,
      suggestedClues: ['ssrn working paper on trust in news', 'that preprint about measuring trust']
    },
    {
      key: 'jstor-library',
      title: 'Public Libraries and Civic Life',
      url: 'https://www.jstor.org/stable/10.1086/000000',
      daysAgo: 90,
      suggestedClues: [
        'jstor article on public libraries',
        'academic paper about libraries and civic life'
      ]
    },
    {
      key: 'substack-newsletter',
      title: 'Why note-taking apps fail researchers',
      url: 'https://example.substack.com/p/why-note-taking-apps-fail',
      daysAgo: 5,
      note: 'disagree with section 3',
      suggestedClues: [
        'substack about note-taking apps failing researchers',
        'newsletter where I disagreed with section 3'
      ]
    },
    {
      key: 'arxiv-retrieval',
      title: 'Dense Passage Retrieval for Open-Domain QA',
      url: 'https://arxiv.org/abs/2004.04906',
      daysAgo: 400,
      suggestedClues: ['arxiv dense passage retrieval paper', 'that old DPR paper on arxiv']
    },
    {
      key: 'weak-title-grant',
      title: 'Untitled document',
      url: 'https://docs.google.com/document/d/yivenoProbeGrantNotes01',
      daysAgo: 11,
      note: 'NSF grant narrative outline — revise budget table',
      suggestedClues: [
        'the untitled doc where I noted NSF grant narrative',
        'page with my note about revising the budget table'
      ]
    },
    {
      key: 'weak-title-interview',
      title: 'Notes',
      url: 'https://notion.so/yiveno-probe-interview-notes',
      daysAgo: 16,
      note: 'interview: ask about cross-source save friction',
      suggestedClues: [
        'notes page where I wrote interview ask about cross-source save friction',
        'the note about interview questions on save friction'
      ]
    }
  ],
  excerpts: [
    {
      key: 'excerpt-attention-quote',
      pageTitle: 'The Attention Economy Is a Lie',
      sourceUrl:
        'https://www.theatlantic.com/technology/archive/2024/01/attention-economy-myth/677000/',
      selectedText:
        'What we call the attention economy is often just a metrics economy wearing a psychological costume.',
      daysAgo: 44,
      note: 'perfect pull quote for talk',
      suggestedClues: [
        'the quote I saved about metrics economy wearing a costume',
        'excerpt where I wrote perfect pull quote for talk'
      ]
    },
    {
      key: 'excerpt-memory-palace',
      pageTitle: 'How Memory Works',
      sourceUrl: 'https://www.newyorker.com/magazine/2023/05/15/how-memory-works',
      selectedText:
        'A memory palace works because place and sequence hitch a ride on an older navigation system.',
      daysAgo: 118,
      note: 'link to method of loci',
      suggestedClues: [
        'excerpt about memory palace and navigation',
        'the line I highlighted about method of loci'
      ]
    },
    {
      key: 'excerpt-tipping',
      pageTitle: 'Climate tipping points are closer than we thought',
      sourceUrl: 'https://www.nature.com/articles/d41586-023-00000-0',
      selectedText:
        'Once ice-sheet collapse begins, local feedbacks can outrun policy cycles by decades.',
      daysAgo: 19,
      suggestedClues: [
        'nature excerpt about ice-sheet collapse outrunning policy',
        'the climate paragraph I clipped about feedbacks'
      ]
    },
    {
      key: 'excerpt-boredom',
      pageTitle: 'The joy of being bored',
      sourceUrl: 'https://aeon.co/essays/the-joy-of-being-bored',
      selectedText: 'Boredom is not empty time; it is unstructured time that still belongs to you.',
      daysAgo: 7,
      note: 'use in newsletter opener',
      suggestedClues: [
        'aeon excerpt saying boredom is unstructured time',
        'clip I noted for newsletter opener about boredom'
      ]
    },
    {
      key: 'excerpt-misinfo',
      pageTitle: 'How misinformation spreads online',
      sourceUrl: 'https://www.theguardian.com/technology/2024/misinformation-spreads',
      selectedText:
        'Shares travel farther than corrections because outrage is a better forwarding heuristic than accuracy.',
      daysAgo: 14,
      suggestedClues: [
        'guardian clip about outrage forwarding heuristic',
        'excerpt on why shares beat corrections'
      ]
    },
    {
      key: 'excerpt-remote',
      pageTitle: 'The surprising science of remote work',
      sourceUrl: 'https://www.ft.com/content/remote-work-science-2024',
      selectedText:
        'Weak-tie conversations collapse first when offices go fully remote, then innovation metrics follow.',
      daysAgo: 58,
      note: 'hybrid teams slide',
      suggestedClues: [
        'ft excerpt about weak-tie conversations collapsing',
        'remote work clip I marked for hybrid teams slide'
      ]
    },
    {
      key: 'excerpt-dpr',
      pageTitle: 'Dense Passage Retrieval for Open-Domain QA',
      sourceUrl: 'https://arxiv.org/abs/2004.04906',
      selectedText:
        'Retrieving then reading remains competitive when the reader is strong and the corpus is noisy.',
      daysAgo: 390,
      suggestedClues: [
        'arxiv excerpt about retrieving then reading',
        'DPR paper quote on noisy corpus'
      ]
    },
    {
      key: 'excerpt-libraries',
      pageTitle: 'Public Libraries and Civic Life',
      sourceUrl: 'https://www.jstor.org/stable/10.1086/000000',
      selectedText:
        'The library desk remains one of the last places where a stranger can ask a hard question for free.',
      daysAgo: 88,
      note: 'civic infrastructure angle',
      suggestedClues: [
        'jstor excerpt about library desk and hard questions',
        'clip about civic infrastructure and libraries'
      ]
    },
    {
      key: 'excerpt-pure-note',
      pageTitle: 'Home',
      sourceUrl: 'https://example.org/yiveno-probe-home-clip',
      selectedText: 'Generic paragraph without distinctive topic words here.',
      daysAgo: 22,
      note: 'parked for lit review on verification rituals',
      suggestedClues: [
        'excerpt I annotated for lit review on verification rituals',
        'the clip where my note mentions verification rituals'
      ]
    }
  ]
}
