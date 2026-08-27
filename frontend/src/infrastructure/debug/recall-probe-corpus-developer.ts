/**
 * DEV 召回探针语料 · 开发者 / PM 画像（分群第三优先）。
 */

import type { RecallProbePersonaCorpus } from '@/infrastructure/debug/recall-probe-corpus-types'

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
      suggestedClues: [
        'mdn page about using promises',
        'javascript promises guide I bookmarked for onboarding'
      ]
    },
    {
      key: 'rfc-9110',
      title: 'RFC 9110 - HTTP Semantics',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
      daysAgo: 70,
      suggestedClues: ['rfc 9110 http semantics', 'that http semantics rfc bookmark']
    },
    {
      key: 'github-actions-cache',
      title: 'Caching dependencies to speed up workflows',
      url: 'https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows',
      daysAgo: 4,
      note: 'cut CI minutes',
      suggestedClues: [
        'github docs on caching dependencies',
        'actions caching page I saved to cut CI minutes'
      ]
    },
    {
      key: 'postgres-explain',
      title: 'Using EXPLAIN - PostgreSQL',
      url: 'https://www.postgresql.org/docs/current/using-explain.html',
      daysAgo: 33,
      suggestedClues: ['postgres docs on using explain', 'postgresql explain page from last month']
    },
    {
      key: 'linear-roadmap',
      title: 'How we run roadmap reviews',
      url: 'https://linear.app/blog/how-we-run-roadmap-reviews',
      daysAgo: 21,
      suggestedClues: [
        'linear blog about roadmap reviews',
        'article on how they run roadmap reviews'
      ]
    },
    {
      key: 'stripe-idempotency',
      title: 'Idempotent requests',
      url: 'https://stripe.com/docs/api/idempotent_requests',
      daysAgo: 50,
      note: 'payments incident postmortem',
      suggestedClues: [
        'stripe docs on idempotent requests',
        'idempotency docs I noted after the payments incident'
      ]
    },
    {
      key: 'chrome-mv3',
      title: 'Migrate to Manifest V3',
      url: 'https://developer.chrome.com/docs/extensions/migrating/',
      daysAgo: 100,
      suggestedClues: ['chrome docs on migrating to manifest v3', 'mv3 migration guide bookmark']
    },
    {
      key: 'hn-thread',
      title: 'Ask HN: How do you keep a reading list useful?',
      url: 'https://news.ycombinator.com/item?id=yivenoProbeReadingList',
      daysAgo: 7,
      suggestedClues: [
        'ask hn about keeping a reading list useful',
        'hacker news thread on reading lists from last week'
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
      suggestedClues: [
        'mdn excerpt comparing promise.all and allSettled',
        'promises clip I marked for the junior FAQ'
      ]
    },
    {
      key: 'ex-idempotency',
      pageTitle: 'Idempotent requests',
      sourceUrl: 'https://stripe.com/docs/api/idempotent_requests',
      selectedText:
        'Clients should retry with the same idempotency key when a network timeout leaves the outcome unknown.',
      daysAgo: 49,
      suggestedClues: [
        'stripe excerpt about retrying with the same idempotency key',
        'payments postmortem clip on idempotency'
      ]
    },
    {
      key: 'ex-explain',
      pageTitle: 'Using EXPLAIN - PostgreSQL',
      sourceUrl: 'https://www.postgresql.org/docs/current/using-explain.html',
      selectedText:
        'Seq Scan is not always a bug; it can win when selectivity is high and the table is small.',
      daysAgo: 32,
      suggestedClues: [
        'postgres excerpt saying seq scan is not always a bug',
        'explain docs clip about small tables'
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
      suggestedClues: [
        'github actions excerpt about cache scoped per branch',
        'CI caching clip about pull requests reading base branch cache'
      ]
    }
  ]
}
