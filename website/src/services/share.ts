const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.ottersage.com'

export interface ShareBookmark {
  title: string
  url: string
  description?: string
  position: number
}

export interface ShareDetail {
  short_code: string
  title: string
  description?: string
  bookmark_count: number
  show_username: boolean
  created_at: string
  bookmarks: ShareBookmark[]
}

export async function getShareDetail(shortCode: string): Promise<ShareDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/api/website/share/${shortCode}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
