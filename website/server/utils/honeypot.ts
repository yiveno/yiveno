/**
 * Honeypot（蜜罐）防护
 * 通过隐藏字段检测机器人
 */

/**
 * 检查是否是机器人提交
 * @param body 请求体
 * @returns 是否是机器人
 */
export function isBotSubmission(body: Record<string, unknown>): boolean {
  // 检查常见的蜜罐字段名
  const honeypotFields = ['website', 'url', 'homepage', 'phone', 'company', 'subject']

  for (const field of honeypotFields) {
    const value = body[field]
    // 如果字段存在且不为空，可能是机器人
    if (typeof value === 'string' && value.trim() !== '') {
      return true
    }
  }

  return false
}

/**
 * 生成蜜罐字段名（随机化，避免被识别）
 */
export function generateHoneypotFieldName(): string {
  const fields: string[] = ['website', 'url', 'homepage', 'phone', 'company']
  const index = Math.floor(Math.random() * fields.length)
  return fields[index] || 'website'
}
