/**
 * 同浏览器官网 ↔ 扩展 UI 状态桥（ADR-019）。
 * 仅 UI 态 / 资料镜像；禁止经本通道传 access/refresh token。
 */
import { z } from 'zod'

/** Port.name；官网 connect / SW onConnectExternal 必须一致。 */
export const UI_BRIDGE_PORT_NAME = 'yiveno-ui-bridge' as const

/** 信封 channel 字面量。 */
export const UI_BRIDGE_CHANNEL = 'yiveno_ui_bridge' as const

/** chrome.storage.session：官网登录 UI 态（Connect 软条等）。 */
export const WEBSITE_AUTH_UI_SESSION_KEY = 'yiveno:website_auth_ui' as const

const OptionalUserIdSchema = z.string().uuid().optional()

/** 官网 → 扩展：网站登录态变更（不带 token）。 */
export const WebsiteAuthChangedSchema = z.object({
  type: z.literal('website_auth_changed'), // 官网登入/登出
  payload: z.object({
    signedIn: z.boolean(), // 官网当前是否有会话
    userId: OptionalUserIdSchema // 已登录时的账号 id
  })
})

/** 官网 → 扩展：资料展示字段变更（头像/昵称）。 */
export const WebsiteProfileChangedSchema = z.object({
  type: z.literal('website_profile_changed'), // 官网改资料
  payload: z.object({
    userId: z.uuid(), // 必须与扩展当前账号一致才应用
    displayName: z.string().trim().min(1).max(200).optional(), // 展示名
    avatarUrl: z.string().url().optional() // 头像 URL
  })
})

/** 扩展 → 官网：扩展登录态 / 展示字段快照。 */
export const ExtensionAuthChangedSchema = z.object({
  type: z.literal('extension_auth_changed'), // 扩展登入/登出/资料
  payload: z.object({
    signedIn: z.boolean(), // 扩展是否已登录
    userId: OptionalUserIdSchema,
    displayName: z.string().trim().min(1).max(200).optional(),
    avatarUrl: z.string().url().optional()
  })
})

/** 握手（连接后各方可推当前快照）。 */
export const BridgeHelloSchema = z.object({
  type: z.literal('bridge_hello'), // 握手
  payload: z.object({
    role: z.enum(['website', 'extension']) // 发送方角色
  })
})

/**
 * 扩展 → 官网：请求用本浏览器官网会话 mint+handoff（零导航优先）。
 * **禁止**带 token；extensionId 仅供 sessionStorage pending。
 */
export const RequestExtensionConnectSchema = z.object({
  type: z.literal('request_extension_connect'), // 扩展请求 Connect
  payload: z.object({
    extensionId: z.string().min(1).max(128) // chrome.runtime.id
  })
})

/** 官网 → 扩展：已收到 Connect 请求并开始处理（防无 tab 时误等）。 */
export const WebsiteConnectAckSchema = z.object({
  type: z.literal('website_connect_ack'), // 官网已接手 Connect
  payload: z.object({}).optional()
})

/** 官网 → 扩展：Connect 终态（成功 / 取消挤掉 / 失败）。 */
export const WebsiteConnectResultSchema = z.object({
  type: z.literal('website_connect_result'), // 官网 Connect 结果
  payload: z.object({
    status: z.enum([
      'ok', // mint+handoff 成功
      'cancelled_displace', // 用户取消挤掉
      'failed', // mint/handoff 失败
      'no_session', // 官网无会话
      'busy' // 已有 Connect 在飞
    ])
  })
})

export const UiBridgeInnerMessageSchema = z.union([
  WebsiteAuthChangedSchema,
  WebsiteProfileChangedSchema,
  ExtensionAuthChangedSchema,
  BridgeHelloSchema,
  RequestExtensionConnectSchema,
  WebsiteConnectAckSchema,
  WebsiteConnectResultSchema
])

/** Port 上传输的完整信封。 */
export const UiBridgeEnvelopeSchema = z.object({
  channel: z.literal(UI_BRIDGE_CHANNEL),
  v: z.literal(1),
  msg: UiBridgeInnerMessageSchema
})

export type UiBridgeInnerMessage = z.infer<typeof UiBridgeInnerMessageSchema>
export type UiBridgeEnvelope = z.infer<typeof UiBridgeEnvelopeSchema>

/** 写入 session 的官网 auth UI 行。 */
export const WebsiteAuthUiStateSchema = z.object({
  signedIn: z.boolean(),
  userId: OptionalUserIdSchema,
  at: z.number().int().nonnegative()
})

export type WebsiteAuthUiState = z.infer<typeof WebsiteAuthUiStateSchema>

/** 构造信封。 */
export function wrapUiBridgeMessage(msg: UiBridgeInnerMessage): UiBridgeEnvelope {
  return { channel: UI_BRIDGE_CHANNEL, v: 1, msg }
}
