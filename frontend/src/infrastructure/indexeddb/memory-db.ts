import { memoryDatabaseDefinition } from '@/infrastructure/indexeddb/memory-db-definition'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

let initializePromise: Promise<void> | null = null

/** 初始化 Yiveno Memory DB；重复调用安全。 */
export async function initializeMemoryDatabase(): Promise<void> {
  if (!initializePromise) {
    initializePromise = indexedDBManager.initialize(memoryDatabaseDefinition)
  }

  await initializePromise
}

/** 重置初始化状态，仅用于测试。 */
export function resetMemoryDatabaseInitializationForTests(): void {
  indexedDBManager.close()
  initializePromise = null
}
