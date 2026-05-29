/** IndexedDB 配置入口类型集。 */
export interface IndexedDBConfig {
  /** 数据库名称 */
  name: string
  /** 版本号（升级时自动触发 onupgradeneeded） */
  version: number
  /** 数据库包含的对象仓库 */
  stores: StoreConfig[]
  /** 全局操作超时时间（毫秒） */
  timeout?: number
  /** 是否输出调试日志 */
  debug?: boolean
}

/** 单个对象仓库的配置。 */
export interface StoreConfig {
  /** 仓库名称 */
  name: string
  /** 主键路径，支持联合主键 */
  keyPath: string | string[]
  /** 是否启用自增主键 */
  autoIncrement?: boolean
  /** 需要建立的索引集合 */
  indexes?: IndexConfig[]
}

/** 索引配置 */
export interface IndexConfig {
  /** 索引名称 */
  name: string
  /** 索引键路径 */
  keyPath: string | string[]
  /** 是否唯一索引 */
  unique?: boolean
  /** 是否使用多值条目 */
  multiEntry?: boolean
}

/** 事务模式 */
export type TransactionMode = 'readonly' | 'readwrite' | 'versionchange'

/** 查询可选项 */
export interface QueryOptions {
  /** 使用的索引名称 */
  index?: string
  /** 限定范围 */
  range?: IDBKeyRange
  /** 游标方向 */
  direction?: IDBCursorDirection
  /** 返回记录上限 */
  limit?: number
  /** 偏移量 */
  offset?: number
  /** 过滤函数 */
  filter?: (value: unknown) => boolean
}

/** 批量操作时的配置。 */
export interface BatchOperationConfig {
  /** 每批处理条数 */
  batchSize: number
  /** 是否并行处理 */
  parallel?: boolean
  /** 错误策略 */
  errorStrategy: 'continue' | 'stop' | 'rollback'
  /** 进度回调 */
  onProgress?: (completed: number, total: number) => void
}

/** 数据库版本迁移描述。 */
export interface DatabaseMigration {
  /** 目标版本号 */
  version: number
  /** 升级逻辑 */
  upgrade: (db: IDBDatabase, transaction: IDBTransaction) => void | Promise<void>
  /** 降级逻辑，可选 */
  downgrade?: (db: IDBDatabase, transaction: IDBTransaction) => void | Promise<void>
}

/** 数据库连接状态信息。 */
export interface DatabaseState {
  /** 是否已连接 */
  isConnected: boolean
  /** 是否正在连接 */
  isConnecting: boolean
  /** 数据库名称 */
  name: string
  /** 当前版本号 */
  version: number
  /** 已存在的对象仓库列表 */
  stores: string[]
  /** 最近错误消息 */
  lastError: string | null
}

/** 对象仓库统计信息。 */
export interface StoreStats {
  /** 仓库名称 */
  name: string
  /** 记录数量 */
  count: number
  /** 估算存储空间（字节） */
  estimatedSize?: number
  /** 已建立的索引列表 */
  indexes: string[]
  /** 最后更新时间戳 */
  lastUpdated?: number
}

/** 连接池配置。 */
export interface ConnectionPoolConfig {
  /** 最大连接数 */
  maxConnections: number
  /** 建立连接超时时间（毫秒） */
  connectionTimeout: number
  /** 空闲连接释放时间（毫秒） */
  idleTimeout: number
}

/** 连接池运行时统计。 */
export interface ConnectionPoolStats {
  /** 活跃连接数 */
  activeConnections: number
  /** 空闲连接数 */
  idleConnections: number
  /** 等待任务数量 */
  waitingTasks: number
  /** 总连接数 */
  totalConnections: number
}
