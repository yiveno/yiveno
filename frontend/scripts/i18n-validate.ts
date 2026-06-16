#!/usr/bin/env bun
/**
 * 国际化翻译验证工具
 *
 * 功能：
 * 1. 检查所有语言包的键是否一致
 * 2. 检测缺失的翻译
 * 3. 检测空翻译
 * 4. 验证占位符一致性
 */

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

interface ValidationIssue {
  type: 'missing' | 'empty' | 'placeholder_mismatch'
  locale: string
  key: string
  details?: string
}

interface ValidationReport {
  passed: boolean
  issues: ValidationIssue[]
  summary: {
    totalKeys: number
    totalLocales: number
    missingTranslations: number
    emptyTranslations: number
    placeholderMismatches: number
  }
}

/**
 * 读取所有语言包
 */
async function loadAllLocales(): Promise<Map<string, Record<string, { message: string }>>> {
  const localesDir = join(process.cwd(), 'public/_locales')
  const locales = new Map<string, Record<string, { message: string }>>()

  try {
    const entries = await readdir(localesDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const messagesPath = join(localesDir, entry.name, 'messages.json')
        try {
          const content = await readFile(messagesPath, 'utf-8')
          const messages = JSON.parse(content)
          locales.set(entry.name, messages)
        } catch {
          console.warn(`⚠️  无法读取 ${entry.name}/messages.json`)
        }
      }
    }
  } catch (error) {
    console.error('读取 public/_locales 目录失败:', error)
  }

  return locales
}

/**
 * 提取占位符
 */
function extractPlaceholders(text: string): string[] {
  const placeholders: string[] = []
  const regex = /\$(\d+)/g
  let match

  while ((match = regex.exec(text)) !== null) {
    placeholders.push(match[1])
  }

  return placeholders
}

/**
 * 验证翻译
 */
function validateTranslations(
  locales: Map<string, Record<string, { message: string }>>
): ValidationReport {
  const issues: ValidationIssue[] = []

  // 获取所有键（以第一个语言包为基准）
  const baseLocale = locales.entries().next().value
  if (!baseLocale) {
    return {
      passed: true,
      issues: [],
      summary: {
        totalKeys: 0,
        totalLocales: 0,
        missingTranslations: 0,
        emptyTranslations: 0,
        placeholderMismatches: 0
      }
    }
  }

  const [, baseMessages] = baseLocale
  const allKeys = Object.keys(baseMessages)

  // 检查每个语言包
  locales.forEach((messages, localeName) => {
    allKeys.forEach(key => {
      // 检查缺失的翻译
      if (!(key in messages)) {
        issues.push({
          type: 'missing',
          locale: localeName,
          key,
          details: `缺少翻译键: ${key}`
        })
        return
      }

      const message = messages[key].message

      // 检查空翻译
      if (!message || message.trim() === '') {
        issues.push({
          type: 'empty',
          locale: localeName,
          key,
          details: `翻译为空`
        })
        return
      }

      // 检查占位符一致性
      const basePlaceholders = extractPlaceholders(baseMessages[key].message)
      const currentPlaceholders = extractPlaceholders(message)

      if (basePlaceholders.length !== currentPlaceholders.length) {
        issues.push({
          type: 'placeholder_mismatch',
          locale: localeName,
          key,
          details: `占位符数量不匹配: 基准 ${basePlaceholders.length} vs 当前 ${currentPlaceholders.length}`
        })
      }
    })
  })

  // 统计
  const summary = {
    totalKeys: allKeys.length,
    totalLocales: locales.size,
    missingTranslations: issues.filter(i => i.type === 'missing').length,
    emptyTranslations: issues.filter(i => i.type === 'empty').length,
    placeholderMismatches: issues.filter(i => i.type === 'placeholder_mismatch').length
  }

  return {
    passed: issues.length === 0,
    issues,
    summary
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🔍 开始验证国际化翻译...\n')

  const locales = await loadAllLocales()
  console.log(`📚 加载语言包: ${Array.from(locales.keys()).join(', ')}\n`)

  const report = validateTranslations(locales)

  console.log('📊 验证结果:\n')
  console.log(`  总键数: ${report.summary.totalKeys}`)
  console.log(`  语言数: ${report.summary.totalLocales}`)
  console.log(`  缺失翻译: ${report.summary.missingTranslations}`)
  console.log(`  空翻译: ${report.summary.emptyTranslations}`)
  console.log(`  占位符不匹配: ${report.summary.placeholderMismatches}`)
  console.log()

  if (report.passed) {
    console.log('✅ 所有翻译验证通过！')
    process.exit(0)
  } else {
    console.log('❌ 发现翻译问题:\n')

    // 按类型分组显示
    const byType = new Map<string, ValidationIssue[]>()
    report.issues.forEach(issue => {
      const existing = byType.get(issue.type) || []
      existing.push(issue)
      byType.set(issue.type, existing)
    })

    byType.forEach((issues, type) => {
      console.log(`\n${getTypeEmoji(type)} ${getTypeName(type)} (${issues.length}):`)
      issues.slice(0, 10).forEach(issue => {
        console.log(`  - [${issue.locale}] ${issue.key}`)
        if (issue.details) {
          console.log(`    ${issue.details}`)
        }
      })

      if (issues.length > 10) {
        console.log(`  ... 还有 ${issues.length - 10} 个问题`)
      }
    })

    process.exit(1)
  }
}

function getTypeEmoji(type: string): string {
  const emojis: Record<string, string> = {
    missing: '❌',
    empty: '⚠️',
    placeholder_mismatch: '🔧'
  }
  return emojis[type] || '❓'
}

function getTypeName(type: string): string {
  const names: Record<string, string> = {
    missing: '缺失翻译',
    empty: '空翻译',
    placeholder_mismatch: '占位符不匹配'
  }
  return names[type] || type
}

main().catch(console.error)
