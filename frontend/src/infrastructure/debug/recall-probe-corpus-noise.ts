/**
 * 质量轮噪声语料：提高邻域真实感，不含 suggestedClues（不作探针金标）。
 * 仅 DEV seeder 使用；禁止复制进召回 runtime。
 */

import type {
  RecallProbeBookmarkSeed,
  RecallProbeExcerptSeed
} from '@/infrastructure/debug/recall-probe-corpus-types'

const NOISE_HOSTS = [
  'https://www.nytimes.com/probe',
  'https://www.bbc.com/probe',
  'https://medium.com/probe',
  'https://www.reddit.com/r/probe',
  'https://news.ycombinator.com/probe',
  'https://www.wikipedia.org/wiki/Probe',
  'https://www.blogger.com/probe',
  'https://www.smithsonianmag.com/probe'
] as const

const NOISE_TOPICS = [
  'gardening tips',
  'urban cycling',
  'sourdough starter',
  'board game night',
  'birdwatching checklist',
  'thrift store finds',
  'podcast recommendations',
  'weekend hiking trails',
  'coffee gear reviews',
  'language learning habits',
  'photography lighting',
  'museum day itinerary',
  'home office chairs',
  'science fiction awards',
  'local farmers markets',
  'aquarium maintenance',
  'vinyl collecting tips',
  'campfire cooking',
  'skatepark etiquette',
  'indoor plant pests',
  'chess opening traps',
  'knitting gauge notes',
  'trail running shoes',
  'sourdough discard recipes'
] as const

/** 生成可复现噪声书签（固定 key 前缀，便于 wipe 后重种）。 */
export function buildNoiseBookmarkSeeds(count: number): RecallProbeBookmarkSeed[] {
  const out: RecallProbeBookmarkSeed[] = []
  for (let i = 0; i < count; i += 1) {
    const topic = NOISE_TOPICS[i % NOISE_TOPICS.length] ?? 'misc notes'
    const host = NOISE_HOSTS[i % NOISE_HOSTS.length] ?? 'https://example.com/probe'
    const daysAgo = 1 + (i % 360)
    out.push({
      key: `noise-bm-${i}`,
      title: `${topic} (#${i + 1})`,
      url: `${host}/${i}`,
      daysAgo,
      ...(i % 5 === 0 ? { note: `noise note ${i}` } : {}),
      suggestedClues: []
    })
  }
  return out
}

/** 生成噪声摘录。 */
export function buildNoiseExcerptSeeds(count: number): RecallProbeExcerptSeed[] {
  const out: RecallProbeExcerptSeed[] = []
  for (let i = 0; i < count; i += 1) {
    const topic = NOISE_TOPICS[(i + 3) % NOISE_TOPICS.length] ?? 'misc notes'
    const host = NOISE_HOSTS[(i + 2) % NOISE_HOSTS.length] ?? 'https://example.com/probe'
    out.push({
      key: `noise-ex-${i}`,
      pageTitle: `Notes on ${topic}`,
      sourceUrl: `${host}/excerpt/${i}`,
      selectedText: `This is filler excerpt ${i} about ${topic} for neighborhood load.`,
      daysAgo: 2 + (i % 200),
      ...(i % 4 === 0 ? { note: `filler annotation ${i}` } : {}),
      suggestedClues: []
    })
  }
  return out
}
