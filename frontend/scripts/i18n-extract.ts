#!/usr/bin/env bun
/**
 * 国际化文案提取工具
 *
 * 功能：
 * 1. 扫描代码中的硬编码中文文案
 * 2. 生成翻译键建议
 * 3. 输出待翻译文案列表
 * 4. 检测未使用的翻译键
 */

import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

interface ExtractedText {
  text: string
  file: string
  line: number
  suggestedKey: string
}

interface UnusedKey {
  key: string
  locales: string[]
}

/**
 * 中文字符正则
 */
const CHINESE_REGEX = /[\u4e00-\u9fa5]{2,}/g

/**
 * 排除的目录
 */
const EXCLUDED_DIRS = ['node_modules', 'dist', '.turbo', '.test-perf-data', '_locales']

/**
 * 排除的文件模式
 */
const EXCLUDED_FILES = ['i18n-extract.ts', 'time-formatter.README.md', '.md', '.json']

/**
 * 扫描目录获取所有文件
 */
async function scanDirectory(dir: string): Promise<string[]> {
  const files: string[] = []

  try {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.includes(entry.name)) {
          files.push(...(await scanDirectory(fullPath)))
        }
      } else if (entry.isFile()) {
        const shouldExclude = EXCLUDED_FILES.some(pattern => entry.name.includes(pattern))

        if (!shouldExclude && (entry.name.endsWith('.vue') || entry.name.endsWith('.ts'))) {
          files.push(fullPath)
        }
      }
    }
  } catch (_error) {
    console.error(`扫描目录失败: ${dir}`)
  }

  return files
}

/**
 * 提取文件中的中文文案
 */
async function extractTextsFromFile(filePath: string): Promise<ExtractedText[]> {
  const extracted: ExtractedText[] = []

  try {
    const content = await readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      // 跳过注释行
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return
      }

      const matches = line.match(CHINESE_REGEX)
      if (matches) {
        matches.forEach(text => {
          // 生成建议的翻译键
          const suggestedKey = generateKey(text, filePath)

          extracted.push({
            text,
            file: filePath.replace(process.cwd(), ''),
            line: index + 1,
            suggestedKey
          })
        })
      }
    })
  } catch (_error) {
    console.error(`读取文件失败: ${filePath}`)
  }

  return extracted
}

/**
 * 生成翻译键建议
 */
function generateKey(text: string, filePath: string): string {
  // 从文件路径提取上下文
  const parts = filePath.split('/')
  const fileName = parts[parts.length - 1].replace(/\.(vue|ts)$/, '')

  // 简化文本作为键的一部分
  const textPart = text
    .slice(0, 20)
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_')
    .toLowerCase()

  return `${fileName}.${textPart}`
}

/**
 * 读取现有的翻译文件
 */
async function loadExistingTranslations(locale: string): Promise<Set<string>> {
  const keys = new Set<string>()

  try {
    const messagesPath = join(process.cwd(), `public/_locales/${locale}/messages.json`)
    const content = await readFile(messagesPath, 'utf-8')
    const messages = JSON.parse(content)

    Object.keys(messages).forEach(key => keys.add(key))
  } catch {
    console.warn(`无法读取 ${locale} 翻译文件`)
  }

  return keys
}

/**
 * 检测未使用的翻译键
 */
async function findUnusedKeys(
  allFiles: string[],
  translationKeys: Set<string>
): Promise<UnusedKey[]> {
  const usedKeys = new Set<string>()

  // 扫描所有文件，查找使用的键
  for (const file of allFiles) {
    try {
      const content = await readFile(file, 'utf-8')

      translationKeys.forEach(key => {
        if (content.includes(`'${key}'`) || content.includes(`"${key}"`)) {
          usedKeys.add(key)
        }
      })
    } catch {
      // 忽略读取错误
    }
  }

  // 找出未使用的键
  const unused: UnusedKey[] = []
  translationKeys.forEach(key => {
    if (!usedKeys.has(key)) {
      unused.push({ key, locales: ['zh_CN', 'en'] })
    }
  })

  return unused
}

/**
 * 主函数
 */
async function main() {
  console.log('🔍 开始扫描国际化文案...\n')

  const srcDir = join(process.cwd(), 'src')
  const allFiles = await scanDirectory(srcDir)

  console.log(`📁 扫描文件数: ${allFiles.length}\n`)

  // 提取所有中文文案
  const allExtracted: ExtractedText[] = []
  for (const file of allFiles) {
    const extracted = await extractTextsFromFile(file)
    allExtracted.push(...extracted)
  }

  console.log(`📝 发现硬编码中文文案: ${allExtracted.length} 处\n`)

  // 去重
  const uniqueTexts = new Map<string, ExtractedText>()
  allExtracted.forEach(item => {
    if (!uniqueTexts.has(item.text)) {
      uniqueTexts.set(item.text, item)
    }
  })

  console.log(`🎯 去重后: ${uniqueTexts.size} 条独特文案\n`)

  // 读取现有翻译
  const existingKeys = await loadExistingTranslations('zh_CN')
  console.log(`📚 现有翻译键: ${existingKeys.size} 个\n`)

  // 检测未使用的键
  const unusedKeys = await findUnusedKeys(allFiles, existingKeys)

  // 生成报告
  const report = {
    summary: {
      totalFiles: allFiles.length,
      hardcodedTexts: allExtracted.length,
      uniqueTexts: uniqueTexts.size,
      existingKeys: existingKeys.size,
      unusedKeys: unusedKeys.length
    },
    hardcodedTexts: Array.from(uniqueTexts.values()).slice(0, 50), // 只显示前50条
    unusedKeys: unusedKeys.slice(0, 20) // 只显示前20个
  }

  // 输出报告
  const reportPath = join(process.cwd(), 'i18n-report.json')
  await writeFile(reportPath, JSON.stringify(report, null, 2))

  console.log('📊 扫描完成！\n')
  console.log('统计信息:')
  console.log(`  - 扫描文件: ${report.summary.totalFiles}`)
  console.log(`  - 硬编码文案: ${report.summary.hardcodedTexts}`)
  console.log(`  - 独特文案: ${report.summary.uniqueTexts}`)
  console.log(`  - 现有翻译键: ${report.summary.existingKeys}`)
  console.log(`  - 未使用的键: ${report.summary.unusedKeys}`)
  console.log(`\n📄 详细报告已保存到: ${reportPath}`)

  // 显示前10条待翻译文案
  console.log('\n📝 待翻译文案示例 (前10条):')
  Array.from(uniqueTexts.values())
    .slice(0, 10)
    .forEach((item, index) => {
      console.log(`\n${index + 1}. "${item.text}"`)
      console.log(`   文件: ${item.file}:${item.line}`)
      console.log(`   建议键: ${item.suggestedKey}`)
    })
}

main().catch(console.error)
