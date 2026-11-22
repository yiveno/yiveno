import { describe, expect, it } from 'vitest'

import {
  collectPageContextOutsideInertTargets,
  setPageContextOutsideInert
} from '@/pages/sidepanel/page-context-outside-inert'

/** 复刻 Side Panel 关键嵌套：root 在 toolbar 内，dock 在 scroll-region 内。 */
function buildFixture(): {
  root: HTMLElement
  composerMain: HTMLElement
  toolbar: HTMLElement
  body: HTMLElement
  floatDock: HTMLElement
  header: HTMLElement
  scrollRegion: HTMLElement
} {
  document.body.innerHTML = ''
  const main = document.createElement('main')
  main.className = 'recall-shell'

  const header = document.createElement('header')
  header.className = 'recall-header'
  main.appendChild(header)

  const scrollRegion = document.createElement('div')
  scrollRegion.className = 'recall-scroll-region'
  main.appendChild(scrollRegion)

  const body = document.createElement('div')
  body.className = 'recall-body'
  scrollRegion.appendChild(body)

  const floatDock = document.createElement('div')
  floatDock.className = 'recall-float-dock'
  scrollRegion.appendChild(floatDock)

  const bottomChrome = document.createElement('div')
  bottomChrome.className = 'recall-bottom-chrome'
  floatDock.appendChild(bottomChrome)

  const dock = document.createElement('div')
  dock.className = 'recall-composer-dock'
  bottomChrome.appendChild(dock)

  const form = document.createElement('div')
  form.className = 'recall-form'
  dock.appendChild(form)

  const shell = document.createElement('div')
  shell.className = 'recall-composer-shell'
  form.appendChild(shell)

  const composerMain = document.createElement('div')
  composerMain.className = 'recall-composer-main'
  shell.appendChild(composerMain)

  const toolbar = document.createElement('div')
  toolbar.className = 'recall-composer-toolbar'
  shell.appendChild(toolbar)

  const root = document.createElement('div')
  root.className = 'page-context'
  toolbar.appendChild(root)

  document.body.appendChild(main)

  return { root, composerMain, toolbar, body, floatDock, header, scrollRegion }
}

describe('collectPageContextOutsideInertTargets', () => {
  it('排除含 root 的 toolbar / float-dock / scroll-region，收集外侧兄弟', () => {
    const { root, composerMain, toolbar, body, floatDock, header, scrollRegion } = buildFixture()
    const targets = collectPageContextOutsideInertTargets(root)

    expect(targets).toContain(composerMain)
    expect(targets).toContain(body)
    expect(targets).toContain(header)
    expect(targets).not.toContain(toolbar)
    expect(targets).not.toContain(floatDock)
    expect(targets).not.toContain(scrollRegion)
    expect(targets).not.toContain(root)
  })
})

describe('setPageContextOutsideInert', () => {
  it('展开时外侧有 inert、root 祖先链无 inert；关闭时清除', () => {
    const { root, composerMain, toolbar, body, header } = buildFixture()

    setPageContextOutsideInert(root, true)
    expect(composerMain.hasAttribute('inert')).toBe(true)
    expect(body.hasAttribute('inert')).toBe(true)
    expect(header.hasAttribute('inert')).toBe(true)
    expect(toolbar.hasAttribute('inert')).toBe(false)
    expect(root.hasAttribute('inert')).toBe(false)
    expect(root.closest('.recall-composer-toolbar')?.hasAttribute('inert')).toBe(false)

    setPageContextOutsideInert(root, false)
    expect(composerMain.hasAttribute('inert')).toBe(false)
    expect(body.hasAttribute('inert')).toBe(false)
    expect(header.hasAttribute('inert')).toBe(false)
  })
})
