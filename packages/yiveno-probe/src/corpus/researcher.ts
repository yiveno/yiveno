/**
 * DEV 召回探针语料 · 跨来源研究者画像（首发分群优先）。
 * 每条带 clues（英语母语口语 + ProbeClueType），供 MCP 探针；禁止当作 runtime 灰名单。
 */

import type { RecallProbePersonaCorpus } from './types'

/** 研究者画像：文章 / 论文页 / 长文站点 + 摘录附注。 */
export const RESEARCHER_PROBE_CORPUS: RecallProbePersonaCorpus = {
  persona: 'researcher',
  label: 'Cross-source researcher',
  bookmarks: [
    {
      key: 'atlantic-attention',
      title: 'The Attention Economy Is a Lie',
      // 禁止假 slug + 真 CMS 数字 id（会 302 到无关真文，如 /677000/ → My Father, the Giant）
      url: 'https://www.theatlantic.com/yiveno-probe/attention-economy-myth/',
      daysAgo: 45,
      note: 'use for intro on focus vs metrics',
      clues: [
        { text: 'that atlantic piece about attention I bookmarked for an intro', type: 'note' },
        { text: 'the article about attention economy from a while ago', type: 'temporal' }
      ]
    },
    {
      key: 'newyorker-memory',
      title: 'How Memory Works',
      url: 'https://www.newyorker.com/magazine/2023/05/15/how-memory-works',
      daysAgo: 120,
      clues: [
        { text: 'the new yorker essay on how memory works', type: 'verbatim' },
        { text: 'magazine piece about memory I saved months ago', type: 'temporal' }
      ]
    },
    {
      key: 'nature-climate',
      title: 'Climate tipping points are closer than we thought',
      url: 'https://www.nature.com/articles/d41586-023-00000-0',
      daysAgo: 20,
      note: 'cite in climate brief',
      clues: [
        { text: 'nature article on climate tipping points I noted for a brief', type: 'note' },
        { text: 'that climate tipping points piece I saved a few weeks ago', type: 'note' }
      ]
    },
    {
      key: 'stratechery-aggregation',
      title: 'Aggregation Theory',
      url: 'https://stratechery.com/2015/aggregation-theory/',
      daysAgo: 200,
      clues: [
        { text: 'stratechery aggregation theory bookmark', type: 'verbatim' },
        { text: 'that old aggregation theory essay', type: 'verbatim' }
      ]
    },
    {
      key: 'aeon-boredom',
      title: 'The joy of being bored',
      url: 'https://aeon.co/essays/the-joy-of-being-bored',
      daysAgo: 8,
      clues: [
        { text: 'aeon essay about boredom from last week', type: 'temporal' },
        { text: 'something I saved about the joy of being bored', type: 'verbatim' }
      ]
    },
    {
      key: 'wired-privacy',
      title: 'Your Phone Is Listening. Sort Of.',
      url: 'https://www.wired.com/story/phone-listening-ads-privacy/',
      daysAgo: 3,
      clues: [
        { text: 'wired story about phones listening that I just saved', type: 'paraphrase' },
        { text: 'the privacy article from a few days ago', type: 'temporal' }
      ]
    },
    {
      key: 'ft-remote-work',
      title: 'The surprising science of remote work',
      url: 'https://www.ft.com/content/remote-work-science-2024',
      daysAgo: 60,
      note: 'compare with my notes on hybrid teams',
      clues: [
        { text: 'ft article on remote work science', type: 'verbatim' },
        { text: 'financial times piece about remote work I annotated', type: 'note' }
      ]
    },
    {
      key: 'guardian-misinfo',
      title: 'How misinformation spreads online',
      url: 'https://www.theguardian.com/technology/2024/misinformation-spreads',
      daysAgo: 15,
      clues: [
        { text: 'guardian article about misinformation', type: 'verbatim' },
        { text: 'how misinformation spreads — that bookmark', type: 'verbatim' }
      ]
    },
    {
      key: 'ssrn-preprint',
      title: 'Working Paper: Measuring Trust in News',
      url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1234567',
      daysAgo: 30,
      clues: [
        { text: 'ssrn working paper on trust in news', type: 'verbatim' },
        { text: 'that preprint about measuring trust', type: 'verbatim' }
      ]
    },
    {
      key: 'jstor-library',
      title: 'Public Libraries and Civic Life',
      url: 'https://www.jstor.org/stable/10.1086/000000',
      daysAgo: 90,
      clues: [
        { text: 'jstor article on public libraries', type: 'verbatim' },
        { text: 'academic paper about libraries and civic life', type: 'verbatim' }
      ]
    },
    {
      key: 'substack-newsletter',
      title: 'Why note-taking apps fail researchers',
      url: 'https://example.substack.com/p/why-note-taking-apps-fail',
      daysAgo: 5,
      note: 'disagree with section 3',
      clues: [
        { text: 'substack about note-taking apps failing researchers', type: 'verbatim' },
        { text: 'newsletter where I disagreed with section 3', type: 'note' }
      ]
    },
    {
      key: 'arxiv-retrieval',
      title: 'Dense Passage Retrieval for Open-Domain QA',
      url: 'https://arxiv.org/abs/2004.04906',
      daysAgo: 400,
      clues: [
        { text: 'arxiv dense passage retrieval paper', type: 'verbatim' },
        { text: 'that old DPR paper on arxiv', type: 'ambiguous' }
      ]
    },
    {
      key: 'weak-title-grant',
      title: 'Untitled document',
      url: 'https://docs.google.com/document/d/yivenoProbeGrantNotes01',
      daysAgo: 11,
      note: 'NSF grant narrative outline — revise budget table',
      clues: [
        { text: 'the untitled doc where I noted NSF grant narrative', type: 'note' },
        { text: 'page with my note about revising the budget table', type: 'note' }
      ]
    },
    {
      key: 'weak-title-interview',
      title: 'Notes',
      url: 'https://notion.so/yiveno-probe-interview-notes',
      daysAgo: 16,
      note: 'interview: ask about cross-source save friction',
      clues: [
        {
          text: 'notes page where I wrote interview ask about cross-source save friction',
          type: 'note'
        },
        { text: 'the note about interview questions on save friction', type: 'note' }
      ]
    }
  ],
  excerpts: [
    {
      key: 'excerpt-attention-quote',
      pageTitle: 'The Attention Economy Is a Lie',
      sourceUrl: 'https://www.theatlantic.com/yiveno-probe/attention-economy-myth/',
      selectedText:
        'What we call the attention economy is often just a metrics economy wearing a psychological costume.',
      daysAgo: 44,
      note: 'perfect pull quote for talk',
      clues: [
        { text: 'the quote I saved about metrics economy wearing a costume', type: 'note' },
        { text: 'excerpt where I wrote perfect pull quote for talk', type: 'note' }
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
      clues: [
        { text: 'excerpt about memory palace and navigation', type: 'verbatim' },
        { text: 'the line I highlighted about method of loci', type: 'note' }
      ]
    },
    {
      key: 'excerpt-tipping',
      pageTitle: 'Climate tipping points are closer than we thought',
      sourceUrl: 'https://www.nature.com/articles/d41586-023-00000-0',
      selectedText:
        'Once ice-sheet collapse begins, local feedbacks can outrun policy cycles by decades.',
      daysAgo: 19,
      clues: [
        { text: 'nature excerpt about ice-sheet collapse outrunning policy', type: 'paraphrase' },
        { text: 'the climate paragraph I clipped about feedbacks', type: 'paraphrase' }
      ]
    },
    {
      key: 'excerpt-boredom',
      pageTitle: 'The joy of being bored',
      sourceUrl: 'https://aeon.co/essays/the-joy-of-being-bored',
      selectedText: 'Boredom is not empty time; it is unstructured time that still belongs to you.',
      daysAgo: 7,
      note: 'use in newsletter opener',
      clues: [
        { text: 'aeon excerpt saying boredom is unstructured time', type: 'paraphrase' },
        { text: 'clip I noted for newsletter opener about boredom', type: 'note' }
      ]
    },
    {
      key: 'excerpt-misinfo',
      pageTitle: 'How misinformation spreads online',
      sourceUrl: 'https://www.theguardian.com/technology/2024/misinformation-spreads',
      selectedText:
        'Shares travel farther than corrections because outrage is a better forwarding heuristic than accuracy.',
      daysAgo: 14,
      clues: [
        { text: 'guardian clip about outrage forwarding heuristic', type: 'paraphrase' },
        { text: 'excerpt on why shares beat corrections', type: 'paraphrase' }
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
      clues: [
        { text: 'ft excerpt about weak-tie conversations collapsing', type: 'paraphrase' },
        { text: 'remote work clip I marked for hybrid teams slide', type: 'note' }
      ]
    },
    {
      key: 'excerpt-dpr',
      pageTitle: 'Dense Passage Retrieval for Open-Domain QA',
      sourceUrl: 'https://arxiv.org/abs/2004.04906',
      selectedText:
        'Retrieving then reading remains competitive when the reader is strong and the corpus is noisy.',
      daysAgo: 390,
      clues: [
        { text: 'arxiv excerpt about retrieving then reading', type: 'paraphrase' },
        { text: 'DPR paper quote on noisy corpus', type: 'paraphrase' }
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
      clues: [
        { text: 'jstor excerpt about library desk and hard questions', type: 'paraphrase' },
        { text: 'clip about civic infrastructure and libraries', type: 'note' }
      ]
    },
    {
      key: 'excerpt-pure-note',
      pageTitle: 'Home',
      sourceUrl: 'https://example.org/yiveno-probe-home-clip',
      selectedText: 'Generic paragraph without distinctive topic words here.',
      daysAgo: 22,
      note: 'parked for lit review on verification rituals',
      clues: [
        { text: 'excerpt I annotated for lit review on verification rituals', type: 'note' },
        { text: 'the clip where my note mentions verification rituals', type: 'note' }
      ]
    }
  ]
}
