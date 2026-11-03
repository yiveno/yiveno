/**
 * L2 召回消融 · 真实 Embedding 轨（非 CI 默认）。
 *
 * 用法：
 *   cd extension && bun run retrieval-ablation:real
 *
 * Token 解析顺序（均须经 Worker Bearer 鉴权；禁止绕过 / 硬编码入库）：
 *   1. RETRIEVAL_ABLATION_ACCESS_TOKEN
 *   2. 本机 `.env*.local` 的 SUPABASE_* + service role：与生产同源
 *      `admin.generateLink(magiclink)` + `anon.verifyOtp` 签发短会话
 *      （可选 RETRIEVAL_ABLATION_USER_EMAIL；默认 retrieval-ablation-local@yiveno.dev）
 *   3. localhost bridge：等待已登录扩展经 getWorkerApiAccessToken 推送
 *      （RETRIEVAL_ABLATION_TOKEN_BRIDGE=1 或缺 mint 凭据时启用）
 *
 * TLS（FACT）：本机 macOS / Bun 调 Supabase 须与 worker 一致设置
 *   NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem（`run-retrieval-ablation-real.mjs` 已默认注入）。
 *   缺省时失败点常在 admin.listUsers / generateLink（unknown certificate verification error），
 *   **不是** Worker 鉴权被绕过。
 *
 * 其它：
 *   VITE_API_BASE_URL 或 RETRIEVAL_ABLATION_API_BASE  默认 http://localhost:8787
 *   RETRIEVAL_ABLATION_OUT  报告写出路径
 *   RETRIEVAL_ABLATION_GATE_MODE  off（默认）| vs_baseline
 *     vs_baseline：对照快照主口径 include 指标；召回/MRR/nDCG 不得降、negFP 不得升
 *   RETRIEVAL_ABLATION_BASELINE_PATH  vs_baseline 快照（相对仓库根或绝对）；
 *     默认 docs/audits/2026-10-L2召回消融-real-run-b2-aligned.json
 *
 * 禁止：fake embedding / embeddingAnchor / 空向量续算。
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import {
  compareRetrievalAblationToBaseline,
  extractRetrievalAblationReport,
  formatRetrievalAblationBaselineCompareSummary
} from '../src/core/recall/eval/compare-retrieval-ablation-baseline'
import {
  formatRetrievalAblationSummary,
  runRetrievalAblation,
  type RetrievalAblationEmbedClient
} from '../src/core/recall/eval/run-retrieval-ablation'
import { WORKER_EMBEDDING_MODEL_HINT } from '../src/core/recall/eval/retrieval-ablation-fusion-constants'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '../..')

const DEFAULT_EVAL_EMAIL = 'retrieval-ablation-local@yiveno.dev'
/** 与 B2 对齐 real-run 同档；vs_baseline 默认对照。 */
const DEFAULT_ABLATION_BASELINE_REL = 'docs/audits/2026-10-L2召回消融-real-run-b2-aligned.json'

type AblationGateMode = 'off' | 'vs_baseline'

function resolveAblationGateMode(raw: string | undefined): AblationGateMode {
  const mode = raw?.trim() || 'off'
  if (mode === 'off' || mode === 'vs_baseline') {
    return mode
  }
  throw new Error(`RETRIEVAL_ABLATION_GATE_MODE 无效: ${mode}（用 off|vs_baseline）`)
}

function resolveAblationBaselinePath(explicit: string | undefined): string {
  const raw = explicit?.trim()
  if (raw) {
    return isAbsolute(raw) ? raw : resolve(repoRoot, raw)
  }
  return resolve(repoRoot, DEFAULT_ABLATION_BASELINE_REL)
}
const BRIDGE_PORT = Number(process.env.RETRIEVAL_ABLATION_BRIDGE_PORT || '17387')
const BRIDGE_WAIT_MS = Number(process.env.RETRIEVAL_ABLATION_BRIDGE_WAIT_MS || '90000')

type TokenSource = 'env' | 'supabase_admin_mint' | 'extension_bridge'

function loadLocalEnvFiles(): void {
  const roots = [repoRoot, resolve(scriptDir, '..')]
  const names = ['.env.shared.local', '.env.development.local', '.env.local']
  for (const root of roots) {
    for (const name of names) {
      const path = resolve(root, name)
      if (!existsSync(path)) {
        continue
      }
      const text = readFileSync(path, 'utf8')
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) {
          continue
        }
        const eq = trimmed.indexOf('=')
        if (eq <= 0) {
          continue
        }
        const key = trimmed.slice(0, eq).trim()
        let value = trimmed.slice(eq + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        if (process.env[key] === undefined) {
          process.env[key] = value
        }
      }
    }
  }
}

function resolveApiBase(): string {
  const raw =
    process.env.RETRIEVAL_ABLATION_API_BASE?.trim() ||
    process.env.VITE_API_BASE_URL?.trim() ||
    'http://localhost:8787'
  return raw.replace(/\/$/, '')
}

function createWorkerEmbedClient(
  accessToken: string,
  apiBaseUrl: string,
  observedModel: { current: string | null }
): RetrievalAblationEmbedClient {
  return {
    model: WORKER_EMBEDDING_MODEL_HINT,
    async embedTexts(texts: readonly string[]): Promise<number[][]> {
      const response = await fetch(`${apiBaseUrl}/api/ai/embed`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ texts: [...texts] })
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const errorCode =
          typeof body === 'object' &&
          body !== null &&
          'error' in body &&
          typeof (body as { error: unknown }).error === 'string'
            ? (body as { error: string }).error
            : `http_${response.status}`
        // 认证/请求失败必须抛错，禁止空向量续算
        throw new Error(errorCode)
      }
      if (
        typeof body !== 'object' ||
        body === null ||
        !('success' in body) ||
        (body as { success: unknown }).success !== true ||
        !('data' in body)
      ) {
        throw new Error('invalid_embed_response')
      }
      const data = (body as { data: { model?: string; dim?: number; embeddings?: number[][] } })
        .data
      if (!data.model) {
        throw new Error('missing_embed_model')
      }
      if (data.model !== WORKER_EMBEDDING_MODEL_HINT) {
        throw new Error(`unexpected_embed_model:${data.model}`)
      }
      observedModel.current = data.model
      if (!Array.isArray(data.embeddings)) {
        throw new Error('invalid_embed_response')
      }
      if (data.embeddings.length !== texts.length) {
        throw new Error(
          `embed_count_mismatch:expected_${texts.length}_got_${data.embeddings.length}`
        )
      }
      for (let i = 0; i < data.embeddings.length; i += 1) {
        const vector = data.embeddings[i]
        if (!Array.isArray(vector) || vector.length === 0) {
          throw new Error(`empty_embedding_at_${i}`)
        }
        if (typeof data.dim === 'number' && vector.length !== data.dim) {
          throw new Error(`dim_mismatch_at_${i}:got_${vector.length}_expected_${data.dim}`)
        }
      }
      return data.embeddings
    }
  }
}

async function probeApi(apiBaseUrl: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/ai/embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texts: ['ping'] })
    })
    if (response.status === 401 || response.status === 403) {
      return { ok: true, detail: `embed 路由可达（HTTP ${response.status} 无鉴权）` }
    }
    if (response.status === 404) {
      return { ok: false, detail: 'embed 路由 404' }
    }
    return { ok: true, detail: `embed 路由 HTTP ${response.status}` }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    }
  }
}

function tlsHintIfCertError(message: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes('certificate') ||
    lower.includes('cert') ||
    lower.includes('ssl') ||
    lower.includes('tls') ||
    lower.includes('unable to get local issuer')
  ) {
    return (
      `${message} | TLS 提示：与 worker dev 同源，设置 NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem` +
      `（run-retrieval-ablation-real.mjs 默认注入）；勿绕过 Worker 鉴权`
    )
  }
  return message
}

/**
 * 合法 mint：service role generateLink + anon verifyOtp（与 Worker issueSupabaseUserSession 同源）。
 * 优先 generateLink（已存在评测用户时免 listUsers）；失败再 createUser。
 */
async function mintAccessTokenViaSupabaseAdmin(): Promise<
  { ok: true; token: string; email: string; userId: string } | { ok: false; detail: string }
> {
  const url = process.env.SUPABASE_URL?.trim()
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const anon = process.env.SUPABASE_ANON_KEY?.trim()
  if (!url || !service || !anon) {
    return {
      ok: false,
      detail:
        '缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY（本机 .env*.local）'
    }
  }

  const email = process.env.RETRIEVAL_ABLATION_USER_EMAIL?.trim() || DEFAULT_EVAL_EMAIL

  console.info(
    `[retrieval-ablation:real] mint TLS NODE_EXTRA_CA_CERTS=${process.env.NODE_EXTRA_CA_CERTS ?? '∅'}`
  )

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  let userId: string | null = null
  let link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (link.error || !link.data?.properties?.hashed_token) {
    const linkErr = link.error?.message ?? 'missing_hashed_token'
    // 用户可能不存在 → create 后再 generateLink
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { purpose: 'retrieval_ablation_local_eval' }
    })
    if (created.error && !/already|registered|exists/i.test(created.error.message)) {
      return {
        ok: false,
        detail: tlsHintIfCertError(`generateLink: ${linkErr}; createUser: ${created.error.message}`)
      }
    }
    userId = created.data.user?.id ?? null
    link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  }

  const hashed = link.data?.properties?.hashed_token
  if (link.error || !hashed) {
    return {
      ok: false,
      detail: tlsHintIfCertError(`generateLink: ${link.error?.message ?? 'missing_hashed_token'}`)
    }
  }
  userId = link.data?.user?.id ?? userId
  if (!userId) {
    return { ok: false, detail: 'generateLink 成功但缺少 userId' }
  }

  const anonClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const otp = await anonClient.auth.verifyOtp({
    type: 'email',
    token_hash: hashed
  })
  const token = otp.data.session?.access_token
  if (otp.error || !token) {
    return {
      ok: false,
      detail: tlsHintIfCertError(`verifyOtp: ${otp.error?.message ?? 'missing_access_token'}`)
    }
  }

  return { ok: true, token, email, userId }
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw.trim()) {
        resolveBody(null)
        return
      }
      try {
        resolveBody(JSON.parse(raw) as unknown)
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

/**
 * 本机临时桥：扩展 SW 用 getWorkerApiAccessToken() 后 POST
 *   http://127.0.0.1:<port>/retrieval-ablation/token
 *   { "accessToken": "…" }
 * 不落盘、不入库。
 */
async function waitForExtensionBridgeToken(
  waitMs: number
): Promise<{ ok: true; token: string } | { ok: false; detail: string }> {
  let settledToken: string | null = null
  let settle!: (token: string) => void
  const tokenPromise = new Promise<string>(resolveToken => {
    settle = resolveToken
  })

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${BRIDGE_PORT}`)
    const allowCors = () => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'content-type')
    }
    if (req.method === 'OPTIONS') {
      allowCors()
      res.writeHead(204)
      res.end()
      return
    }
    if (req.method === 'POST' && url.pathname === '/retrieval-ablation/token') {
      allowCors()
      void readJsonBody(req)
        .then(body => {
          const token =
            typeof body === 'object' &&
            body !== null &&
            'accessToken' in body &&
            typeof (body as { accessToken: unknown }).accessToken === 'string'
              ? (body as { accessToken: string }).accessToken.trim()
              : ''
          if (!token) {
            res.writeHead(400, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'missing_accessToken' }))
            return
          }
          settledToken = token
          settle(token)
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        })
        .catch(() => {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'invalid_json' }))
        })
      return
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, hasToken: Boolean(settledToken) }))
      return
    }
    res.writeHead(404)
    res.end()
  })

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(BRIDGE_PORT, '127.0.0.1', () => resolveListen())
  })

  console.info(
    [
      `[retrieval-ablation:real] token bridge 监听 http://127.0.0.1:${BRIDGE_PORT}/retrieval-ablation/token`,
      '请在已登录扩展 SW/控制台执行（复用 getWorkerApiAccessToken，勿贴 token 进 git）：',
      `  fetch('http://127.0.0.1:${BRIDGE_PORT}/retrieval-ablation/token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accessToken: await yiveno?.getWorkerApiAccessToken?.() })})`,
      `等待 ${waitMs}ms…`
    ].join('\n')
  )

  try {
    const token = await Promise.race([
      tokenPromise,
      new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('bridge_timeout')), waitMs)
      })
    ])
    return { ok: true, token }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    }
  } finally {
    await new Promise<void>(resolveClose => {
      server.close(() => resolveClose())
    })
  }
}

async function resolveAccessToken(): Promise<
  | { ok: true; token: string; source: TokenSource; detail: string }
  | { ok: false; detail: string; tried: string[] }
> {
  const tried: string[] = []
  const fromEnv = process.env.RETRIEVAL_ABLATION_ACCESS_TOKEN?.trim()
  if (fromEnv) {
    tried.push('env:RETRIEVAL_ABLATION_ACCESS_TOKEN')
    return {
      ok: true,
      token: fromEnv,
      source: 'env',
      detail: 'RETRIEVAL_ABLATION_ACCESS_TOKEN'
    }
  }
  tried.push('env:RETRIEVAL_ABLATION_ACCESS_TOKEN=missing')

  const forceBridge = process.env.RETRIEVAL_ABLATION_TOKEN_BRIDGE === '1'
  if (!forceBridge) {
    const minted = await mintAccessTokenViaSupabaseAdmin()
    tried.push(
      minted.ok
        ? `supabase_admin_mint:${minted.email}`
        : `supabase_admin_mint:fail:${minted.detail}`
    )
    if (minted.ok) {
      return {
        ok: true,
        token: minted.token,
        source: 'supabase_admin_mint',
        detail: `email=${minted.email} userId=${minted.userId}（generateLink+verifyOtp · 与 Worker mint 同源）`
      }
    }
  } else {
    tried.push('supabase_admin_mint:skipped(RETRIEVAL_ABLATION_TOKEN_BRIDGE=1)')
  }

  const bridged = await waitForExtensionBridgeToken(BRIDGE_WAIT_MS)
  tried.push(bridged.ok ? 'extension_bridge:ok' : `extension_bridge:fail:${bridged.detail}`)
  if (bridged.ok) {
    return {
      ok: true,
      token: bridged.token,
      source: 'extension_bridge',
      detail: `127.0.0.1:${BRIDGE_PORT}（扩展 getWorkerApiAccessToken 推送）`
    }
  }

  return {
    ok: false,
    detail: '无法取得有效 Worker Bearer',
    tried
  }
}

export async function runRetrievalAblationRealCli(): Promise<void> {
  loadLocalEnvFiles()
  const apiBase = resolveApiBase()

  console.info(`[retrieval-ablation:real] apiBase=${apiBase}`)
  const probe = await probeApi(apiBase)
  console.info(`[retrieval-ablation:real] probe: ${probe.detail}`)

  if (!probe.ok) {
    console.error(
      [
        '[retrieval-ablation:real] BLOCKED：Worker API 不可达。',
        '请先 `bun run --cwd worker dev`（或指向可用 VITE_API_BASE_URL），再重试。',
        `detail=${probe.detail}`
      ].join('\n')
    )
    process.exitCode = 2
    return
  }

  const tokenResolved = await resolveAccessToken()
  if (!tokenResolved.ok) {
    console.error(
      [
        '[retrieval-ablation:real] BLOCKED：缺少可用 access token。',
        tokenResolved.detail,
        'tried:',
        ...tokenResolved.tried.map(item => `  - ${item}`),
        '合法路径：',
        '  1) export RETRIEVAL_ABLATION_ACCESS_TOKEN=<扩展 getWorkerApiAccessToken>',
        '  2) 本机 .env.shared.local 含 SUPABASE_* 时自动 mint（不绕过 Worker）',
        '  3) RETRIEVAL_ABLATION_TOKEN_BRIDGE=1 经 localhost 接收扩展推送',
        '不得用 fake embedding 代替本实验结论。'
      ].join('\n')
    )
    process.exitCode = 2
    return
  }

  console.info(
    `[retrieval-ablation:real] tokenSource=${tokenResolved.source} detail=${tokenResolved.detail}`
  )

  const observedModel = { current: null as string | null }
  const report = await runRetrievalAblation({
    embedClient: createWorkerEmbedClient(tokenResolved.token, apiBase, observedModel)
  })
  const summary = formatRetrievalAblationSummary(report)
  console.info(summary)

  if (!report.meta.embedTelemetry || report.meta.embedTelemetry.errorCount > 0) {
    console.error('[retrieval-ablation:real] embed 调用存在失败；报告不可当作完整三策略结论')
    process.exitCode = 1
  }
  if (observedModel.current !== WORKER_EMBEDDING_MODEL_HINT) {
    console.error(
      `[retrieval-ablation:real] 未观测到期望 model=${WORKER_EMBEDDING_MODEL_HINT}（actual=${observedModel.current ?? 'null'}）`
    )
    process.exitCode = 1
  }

  const outDir = resolve(repoRoot, 'docs/audits')
  mkdirSync(outDir, { recursive: true })
  // 默认写入 B2 对齐新快照，不覆盖旧 real-run.json（可用 RETRIEVAL_ABLATION_OUT 覆盖路径）
  const outPath = resolve(
    outDir,
    process.env.RETRIEVAL_ABLATION_OUT?.trim() || '2026-10-L2召回消融-real-run-b2-aligned.json'
  )
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        apiBase,
        tokenSource: tokenResolved.source,
        tokenSourceDetail: tokenResolved.detail,
        observedEmbedModel: observedModel.current,
        summaryLines: summary.split('\n'),
        report
      },
      null,
      2
    ),
    'utf8'
  )
  console.info(`[retrieval-ablation:real] 已写入 ${outPath}`)

  // 故障阈值已在上方设 exitCode；质量阈值（vs_baseline）另计，防「测了但不过问退化」
  if (process.exitCode && process.exitCode !== 0) {
    return
  }

  let gateMode: AblationGateMode
  try {
    gateMode = resolveAblationGateMode(process.env.RETRIEVAL_ABLATION_GATE_MODE)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
    return
  }
  if (gateMode === 'off') {
    console.info(
      '[retrieval-ablation:real] gate=off（仅测量；设 RETRIEVAL_ABLATION_GATE_MODE=vs_baseline 启用质量门禁）'
    )
    return
  }

  const baselinePath = resolveAblationBaselinePath(process.env.RETRIEVAL_ABLATION_BASELINE_PATH)
  if (!existsSync(baselinePath)) {
    console.error(`[retrieval-ablation:real] 基线快照不存在: ${baselinePath}`)
    process.exitCode = 1
    return
  }
  let baselineRaw: unknown
  try {
    baselineRaw = JSON.parse(readFileSync(baselinePath, 'utf8')) as unknown
  } catch (error) {
    console.error(
      `[retrieval-ablation:real] 基线快照无法解析: ${baselinePath}`,
      error instanceof Error ? error.message : error
    )
    process.exitCode = 1
    return
  }
  let baselineReport
  try {
    baselineReport = extractRetrievalAblationReport(baselineRaw)
  } catch (error) {
    console.error(
      `[retrieval-ablation:real] 基线快照结构无效: ${baselinePath}`,
      error instanceof Error ? error.message : error
    )
    process.exitCode = 1
    return
  }
  const compared = compareRetrievalAblationToBaseline({
    current: report,
    baseline: baselineReport
  })
  console.info(formatRetrievalAblationBaselineCompareSummary(compared, { baselinePath }))
  if (!compared.passed) {
    process.exitCode = 2
  }
}

const isDirectBunRun =
  typeof process.argv[1] === 'string' && process.argv[1].includes('run-retrieval-ablation-real.ts')

if (isDirectBunRun) {
  runRetrievalAblationRealCli().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
