import { describe, expect, it } from 'vitest'

import {
  applyExtensionManifestHostPermissions,
  EXTENSION_CWS_HOST_PERMISSIONS_DEVELOPMENT,
  EXTENSION_CWS_HOST_PERMISSIONS_PRODUCTION,
  EXTENSION_LOCAL_DEV_API_HOST_PERMISSION,
  resolveExtensionManifestHostPermissions
} from '@/core/extension/extension-manifest-profile'

describe('extension-manifest-profile', () => {
  it('development 含 localhost API', () => {
    const hosts = resolveExtensionManifestHostPermissions('development')
    expect(hosts).toContain(EXTENSION_LOCAL_DEV_API_HOST_PERMISSION)
    expect([...hosts].sort()).toEqual([...EXTENSION_CWS_HOST_PERMISSIONS_DEVELOPMENT].sort())
  })

  it('production 剔除 localhost API', () => {
    const hosts = resolveExtensionManifestHostPermissions('production')
    expect(hosts).not.toContain(EXTENSION_LOCAL_DEV_API_HOST_PERMISSION)
    expect([...hosts]).toEqual([...EXTENSION_CWS_HOST_PERMISSIONS_PRODUCTION])
  })

  it('applyExtensionManifestHostPermissions 仅改 host_permissions', () => {
    const base = { version: '4.0.0', host_permissions: ['http://localhost:8787/*'] }
    const next = applyExtensionManifestHostPermissions(base, 'production')
    expect(next.version).toBe('4.0.0')
    expect(next.host_permissions).toEqual([...EXTENSION_CWS_HOST_PERMISSIONS_PRODUCTION])
  })
})
