import mitt from 'mitt'

/** v4 跨层事件总线；事件名与载荷由具体领域模块定义。 */
type AppEvents = Record<string, unknown>

const eventBus = mitt<AppEvents>()

export const emitEvent = eventBus.emit
export const onEvent = eventBus.on
export const offEvent = eventBus.off
