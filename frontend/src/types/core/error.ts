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

/** 全局错误对象定义。 */
export interface AppError {
  /** 错误类型 */
  type: ErrorType
  /** 错误严重级别 */
  severity: ErrorSeverity
  /** 恢复策略 */
  recoveryStrategy: RecoveryStrategy
  /** 给用户看的错误文案 */
  userMessage: string
  /** 用于日志/调试的技术细节 */
  technicalMessage: string
  /** 额外上下文信息 */
  context?: Record<string, unknown>
  /** 原始错误实例（如果存在） */
  originalError?: Error
  /** 业务自定义错误码 */
  code?: string | number
  /** 发生时间戳 */
  timestamp?: number
  /** 堆栈信息 */
  stack?: string
}

/** Store 层常用错误类型。 */
export enum StoreErrorType {
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
  OPERATION_FAILED = 'OPERATION_FAILED',
  /** 系统错误 */
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  /** 未知错误 */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/** Store 错误状态结构，用于 Pinia 管理。 */
export interface StoreErrorState {
  /** 最后一次错误 */
  lastError: AppError | null
  /** 错误历史 */
  errorHistory: AppError[]
  /** 是否正在恢复 */
  isRecovering: boolean
  /** 恢复进度 */
  recoveryProgress: number
}

/** 错误统计数据。 */
export interface ErrorStats {
  /** 总错误数 */
  total: number
  /** 按类型统计 */
  byType: Record<ErrorType, number>
  /** 按严重级别统计 */
  bySeverity: Record<ErrorSeverity, number>
  /** 最近错误列表 */
  recentErrors: AppError[]
}
