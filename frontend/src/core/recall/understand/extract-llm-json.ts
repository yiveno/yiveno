/**
 * 从模型文本中抽出 JSON 对象（允许 ```json 围栏或前后废话）。
 */
export function extractJsonObjectText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('llm_empty_response')
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fence?.[1] ?? trimmed).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end < start) {
    throw new Error('llm_no_json_object')
  }
  return candidate.slice(start, end + 1)
}

/** 解析并返回 unknown；调用方再走 Zod。 */
export function parseJsonObjectFromLlmText(text: string): unknown {
  const jsonText = extractJsonObjectText(text)
  try {
    return JSON.parse(jsonText) as unknown
  } catch {
    throw new Error('llm_json_parse_failed')
  }
}
