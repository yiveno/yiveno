#!/usr/bin/env bun
/**
 * Validate en messages.json keys against MESSAGE_KEYS and product-surface forbidden labels.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { scanEnMessagesForProductSurfaceViolations } from '../src/infrastructure/i18n/product-surface-label-policy.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const enPath = join(root, 'public/_locales/en/messages.json')
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
const declared = loadDeclaredKeys(keysTsPath)
const enMessages = JSON.parse(readFileSync(enPath, 'utf8'))

const errors = []

const onlyDeclared = diff(declared, en)
const onlyLocale = diff(en, declared)
if (onlyDeclared.length > 0) {
  errors.push(`MESSAGE_KEYS 多出: ${onlyDeclared.join(', ')}`)
}
if (onlyLocale.length > 0) {
  errors.push(`messages.json 有但 MESSAGE_KEYS 缺: ${onlyLocale.join(', ')}`)
}

const forbiddenViolations = scanEnMessagesForProductSurfaceViolations(enMessages)
if (forbiddenViolations.length > 0) {
  const preview = forbiddenViolations
    .slice(0, 8)
    .map(v => `${v.key} (${v.matched})`)
    .join(', ')
  const suffix =
    forbiddenViolations.length > 8 ? ` …共 ${forbiddenViolations.length} 条` : ''
  errors.push(`产品面禁用词 Search: ${preview}${suffix}`)
}

if (errors.length > 0) {
  console.error('❌ i18n key 校验失败:')
  for (const line of errors) {
    console.error(`  - ${line}`)
  }
  process.exit(1)
}

console.log(`✅ i18n keys aligned (en / MESSAGE_KEYS, ${en.size} keys, forbidden-label scan ok)`)
