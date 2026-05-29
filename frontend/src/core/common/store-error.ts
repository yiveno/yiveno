/**
 * Store 统一错误处理
 *
 * 职责：
 * - 定义统一的错误类型枚举
 * - 提供结构化的错误信息
 * - 支持错误恢复策略
 * - 生成用户友好的错误消息
 *
 * 设计：
 * - 使用枚举约束错误类型，便于统一处理
 * - 区分用户消息和技术消息
 * - 提供错误严重程度分级
 * - 支持错误上下文和原始错误链
 */

/**
 * Store 错误类型枚举
 *
 * 定义所有可能的错误类型
 */
export enum StoreErrorType {
  /** 网络连接错误 */
  NETWORK_ERROR = "NETWORK_ERROR",
  /** 操作超时错误 */
  TIMEOUT_ERROR = "TIMEOUT_ERROR",

  /** 数据验证错误 */
  DATA_VALIDATION_ERROR = "DATA_VALIDATION_ERROR",
  /** 数据未找到 */
  DATA_NOT_FOUND = "DATA_NOT_FOUND",
  /** 数据同步错误 */
  DATA_SYNC_ERROR = "DATA_SYNC_ERROR",

  /** 权限被拒绝 */
  PERMISSION_DENIED = "PERMISSION_DENIED",
  /** 认证错误 */
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",

  /** 业务逻辑错误 */
  BUSINESS_LOGIC_ERROR = "BUSINESS_LOGIC_ERROR",
  /** 操作失败 */
  OPERATION_FAILED = "OPERATION_FAILED",

  /** 系统错误 */
  SYSTEM_ERROR = "SYSTEM_ERROR",
  /** 未知错误 */
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * 错误严重程度枚举
 */
export enum ErrorSeverity {
  /** 低 - 不影响核心功能 */
  LOW = "LOW",
  /** 中 - 影响部分功能 */
  MEDIUM = "MEDIUM",
  /** 高 - 影响核心功能 */
  HIGH = "HIGH",
  /** 严重 - 系统无法正常工作 */
  CRITICAL = "CRITICAL",
}

/**
 * 错误恢复策略枚举
 */
export enum RecoveryStrategy {
  /** 无恢复策略 */
  NONE = "NONE",
  /** 自动重试 */
  RETRY = "RETRY",
  /** 降级处理 */
  FALLBACK = "FALLBACK",
  /** 需要用户手动处理 */
  MANUAL = "MANUAL",
}

/**
 * 统一错误类
 *
 * 扩展 Error 类，提供结构化的错误信息和恢复策略
 */
export class StoreError extends Error {
  /**
   * 构造函数
   *
   * @param type - 错误类型
   * @param severity - 严重程度
   * @param recoveryStrategy - 恢复策略
   * @param userMessage - 用户友好的错误消息
   * @param technicalMessage - 技术性错误消息
   * @param context - 可选的错误上下文信息
   * @param originalError - 可选的原始错误对象
   */
  constructor(
    public type: StoreErrorType,
    public severity: ErrorSeverity,
    public recoveryStrategy: RecoveryStrategy,
    public userMessage: string,
    public technicalMessage: string,
    public context?: Record<string, unknown>,
    public originalError?: Error,
  ) {
    super(technicalMessage);
    this.name = "StoreError";
  }

  /**
   * 创建用户友好的错误消息
   *
   * @param type - 错误类型
   * @param _context - 错误上下文（预留用于未来扩展）
   * @returns 用户友好的错误消息
   */
  static createUserFriendlyMessage(
    type: StoreErrorType,
    _context?: Record<string, unknown>,
  ): string {
    const messages = {
      [StoreErrorType.NETWORK_ERROR]: "网络连接异常，请检查网络设置",
      [StoreErrorType.TIMEOUT_ERROR]: "操作超时，请稍后重试",
      [StoreErrorType.DATA_VALIDATION_ERROR]: "数据格式错误，请检查输入",
      [StoreErrorType.DATA_NOT_FOUND]: "未找到相关数据",
      [StoreErrorType.DATA_SYNC_ERROR]: "数据同步失败，请刷新页面",
      [StoreErrorType.PERMISSION_DENIED]: "权限不足，请检查权限设置",
      [StoreErrorType.AUTHENTICATION_ERROR]: "身份验证失败，请重新登录",
      [StoreErrorType.BUSINESS_LOGIC_ERROR]: "操作失败，请重试",
      [StoreErrorType.OPERATION_FAILED]: "操作执行失败",
      [StoreErrorType.SYSTEM_ERROR]: "系统错误，请联系技术支持",
      [StoreErrorType.UNKNOWN_ERROR]: "未知错误，请重试",
    };

    return messages[type] || messages[StoreErrorType.UNKNOWN_ERROR];
  }

  /**
   * 转换为 JSON 格式
   *
   * 用于序列化错误信息，便于日志记录和传输
   *
   * @returns 错误的 JSON 表示
   */
  toJSON() {
    return {
      type: this.type,
      severity: this.severity,
      recoveryStrategy: this.recoveryStrategy,
      userMessage: this.userMessage,
      technicalMessage: this.technicalMessage,
      context: this.context,
      originalError: this.originalError?.message,
    };
  }
}

/**
 * Store 错误状态接口
 */
export interface StoreErrorState {
  lastError: StoreError | null;
  errorHistory: StoreError[];
  isRecovering: boolean;
  recoveryProgress: number;
}

/**
 * 创建错误状态
 */
export function createErrorState(): StoreErrorState {
  return {
    lastError: null,
    errorHistory: [],
    isRecovering: false,
    recoveryProgress: 0,
  };
}

/**
 * 数据验证工具类
 */
export class DataValidator {
  /**
   * 检查是否为书签树节点
   */
  static isBookmarkTreeNode(
    obj: unknown,
  ): obj is chrome.bookmarks.BookmarkTreeNode {
    if (!obj || typeof obj !== "object") return false;
    const node = obj as Record<string, unknown>;
    return typeof node.id === "string" && typeof node.title === "string";
  }

  /**
   * 检查是否为书签数组
   */
  static isBookmarkArray(
    arr: unknown,
  ): arr is chrome.bookmarks.BookmarkTreeNode[] {
    return (
      Array.isArray(arr) && arr.every((item) => this.isBookmarkTreeNode(item))
    );
  }

  /**
   * 验证 URL 是否有效
   */
  static validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);

      // 仅允许 http/https
      const protocol = urlObj.protocol.toLowerCase();
      if (!["http:", "https:"].includes(protocol)) return false;

      const host = urlObj.hostname.trim();
      if (!host) return false;

      // 不允许 localhost 或 IPv4 地址作为有效域名
      if (host === "localhost") return false;
      if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;

      const parts = host.split(".");
      // 至少包含一个二级域名 + 顶级域名
      if (parts.length < 2) return false;

      const tld = parts[parts.length - 1];
      const sld = parts[parts.length - 2];
      if (!tld || !sld) return false;

      // 顶级域名需为字母，长度>=2（如 com, cn 等）
      if (!/^[a-z]{2,}$/i.test(tld)) return false;

      // 二级域名与各级标签规则：允许字母数字与连字符，中间最多63字符，首尾为字母数字；支持 punycode（xn--）
      const labelRegex = /^(?:xn--)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
      if (!labelRegex.test(sld)) return false;
      for (const label of parts) {
        if (!labelRegex.test(label)) return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 验证书签节点数据（仅验证有 URL 的书签，文件夹节点无需 URL 验证）
   *
   * @param node - 待验证的节点
   * @returns 如果是有效的书签节点且 URL 有效则返回 true
   */
  static validateBookmarkNode(node: unknown): boolean {
    return this.isBookmarkTreeNode(node) && this.validateUrl(node.url || "");
  }
}
