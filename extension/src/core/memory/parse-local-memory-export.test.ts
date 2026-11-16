import { describe, expect, it } from 'vitest'

import {
  LocalMemoryBackupParseError,
  parseLocalMemoryBackup
} from '@/core/memory/parse-local-memory-export'

describe('parseLocalMemoryBackup', () => {
  it('有效 v1 信封', () => {
    const parsed = parseLocalMemoryBackup(
      JSON.stringify({
        formatVersion: 1,
        ownerId: 'owner-1',
        items: [{ id: 'a' }],
        memoryNotes: [{ id: 'n' }],
        memoryNotesMeta: { ownerId: 'owner-1' }
      })
    )
    expect(parsed.formatVersion).toBe(1)
    expect(parsed.ownerId).toBe('owner-1')
    expect(parsed.items).toHaveLength(1)
    expect(parsed.memoryNotes).toHaveLength(1)
    expect(parsed.memoryNotesMeta).toEqual({ ownerId: 'owner-1' })
  })

  it('历史文件（无 formatVersion / notes / meta）按 v1 接受', () => {
    const parsed = parseLocalMemoryBackup(
      JSON.stringify({
        ownerId: 'owner-legacy',
        items: []
      })
    )
    expect(parsed.formatVersion).toBe(1)
    expect(parsed.memoryNotes).toEqual([])
    expect(parsed.memoryNotesMeta).toBeNull()
  })

  it('formatVersion > 1 → UNSUPPORTED_VERSION', () => {
    expect(() =>
      parseLocalMemoryBackup(
        JSON.stringify({
          formatVersion: 2,
          ownerId: 'owner-1',
          items: []
        })
      )
    ).toThrow(LocalMemoryBackupParseError)
    try {
      parseLocalMemoryBackup(JSON.stringify({ formatVersion: 2, ownerId: 'owner-1', items: [] }))
    } catch (error) {
      expect(error).toBeInstanceOf(LocalMemoryBackupParseError)
      if (error instanceof LocalMemoryBackupParseError) {
        expect(error.errorCode).toBe('LOCAL_IMPORT_UNSUPPORTED_VERSION')
      }
    }
  })

  it('畸形 JSON / 错误形状 → INVALID_FORMAT', () => {
    expect(() => parseLocalMemoryBackup('{')).toThrow(LocalMemoryBackupParseError)
    expect(() => parseLocalMemoryBackup(JSON.stringify({ items: [] }))).toThrow(
      LocalMemoryBackupParseError
    )
    expect(() =>
      parseLocalMemoryBackup(
        JSON.stringify({
          formatVersion: 0,
          ownerId: 'owner-1',
          items: []
        })
      )
    ).toThrow(LocalMemoryBackupParseError)
    expect(() =>
      parseLocalMemoryBackup(
        JSON.stringify({
          ownerId: 'owner-1',
          items: [],
          memoryNotesMeta: []
        })
      )
    ).toThrow(LocalMemoryBackupParseError)
  })
})
