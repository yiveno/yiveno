#!/usr/bin/env bun
/**
 * CF AI Gateway compat 错误保真探针（只读 · Batch 1）。
 *
 * 用不存在的模型名触发 4xx，检查 status / error.code / details / 限额头是否保真。
 * 不打印 API key 值；不改生产配置。
 *
 * 用法（在 worker/ 下）：
 *   bun scripts/probe-gateway-compat-error-fidelity.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workerRoot = path.resolve(__dirname, '..')

function loadEnvFile(filePath, out) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (out[k] === undefined || out[k] === '') out[k] = v
  }
}

function loadTomlVars(filePath, out) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  const m = text.match(/^\[vars\]([\s\S]*?)(?=^\[|\z)/m)
  if (!m) return
  for (const line of m[1].split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (out[k] === undefined || out[k] === '') out[k] = v
  }
}

function redact(text) {
  return String(text)
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/AIza[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/gsk_[A-Za-z0-9]+/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
}

const env = {}
loadTomlVars(path.join(workerRoot, 'wrangler.toml'), env)
loadEnvFile(path.join(workerRoot, '.dev.vars'), env)
loadEnvFile(path.join(workerRoot, '../.env.shared.local'), env)

const presence = {
  AI_GATEWAY_ACCOUNT_ID: Boolean(env.AI_GATEWAY_ACCOUNT_ID?.trim()),
  AI_GATEWAY_ID: Boolean(env.AI_GATEWAY_ID?.trim()),
  AI_GATEWAY_TOKEN: Boolean(env.AI_GATEWAY_TOKEN?.trim()),
  GOOGLE_AI_API_KEY: Boolean(env.GOOGLE_AI_API_KEY?.trim()),
  GROQ_API_KEY: Boolean(env.GROQ_API_KEY?.trim())
}
console.log(JSON.stringify({ keyPresence: presence }, null, 2))

if (!presence.AI_GATEWAY_ACCOUNT_ID || !presence.AI_GATEWAY_ID) {
  console.log(JSON.stringify({ probeSkipped: true, reason: 'missing_gateway_ids' }))
  process.exit(0)
}

const url = `https://gateway.ai.cloudflare.com/v1/${env.AI_GATEWAY_ACCOUNT_ID.trim()}/${env.AI_GATEWAY_ID.trim()}/compat/chat/completions`

async function probe(label, model, apiKey) {
  if (!apiKey) {
    console.log(JSON.stringify({ label, skipped: true, reason: 'missing_vendor_key' }))
    return
  }
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
    'cf-aig-collect-log-payload': 'false',
    'cf-aig-skip-cache': 'true',
    'user-agent': 'yiveno-worker/compat-error-fidelity-probe'
  }
  if (env.AI_GATEWAY_TOKEN?.trim()) {
    headers['cf-aig-authorization'] = `Bearer ${env.AI_GATEWAY_TOKEN.trim()}`
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 8,
      temperature: 0
    })
  })
  const rawText = await res.text()
  let parsed = null
  try {
    parsed = JSON.parse(rawText)
  } catch {
    parsed = null
  }
  const rateLimitHeaders = {}
  for (const k of [
    'retry-after',
    'x-ratelimit-remaining-requests',
    'x-ratelimit-remaining-tokens',
    'x-ratelimit-reset-requests',
    'x-ratelimit-reset-tokens'
  ]) {
    const v = res.headers.get(k)
    if (v) rateLimitHeaders[k] = v
  }

  // Google 实测可能返回数组包装
  const first =
    Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object' ? parsed[0] : parsed
  const err = first && typeof first === 'object' ? first.error : undefined
  const errObj = Array.isArray(err) ? err[0] : err

  console.log(
    JSON.stringify(
      {
        label,
        model,
        httpStatus: res.status,
        contentType: res.headers.get('content-type'),
        parsedType: parsed === null ? 'parse_fail' : Array.isArray(parsed) ? 'array' : typeof parsed,
        errorKeys: errObj && typeof errObj === 'object' ? Object.keys(errObj) : null,
        errorCode: errObj?.code ?? first?.internalCode ?? null,
        errorStatus: errObj?.status ?? null,
        errorType: errObj?.type ?? null,
        hasDetails: errObj?.details !== undefined,
        detailsType:
          errObj?.details === undefined
            ? 'missing'
            : Array.isArray(errObj.details)
              ? 'array'
              : typeof errObj.details,
        rateLimitHeadersPresent: Object.keys(rateLimitHeaders),
        rateLimitHeaders,
        rawPreview: redact(rawText).slice(0, 360)
      },
      null,
      2
    )
  )
}

await probe(
  'google_bad_model',
  'google-ai-studio/yiveno-nonexistent-model-batch1-probe',
  env.GOOGLE_AI_API_KEY?.trim()
)
await probe(
  'groq_bad_model',
  'groq/yiveno-nonexistent-model-batch1-probe',
  env.GROQ_API_KEY?.trim()
)
