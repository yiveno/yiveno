import type { ChromeBookmarkTreeInput } from '@/core/memory/bookmark-library-tree'

/** 合成 Chrome 书签树，供性能基准与单测。 */
export function buildSyntheticChromeBookmarkTree(bookmarkCount: number): ChromeBookmarkTreeInput[] {
  const barChildren: ChromeBookmarkTreeInput[] = []
  const folders = Math.max(1, Math.ceil(bookmarkCount / 200))

  for (let folderIndex = 0; folderIndex < folders; folderIndex += 1) {
    const folderId = `folder-${folderIndex}`
    const children: ChromeBookmarkTreeInput[] = []
    const start = folderIndex * 200
    const end = Math.min(bookmarkCount, start + 200)
    for (let i = start; i < end; i += 1) {
      children.push({
        id: `bookmark-${i}`,
        title: `Bookmark ${i}`,
        url: `https://example.com/page/${i}`
      })
    }
    barChildren.push({
      id: folderId,
      title: `Folder ${folderIndex}`,
      children
    })
  }

  return [
    {
      id: '0',
      title: '',
      children: [
        {
          id: '1',
          title: 'Bookmarks bar',
          children: barChildren
        },
        {
          id: '2',
          title: 'Other bookmarks',
          children: []
        }
      ]
    }
  ]
}
