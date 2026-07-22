import { logger } from '@/infrastructure/logging/logger'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'

/** Background 启动时初始化本地身份等基础设施。 */
export async function bootstrapBackground(): Promise<void> {
  const profile = await getOrCreateLocalProfile()
  const ownerId = await getCurrentOwnerId()

  logger.info('Background', '本地身份已就绪', {
    localProfileId: profile.localProfileId,
    ownerId
  })
}
