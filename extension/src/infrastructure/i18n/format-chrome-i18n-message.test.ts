import { describe, expect, it } from 'vitest'

import { formatChromeI18nMessage } from '@/infrastructure/i18n/format-chrome-i18n-message'

describe('formatChromeI18nMessage', () => {
  it('替换 $1 $2 与字面 $$', () => {
    expect(formatChromeI18nMessage('Importing $1 / $2', ['3', '10'])).toBe('Importing 3 / 10')
    expect(formatChromeI18nMessage('Price $$5', [])).toBe('Price $5')
    expect(formatChromeI18nMessage('Only $1', 'x')).toBe('Only x')
  })

  it('经 placeholders 展开命名占位后再换 $1（对齐 chrome.i18n）', () => {
    expect(
      formatChromeI18nMessage('已选 $count$', ['3'], {
        count: { content: '$1' }
      })
    ).toBe('已选 3')
    expect(
      formatChromeI18nMessage('$count$ selected', ['2'], {
        count: { content: '$1' }
      })
    ).toBe('2 selected')
  })

  it('命名占位大小写不敏感', () => {
    expect(
      formatChromeI18nMessage('Hello, $NAME$', ['Alex'], {
        name: { content: '$1' }
      })
    ).toBe('Hello, Alex')
  })

  it('未声明的命名占位原样保留', () => {
    expect(formatChromeI18nMessage('已选 $count$', ['3'])).toBe('已选 $count$')
  })
})
