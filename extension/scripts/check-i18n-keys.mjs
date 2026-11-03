#!/usr/bin/env bun
/**
 * Validate en/zh_CN messages.json keys against MESSAGE_KEYS and product-surface forbidden labels.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { scanEnMessagesForProductSurfaceViolations } from '../src/infrastructure/i18n/product-surface-label-policy.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const enPath = join(root, 'public/_locales/en/messages.json')
const zhPath = join(root, 'public/_locales/zh_CN/messages.json')
const keysTsPath = join(root, 'src/infrastructure/i18n/message-keys.ts')

function loadMessageKeys(path) {
  const json = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error(`无效 messages.json: ${path}`)
  }
  return new Set(Object.keys(json))
}

function loadDeclaredKeys(path) {
  const source = readFileSync(path, 'utf8')
  const match = source.match(/export const MESSAGE_KEYS = \[([\s\S]*?)\] as const/)
  if (!match) {
    throw new Error(`无法解析 MESSAGE_KEYS: ${path}`)
  }
  const keys = [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1])
  return new Set(keys)
}

function diff(a, b) {
  return [...a].filter(key => !b.has(key)).sort()
}

const en = loadMessageKeys(enPath)
const zh = loadMessageKeys(zhPath)
const declared = loadDeclaredKeys(keysTsPath)
const enMessages = JSON.parse(readFileSync(enPath, 'utf8'))
const zhMessages = JSON.parse(readFileSync(zhPath, 'utf8'))

const errors = []

const onlyDeclared = diff(declared, en)
const onlyLocale = diff(en, declared)
if (onlyDeclared.length > 0) {
  errors.push(`MESSAGE_KEYS 多出: ${onlyDeclared.join(', ')}`)
}
if (onlyLocale.length > 0) {
  errors.push(`en messages.json 有但 MESSAGE_KEYS 缺: ${onlyLocale.join(', ')}`)
}

const zhMissing = diff(en, zh)
const zhExtra = diff(zh, en)
if (zhMissing.length > 0) {
  errors.push(
    `zh_CN 缺键: ${zhMissing.slice(0, 12).join(', ')}${zhMissing.length > 12 ? ` …共 ${zhMissing.length}` : ''}`
  )
}
if (zhExtra.length > 0) {
  errors.push(
    `zh_CN 多键: ${zhExtra.slice(0, 12).join(', ')}${zhExtra.length > 12 ? ` …共 ${zhExtra.length}` : ''}`
  )
}

/** 只比占位名与 content（$1…）；example 可本地化，不纳入对称门禁。 */
function placeholderSignature(placeholders) {
  if (!placeholders || typeof placeholders !== 'object') return null
  const names = Object.keys(placeholders).sort()
  return names.map(name => {
    const entry = placeholders[name]
    const content =
      entry && typeof entry === 'object' && typeof entry.content === 'string' ? entry.content : null
    return `${name}:${content}`
  })
}

for (const key of en) {
  const enSig = placeholderSignature(enMessages[key]?.placeholders)
  const zhSig = placeholderSignature(zhMessages[key]?.placeholders)
  if (JSON.stringify(enSig) !== JSON.stringify(zhSig)) {
    errors.push(`zh_CN placeholders 与 en 不一致: ${key}`)
  }
}

const forbiddenViolations = scanEnMessagesForProductSurfaceViolations(enMessages)
if (forbiddenViolations.length > 0) {
  const preview = forbiddenViolations
    .slice(0, 8)
    .map(v => `${v.key} (${v.matched})`)
    .join(', ')
  const suffix = forbiddenViolations.length > 8 ? ` …共 ${forbiddenViolations.length} 条` : ''
  errors.push(`产品面禁用词 Search: ${preview}${suffix}`)
}

const zhSearchHits = [...zh].filter(key => /搜索/.test(zhMessages[key]?.message ?? ''))
if (zhSearchHits.length > 0) {
  errors.push(`zh_CN 含禁用「搜索」: ${zhSearchHits.slice(0, 8).join(', ')}`)
}

if (errors.length > 0) {
  console.error('❌ i18n key 校验失败:')
  for (const line of errors) {
    console.error(`  - ${line}`)
  }
  process.exit(1)
}

console.log(
  `✅ i18n keys aligned (en / zh_CN / MESSAGE_KEYS, ${en.size} keys, forbidden-label scan ok)`
)
