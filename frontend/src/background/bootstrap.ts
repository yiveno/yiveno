import { logger } from '@/infrastructure/logging/logger'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'

/** Background 启动时初始化本地身份等基础设施。 */
export async function bootstrapBackground(): Promise<void> {
  const [profile, ownerId] = await Promise.all([getOrCreateLocalProfile(), getCurrentOwnerId()])

  await initializeMemoryDatabase()

  logger.info('Background', '本地身份与 Memory DB 已就绪', {
    localProfileId: profile.localProfileId,
    ownerId,
    database: 'YivenoMemoryDB'
  })
}
