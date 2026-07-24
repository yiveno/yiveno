import { z } from 'zod'

/** MemoryItem 捕获入口。 */
export const CaptureEntrySchema = z.enum([
  'popup',
  'context_menu',
  'selection_toolbar',
  'omnibox',
  'shortcut',
  'sync',
  'import'
])

export type CaptureEntry = z.infer<typeof CaptureEntrySchema>
