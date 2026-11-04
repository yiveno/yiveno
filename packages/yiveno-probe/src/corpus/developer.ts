/**
 * DEV 召回探针语料 · 开发者 / PM 画像（分群第三优先）。
 */

import type { RecallProbePersonaCorpus } from './types'

export const DEVELOPER_PROBE_CORPUS: RecallProbePersonaCorpus = {
  persona: 'developer',
  label: 'Developer / PM',
  bookmarks: [
    {
      key: 'mdn-promises',
      title: 'Using promises - JavaScript | MDN',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises',
      daysAgo: 14,
      note: 'onboarding doc link',
      clues: [
        { text: 'mdn page about using promises', type: 'verbatim' },
        { text: 'javascript promises guide I bookmarked for onboarding', type: 'note' }
      ]
    },
    {
      key: 'rfc-9110',
      title: 'RFC 9110 - HTTP Semantics',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
      daysAgo: 70,
      clues: [
        { text: 'rfc 9110 http semantics', type: 'verbatim' },
        { text: 'that http semantics rfc bookmark', type: 'verbatim' }
      ]
    },
    {
      key: 'github-actions-cache',
      title: 'Caching dependencies to speed up workflows',
      url: 'https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows',
      daysAgo: 4,
      note: 'cut CI minutes',
      clues: [
        { text: 'github docs on caching dependencies', type: 'verbatim' },
        { text: 'actions caching page I saved to cut CI minutes', type: 'note' }
      ]
    },
    {
      key: 'postgres-explain',
      title: 'Using EXPLAIN - PostgreSQL',
      url: 'https://www.postgresql.org/docs/current/using-explain.html',
      daysAgo: 33,
      clues: [
        { text: 'postgres docs on using explain', type: 'verbatim' },
        { text: 'postgresql explain page from last month', type: 'temporal' }
      ]
    },
    {
      key: 'linear-roadmap',
      title: 'How we run roadmap reviews',
      url: 'https://linear.app/blog/how-we-run-roadmap-reviews',
      daysAgo: 21,
      clues: [
        { text: 'linear blog about roadmap reviews', type: 'verbatim' },
        { text: 'article on how they run roadmap reviews', type: 'verbatim' }
      ]
    },
    {
      key: 'stripe-idempotency',
      title: 'Idempotent requests',
      url: 'https://stripe.com/docs/api/idempotent_requests',
      daysAgo: 50,
      note: 'payments incident postmortem',
      clues: [
        { text: 'stripe docs on idempotent requests', type: 'verbatim' },
        { text: 'idempotency docs I noted after the payments incident', type: 'note' }
      ]
    },
    {
      key: 'chrome-mv3',
      title: 'Migrate to Manifest V3',
      url: 'https://developer.chrome.com/docs/extensions/migrating/',
      daysAgo: 100,
      clues: [
        { text: 'chrome docs on migrating to manifest v3', type: 'verbatim' },
        { text: 'mv3 migration guide bookmark', type: 'paraphrase' }
      ]
    },
    {
      key: 'hn-thread',
      title: 'Ask HN: How do you keep a reading list useful?',
      url: 'https://news.ycombinator.com/item?id=yivenoProbeReadingList',
      daysAgo: 7,
      clues: [
        { text: 'ask hn about keeping a reading list useful', type: 'verbatim' },
        { text: 'hacker news thread on reading lists from last week', type: 'temporal' }
      ]
    }
  ],
  excerpts: [
    {
      key: 'ex-promises',
      pageTitle: 'Using promises - JavaScript | MDN',
      sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises',
      selectedText:
        'Promise.all fails fast; Promise.allSettled waits for every settlement before you inspect.',
      daysAgo: 13,
      note: 'junior FAQ',
      clues: [
        { text: 'mdn excerpt comparing promise.all and allSettled', type: 'paraphrase' },
        { text: 'promises clip I marked for the junior FAQ', type: 'note' }
      ]
    },
    {
      key: 'ex-idempotency',
      pageTitle: 'Idempotent requests',
      sourceUrl: 'https://stripe.com/docs/api/idempotent_requests',
      selectedText:
        'Clients should retry with the same idempotency key when a network timeout leaves the outcome unknown.',
      daysAgo: 49,
      clues: [
        { text: 'stripe excerpt about retrying with the same idempotency key', type: 'paraphrase' },
        { text: 'payments postmortem clip on idempotency', type: 'associative' }
      ]
    },
    {
      key: 'ex-explain',
      pageTitle: 'Using EXPLAIN - PostgreSQL',
      sourceUrl: 'https://www.postgresql.org/docs/current/using-explain.html',
      selectedText:
        'Seq Scan is not always a bug; it can win when selectivity is high and the table is small.',
      daysAgo: 32,
      clues: [
        { text: 'postgres excerpt saying seq scan is not always a bug', type: 'paraphrase' },
        { text: 'explain docs clip about small tables', type: 'verbatim' }
      ]
    },
    {
      key: 'ex-cache',
      pageTitle: 'Caching dependencies to speed up workflows',
      sourceUrl:
        'https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows',
      selectedText:
        'Caches are scoped per branch by default; pull request jobs read from the base branch cache.',
      daysAgo: 3,
      clues: [
        { text: 'github actions excerpt about cache scoped per branch', type: 'paraphrase' },
        { text: 'CI caching clip about pull requests reading base branch cache', type: 'verbatim' }
      ]
    }
  ]
}
