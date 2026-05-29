/**
 * OAuth 请求参数验证
 */

import type { Env } from '../../types/env'
import { errorJson } from '../../utils/response'
import { isAllowedRedirectUri } from '../../utils/validation'
import { getProviderConfig, missingKeys } from './provider-config'

/** 验证 OAuth 回调请求参数 */
export function validateCallbackRequest(
  code: string,
  provider: string,
  redirectUri: string,
  env: Env,
  origin: string | null
): Response | null {
  if (!code) return errorJson({ error: 'missing code' }, 400, origin)
  if (!['google', 'microsoft'].includes(provider)) {
    return errorJson({ error: `unsupported provider: ${provider}` }, 400, origin)
  }
  if (!redirectUri) return errorJson({ error: 'missing redirect_uri' }, 400, origin)
  const redirCheck = isAllowedRedirectUri(redirectUri, env)
  if (!redirCheck.ok)
    return errorJson({ error: `invalid redirect_uri: ${redirCheck.error}` }, 400, origin)
  const cfg = getProviderConfig(provider, env)
  if (!cfg) {
    return errorJson(
      { error: `provider not configured: ${provider}`, missing: missingKeys(provider, env, true) },
      400,
      origin
    )
  }
  return null
}

/** 验证 OAuth 开始请求参数 */
export function validateStartParams(
  redirectUri: string,
  provider: string,
  env: Env,
  origin: string | null
): Response | null {
  if (!redirectUri) return errorJson({ error: 'missing redirect_uri' }, 400, origin)
  const redirCheck = isAllowedRedirectUri(redirectUri, env)
  if (!redirCheck.ok)
    return errorJson({ error: `invalid redirect_uri: ${redirCheck.error}` }, 400, origin)
  if (!['google', 'microsoft'].includes(provider)) {
    return errorJson({ error: `unsupported provider: ${provider}` }, 400, origin)
  }
  const cfg = getProviderConfig(provider, env)
  if (!cfg) {
    return errorJson(
      { error: `provider not configured: ${provider}`, missing: missingKeys(provider, env) },
      400,
      origin
    )
  }
  return null
}
