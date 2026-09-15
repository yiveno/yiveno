/**
 * 扩展业务日志 scope 闭集（控制台首行 `[Yiveno:<scope>]`）。
 *
 * **权威源：** 新增 / 改名 / 废弃 scope → **先改本文件**，再接线调用点。
 * 禁止在 `logger` / `flow-log` 调用处自由发明未登记字符串。
 *
 * 过滤：DevTools / chrome://extensions 搜 `Yiveno:` 或具体 scope（如 `MemoryEmbed`）。
 */

export const LOG_SCOPES = [
  'Account', // 账号删除等云端账号操作
  'Auth', // 登录 / session / OAuth / 官网 handoff
  'Background', // SW 启动、bootstrap、安装更新
  'Capture', // Capture 书签 / 摘录 / 选区
  'ChromeBookmarkImport', // Chrome 书签 bulk 灌库导入
  'ChromeBookmarkSync', // Chrome 书签增量同步 / reconcile
  'ChromeStorageLocal', // chrome.storage.local 读写校验
  'ChromeStorageQuota', // chrome.storage 用量采样 / 告警
  'ChromeStorageSession', // chrome.storage.session 读写校验
  'ClueLlm', // 线索理解 LLM（托管 / 代理 / 配额）
  'ColdStart', // 冷启动 pipeline / 存量迁移 / 门禁
  'Commands', // 快捷键命令注册与分发
  'ContextMenu', // 右键选区菜单
  'Data', // 本机数据清除等用户数据操作
  'DetailExport', // Memory detail export 导出
  'DevMemory', // DEV：Memory 调试（如回溯 savedAt）
  'DevProbe', // DEV：召回探针种库 / 清理 / 盘点
  'Embed', // Worker embed HTTP 请求
  'ExtensionTab', // 打开扩展页标签
  'Identity', // 本地身份 / owner 桶 / 归并
  'Import', // 通用导入编排（非第三方专用）
  'IndexedDbQuota', // IndexedDB 写配额熔断
  'Mcp', // 只读 MCP 召回证据包
  'Memory', // Memory 条目 CRUD / 候选扫描
  'MemoryEmbed', // 本机异步 / 回填 embedding 队列
  'MemoryEnrichment', // 本机异步 LLM enrichment
  'MemoryEnrichmentBackfill', // 存量 enrichment 规则回填
  'MemorySync', // Memory 云同步 pull/push/replace
  'Msg', // background 消息分发
  'Nav', // 标签页导航打开
  'Omnibox', // 地址栏 Omnibox 找回
  'Onboarding', // 安装后引导页
  'Privacy', // 隐私 ACK / 删云记忆 / 删账号 / 本机导出
  'Recall', // Recall 服务选型与主入口
  'RecallFlow', // Recall 理解流水线 trace
  'RecallOutcome', // Recall 会话结果结算
  'RecallTelemetry', // Recall 本机遥测追加
  'Settings', // 用户设置读写 / 托管配额展示
  'SidePanel', // Side Panel 行为配置与打开
  'Subscription', // 云端订阅拉取 / 快照刷新
  'ThirdPartyImport', // Raindrop / Pocket 等第三方导入
  'i18n' // 扩展文案 key 缺失 / 未解析告警
] as const

/** 日志 scope（闭集）。 */
export type LogScope = (typeof LOG_SCOPES)[number]

const LOG_SCOPE_SET: ReadonlySet<string> = new Set(LOG_SCOPES)

/** 运行时判断是否为已登记 scope（迁移 / 校验用）。 */
export function isLogScope(value: string): value is LogScope {
  return LOG_SCOPE_SET.has(value)
}
