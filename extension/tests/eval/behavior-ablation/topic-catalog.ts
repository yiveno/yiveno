/**
 * 12 个主题簇定义（词面重叠近邻干扰）。
 * 仅 eval 合成语料；不进生产召回词典。
 */

export interface TopicClusterDef {
  id: string
  /** 簇共享词（近邻重叠） */
  shared: readonly string[]
  /** 每条物品的区分词（长度 = itemsPerCluster） */
  distinctive: readonly (readonly string[])[]
  /** 域名池 */
  domains: readonly string[]
  /** 标题模板；`{shared}` `{distinct}` 占位 */
  titleTemplates: readonly string[]
  /** 附注模板 */
  noteTemplates: readonly string[]
  /** 摘录正文模板 */
  excerptTemplates: readonly string[]
}

/**
 * 12 簇 × 10 区分组。区分词彼此不同，但共享词保证簇内关键词分接近。
 */
export const TOPIC_CLUSTERS: readonly TopicClusterDef[] = [
  {
    id: 'espresso',
    shared: ['espresso', 'machine', 'coffee', 'brew', 'boiler'],
    distinctive: [
      ['pressure', 'profiling'],
      ['dual', 'boiler'],
      ['pid', 'controller'],
      ['portafilter', 'basket'],
      ['steam', 'wand'],
      ['preinfusion', 'ramp'],
      ['flat', 'burr'],
      ['volumetric', 'dosing'],
      ['grouphead', 'gasket'],
      ['flow', 'control']
    ],
    domains: ['coffee.example.com', 'homebarista.example.com', 'notes.example.com'],
    titleTemplates: [
      '{shared} notes on {distinct}',
      '{distinct} guide for home {shared}',
      'Saved {shared} article: {distinct}'
    ],
    noteTemplates: ['Want to try {distinct} on my {shared}', 'Compare {distinct} vs stock'],
    excerptTemplates: [
      'Deep dive into {distinct} for daily {shared} workflows at home.',
      'Bench notes: {distinct} changed extraction more than another {shared} tweak.'
    ]
  },
  {
    id: 'privacy',
    shared: ['privacy', 'tracker', 'cookie', 'consent', 'browser'],
    distinctive: [
      ['fingerprint', 'canvas'],
      ['gdpr', 'timeline'],
      ['cookie', 'banner'],
      ['thirdparty', 'pixels'],
      ['storage', 'partition'],
      ['referrer', 'policy'],
      ['dnt', 'signal'],
      ['att', 'prompt'],
      ['cmp', 'vendors'],
      ['sandbox', 'iframe']
    ],
    domains: ['privacy.example.com', 'security.example.com', 'news.example.com'],
    titleTemplates: [
      '{shared} briefing: {distinct}',
      'How {distinct} affects {shared}',
      '{distinct} checklist for {shared}'
    ],
    noteTemplates: ['Re-read {distinct} before shipping', 'Team FAQ on {distinct}'],
    excerptTemplates: [
      'Engineers argued about {distinct} while auditing {shared} flows.',
      'Practical {shared} tip centered on {distinct} without legal jargon.'
    ]
  },
  {
    id: 'hiking',
    shared: ['hiking', 'trail', 'boots', 'pack', 'gear'],
    distinctive: [
      ['vibram', 'sole'],
      ['goretex', 'membrane'],
      ['ultralight', 'quilt'],
      ['trekking', 'poles'],
      ['hydration', 'bladder'],
      ['ridge', 'map'],
      ['alpine', 'start'],
      ['switchback', 'grade'],
      ['gaiters', 'mud'],
      ['bear', 'canister']
    ],
    domains: ['outdoors.example.com', 'trail.example.com', 'gear.example.com'],
    titleTemplates: [
      '{shared} pick: {distinct}',
      'Field notes on {distinct} for {shared}',
      '{distinct} packing list'
    ],
    noteTemplates: ['Try {distinct} next trip', 'Replace worn {distinct}'],
    excerptTemplates: [
      'Weekend {shared} report focused on {distinct} after twenty miles.',
      'Why {distinct} mattered more than another {shared} upgrade.'
    ]
  },
  {
    id: 'typescript',
    shared: ['typescript', 'types', 'generic', 'compiler', 'module'],
    distinctive: [
      ['satisfies', 'operator'],
      ['infer', 'keyword'],
      ['branded', 'types'],
      ['const', 'assertions'],
      ['template', 'literals'],
      ['discriminated', 'unions'],
      ['mapped', 'types'],
      ['declaration', 'merging'],
      ['project', 'references'],
      ['erasable', 'syntax']
    ],
    domains: ['dev.example.com', 'ts.example.com', 'handbook.example.com'],
    titleTemplates: [
      '{shared} pattern: {distinct}',
      'Notes on {distinct} in modern {shared}',
      '{distinct} pitfalls'
    ],
    noteTemplates: ['Use {distinct} in API layer', 'Teach {distinct} Friday'],
    excerptTemplates: [
      'Short {shared} walkthrough of {distinct} with failing cases.',
      'Migration note: adopt {distinct} before touching other {shared} flags.'
    ]
  },
  {
    id: 'japanese_food',
    shared: ['japanese', 'recipe', 'kitchen', 'dashi', 'rice'],
    distinctive: [
      ['tonkatsu', 'sauce'],
      ['miso', 'glaze'],
      ['onigiri', 'fillings'],
      ['tamagoyaki', 'roll'],
      ['yakitori', 'tare'],
      ['okonomiyaki', 'batter'],
      ['gyudon', 'broth'],
      ['ramen', 'tare'],
      ['pickled', 'ginger'],
      ['matcha', 'latte']
    ],
    domains: ['food.example.com', 'kitchen.example.com', 'recipes.example.com'],
    titleTemplates: [
      '{shared}: {distinct}',
      'Weeknight {distinct} from {shared} notes',
      'Bookmark {distinct} method'
    ],
    noteTemplates: ['Buy ingredients for {distinct}', 'Kids liked {distinct}'],
    excerptTemplates: [
      'Home cook notes for {distinct} using pantry {shared} staples.',
      'Texture tips when making {distinct} without restaurant gear.'
    ]
  },
  {
    id: 'photography',
    shared: ['lens', 'camera', 'aperture', 'focus', 'photo'],
    distinctive: [
      ['bokeh', 'rendering'],
      ['macro', 'rail'],
      ['anamorphic', 'flare'],
      ['telephoto', 'compression'],
      ['wideangle', 'distortion'],
      ['prime', 'nifty'],
      ['stabilization', 'ibis'],
      ['autofocus', 'eye'],
      ['filter', 'nd'],
      ['vintage', 'coating']
    ],
    domains: ['photo.example.com', 'lensrentals.example.com', 'gear.example.com'],
    titleTemplates: [
      '{shared} review: {distinct}',
      '{distinct} field test',
      'Why {distinct} for street {shared}'
    ],
    noteTemplates: ['Rent {distinct} first', 'Compare {distinct} samples'],
    excerptTemplates: [
      'Side-by-side frames showing {distinct} against a stock {shared} setup.',
      'Buying guide excerpt focused on {distinct} tradeoffs.'
    ]
  },
  {
    id: 'finance',
    shared: ['finance', 'budget', 'invest', 'savings', 'portfolio'],
    distinctive: [
      ['index', 'funds'],
      ['emergency', 'fund'],
      ['taxloss', 'harvest'],
      ['roth', 'conversion'],
      ['expense', 'ratio'],
      ['rebalance', 'band'],
      ['bond', 'ladder'],
      ['hysa', 'rate'],
      ['dollar', 'cost'],
      ['fee', 'drag']
    ],
    domains: ['money.example.com', 'bogle.example.com', 'notes.example.com'],
    titleTemplates: [
      '{shared} memo: {distinct}',
      'Personal note on {distinct}',
      '{distinct} checklist'
    ],
    noteTemplates: ['Do {distinct} in April', 'Explain {distinct} to partner'],
    excerptTemplates: [
      'Plain-language {shared} explainer about {distinct}.',
      'Spreadsheet note capturing {distinct} assumptions.'
    ]
  },
  {
    id: 'sleep',
    shared: ['sleep', 'circadian', 'bedtime', 'rest', 'insomnia'],
    distinctive: [
      ['blue', 'light'],
      ['caffeine', 'cutoff'],
      ['temperature', 'cool'],
      ['nap', 'protocol'],
      ['melatonin', 'timing'],
      ['sleep', 'inertia'],
      ['rem', 'cycles'],
      ['white', 'noise'],
      ['breathing', '478'],
      ['weekend', 'catchup']
    ],
    domains: ['health.example.com', 'sleep.example.com', 'science.example.com'],
    titleTemplates: [
      '{shared} science: {distinct}',
      'Habit note — {distinct}',
      '{distinct} experiment log'
    ],
    noteTemplates: ['Try {distinct} two weeks', 'Stop if {distinct} worsens'],
    excerptTemplates: [
      'Lab-adjacent summary of {distinct} effects on {shared} quality.',
      'Personal log after changing {distinct} only.'
    ]
  },
  {
    id: 'berlin',
    shared: ['berlin', 'neighborhood', 'transit', 'cafe', 'walk'],
    distinctive: [
      ['kreuzberg', 'canal'],
      ['prenzlauer', 'berg'],
      ['tempelhofer', 'field'],
      ['museum', 'island'],
      ['spree', 'path'],
      ['neukolln', 'market'],
      ['charlottenburg', 'palace'],
      ['friedrichshain', 'boxes'],
      ['schoneberg', 'steps'],
      ['wedding', 'brewery']
    ],
    domains: ['travel.example.com', 'city.example.com', 'maps.example.com'],
    titleTemplates: ['{shared} day: {distinct}', 'Map pin — {distinct}', '{distinct} cafe crawl'],
    noteTemplates: ['Go back to {distinct}', 'Rain plan near {distinct}'],
    excerptTemplates: [
      'Walking notes around {distinct} with {shared} transit tips.',
      'Quiet corners near {distinct} worth a second {shared}.'
    ]
  },
  {
    id: 'guitar',
    shared: ['guitar', 'practice', 'chord', 'scale', 'riff'],
    distinctive: [
      ['pentatonic', 'box'],
      ['alternate', 'picking'],
      ['barre', 'shapes'],
      ['hybrid', 'picking'],
      ['metronome', 'subdiv'],
      ['bend', 'intonation'],
      ['fingerstyle', 'travis'],
      ['modes', 'dorian'],
      ['sweep', 'arpeggio'],
      ['comping', 'shell']
    ],
    domains: ['music.example.com', 'practice.example.com', 'tabs.example.com'],
    titleTemplates: ['{shared} drill: {distinct}', '{distinct} warmup', 'Lesson clip — {distinct}'],
    noteTemplates: ['10 min {distinct} daily', 'Film {distinct} take'],
    excerptTemplates: [
      'Slow practice plan for {distinct} inside a broader {shared} routine.',
      'Common mistakes when learning {distinct} too fast.'
    ]
  },
  {
    id: 'climate',
    shared: ['climate', 'emissions', 'carbon', 'warming', 'report'],
    distinctive: [
      ['methane', 'leaks'],
      ['heat', 'pump'],
      ['sea', 'level'],
      ['grid', 'storage'],
      ['soil', 'carbon'],
      ['aviation', 'contrails'],
      ['permafrost', 'thaw'],
      ['urban', 'heat'],
      ['offset', 'quality'],
      ['adaptation', 'fund']
    ],
    domains: ['climate.example.com', 'science.example.com', 'policy.example.com'],
    titleTemplates: [
      '{shared} brief: {distinct}',
      'Data note on {distinct}',
      '{distinct} explainer'
    ],
    noteTemplates: ['Cite {distinct} in talk', 'Follow {distinct} bill'],
    excerptTemplates: [
      'Policy-facing summary of {distinct} within the latest {shared}.',
      'Numbers behind {distinct} that change local planning.'
    ]
  },
  {
    id: 'kids_apps',
    shared: ['kids', 'learning', 'app', 'phonics', 'reading'],
    distinctive: [
      ['syllable', 'games'],
      ['number', 'bonds'],
      ['story', 'builder'],
      ['handwriting', 'trace'],
      ['vocab', 'flash'],
      ['music', 'rhythm'],
      ['coding', 'blocks'],
      ['emotion', 'cards'],
      ['bilingual', 'songs'],
      ['focus', 'timer']
    ],
    domains: ['parenting.example.com', 'edtech.example.com', 'apps.example.com'],
    titleTemplates: [
      '{shared} app: {distinct}',
      'Trial notes — {distinct}',
      '{distinct} for bedtime {shared}'
    ],
    noteTemplates: ['Limit {distinct} to 15m', 'Ask teacher about {distinct}'],
    excerptTemplates: [
      'Parent review of {distinct} as a {shared} supplement.',
      'What worked after a week of {distinct} sessions.'
    ]
  }
] as const
