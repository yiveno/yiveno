import { describe, expect, it, vi } from 'vitest'

import { resolveRecallShellHandoff } from '@/core/recall/recall-shell-handoff'

describe('resolveRecallShellHandoff', () => {
  it('先调用 openShell 再 writePrefill（保用户手势）', async () => {
    const order: string[] = []
    const result = await resolveRecallShellHandoff({
      openShell: () => {
        order.push('open')
        return Promise.resolve({ ok: true })
      },
      writePrefill: async () => {
        order.push('write')
      }
    })
    expect(order).toEqual(['open', 'write'])
    expect(result).toBe('opened')
  })

  it('开壳失败但预填成功 → prefilled（Panel 已开场景）', async () => {
    const result = await resolveRecallShellHandoff({
      openShell: async () => ({ ok: false, errorCode: 'RECALL_SHELL_OPEN_FAILED' }),
      writePrefill: async () => undefined
    })
    expect(result).toBe('prefilled')
  })

  it('开壳抛错但预填成功 → prefilled', async () => {
    const result = await resolveRecallShellHandoff({
      openShell: async () => {
        throw new Error('gesture')
      },
      writePrefill: async () => undefined
    })
    expect(result).toBe('prefilled')
  })

  it('预填失败且开壳失败 → failed', async () => {
    const result = await resolveRecallShellHandoff({
      openShell: async () => ({ ok: false }),
      writePrefill: async () => {
        throw new Error('storage')
      }
    })
    expect(result).toBe('failed')
  })

  it('预填失败但开壳成功 → opened', async () => {
    const result = await resolveRecallShellHandoff({
      openShell: async () => ({ ok: true }),
      writePrefill: async () => {
        throw new Error('storage')
      }
    })
    expect(result).toBe('opened')
  })

  it('openShell 返回的 Promise 与 write 并行（不串行 await open 再 write）', async () => {
    let writeStarted = false
    let openAwaitedAfterWrite = false
    const openShell = () =>
      new Promise<{ ok: boolean }>(resolve => {
        queueMicrotask(() => {
          openAwaitedAfterWrite = writeStarted
          resolve({ ok: true })
        })
      })
    await resolveRecallShellHandoff({
      openShell,
      writePrefill: async () => {
        writeStarted = true
        await Promise.resolve()
      }
    })
    expect(writeStarted).toBe(true)
    expect(openAwaitedAfterWrite).toBe(true)
  })

  it('openShell 被调用一次', async () => {
    const openShell = vi.fn(async () => ({ ok: true }))
    await resolveRecallShellHandoff({
      openShell,
      writePrefill: async () => undefined
    })
    expect(openShell).toHaveBeenCalledTimes(1)
  })
})
