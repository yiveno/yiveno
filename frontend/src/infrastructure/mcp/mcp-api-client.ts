/**
 * 只读 MCP 偏好同步到 Worker（AI_USAGE_KV）。
 */

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv && fromEnv.length > 0 ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

export async function putMcpReadOnlyRemote(input: {
  accessToken: string
  enabled: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/account/mcp`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${input.accessToken}`
      },
      body: JSON.stringify({ enabled: input.enabled })
    })
    if (!response.ok) {
      const text = await response.text()
      return { ok: false, error: text || `http_${response.status}` }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function getYivenoApiBaseUrlForMcp(): string {
  return getApiBaseUrl()
}
