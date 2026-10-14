import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('openWebsiteAccountPage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_WEBSITE_URL', 'http://localhost:3001')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('已有 /account 标签则激活，不 create', async () => {
    const tabsUpdate = vi.fn().mockResolvedValue({})
    const windowsUpdate = vi.fn().mockResolvedValue({})
    const tabsCreate = vi.fn()
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-id-1' },
      tabs: {
        query: vi.fn().mockResolvedValue([
          {
            id: 9,
            windowId: 1,
            url: 'http://localhost:3001/account?extension_connected=1'
          }
        ]),
        update: tabsUpdate,
        create: tabsCreate
      },
      windows: { update: windowsUpdate }
    })

    const { openWebsiteAccountPage } = await import('@/infrastructure/browser/website-page')
    await openWebsiteAccountPage()

    expect(tabsCreate).not.toHaveBeenCalled()
    expect(tabsUpdate).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        url: 'http://localhost:3001/account?extension_id=ext-id-1',
        active: true
      })
    )
    expect(windowsUpdate).toHaveBeenCalledWith(1, { focused: true })
  })

  it('同 extension_id 已在 URL 时只激活不改址', async () => {
    const tabsUpdate = vi.fn().mockResolvedValue({})
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-id-1' },
      tabs: {
        query: vi.fn().mockResolvedValue([
          {
            id: 3,
            windowId: 2,
            url: 'http://localhost:3001/account?extension_id=ext-id-1'
          }
        ]),
        update: tabsUpdate,
        create: vi.fn()
      },
      windows: { update: vi.fn().mockResolvedValue({}) }
    })

    const { openWebsiteAccountPage } = await import('@/infrastructure/browser/website-page')
    await openWebsiteAccountPage()

    expect(tabsUpdate).toHaveBeenCalledWith(3, { active: true })
  })

  it('无账户标签则 create', async () => {
    const tabsCreate = vi.fn().mockResolvedValue({ id: 1 })
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-id-1' },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 1, url: 'http://localhost:3001/pricing' }]),
        update: vi.fn(),
        create: tabsCreate
      },
      windows: { update: vi.fn() }
    })

    const { openWebsiteAccountPage } = await import('@/infrastructure/browser/website-page')
    await openWebsiteAccountPage()

    expect(tabsCreate).toHaveBeenCalledWith({
      url: 'http://localhost:3001/account?extension_id=ext-id-1',
      active: true
    })
  })
})

describe('openWebsiteLoginPage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_WEBSITE_URL', 'http://localhost:3001')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('已有 /login 标签则激活，不 create', async () => {
    const tabsUpdate = vi.fn().mockResolvedValue({})
    const windowsUpdate = vi.fn().mockResolvedValue({})
    const tabsCreate = vi.fn()
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-id-1' },
      tabs: {
        query: vi.fn().mockResolvedValue([
          {
            id: 11,
            windowId: 3,
            url: 'http://localhost:3001/login?connect_extension=1&extension_id=ext-id-1'
          }
        ]),
        update: tabsUpdate,
        create: tabsCreate
      },
      windows: { update: windowsUpdate }
    })

    const { openWebsiteLoginPage } = await import('@/infrastructure/browser/website-page')
    await openWebsiteLoginPage(
      'http://localhost:3001/login?connect_extension=1&extension_id=ext-id-1'
    )

    expect(tabsCreate).not.toHaveBeenCalled()
    expect(tabsUpdate).toHaveBeenCalledWith(11, { active: true })
    expect(windowsUpdate).toHaveBeenCalledWith(3, { focused: true })
  })

  it('已有纯 /login 时 Connect 入口改址补参', async () => {
    const tabsUpdate = vi.fn().mockResolvedValue({})
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-id-1' },
      tabs: {
        query: vi.fn().mockResolvedValue([
          {
            id: 12,
            windowId: 1,
            url: 'http://localhost:3001/login'
          }
        ]),
        update: tabsUpdate,
        create: vi.fn()
      },
      windows: { update: vi.fn().mockResolvedValue({}) }
    })

    const { openWebsiteLoginPage } = await import('@/infrastructure/browser/website-page')
    await openWebsiteLoginPage(
      'http://localhost:3001/login?connect_extension=1&extension_id=ext-id-1'
    )

    expect(tabsUpdate).toHaveBeenCalledWith(12, {
      url: 'http://localhost:3001/login?connect_extension=1&extension_id=ext-id-1',
      active: true
    })
  })

  it('无登录标签则 create', async () => {
    const tabsCreate = vi.fn().mockResolvedValue({ id: 1 })
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-id-1' },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 1, url: 'http://localhost:3001/' }]),
        update: vi.fn(),
        create: tabsCreate
      },
      windows: { update: vi.fn() }
    })

    const { openWebsiteLoginPage } = await import('@/infrastructure/browser/website-page')
    await openWebsiteLoginPage(
      'http://localhost:3001/login?connect_extension=1&extension_id=ext-id-1'
    )

    expect(tabsCreate).toHaveBeenCalledWith({
      url: 'http://localhost:3001/login?connect_extension=1&extension_id=ext-id-1',
      active: true
    })
  })
})
