import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getAuthSessionMock = vi.hoisted(() => vi.fn())
const readWebsiteAuthUiStateMock = vi.hoisted(() => vi.fn())

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  getAuthSession: getAuthSessionMock
}))

vi.mock('@/infrastructure/auth/website-auth-ui-storage', () => ({
  readWebsiteAuthUiState: readWebsiteAuthUiStateMock
}))

describe('openWebsiteAccountPage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_WEBSITE_URL', 'http://localhost:3001')
    getAuthSessionMock.mockReset()
    readWebsiteAuthUiStateMock.mockReset()
    getAuthSessionMock.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      userId: '22222222-2222-4222-8222-222222222222'
    })
    readWebsiteAuthUiStateMock.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('官网已是同一账号 → 直接 /account', async () => {
    readWebsiteAuthUiStateMock.mockResolvedValue({
      signedIn: true,
      userId: '22222222-2222-4222-8222-222222222222',
      at: Date.now()
    })
    const tabsCreate = vi.fn().mockResolvedValue({ id: 1 })
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-id-1' },
      tabs: {
        query: vi.fn().mockResolvedValue([]),
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

  it('官网未登录 → /auth/from-extension 反向接通', async () => {
    readWebsiteAuthUiStateMock.mockResolvedValue({
      signedIn: false,
      at: Date.now()
    })
    const tabsCreate = vi.fn().mockResolvedValue({ id: 1 })
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-id-1' },
      tabs: {
        query: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        create: tabsCreate
      },
      windows: { update: vi.fn() }
    })

    const { openWebsiteAccountPage } = await import('@/infrastructure/browser/website-page')
    await openWebsiteAccountPage()

    expect(tabsCreate).toHaveBeenCalledWith({
      url: 'http://localhost:3001/auth/from-extension?extension_id=ext-id-1&next=%2Faccount',
      active: true
    })
  })

  it('同账号已在 /account → 只激活', async () => {
    readWebsiteAuthUiStateMock.mockResolvedValue({
      signedIn: true,
      userId: '22222222-2222-4222-8222-222222222222',
      at: Date.now()
    })
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
})

describe('openWebsiteAccountConnectPage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_WEBSITE_URL', 'http://localhost:3001')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('打开账户页并带 connect_extension', async () => {
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-id-1', lastError: undefined },
      tabs: {
        query: vi.fn(async () => []),
        create: vi.fn(async () => ({ id: 1 })),
        update: vi.fn()
      },
      windows: { update: vi.fn() }
    })

    const { openWebsiteAccountConnectPage } = await import('@/infrastructure/browser/website-page')
    await openWebsiteAccountConnectPage()

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'http://localhost:3001/account?connect_extension=1&extension_id=ext-id-1',
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
