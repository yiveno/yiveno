/**
 * 扩展 UI 通识图标：Lucide 线框按需内联（离线、控体积；ISC License）。
 * 增补：从 https://lucide.dev 取图标节点写入下表；禁止图标字体 / CDN / 第二套图标库。
 */

/** Lucide 风格 SVG 子节点：[标签名, 属性表] */
export type AppIconNode = readonly [tag: string, attrs: Readonly<Record<string, string>>]

export const APP_ICON_NAMES = [
  'account_circle',
  'arrow_upward',
  'bookmark',
  'bookmark_add',
  'celebration',
  'check_circle',
  'close',
  'chevron_right',
  'chevron_up',
  'circle_alert',
  'content_copy',
  'delete',
  'download',
  'edit_note',
  'expand_more',
  'flip_vertical',
  'folder',
  'folder_open',
  'format_quote',
  'info',
  'library_books',
  'list_checks',
  'looks_one',
  'looks_two',
  'message_circle_plus',
  'open_in_new',
  'package',
  'refresh',
  'shuffle',
  'settings',
  'stacks',
  'triangle_alert'
] as const

export type AppIconName = (typeof APP_ICON_NAMES)[number]

/** Lucide 默认画布。 */
export const APP_ICON_VIEW_BOX = '0 0 24 24'

/** 登记名 → Lucide 源图标名（custom-* 为步骤序号自研线框）。 */
export const APP_ICON_LUCIDE_SOURCE: Record<AppIconName, string> = {
  account_circle: 'CircleUser',
  arrow_upward: 'ArrowUp',
  bookmark: 'Bookmark',
  bookmark_add: 'BookmarkPlus',
  celebration: 'PartyPopper',
  check_circle: 'CircleCheck',
  close: 'X',
  chevron_right: 'ChevronRight',
  chevron_up: 'ChevronUp',
  circle_alert: 'CircleAlert',
  content_copy: 'Copy',
  delete: 'Trash2',
  download: 'Download',
  edit_note: 'NotebookPen',
  expand_more: 'ChevronDown',
  flip_vertical: 'FlipVertical2',
  folder: 'Folder',
  folder_open: 'FolderOpen',
  format_quote: 'Quote',
  info: 'Info',
  library_books: 'Library',
  list_checks: 'ListChecks',
  looks_one: 'custom-step-1',
  looks_two: 'custom-step-2',
  message_circle_plus: 'MessageCirclePlus',
  open_in_new: 'ExternalLink',
  package: 'Package',
  refresh: 'RefreshCw',
  shuffle: 'Shuffle',
  settings: 'Settings',
  stacks: 'Layers',
  triangle_alert: 'TriangleAlert'
}

/**
 * 子节点表。渲染时统一 fill=none + stroke=currentColor + stroke-width=2
 * （与 Lucide 默认一致；见 AppIcon / selection-toolbar）。
 */
export const APP_ICON_NODES: Record<AppIconName, readonly AppIconNode[]> = {
  account_circle: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['circle', { cx: '12', cy: '10', r: '3' }],
    ['path', { d: 'M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662' }]
  ] as const,
  arrow_upward: [
    ['path', { d: 'm5 12 7-7 7 7' }],
    ['path', { d: 'M12 19V5' }]
  ] as const,
  bookmark: [
    [
      'path',
      {
        d: 'M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z'
      }
    ]
  ] as const,
  bookmark_add: [
    ['path', { d: 'M12 7v6' }],
    ['path', { d: 'M15 10H9' }],
    [
      'path',
      {
        d: 'M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z'
      }
    ]
  ] as const,
  celebration: [
    ['path', { d: 'M5.8 11.3 2 22l10.7-3.79' }],
    ['path', { d: 'M4 3h.01' }],
    ['path', { d: 'M22 8h.01' }],
    ['path', { d: 'M15 2h.01' }],
    ['path', { d: 'M22 20h.01' }],
    [
      'path',
      {
        d: 'm22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10'
      }
    ],
    ['path', { d: 'm22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17' }],
    ['path', { d: 'm11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7' }],
    [
      'path',
      {
        d: 'M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z'
      }
    ]
  ] as const,
  check_circle: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'm9 12 2 2 4-4' }]
  ] as const,
  close: [
    ['path', { d: 'M18 6 6 18' }],
    ['path', { d: 'm6 6 12 12' }]
  ] as const,
  chevron_right: [['path', { d: 'm9 18 6-6-6-6' }]] as const,
  chevron_up: [['path', { d: 'm18 15-6-6-6 6' }]] as const,
  circle_alert: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['line', { x1: '12', x2: '12', y1: '8', y2: '12' }],
    ['line', { x1: '12', x2: '12.01', y1: '16', y2: '16' }]
  ] as const,
  content_copy: [
    ['rect', { width: '8', height: '4', x: '8', y: '2', rx: '1', ry: '1' }],
    ['path', { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' }]
  ] as const,
  delete: [
    ['path', { d: 'M10 11v6' }],
    ['path', { d: 'M14 11v6' }],
    ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }],
    ['path', { d: 'M3 6h18' }],
    ['path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }]
  ] as const,
  download: [
    ['path', { d: 'M12 15V3' }],
    ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
    ['path', { d: 'm7 10 5 5 5-5' }]
  ] as const,
  edit_note: [
    ['path', { d: 'M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4' }],
    ['path', { d: 'M2 6h4' }],
    ['path', { d: 'M2 10h4' }],
    ['path', { d: 'M2 14h4' }],
    ['path', { d: 'M2 18h4' }],
    [
      'path',
      {
        d: 'M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z'
      }
    ]
  ] as const,
  expand_more: [['path', { d: 'm6 9 6 6 6-6' }]] as const,
  flip_vertical: [
    ['path', { d: 'M12 3v18' }],
    ['path', { d: 'm16 7-4-4-4 4' }],
    ['path', { d: 'M8 17l4 4 4-4' }]
  ] as const,
  folder: [
    [
      'path',
      {
        d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'
      }
    ]
  ] as const,
  folder_open: [
    [
      'path',
      {
        d: 'm6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2'
      }
    ]
  ] as const,
  format_quote: [
    [
      'path',
      {
        d: 'M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z'
      }
    ],
    [
      'path',
      {
        d: 'M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z'
      }
    ]
  ] as const,
  info: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M12 16v-4' }],
    ['path', { d: 'M12 8h.01' }]
  ] as const,
  library_books: [
    ['path', { d: 'm16 6 4 14' }],
    ['path', { d: 'M12 6v14' }],
    ['path', { d: 'M8 8v12' }],
    ['path', { d: 'M4 4v16' }]
  ] as const,
  list_checks: [
    ['path', { d: 'M11 18H3' }],
    ['path', { d: 'M11 12H3' }],
    ['path', { d: 'M11 6H3' }],
    ['path', { d: 'm15 18 2 2 4-4' }],
    ['path', { d: 'm15 12 2 2 4-4' }],
    ['path', { d: 'm15 6 2 2 4-4' }]
  ] as const,
  looks_one: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M10 16V8h2' }],
    ['path', { d: 'M9 16h4' }]
  ] as const,
  looks_two: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M9 9a2 2 0 0 1 2-2h1.5a2 2 0 0 1 0 4H11a2 2 0 0 0 0 4h1.5a2 2 0 0 0 2-2' }]
  ] as const,
  message_circle_plus: [
    [
      'path',
      {
        d: 'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719'
      }
    ],
    ['path', { d: 'M8 12h8' }],
    ['path', { d: 'M12 8v8' }]
  ] as const,
  open_in_new: [
    ['path', { d: 'M15 3h6v6' }],
    ['path', { d: 'M10 14 21 3' }],
    ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }]
  ] as const,
  package: [
    [
      'path',
      {
        d: 'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z'
      }
    ],
    ['path', { d: 'M12 22V12' }],
    ['path', { d: 'm3.3 7 8.7 5 8.7-5' }],
    ['path', { d: 'M7.5 4.27 16.5 9.63' }]
  ] as const,
  refresh: [
    ['path', { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' }],
    ['path', { d: 'M21 3v5h-5' }],
    ['path', { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' }],
    ['path', { d: 'M8 16H3v5' }]
  ] as const,
  shuffle: [
    ['path', { d: 'm18 14 4 4-4 4' }],
    ['path', { d: 'm18 2 4 4-4 4' }],
    ['path', { d: 'M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22' }],
    ['path', { d: 'M2 6h1.9c1.5 0 2.9.9 3.6 2.2' }],
    ['path', { d: 'M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8' }]
  ] as const,
  settings: [
    [
      'path',
      {
        d: 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915'
      }
    ],
    ['circle', { cx: '12', cy: '12', r: '3' }]
  ] as const,
  stacks: [
    [
      'path',
      {
        d: 'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z'
      }
    ],
    ['path', { d: 'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12' }],
    ['path', { d: 'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17' }]
  ] as const,
  triangle_alert: [
    ['path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' }],
    ['path', { d: 'M12 9v4' }],
    ['path', { d: 'M12 17h.01' }]
  ] as const
}

/** 读取已登记图标的 SVG 子节点。 */
export function getAppIconNodes(name: AppIconName): readonly AppIconNode[] {
  return APP_ICON_NODES[name]
}

/** Lucide 统一 viewBox（参数保留：调用方按图标名查询，便于以后按名差异化）。 */
export function getAppIconViewBox(name?: AppIconName): string {
  void name
  return APP_ICON_VIEW_BOX
}
