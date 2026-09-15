/**
 * Getting Started 示意 clue：一次 LLM → 恰好 4 条英文口语线索。
 * 输入仅书签元数据（title/url/可选 description）；禁止发明正文论点。
 */

import { z } from 'zod'

export const GsClueSamplesBookmarkSchema = z.object({
  /** 书签标题 */
  title: z.string().trim().min(1).max(500),
  /** 书签 URL */
  url: z.string().trim().max(2000).optional(),
  /** 可选描述 / summary（无网页正文） */
  description: z.string().trim().max(1000).optional()
})

export type GsClueSamplesBookmark = z.infer<typeof GsClueSamplesBookmarkSchema>

export const GsClueSamplesCompleteRequestSchema = z.object({
  bookmark: GsClueSamplesBookmarkSchema
})

export type GsClueSamplesCompleteRequest = z.infer<typeof GsClueSamplesCompleteRequestSchema>

const GsClueSampleItemSchema = z.object({
  text: z
    .string()
    .trim()
    .min(8)
    .max(280)
    .transform(value => value.replace(/\s+/g, ' ').trim())
})

export const GsClueSamplesResultSchema = z.object({
  clues: z.array(GsClueSampleItemSchema).length(4)
})

export type GsClueSamplesResult = z.infer<typeof GsClueSamplesResultSchema>

/** 系统提示：用户提供的 Recall Clue Generation Prompt + 工程硬约束。 */
export function buildGsClueSamplesSystemPrompt(): string {
  return `# Yiveno — Recall Clue Generation Prompt

You are generating personalized recall clues for Yiveno.

Yiveno helps users find things they have previously saved, even when they do not remember the exact title, URL, or keywords.

Your task is to read a saved bookmark and generate several natural-language clues that a real user might plausibly use when trying to remember and find that bookmark later.

## Core principle

A recall clue is NOT a search keyword.

It should resemble imperfect human memory.

The user may remember:

* what the content was about
* an idea or argument it contained
* something interesting they learned from it
* why it caught their attention
* the context in which they encountered it
* a distinctive impression or detail

Generate clues from different memory angles so that the user can choose the one that feels most familiar.

## Requirements

Generate 4 distinct clues.

Each clue should approach the same bookmark from a different memory perspective.

Prefer these perspectives when the content supports them:

1. Topic — What was this thing about?
2. Idea — What interesting idea, argument, explanation, or insight did it contain?
3. Context — What situation or context might the user remember it from?
4. Impression — What distinctive or memorable aspect might stick in someone's mind?

Do NOT expose these category names in the output.

## Important constraints

* Write clues as natural human recollections, not search queries.
* Do not simply rewrite the bookmark title.
* Do not copy the URL.
* Do not unnecessarily repeat exact keywords from the title.
* Do not quote long passages from the content.
* Do not invent facts that are not supported by the bookmark.
* Do not assume why the user personally saved the bookmark unless there is evidence.
* Do not make every clue start with "I remember".
* Vary sentence structure and phrasing naturally.
* Clues should be concise.
* Prefer approximately 12–30 words per clue.
* A clue should contain enough semantic information to meaningfully retrieve the bookmark.
* The clue should not reveal the exact title as if the user already knew it.
* Avoid generic clues such as "an interesting article I saved".
* Avoid keyword lists such as "AI, agents, memory, LLM".
* If the bookmark contains insufficient information to generate a reliable clue for a particular perspective, choose another valid perspective instead.
* Quality and factual grounding are more important than forcing diversity.

## Engineering hard rules (Normative)

* Product language: American English only. Never output Chinese clues.
* Input fields are only title, url, and optional description/summary. There is NO page body text.
* If only a title and URL are available, do not invent article arguments, examples, or conclusions.
* Return ONLY valid JSON. No markdown. No explanations. No category names. No text outside the JSON object.

## Tone

The clues should feel like something a person would naturally type into Yiveno when trying to remember something.

Good: "That article about why AI agents struggle to remember what happened earlier"
Good: "I remember reading something that explained why giving AI agents long-term memory is harder than it sounds"
Bad: "AI agents long-term memory"
Bad: "Why AI Agents Need Long-Term Memory"
Bad: "An article I saved about AI"

## Output

Return ONLY valid JSON.

Use exactly this structure:

{
"clues": [
{"text": "..."},
{"text": "..."},
{"text": "..."},
{"text": "..."}
]
}`
}

/** 用户提示：单条书签元数据。 */
export function buildGsClueSamplesUserPrompt(bookmark: GsClueSamplesBookmark): string {
  const lines: string[] = ['You will receive one saved bookmark.', 'Bookmark fields:']
  lines.push(`title: ${bookmark.title}`)
  if (bookmark.url?.trim()) {
    lines.push(`url: ${bookmark.url.trim()}`)
  }
  if (bookmark.description?.trim()) {
    lines.push(`description: ${bookmark.description.trim()}`)
  } else {
    lines.push('description: (none)')
  }
  lines.push(
    'No extracted page content is available. Do not invent facts beyond these fields.',
    'Return the JSON object with exactly 4 clues.'
  )
  return lines.join('\n')
}

/** 从模型原文解析 4 条 clue。 */
export function parseGsClueSamplesText(raw: string): GsClueSamplesResult | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced?.[1] ?? trimmed).trim()
  const tryParse = (text: string): unknown => {
    try {
      return JSON.parse(text) as unknown
    } catch {
      return null
    }
  }
  let candidate = tryParse(body)
  if (candidate === null) {
    const start = body.indexOf('{')
    const end = body.lastIndexOf('}')
    if (start >= 0 && end > start) {
      candidate = tryParse(body.slice(start, end + 1))
    }
  }
  if (candidate === null) {
    return null
  }
  const parsed = GsClueSamplesResultSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}
