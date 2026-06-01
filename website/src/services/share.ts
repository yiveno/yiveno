const API_BASE = import.meta.env.PUBLIC_API_URL || 'https://api.ottersage.com'

export interface ShareData {
  short_code: string
  share_url: string
  title: string
  url: string
  created_at: string
}

export async function getShare(shortCode: string): Promise<ShareData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/website/share/${shortCode}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
