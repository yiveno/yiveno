/**
 * AI 接口处理器
 */

import type { Env } from '../types/env'
import type { AICompleteRequest } from '../types/ai'
import { okJson, errorJson } from '../utils/response'
import { getCorsHeaders } from '../middleware/cors'

/** 默认的文本补全模型，兼顾体积与生成质量。 */
const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct'
/** 默认的采样温度，控制生成结果的随机度。 */
const DEFAULT_TEMPERATURE = 0.6
/** 默认最大返回 Token 数量，防止生成过长响应。 */
const DEFAULT_MAX_TOKENS = 256

/**
 * 从请求中提取 AI 参数
 */
function extractAIParams(body: AICompleteRequest, sp: URLSearchParams) {
  return {
    prompt: sp.get('prompt') || body.prompt || '',
    messages: body.messages || undefined,
    stream: body.stream === true || sp.get('stream') === 'true',
    model: body.model || sp.get('model') || DEFAULT_MODEL,
    temperature: body.temperature ?? DEFAULT_TEMPERATURE,
    max_tokens: body.max_tokens ?? DEFAULT_MAX_TOKENS
  }
}

/**
 * 处理 AI 文本补全请求
 *
 * @param request - 请求对象
 * @param env - 环境变量
 * @returns AI 补全响应
 */
export async function handleAIComplete(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('origin')

  try {
    const url = new URL(request.url)
    const rawBody = request.method === 'POST' ? await request.json().catch(() => ({})) : {}
    const body = rawBody as AICompleteRequest
    const { prompt, messages, stream, model, temperature, max_tokens } = extractAIParams(
      body,
      url.searchParams
    )

    if (!prompt && !Array.isArray(messages))
      return errorJson({ error: 'missing prompt or messages' }, 400, origin)

    const params =
      Array.isArray(messages) && messages.length > 0
        ? { messages, stream, temperature, max_tokens }
        : { prompt, stream, temperature, max_tokens }

    const answer = await env.AI.run(model as any, params)
    if (stream)
      return new Response(answer as any, {
        headers: { 'content-type': 'text/event-stream', ...getCorsHeaders(origin) }
      })
    return okJson(answer, origin)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500, origin)
  }
}
