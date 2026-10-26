import { describe, expect, it } from 'vitest'

import { formatChromeI18nMessage } from '@/infrastructure/i18n/format-chrome-i18n-message'

describe('formatChromeI18nMessage', () => {
  it('替换 $1 $2 与字面 $$', () => {
    expect(formatChromeI18nMessage('Importing $1 / $2', ['3', '10'])).toBe('Importing 3 / 10')
    expect(formatChromeI18nMessage('Price $$5', [])).toBe('Price $5')
    expect(formatChromeI18nMessage('Only $1', 'x')).toBe('Only x')
  })
})
