/**
 * 书签特征规则字典
 *
 * 职责：
 * - 定义所有特征类型
 * - 提供特征的元数据（名称、描述、优先级）
 * - 统一管理特征规则
 *
 * 设计原则：
 * - 单一数据源：所有特征定义都在这里
 * - 易于扩展：新增特征只需在这里添加
 * - 类型安全：使用 TypeScript 确保类型正确
 */

/**
 * 特征标签类型
 *
 * 所有可能的书签特征：
 * - duplicate: 重复书签（URL 完全相同的书签，从第二个开始）
 * - invalid: 无效书签（URL 格式错误的书签）
 * - internal: 内部书签（浏览器内部地址）
 * - outdated: 过时书签（超过 1 年未访问）
 * - untagged: 未分类书签（直接在根目录或书签栏）
 * - untitled: 无标题书签（标题为空或等于 URL）
 */
export type TraitTag = 'duplicate' | 'invalid' | 'internal' | 'outdated' | 'untagged' | 'untitled'

/**
 * 特征元数据
 */
export interface TraitMetadata {
  /** 特征 ID */
  id: TraitTag
  /** 特征名称（中文） */
  name: string
  /** 特征描述 */
  description: string
  /** 特征图标（emoji） */
  icon: string
  /** 优先级（数字越小优先级越高） */
  priority: number
  /** 是否为负面特征（需要用户关注） */
  isNegative: boolean
  /** 检测规则描述 */
  detectionRules: string[]
}

/**
 * 特征规则字典
 *
 * 包含所有特征的完整定义
 */
export const TRAIT_RULES: Record<TraitTag, TraitMetadata> = {
  /**
   * 重复书签
   *
   * 检测规则：
   * 1. URL 完全相同（忽略大小写）
   * 2. 按 dateAdded + index 排序
   * 3. 第一个出现的是原始书签，后续的标记为重复
   */
  duplicate: {
    id: 'duplicate',
    name: '重复书签',
    description: 'URL 完全相同的书签（从第二个开始）',
    icon: '🔄',
    priority: 1,
    isNegative: true,
    detectionRules: [
      'URL 完全相同（忽略大小写）',
      '按 dateAdded + index 排序，第一个是原始书签',
      '后续相同 URL 的标记为重复'
    ]
  },

  /**
   * 无效书签
   *
   * 检测规则：
   * 1. URL 格式错误（协议不是 http/https、域名格式错误、TLD 不完整）
   */
  invalid: {
    id: 'invalid',
    name: '无效书签',
    description: 'URL 格式错误的书签',
    icon: '❌',
    priority: 2,
    isNegative: true,
    detectionRules: [
      'URL 格式错误：协议不是 http/https',
      'URL 格式错误：域名格式不正确',
      'URL 格式错误：TLD 不完整（如 .o 而不是 .org）',
      'HTTP 4xx 错误：404、403 等客户端错误',
      'HTTP 5xx 错误：500、502 等服务器错误',
      '网络错误：DNS 解析失败、连接失败、超时'
    ]
  },

  /**
   * 内部书签
   *
   * 检测规则：
   * 1. chrome:// 协议（Chrome 内部页面）
   * 2. chrome-extension:// 协议（扩展程序页面）
   * 3. about: 协议（浏览器关于页面）
   * 4. file:// 协议（本地文件系统）
   * 5. edge:// 协议（Edge 浏览器内部页面）
   * 6. brave:// 协议（Brave 浏览器内部页面）
   */
  internal: {
    id: 'internal',
    name: '内部书签',
    description: '浏览器内部地址，仅限本浏览器访问',
    icon: '🔒',
    priority: 3,
    isNegative: false,
    detectionRules: [
      'chrome:// 协议（Chrome 内部页面）',
      'chrome-extension:// 协议（扩展程序页面）',
      'about: 协议（浏览器关于页面）',
      'file:// 协议（本地文件系统）',
      'edge:// 协议（Edge 浏览器）',
      'brave:// 协议（Brave 浏览器）'
    ]
  },

  /**
   * 过时书签
   *
   * 检测规则：
   * 1. 超过 1 年（365 天）未访问
   * 2. 如果没有 lastVisited，使用 dateAdded 判断
   * 3. 文件夹不检测此特征
   */
  outdated: {
    id: 'outdated',
    name: '过时书签',
    description: '超过 1 年未访问的书签',
    icon: '📅',
    priority: 4,
    isNegative: true,
    detectionRules: [
      '超过 365 天未访问（基于 lastVisited）',
      '如果没有 lastVisited，使用 dateAdded 判断',
      '文件夹不检测此特征'
    ]
  },

  /**
   * 未分类书签
   *
   * 检测规则：
   * 1. 直接在根目录（parentId 为 '0'）
   * 2. 直接在书签栏（parentId 为 '1'）
   * 3. 路径深度 <= 1（根目录或书签栏）
   * 4. 文件夹不检测此特征
   */
  untagged: {
    id: 'untagged',
    name: '未分类书签',
    description: '直接在根目录或书签栏，未整理到文件夹',
    icon: '📂',
    priority: 5,
    isNegative: true,
    detectionRules: [
      '直接在根目录（parentId 为 "0"）',
      '直接在书签栏（parentId 为 "1"）',
      '路径深度 <= 1',
      '文件夹不检测此特征'
    ]
  },

  /**
   * 无标题书签
   *
   * 检测规则：
   * 1. 标题为空字符串
   * 2. 标题只包含空格
   * 3. 标题等于 URL（未自定义标题）
   * 4. 标题为默认值（如 "Untitled"、"无标题"）
   * 5. 文件夹不检测此特征
   */
  untitled: {
    id: 'untitled',
    name: '无标题书签',
    description: '标题为空或等于 URL，未添加有意义的标题',
    icon: '✏️',
    priority: 6,
    isNegative: true,
    detectionRules: [
      '标题为空字符串或只包含空格',
      '标题等于 URL（未自定义标题）',
      '标题为默认值（"Untitled"、"无标题"等）',
      '文件夹不检测此特征'
    ]
  }
}

/**
 * 特征标签优先级顺序
 *
 * 用于排序显示，优先级高的排在前面
 */
export const TRAIT_TAG_ORDER: TraitTag[] = [
  'duplicate',
  'invalid',
  'internal',
  'outdated',
  'untagged',
  'untitled'
]
