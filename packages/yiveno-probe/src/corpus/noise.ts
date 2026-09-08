/**
 * 质量轮噪声语料：过程随机拼装（可复现 seed），不含 suggestedClues。
 * URL 保留 /probe/ 指纹供 DEV 清理分类；禁止复制进召回 runtime。
 */

import { DEFAULT_PROBE_FILLER_SEED, rngForFillerItem, type SeededRng } from './prng'
import type { RecallProbeBookmarkSeed, RecallProbeExcerptSeed } from './types'

export type ProbeNoiseBuildOptions = {
  /** 过程随机种子；缺省用 DEFAULT_PROBE_FILLER_SEED */
  seed?: number
}

const NOISE_HOSTS = [
  'https://www.nytimes.com/probe',
  'https://www.bbc.com/probe',
  'https://medium.com/probe',
  'https://www.reddit.com/r/probe',
  'https://news.ycombinator.com/probe',
  'https://www.wikipedia.org/wiki/Probe',
  'https://www.blogger.com/probe',
  'https://www.smithsonianmag.com/probe',
  'https://www.theguardian.com/probe',
  'https://www.wired.com/story/probe',
  'https://www.atlasobscura.com/probe',
  'https://www.npr.org/probe',
  'https://www.vox.com/probe',
  'https://www.forbes.com/sites/probe',
  'https://www.cnet.com/probe',
  'https://www.goodreads.com/probe'
] as const

const NOISE_HEADLINES = [
  'How I finally kept a sourdough starter alive',
  'Quiet weekend hiking trails near the reservoir',
  'A thrift-store find that actually fits my kitchen',
  'Birdwatching checklist for early spring mornings',
  'Coffee gear I stopped recommending to friends',
  'Board game night rules that keep new players',
  'Urban cycling routes that avoid the highway merge',
  'Podcast recommendations when you are tired of tech',
  'Museum day itinerary without the crowds',
  'Home office chairs that do not wreck your back',
  'Science fiction awards worth arguing about',
  'Local farmers markets with decent tomatoes',
  'Aquarium maintenance when you travel for work',
  'Vinyl collecting tips without the snobbery',
  'Campfire cooking that is not just hot dogs',
  'Skatepark etiquette for nervous beginners',
  'Indoor plant pests and what actually worked',
  'Chess opening traps I keep falling for',
  'Knitting gauge notes from a messy project',
  'Trail running shoes after 200 muddy miles',
  'Sourdough discard recipes that are not pancakes',
  'Language learning habits that survived January',
  'Photography lighting on a cloudy afternoon',
  'Gardening tips for a balcony that gets little sun',
  'Why I quit tracking every hobby in a spreadsheet',
  'A rainy-day list that is not streaming',
  'Secondhand bookstore etiquette in small towns',
  'Packing light for a two-night train trip'
] as const

const NOISE_SLUGS = [
  'notes',
  'scrap',
  'list',
  'draft',
  'saved',
  'later',
  'mix',
  'roundup',
  'field',
  'weekend'
] as const

const NOISE_EXCERPT_LEADS = [
  'I keep coming back to this line when the week gets noisy.',
  'Saved this for later — the middle section is the useful part.',
  'Not sure I agree, but the framing stuck with me.',
  'Practical enough that I actually tried it once.',
  'This is filler texture for neighborhood load, not a gold card.',
  'Skimmed on the train; the checklist is what I needed.'
] as const

function pathSlug(rng: SeededRng, index: number): string {
  return `${rng.pick(NOISE_SLUGS)}-${index}-${rng.nextInt(9000) + 1000}`
}

/** 生成可复现噪声书签（过程随机；固定 key 前缀便于 wipe 后重种）。 */
export function buildNoiseBookmarkSeeds(
  count: number,
  options?: ProbeNoiseBuildOptions
): RecallProbeBookmarkSeed[] {
  const seed = options?.seed ?? DEFAULT_PROBE_FILLER_SEED
  const out: RecallProbeBookmarkSeed[] = []
  for (let i = 0; i < count; i += 1) {
    const rng = rngForFillerItem(seed, 'noise-bm', i)
    const topic = rng.pick(NOISE_HEADLINES)
    const host = rng.pick(NOISE_HOSTS)
    const daysAgo = 1 + rng.nextInt(360)
    const withNote = rng.next() < 0.22
    out.push({
      key: `noise-bm-${i}`,
      title: topic,
      url: `${host}/${pathSlug(rng, i)}`,
      daysAgo,
      ...(withNote ? { note: `noise note ${i}` } : {}),
      suggestedClues: []
    })
  }
  return out
}

/** 生成噪声摘录（过程随机）。 */
export function buildNoiseExcerptSeeds(
  count: number,
  options?: ProbeNoiseBuildOptions
): RecallProbeExcerptSeed[] {
  const seed = options?.seed ?? DEFAULT_PROBE_FILLER_SEED
  const out: RecallProbeExcerptSeed[] = []
  for (let i = 0; i < count; i += 1) {
    const rng = rngForFillerItem(seed, 'noise-ex', i)
    const topic = rng.pick(NOISE_HEADLINES)
    const host = rng.pick(NOISE_HOSTS)
    const lead = rng.pick(NOISE_EXCERPT_LEADS)
    const withNote = rng.next() < 0.28
    out.push({
      key: `noise-ex-${i}`,
      pageTitle: topic,
      sourceUrl: `${host}/excerpt/${pathSlug(rng, i)}`,
      selectedText: `${lead} Filler excerpt ${i} about ${topic.toLowerCase()}.`,
      daysAgo: 2 + rng.nextInt(200),
      ...(withNote ? { note: `filler annotation ${i}` } : {}),
      suggestedClues: []
    })
  }
  return out
}
