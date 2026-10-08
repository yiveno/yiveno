/**
 * production：recall / inspect DEV expose 替身。
 * 仅暴露空函数，调用方在 dev 条件分支下注册；prod 构建不会把真实实现拉进来。
 */
export function exposeRecallProbeSeedDebug(): void {
  // no-op
}
