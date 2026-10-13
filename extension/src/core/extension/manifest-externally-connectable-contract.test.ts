/**
 * Manifest 回归：externally_connectable 与运行时 origin 白名单一致。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { EXTERNAL_AUTH_HANDOFF_MATCH_PATTERNS } from '@/core/extension/externally-connectable-origins'

interface ExtensionManifest {
  externally_connectable?: {
    matches?: string[]
  }
}

const manifestPath = resolve(import.meta.dirname, '../../../public/manifest.json')

function readManifest(): ExtensionManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionManifest
}

describe('manifest externally_connectable 契约', () => {
  it('matches 与权威 origin 表一致', () => {
    const manifest = readManifest()
    expect([...(manifest.externally_connectable?.matches ?? [])].sort()).toEqual(
      [...EXTERNAL_AUTH_HANDOFF_MATCH_PATTERNS].sort()
    )
  })
})
