/**
 * 开发用：从 chrome.storage.local 读取 LLM API Key，供线索理解调用。
 * 正式 Pro 托管接入前的本地开关；不得在 UI 暗示已对普通用户上线。
 */

import { z } from 'zod'

import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

const DEV_LLM_CONFIG_KEY = 'yiveno.dev.clueLlm'

const DevClueLlmConfigSchema = z.object({
  /** OpenAI 兼容 API Key */
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
  model: z.string().min(1).optional(),
  /** 显式关闭语义 LLM（即使有 key） */
  enabled: z.boolean().optional()
})

export type DevClueLlmConfig = z.infer<typeof DevClueLlmConfigSchema>

/** 读取开发用线索 LLM 配置；无或未启用则 null。 */
export async function readDevClueLlmConfig(): Promise<DevClueLlmConfig | null> {
  const parsed = await readChromeStorageLocal(DEV_LLM_CONFIG_KEY, DevClueLlmConfigSchema)
  if (!parsed || parsed.enabled === false) {
    return null
  }
  if (!parsed.apiKey.trim()) {
    return null
  }
  return parsed
}

/** 写入开发用配置（调试脚本 / 扩展控制台）。 */
export async function writeDevClueLlmConfig(config: DevClueLlmConfig): Promise<void> {
  await writeChromeStorageLocal(DEV_LLM_CONFIG_KEY, DevClueLlmConfigSchema.parse(config))
}
