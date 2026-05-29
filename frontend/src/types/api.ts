/**
 * API 交互相关的通用类型定义。
 *
 * 约定：所有接口都要返回统一结构，便于前端在错误处理时复用逻辑。
 */
export interface ApiResponse<T> {
  /** 调用是否成功 */
  ok: boolean;
  /** 服务端返回的主体数据 */
  data: T;
  /** HTTP 状态码 */
  status: number;
  /** 额外的响应头信息 */
  headers?: Record<string, string>;
}

/**
 * API 错误统一描述。
 *
 * 用于封装后端返回的错误详情，方便上报与日志记录。
 */
export interface ApiError {
  /** HTTP 状态码或业务错误码 */
  status: number;
  /** 错误简要描述 */
  message: string;
  /** 附加上下文信息（例如校验失败字段） */
  details?: Record<string, unknown>;
}

/**
 * 创建书签时可提交的字段。
 *
 * 对应 `chrome.bookmarks.create` 的参数结构。
 */
export interface BookmarkCreateDetails {
  /** 目标父级 ID，缺省表示根目录 */
  parentId?: string;
  /** 在父级下的插入位置 */
  index?: number;
  /** 书签标题 */
  title?: string;
  /** 书签 URL，文件夹可为空 */
  url?: string;
}

/**
 * 书签移动目的地描述。
 */
export interface BookmarkDestination {
  /** 新的父级 ID */
  parentId?: string;
  /** 在新父级下的索引位置 */
  index?: number;
}

/**
 * 更新书签标题或 URL 时使用的结构。
 */
export interface BookmarkUpdateDetails {
  /** 新标题 */
  title?: string;
  /** 新 URL，文件夹保持为空 */
  url?: string;
}

/**
 * 用户登录响应。
 *
 * 注意：OAuth 登录流程在官网完成，插件通过 Supabase 自动同步 session。
 * 此类型仅用于兼容旧版 API 或特殊场景。
 */
export interface LoginResponse {
  /** 是否登录成功 */
  success: boolean;
  /** 访问令牌（旧字段名，下划线格式） */
  access_token?: string;
  /** 刷新令牌（旧字段名，下划线格式） */
  refresh_token?: string;
  /** 访问令牌（新字段名，驼峰格式） */
  accessToken?: string;
  /** 刷新令牌（新字段名，驼峰格式） */
  refreshToken?: string;
  /** 失败时返回的错误信息 */
  error?: string;
}

/**
 * 仅需确认成功与否的简单响应。
 */
export interface BasicOk {
  /** 操作是否成功 */
  success: boolean;
  /** 失败时的错误信息 */
  error?: string;
}

/**
 * 用户信息查询响应。
 */
export interface MeResponse {
  /** 调用是否成功 */
  success: boolean;
  /** 用户基本资料，可能因未登录而不存在 */
  user?: {
    /** 用户ID */
    id?: string;
    /** 用户邮箱 */
    email: string;
    /** 用户昵称 */
    nickname?: string;
    /** 付费等级 */
    tier: "free" | "pro";
    /** 订阅到期时间戳 */
    expiresAt?: number;
  };
}
