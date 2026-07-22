/**
 * IndexedDB 唯一访问入口。
 *
 * v4 暂不预设任何业务表；MemoryItem 模块落地时必须通过此管理器注册 schema
 * 并执行所有事务，避免领域代码直接调用原生 IndexedDB API。
 */
export interface IndexedDBDefinition {
  name: string
  version: number
  upgrade: (database: IDBDatabase, transaction: IDBTransaction, oldVersion: number) => void
}

/** 将 IndexedDB 请求转换为 Promise。 */
export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 请求失败'))
  })
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB 事务失败'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB 事务已取消'))
  })
}

export class IndexedDBManager {
  private database: IDBDatabase | null = null
  private definition: IndexedDBDefinition | null = null

  /** 初始化数据库；同一运行时只能使用一个 schema 定义。 */
  async initialize(definition: IndexedDBDefinition): Promise<void> {
    if (this.database) {
      if (
        this.definition?.name !== definition.name ||
        this.definition.version !== definition.version
      ) {
        throw new Error('IndexedDB 已使用其他 schema 初始化')
      }
      return
    }

    this.definition = definition
    this.database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(definition.name, definition.version)
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        definition.upgrade(request.result, request.transaction!, event.oldVersion)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB 初始化失败'))
    })
  }

  /** 在指定表上执行事务。 */
  async withTransaction<T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    action: (transaction: IDBTransaction) => Promise<T>
  ): Promise<T> {
    if (!this.database) {
      throw new Error('IndexedDB 尚未初始化')
    }

    const transaction = this.database.transaction(storeNames, mode)
    const completion = waitForTransaction(transaction)
    const result = await action(transaction)
    await completion
    return result
  }

  /** 关闭当前连接，主要用于测试与扩展上下文销毁。 */
  close(): void {
    this.database?.close()
    this.database = null
    this.definition = null
  }
}

export const indexedDBManager = new IndexedDBManager()
