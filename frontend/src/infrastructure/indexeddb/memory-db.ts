import { memoryDatabaseDefinition } from '@/infrastructure/indexeddb/memory-db-definition'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

let initializePromise: Promise<void> | null = null

/** 初始化 Yiveno Memory DB；重复调用安全。versionchange 关闭连接后可再次打开。 */
export async function initializeMemoryDatabase(): Promise<void> {
  if (indexedDBManager.isOpen()) {
    return
  }

  if (!initializePromise) {
    initializePromise = indexedDBManager
      .initialize(memoryDatabaseDefinition)
      .then(() => {
        // 连接被其它上下文升版本/删库关闭时，允许下次重新 initialize
        indexedDBManager.setConnectionLostHandler(() => {
          initializePromise = null
        })
      })
      .catch(error => {
        initializePromise = null
        throw error
      })
  }

  await initializePromise

  // 竞态：initialize 完成后立刻 versionchange，需再开一次
  if (!indexedDBManager.isOpen()) {
    initializePromise = null
    await initializeMemoryDatabase()
  }
}

/** 重置初始化状态，仅用于测试。 */
export function resetMemoryDatabaseInitializationForTests(): void {
  indexedDBManager.close()
  initializePromise = null
}
