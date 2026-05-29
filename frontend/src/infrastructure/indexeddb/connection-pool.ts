/**
 * IndexedDB 连接池（轻量版）
 *
 * 职责与设计：
 * - 统一管理单个 IDBDatabase 实例，避免在不同模块中重复打开数据库
 * - 由上层管理器（IndexedDBManager）在初始化完成后注入连接
 * - 提供 `getDB()` 的显式访问接口，保证调用方在数据库未初始化时得到明确错误
 * - 不处理升级与版本事件，保持纯粹的连接持有职责，事件由上层管理器统一处理
 *
 * 约束：
 * - 不在此处隐式打开数据库
 * - 不自动重试或降级，所有生命周期管理交由管理器
 * - 仅提供轻量的单例访问，便于在 SW 与前端共享
 */

/**
 * IndexedDB 连接池类
 *
 * 单例模式管理全局唯一的数据库连接
 */
export class IndexedDBConnectionPool {
  /** 单例实例 */
  private static _instance: IndexedDBConnectionPool | null = null
  /** 数据库连接实例 */
  private _db: IDBDatabase | null = null

  /**
   * 获取单例实例
   *
   * @returns 连接池实例
   */
  static get instance(): IndexedDBConnectionPool {
    if (!this._instance) this._instance = new IndexedDBConnectionPool()
    return this._instance
  }

  /**
   * 设置数据库连接
   *
   * 由 IndexedDBManager 在初始化完成后调用
   *
   * @param db - IndexedDB 数据库实例
   */
  setDB(db: IDBDatabase) {
    this._db = db
  }

  /**
   * 获取数据库连接
   *
   * @returns IndexedDB 数据库实例
   * @throws 如果数据库尚未初始化则抛出错误
   */
  getDB(): IDBDatabase {
    if (!this._db) throw new Error('IndexedDBConnectionPool: 数据库尚未初始化')
    return this._db
  }

  /**
   * 关闭数据库连接
   *
   * 清理资源，释放连接
   */
  close(): void {
    if (this._db) {
      this._db.close()
      this._db = null
    }
  }
}

/**
 * 连接池单例实例
 *
 * 全局共享的连接池
 */
export const idbConnectionPool = IndexedDBConnectionPool.instance
