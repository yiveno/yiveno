/**
 * user-sim persona 潜在状态数据（纯数据；不进产品 runtime）。
 * 每个 persona 有独立主题集、项目生命周期与行为参数；生成器只读本表。
 */

export type SimTopic = {
  id: string
  label: string
  domains: string[]
  aspects: string[]
  claims: string[]
}

export type SimProject = {
  id: string
  label: string
  topics: string[]
  windows: [number, number][]
  revivalDay: number | null
  scenes: string[]
}

export type SimPersonaActivity = {
  sessionsMul: number
  saveP: number
  revisitP: number
  bookmarkRatio: number
  weekendBoost: number
  forgetDays: number
}

export type SimPersona = {
  id: string
  label: string
  topicIds: string[]
  projects: SimProject[]
  activity: SimPersonaActivity
}

export const USER_SIM_TOPICS: SimTopic[] = [
  {
    id: 'agent-memory',
    label: 'agent memory systems',
    domains: ['papers.example', 'devblog.example', 'docs.example'],
    aspects: [
      'episodic recall',
      'memory consolidation',
      'context compression',
      'retrieval scoring',
      'forgetting curves'
    ],
    claims: [
      'Episodic memory works best when retrieval cues match encoding context',
      'Consolidation during idle time improves later recall precision',
      'Forgetting curves flatten after spaced retrieval practice'
    ]
  },
  {
    id: 'retrieval',
    label: 'information retrieval',
    domains: ['papers.example', 'docs.example', 'forum.example'],
    aspects: [
      'hybrid ranking',
      'embedding drift',
      'query rewriting',
      'reranking latency',
      'sparse vectors'
    ],
    claims: [
      'Hybrid ranking beats pure vector search on short queries',
      'Reranking latency dominates end-to-end response time at scale',
      'Query rewriting helps most when the original query is underspecified'
    ]
  },
  {
    id: 'browser-ext',
    label: 'browser extension engineering',
    domains: ['docs.example', 'devblog.example', 'forum.example'],
    aspects: [
      'service worker lifecycle',
      'side panel UX',
      'storage quotas',
      'message passing',
      'permission prompts'
    ],
    claims: [
      'Service workers terminate after thirty seconds of inactivity',
      'Permission prompts must originate from a user gesture',
      'Side panels keep context better than popups for long tasks'
    ]
  },
  {
    id: 'pricing',
    label: 'saas pricing',
    domains: ['devblog.example', 'news.example', 'forum.example'],
    aspects: [
      'usage-based tiers',
      'trial conversion',
      'annual discounts',
      'churn signals',
      'freemium limits'
    ],
    claims: [
      'Usage-based pricing aligns cost with perceived value for heavy users',
      'Annual discounts reduce churn more than monthly price cuts',
      'Free tiers convert best when limits bite during real work'
    ]
  },
  {
    id: 'cognition',
    label: 'human memory and cognition',
    domains: ['papers.example', 'news.example', 'devblog.example'],
    aspects: [
      'cue-dependent recall',
      'spacing effect',
      'interference theory',
      'prospective memory',
      'chunking'
    ],
    claims: [
      'Cue-dependent recall explains why context reinstatement restores lost details',
      'The spacing effect doubles retention compared with massed practice',
      'Interference from similar memories is the main cause of everyday forgetting'
    ]
  },
  {
    id: 'llm-eng',
    label: 'llm engineering',
    domains: ['docs.example', 'papers.example', 'devblog.example'],
    aspects: [
      'structured outputs',
      'tool calling reliability',
      'eval harnesses',
      'prompt caching',
      'streaming UX'
    ],
    claims: [
      'Structured outputs fail most often on deeply nested schemas',
      'Prompt caching cuts repeated-prefix cost by more than half',
      'Eval harnesses drift unless cases are versioned with the code'
    ]
  },
  {
    id: 'design',
    label: 'product design',
    domains: ['devblog.example', 'news.example', 'video.example'],
    aspects: ['empty states', 'onboarding flows', 'microcopy', 'visual hierarchy', 'dark patterns'],
    claims: [
      'Empty states teach faster than tooltips for first-time users',
      'Microcopy that names the next action reduces abandonment',
      'Visual hierarchy fails when every element shouts at once'
    ]
  },
  {
    id: 'health',
    label: 'health and habits',
    domains: ['news.example', 'video.example', 'devblog.example'],
    aspects: [
      'sleep regularity',
      'strength training',
      'desk ergonomics',
      'walking meetings',
      'screen breaks'
    ],
    claims: [
      'Sleep regularity predicts next-day focus better than sleep duration',
      'Short walking breaks restore attention within ten minutes',
      'Strength training twice a week preserves muscle during desk work'
    ]
  },
  {
    id: 'rust-wasm',
    label: 'rust and wasm',
    domains: ['docs.example', 'devblog.example', 'forum.example'],
    aspects: [
      'wasm bundle size',
      'ffi boundaries',
      'async runtimes',
      'compile times',
      'memory safety'
    ],
    claims: [
      'Wasm bundle size drops sharply with link-time optimization',
      'FFI boundaries are where most wasm bugs hide',
      'Compile times shape iteration speed more than runtime speed'
    ]
  },
  {
    id: 'marketing',
    label: 'indie marketing',
    domains: ['devblog.example', 'forum.example', 'news.example'],
    aspects: ['launch posts', 'seo long tail', 'community building', 'landing pages', 'waitlists'],
    claims: [
      'Launch posts convert when they show a concrete before-and-after',
      'Long-tail search compounds quietly for niche tools',
      'Waitlists measure curiosity, not willingness to pay'
    ]
  },
  {
    id: 'statistics',
    label: 'statistics and inference',
    domains: ['papers.example', 'docs.example', 'forum.example'],
    aspects: [
      'bayesian inference',
      'regression diagnostics',
      'power analysis',
      'causal graphs',
      'meta-analysis'
    ],
    claims: [
      'Power analysis done after data collection misleads more than it helps',
      'Causal graphs make hidden assumptions explicit and testable',
      'Meta-analysis inherits the biases of its weakest included study'
    ]
  },
  {
    id: 'literature',
    label: 'scholarly literature practice',
    domains: ['papers.example', 'docs.example', 'news.example'],
    aspects: [
      'citation management',
      'systematic reviews',
      'preprint norms',
      'peer review',
      'research ethics'
    ],
    claims: [
      'Systematic reviews fail quietly when search strings go unreported',
      'Preprints speed feedback but shift the burden of vetting to readers',
      'Citation managers break down at the boundary between projects'
    ]
  },
  {
    id: 'user-research',
    label: 'user research',
    domains: ['devblog.example', 'forum.example', 'docs.example'],
    aspects: [
      'interview scripts',
      'usability tests',
      'survey bias',
      'journey maps',
      'diary studies'
    ],
    claims: [
      'Interview scripts that ask about past behavior beat opinion questions',
      'Survey bias grows when the sponsor is visible to respondents',
      'Diary studies surface routines that interviews never reach'
    ]
  },
  {
    id: 'roadmapping',
    label: 'product roadmapping',
    domains: ['devblog.example', 'docs.example', 'forum.example'],
    aspects: [
      'prioritization frameworks',
      'okr design',
      'release planning',
      'stakeholder updates',
      'scope cuts'
    ],
    claims: [
      'Prioritization frameworks hide judgment calls behind arithmetic',
      'Scope cuts land better when the tradeoff is named early',
      'Roadmaps age fastest at the edges nobody owns'
    ]
  },
  {
    id: 'metrics',
    label: 'product metrics',
    domains: ['docs.example', 'devblog.example', 'papers.example'],
    aspects: [
      'funnel analysis',
      'retention cohorts',
      'north-star metrics',
      'experiment design',
      'dashboard design'
    ],
    claims: [
      'Retention cohorts reveal what aggregate funnels conceal',
      'North-star metrics distort when teams optimize the proxy',
      'Experiment design fails most often at the randomization unit'
    ]
  },
  {
    id: 'video-prod',
    label: 'video production',
    domains: ['video.example', 'devblog.example', 'forum.example'],
    aspects: ['scripting', 'lighting setups', 'editing rhythm', 'thumbnails', 'audio cleanup'],
    claims: [
      'Editing rhythm carries attention more than resolution does',
      'Thumbnails promise what the first thirty seconds must repay',
      'Audio cleanup matters more than camera upgrades for retention'
    ]
  },
  {
    id: 'branding',
    label: 'brand and visual identity',
    domains: ['devblog.example', 'video.example', 'news.example'],
    aspects: [
      'visual identity',
      'typography pairing',
      'color systems',
      'portfolio layout',
      'naming'
    ],
    claims: [
      'Typography pairing fails when both faces compete for the same voice',
      'Color systems break at the extremes nobody tested',
      'Naming works when it survives being shouted across a room'
    ]
  },
  {
    id: 'writing',
    label: 'writing and notes',
    domains: ['devblog.example', 'docs.example', 'news.example'],
    aspects: [
      'note-taking systems',
      'drafting habits',
      'editing passes',
      'reference managers',
      'plain language'
    ],
    claims: [
      'Note-taking systems collapse when capture outruns review',
      'Editing passes work best when each pass hunts one problem',
      'Plain language shortens documents without thinning them'
    ]
  },
  {
    id: 'meetings',
    label: 'meetings and collaboration',
    domains: ['devblog.example', 'docs.example', 'forum.example'],
    aspects: ['agenda design', 'decision logs', 'async updates', 'facilitation', 'follow-ups'],
    claims: [
      'Decision logs prevent the same argument from recurring monthly',
      'Async updates fail when nobody owns the summary',
      'Agendas that name the decision shorten meetings by half'
    ]
  },
  {
    id: 'personal-finance',
    label: 'personal finance',
    domains: ['news.example', 'devblog.example', 'docs.example'],
    aspects: [
      'index investing',
      'emergency funds',
      'tax basics',
      'budgeting systems',
      'insurance gaps'
    ],
    claims: [
      'Emergency funds buy time, which is the real asset in a crisis',
      'Index investing wins by removing decisions, not by insight',
      'Budgeting systems fail at irregular expenses, not daily ones'
    ]
  }
]
// topics never saved by this persona (negative-query material)
export const USER_SIM_NEGATIVE_TOPICS: { id: string; label: string }[] = [
  { id: 'crypto-trading', label: 'crypto trading strategies' },
  { id: 'home-brewing', label: 'home brewing recipes' },
  { id: 'car-repair', label: 'car repair manuals' },
  { id: 'orchid-care', label: 'orchid care' },
  { id: 'sailing-knots', label: 'sailing knots' },
  { id: 'pottery-glazing', label: 'pottery glazing' },
  { id: 'beekeeping', label: 'beekeeping basics' },
  { id: 'astronomy', label: 'astronomy telescopes' },
  { id: 'fencing', label: 'fencing footwork' },
  { id: 'mycology', label: 'mycology field guides' },
  { id: 'calligraphy', label: 'calligraphy strokes' },
  { id: 'origami', label: 'origami cranes' }
]
const BASE_PROJECTS: SimProject[] = [
  {
    id: 'memory-prototype',
    label: 'the memory prototype',
    topics: ['agent-memory', 'retrieval', 'cognition'],
    windows: [
      [0, 34],
      [58, 89]
    ],
    revivalDay: 58,
    scenes: [
      'when I was wiring up the first version of my side project',
      'back when I was sketching the storage layer for my prototype',
      'during that late-night session debugging my prototype'
    ]
  },
  {
    id: 'extension-launch',
    label: 'the extension launch',
    topics: ['browser-ext', 'design', 'marketing'],
    windows: [[20, 89]],
    revivalDay: null,
    scenes: [
      'while I was preparing the store listing for my extension',
      'when I was polishing the onboarding for the launch',
      'during the week I was fixing review feedback'
    ]
  },
  {
    id: 'pricing-experiments',
    label: 'the pricing experiments',
    topics: ['pricing', 'marketing'],
    windows: [[40, 66]],
    revivalDay: null,
    scenes: [
      'when I was reworking the pricing page',
      'while I was comparing plan structures for the launch'
    ]
  },
  {
    id: 'llm-evals',
    label: 'the eval harness work',
    topics: ['llm-eng', 'retrieval'],
    windows: [
      [10, 50],
      [74, 89]
    ],
    revivalDay: 74,
    scenes: [
      'when I was building the test harness',
      'during the week I was chasing flaky eval results'
    ]
  },
  {
    id: 'personal',
    label: 'personal reading',
    topics: ['health', 'cognition', 'rust-wasm'],
    windows: [[0, 89]],
    revivalDay: null,
    scenes: ['on a quiet weekend morning', 'during my evening reading time']
  }
]
// ---------- persona registry (5 personas; first entry preserves the MVP sample exactly) ----------
export const USER_SIM_PERSONAS: SimPersona[] = [
  {
    id: 'indie-dev-researcher',
    label: 'Independent developer-researcher',
    topicIds: [
      'agent-memory',
      'retrieval',
      'browser-ext',
      'pricing',
      'cognition',
      'llm-eng',
      'design',
      'health',
      'rust-wasm',
      'marketing'
    ],
    projects: BASE_PROJECTS,
    activity: {
      sessionsMul: 1,
      saveP: 0.75,
      revisitP: 0.8,
      bookmarkRatio: 0.55,
      weekendBoost: 0,
      forgetDays: 45
    }
  },
  {
    id: 'academic-researcher',
    label: 'Academic researcher',
    topicIds: ['statistics', 'literature', 'cognition', 'retrieval', 'llm-eng'],
    projects: [
      {
        id: 'systematic-review',
        label: 'the systematic review',
        topics: ['literature', 'statistics'],
        windows: [
          [0, 40],
          [62, 89]
        ],
        revivalDay: 62,
        scenes: [
          'when I was screening papers for the review',
          'during the week I was redoing the search strategy',
          'back when the inclusion criteria kept shifting'
        ]
      },
      {
        id: 'methods-course',
        label: 'the methods course',
        topics: ['statistics', 'cognition'],
        windows: [[15, 55]],
        revivalDay: null,
        scenes: [
          'while I was preparing the methods lectures',
          'when I was grading the midterm problem sets'
        ]
      },
      {
        id: 'grant-writing',
        label: 'the grant proposal',
        topics: ['literature', 'llm-eng', 'retrieval'],
        windows: [[45, 80]],
        revivalDay: null,
        scenes: [
          'during the grant writing sprint',
          'when I was tightening the related-work section'
        ]
      },
      {
        id: 'lab-reading',
        label: 'lab reading group',
        topics: ['cognition', 'llm-eng'],
        windows: [[0, 89]],
        revivalDay: null,
        scenes: ['before the Friday reading group', 'on the train back from the conference']
      }
    ],
    activity: {
      sessionsMul: 0.95,
      saveP: 0.7,
      revisitP: 0.9,
      bookmarkRatio: 0.35,
      weekendBoost: 0,
      forgetDays: 60
    }
  },
  {
    id: 'product-manager',
    label: 'Product manager',
    topicIds: ['user-research', 'roadmapping', 'metrics', 'pricing', 'design', 'marketing'],
    projects: [
      {
        id: 'discovery-sprint',
        label: 'the discovery sprint',
        topics: ['user-research', 'metrics'],
        windows: [
          [0, 40],
          [66, 89]
        ],
        revivalDay: 66,
        scenes: [
          'when I was running the interview round',
          'during the week we mapped the journey end to end',
          'back when the survey results surprised us'
        ]
      },
      {
        id: 'launch-planning',
        label: 'the launch plan',
        topics: ['roadmapping', 'pricing', 'marketing'],
        windows: [[30, 89]],
        revivalDay: null,
        scenes: [
          'while I was cutting scope for the launch',
          'when the pricing debate took over the roadmap review'
        ]
      },
      {
        id: 'metrics-review',
        label: 'the metrics review',
        topics: ['metrics', 'design'],
        windows: [[50, 89]],
        revivalDay: null,
        scenes: [
          'before the quarterly metrics review',
          'when I was rebuilding the dashboard for leadership'
        ]
      }
    ],
    activity: {
      sessionsMul: 1.15,
      saveP: 0.7,
      revisitP: 0.75,
      bookmarkRatio: 0.65,
      weekendBoost: 0,
      forgetDays: 35
    }
  },
  {
    id: 'creator',
    label: 'Independent creator',
    topicIds: ['video-prod', 'branding', 'design', 'marketing', 'writing'],
    projects: [
      {
        id: 'video-series',
        label: 'the video series',
        topics: ['video-prod', 'writing'],
        windows: [
          [0, 70],
          [78, 89]
        ],
        revivalDay: 78,
        scenes: [
          'when I was shooting the third episode',
          'during the edit marathon before the deadline',
          'back when the lighting setup kept failing'
        ]
      },
      {
        id: 'rebrand',
        label: 'the rebrand',
        topics: ['branding', 'design'],
        windows: [[25, 60]],
        revivalDay: null,
        scenes: [
          'while I was choosing the new type pairing',
          'when the color palette finally clicked'
        ]
      },
      {
        id: 'portfolio',
        label: 'the portfolio refresh',
        topics: ['branding', 'marketing', 'design'],
        windows: [[55, 89]],
        revivalDay: null,
        scenes: [
          'when I was rebuilding the portfolio page',
          'during the week I rewrote every case study'
        ]
      }
    ],
    activity: {
      sessionsMul: 0.9,
      saveP: 0.8,
      revisitP: 0.7,
      bookmarkRatio: 0.7,
      weekendBoost: 1,
      forgetDays: 40
    }
  },
  {
    id: 'knowledge-worker',
    label: 'Knowledge worker',
    topicIds: ['writing', 'meetings', 'personal-finance', 'health', 'cognition'],
    projects: [
      {
        id: 'report-cycle',
        label: 'the quarterly report',
        topics: ['writing', 'meetings'],
        windows: [[0, 89]],
        revivalDay: null,
        scenes: [
          'when I was drafting the quarterly report',
          'during the week of back-to-back reviews',
          'back when the summary kept getting rewritten'
        ]
      },
      {
        id: 'team-rituals',
        label: 'the team rituals reset',
        topics: ['meetings', 'cognition'],
        windows: [[10, 60]],
        revivalDay: null,
        scenes: [
          'while I was redesigning our weekly meeting',
          'when we tried async updates for a month'
        ]
      },
      {
        id: 'finance-reset',
        label: 'the finance reset',
        topics: ['personal-finance', 'health'],
        windows: [[40, 75]],
        revivalDay: null,
        scenes: [
          'when I was sorting out the household budget',
          'during the weekend I reviewed every subscription'
        ]
      }
    ],
    activity: {
      sessionsMul: 0.9,
      saveP: 0.65,
      revisitP: 0.65,
      bookmarkRatio: 0.6,
      weekendBoost: 0,
      forgetDays: 50
    }
  },
  {
    id: 'hoarder',
    label: 'Hoarder',
    topicIds: ['writing', 'meetings', 'personal-finance', 'health', 'cognition'],
    projects: [
      {
        id: 'someday-pile',
        label: 'the someday pile',
        topics: ['writing', 'cognition'],
        windows: [[0, 89]],
        revivalDay: null,
        scenes: ['when I was saving everything for later', 'during a late-night tab cleanup']
      },
      {
        id: 'life-admin',
        label: 'the life admin sweep',
        topics: ['personal-finance', 'health', 'meetings'],
        windows: [[20, 70]],
        revivalDay: 78,
        scenes: ['while I was sorting paperwork', 'when the renewal notices piled up']
      }
    ],
    activity: {
      sessionsMul: 1.15,
      saveP: 0.85,
      revisitP: 0.25,
      bookmarkRatio: 0.9,
      weekendBoost: 0,
      forgetDays: 25
    }
  },
  {
    id: 'fragmented-browser',
    label: 'Fragmented browser',
    topicIds: ['video-prod', 'branding', 'writing', 'design', 'marketing'],
    projects: [
      {
        id: 'trend-hopping',
        label: 'the trend hopping streak',
        topics: ['video-prod', 'branding'],
        windows: [[0, 45]],
        revivalDay: null,
        scenes: ['while I was bouncing between tabs', 'during a short-video rabbit hole']
      },
      {
        id: 'side-project-drift',
        label: 'the side project drift',
        topics: ['design', 'marketing', 'writing'],
        windows: [[35, 89]],
        revivalDay: null,
        scenes: ['when I kept switching projects', 'during a weekend of half-finished drafts']
      }
    ],
    activity: {
      sessionsMul: 1.3,
      saveP: 0.5,
      revisitP: 0.3,
      bookmarkRatio: 0.75,
      weekendBoost: 1,
      forgetDays: 20
    }
  },
  {
    id: 'misremembering-user',
    label: 'Misremembering user',
    topicIds: ['statistics', 'literature', 'cognition', 'retrieval', 'llm-eng'],
    projects: [
      {
        id: 'coursework',
        label: 'the coursework',
        topics: ['statistics', 'literature'],
        windows: [[0, 60]],
        revivalDay: 75,
        scenes: ['while I was revising for the course', 'when the readings all blurred together']
      },
      {
        id: 'reading-group',
        label: 'the reading group',
        topics: ['cognition', 'retrieval', 'llm-eng'],
        windows: [[30, 89]],
        revivalDay: null,
        scenes: ['during the reading group weeks', 'when I mixed up two similar papers']
      }
    ],
    activity: {
      sessionsMul: 0.9,
      saveP: 0.6,
      revisitP: 0.5,
      bookmarkRatio: 0.6,
      weekendBoost: 0,
      forgetDays: 30
    }
  },
  {
    id: 'deep-researcher',
    label: 'Deep researcher',
    topicIds: ['statistics', 'literature', 'cognition', 'retrieval', 'llm-eng'],
    projects: [
      {
        id: 'thesis-core',
        label: 'the thesis core',
        topics: ['statistics', 'literature'],
        windows: [[0, 89]],
        revivalDay: null,
        scenes: ['while I was deep in the thesis chapters', 'during the long literature pass']
      },
      {
        id: 'methods-appendix',
        label: 'the methods appendix',
        topics: ['retrieval', 'llm-eng', 'cognition'],
        windows: [[25, 80]],
        revivalDay: null,
        scenes: ['when I was cross-checking methods', 'during the appendix rewrite']
      }
    ],
    activity: {
      sessionsMul: 1,
      saveP: 0.7,
      revisitP: 0.85,
      bookmarkRatio: 0.35,
      weekendBoost: 0,
      forgetDays: 60
    }
  },
  {
    id: 'task-sprinter',
    label: 'Task sprinter',
    topicIds: ['user-research', 'roadmapping', 'metrics', 'design', 'marketing'],
    projects: [
      {
        id: 'launch-sprint',
        label: 'the launch sprint',
        topics: ['roadmapping', 'metrics'],
        windows: [[0, 18]],
        revivalDay: 80,
        scenes: ['during the launch sprint', 'when the deadline was days away']
      },
      {
        id: 'research-sprint',
        label: 'the research sprint',
        topics: ['user-research', 'design', 'marketing'],
        windows: [[45, 63]],
        revivalDay: null,
        scenes: ['while the sprint board was full', 'during the two-week push']
      }
    ],
    activity: {
      sessionsMul: 1.1,
      saveP: 0.8,
      revisitP: 0.45,
      bookmarkRatio: 0.6,
      weekendBoost: 0,
      forgetDays: 20
    }
  },
  {
    id: 'non-organizer',
    label: 'Non-organizer',
    topicIds: ['writing', 'meetings', 'health', 'personal-finance', 'cognition'],
    projects: [
      {
        id: 'everything-pile',
        label: 'the everything pile',
        topics: ['writing', 'meetings'],
        windows: [[0, 89]],
        revivalDay: null,
        scenes: ['when everything landed in one folder', 'during a week of unsorted tabs']
      },
      {
        id: 'admin-drift',
        label: 'the admin drift',
        topics: ['health', 'personal-finance', 'cognition'],
        windows: [[15, 75]],
        revivalDay: null,
        scenes: ['while I kept postponing the cleanup', 'when the receipts piled up']
      }
    ],
    activity: {
      sessionsMul: 1,
      saveP: 0.7,
      revisitP: 0.35,
      bookmarkRatio: 0.95,
      weekendBoost: 0,
      forgetDays: 15
    }
  },
  {
    id: 'scene-memory-user',
    label: 'Scene-memory user',
    topicIds: ['video-prod', 'branding', 'writing', 'design', 'cognition'],
    projects: [
      {
        id: 'studio-days',
        label: 'the studio days',
        topics: ['video-prod', 'branding'],
        windows: [[0, 50]],
        revivalDay: 72,
        scenes: ['back in the studio that week', 'when we shot on location']
      },
      {
        id: 'desk-reset',
        label: 'the desk reset',
        topics: ['design', 'writing', 'cognition'],
        windows: [[40, 89]],
        revivalDay: null,
        scenes: ['after I rearranged the desk', 'during the quiet mornings at home']
      }
    ],
    activity: {
      sessionsMul: 0.95,
      saveP: 0.6,
      revisitP: 0.55,
      bookmarkRatio: 0.65,
      weekendBoost: 1,
      forgetDays: 35
    }
  },
  {
    id: 'casual-light-user',
    label: 'Casual light user',
    topicIds: ['health', 'personal-finance', 'writing', 'meetings', 'design'],
    projects: [
      {
        id: 'weekend-reads',
        label: 'the weekend reads',
        topics: ['health', 'writing'],
        windows: [[0, 89]],
        revivalDay: null,
        scenes: ['on a slow weekend morning', 'while browsing with coffee']
      },
      {
        id: 'occasional-admin',
        label: 'the occasional admin',
        topics: ['personal-finance', 'meetings', 'design'],
        windows: [[30, 80]],
        revivalDay: null,
        scenes: ['when I finally opened the admin tabs', 'during a rare tidy-up']
      }
    ],
    activity: {
      sessionsMul: 0.85,
      saveP: 0.6,
      revisitP: 0.5,
      bookmarkRatio: 0.7,
      weekendBoost: 1,
      forgetDays: 30
    }
  }
]
