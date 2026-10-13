/**
 * Background bootstrap 门闩（无 listeners / handlers 依赖）。
 *
 * 扩展 SW 禁止动态 `import()`；listeners 须静态 import 本模块，
 * 由 `bootstrap.ts` 绑定真正的启动实现，打断与 bootstrap 实现体的循环依赖。
 */

type BootstrapRunner = () => Promise<void>

let runner: BootstrapRunner | null = null
let bootstrapPromise: Promise<void> | null = null

/** 由 `bootstrap.ts` 在模块加载时绑定启动实现。 */
export function bindBackgroundBootstrapRunner(fn: BootstrapRunner): void {
  runner = fn
}

/** 幂等启动 Background；并发调用合并为一次 bootstrap。 */
export function ensureBackgroundBootstrapped(): Promise<void> {
  if (!bootstrapPromise) {
    if (!runner) {
      return Promise.reject(new Error('Background bootstrap runner 未绑定'))
    }
    const run = runner
    bootstrapPromise = run().catch(error => {
      bootstrapPromise = null
      throw error
    })
  }
  return bootstrapPromise
}

/** 测试用：重置 bootstrap 状态（不清除 runner）。 */
export function resetBackgroundBootstrapForTests(): void {
  bootstrapPromise = null
}
