/**
 * 标准化的错误类型枚举。
 */
export enum ErrorType {
  /** 网络错误 */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** 超时错误 */
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  /** 数据验证错误 */
  DATA_VALIDATION_ERROR = 'DATA_VALIDATION_ERROR',
  /** 数据未找到 */
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  /** 数据同步错误 */
  DATA_SYNC_ERROR = 'DATA_SYNC_ERROR',
  /** 权限拒绝 */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  /** 认证错误 */
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  /** 业务逻辑错误 */
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  /** 操作失败 */
  OPERATION_FAILED = 'OPERATION_FAILED',
  /** 系统错误 */
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  /** 未知错误 */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/** 错误严重级别。 */
export enum ErrorSeverity {
  /** 低级错误 */
  LOW = 'LOW',
  /** 中级错误 */
  MEDIUM = 'MEDIUM',
  /** 高级错误 */
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/** 针对错误的降级策略。 */
export enum RecoveryStrategy {
  /** 无恢复策略 */
  NONE = 'NONE',
  /** 重试 */
  RETRY = 'RETRY',
  /** 降级 */
  FALLBACK = 'FALLBACK',
  /** 手动 */
  MANUAL = 'MANUAL'
}
