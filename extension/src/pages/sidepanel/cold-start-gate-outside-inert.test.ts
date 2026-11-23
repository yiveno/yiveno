import { describe, expect, it } from 'vitest'

import {
  collectColdStartGateOutsideInertTargets,
  setColdStartGateOutsideInert
} from '@/pages/sidepanel/cold-start-gate-outside-inert'

/** 复刻 Side Panel：Gate 与 header / scroll-region 同为 main.recall-shell 子元素。 */
function buildFixture(): {
  root: HTMLElement
  header: HTMLElement
  scrollRegion: HTMLElement
  main: HTMLElement
} {
  document.body.innerHTML = ''
  const main = document.createElement('main')
  main.className = 'recall-shell'

  const root = document.createElement('div')
  root.className = 'cold-start-gate'
  main.appendChild(root)

  const header = document.createElement('header')
  header.className = 'recall-header'
  main.appendChild(header)

  const scrollRegion = document.createElement('div')
  scrollRegion.className = 'recall-scroll-region'
  main.appendChild(scrollRegion)

  document.body.appendChild(main)

  return { root, header, scrollRegion, main }
}

describe('collectColdStartGateOutsideInertTargets', () => {
  it('排除 Gate 自身，收集 main 下外侧兄弟', () => {
    const { root, header, scrollRegion, main } = buildFixture()
    const targets = collectColdStartGateOutsideInertTargets(root)

    expect(targets).toContain(header)
    expect(targets).toContain(scrollRegion)
    expect(targets).not.toContain(root)
    expect(targets).not.toContain(main)
  })
})

describe('setColdStartGateOutsideInert', () => {
  it('展开时外侧有 inert、Gate 无 inert；关闭时清除', () => {
    const { root, header, scrollRegion } = buildFixture()

    setColdStartGateOutsideInert(root, true)
    expect(header.hasAttribute('inert')).toBe(true)
    expect(scrollRegion.hasAttribute('inert')).toBe(true)
    expect(root.hasAttribute('inert')).toBe(false)

    setColdStartGateOutsideInert(root, false)
    expect(header.hasAttribute('inert')).toBe(false)
    expect(scrollRegion.hasAttribute('inert')).toBe(false)
  })
})
