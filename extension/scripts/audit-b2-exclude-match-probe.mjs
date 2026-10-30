/**
 * B2 回归审计探针：排除匹配语义 / 误杀 / 空池（只读 · 不改生产）。
 */
import { createServer } from 'vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const repoRoot = resolve(root, '..')

const server = await createServer({
  configFile: false,
  root,
  resolve: { alias: { '@': resolve(root, 'src') } },
  server: { middlewareMode: true },
  appType: 'custom'
})

try {
  const { createTextExcerptMemoryItem } = await server.ssrLoadModule(
    '/src/core/memory/create-memory-item.ts'
  )
  const {
    itemHitsExcludeContentTerms,
    normalizeExcludeContentTerms
  } = await server.ssrLoadModule('/src/core/recall/exclude-content-terms.ts')
  const { compactRecallText, normalizeRecallText } = await server.ssrLoadModule(
    '/src/core/recall/keyword-filter.ts'
  )
  const { parseRecallClue } = await server.ssrLoadModule('/src/core/recall/parse-recall-clue.ts')
  const { recallByKeywordWithParsedClue } = await server.ssrLoadModule(
    '/src/core/recall/orchestrate-keyword-recall.ts'
  )
  const { mapLlmProposalToParsedClue } = await server.ssrLoadModule(
    '/src/core/recall/understand/map-llm-proposal-to-parsed.ts'
  )

  const OWNER = '11111111-1111-4111-8111-111111111111'
  const PROFILE = '22222222-2222-4222-8222-222222222222'
  const make = (id, pageTitle, selectedText) =>
    createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-25T12:00:00.000Z',
      payload: {
        selectedText,
        sourceUrl: `https://example.com/${id}`,
        pageTitle
      }
    })

  const hiking = make(
    'h1',
    'Yellowstone day-hike packing checklist',
    'Bear spray packing checklist for day hike'
  )
  const lodging = make(
    'l1',
    'Yellowstone lodging booking confirmation',
    'Summer cabin reservation confirmation email'
  )
  const ashike = make('s1', 'Ashike lodging booking', 'Random lodging note')
  const hikers = make('hk', 'Yellowstone lodging for hikers', 'Cabin near trail for hikers')
  const packingOnly = make('p1', 'Kitchen packing tips', 'How to packing kitchen for move')
  const dayHikeSpaced = make('d1', 'Yellowstone day hike guide', 'A day hike without packing list')

  const llmExclude = normalizeExcludeContentTerms(['day', 'hike', 'packing', 'checklist'])
  const rulesExclude = normalizeExcludeContentTerms(['day-hike', 'packing', 'checklist'])

  const hitTable = (label, exclude) =>
    [hiking, lodging, ashike, hikers, packingOnly, dayHikeSpaced].map(item => ({
      title: item.payload.pageTitle,
      hits: itemHitsExcludeContentTerms(item, exclude)
    }))

  const clueA =
    'my Yellowstone lodging booking confirmation from that summer, not the day-hike packing checklist'
  const rulesParsed = parseRecallClue(clueA)
  const emptyPoolRules = recallByKeywordWithParsedClue([hiking], clueA, {
    parsed: rulesParsed
  })

  const llmMapped = mapLlmProposalToParsedClue(
    clueA,
    {
      contentTerms: ['yellowstone', 'lodging', 'booking', 'confirmation', 'summer'],
      excludeContentTerms: ['day', 'hike', 'packing', 'checklist'],
      confidence: 'medium'
    },
    Date.now()
  )
  const emptyPoolLlm = recallByKeywordWithParsedClue([hiking], clueA, {
    parsed: llmMapped
  })

  const bothOk = recallByKeywordWithParsedClue([lodging, hiking], clueA, {
    parsed: rulesParsed
  })
  const rankedBoth = [
    ...(bothOk.topPick ? [bothOk.topPick.item.id] : []),
    ...bothOk.alsoPossible.map(c => c.item.id)
  ]

  const out = {
    generatedAt: new Date().toISOString(),
    evidenceClass: 'static_probe_exclude_match_semantics',
    compactExamples: {
      dayHyphen: compactRecallText('day-hike'),
      daySpace: compactRecallText('day hike'),
      fieldIncludesHike: normalizeRecallText('Yellowstone day-hike packing').includes('hike'),
      compactIncludesHike: compactRecallText('Yellowstone day-hike packing').includes('hike')
    },
    normalizedExclude: { llmExclude, rulesExclude },
    hitsLlmExclude: hitTable('llm', llmExclude),
    hitsRulesExclude: hitTable('rules', rulesExclude),
    emptyPool: {
      rules: {
        outcome: emptyPoolRules.outcome,
        topPickId: emptyPoolRules.topPick?.item.id ?? null,
        alsoCount: emptyPoolRules.alsoPossible.length,
        excludeContentTerms: rulesParsed.excludeContentTerms ?? []
      },
      llmMapped: {
        outcome: emptyPoolLlm.outcome,
        topPickId: emptyPoolLlm.topPick?.item.id ?? null,
        alsoCount: emptyPoolLlm.alsoPossible.length,
        excludeContentTerms: llmMapped.excludeContentTerms ?? []
      }
    },
    mixedCorpusRankedIds: rankedBoth,
    lodgingSurvives: rankedBoth.includes(lodging.id),
    hikingExcluded: !rankedBoth.includes(hiking.id)
  }

  const outPath = resolve(
    repoRoot,
    'docs/audits/snapshots/2026-10-30-B2-exclude-match-probe.json'
  )
  mkdirSync(resolve(repoRoot, 'docs/audits/snapshots'), { recursive: true })
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
  console.log(JSON.stringify(out, null, 2))
  console.log('wrote', outPath)
} finally {
  await server.close()
}
