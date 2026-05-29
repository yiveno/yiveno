/**
 * 后端错误码到前端文案的映射
 *
 * 前后端约定：后端只返回错误码（error 字段），前端根据错误码显示对应的文案
 * 这样可以：
 * 1. 统一管理所有错误文案
 * 2. 便于国际化（i18n）
 * 3. 减少前后端耦合
 * 4. 前端可以根据上下文显示更友好的错误信息
 */

export interface ErrorCodeMap {
  [key: string]: string;
}

/**
 * Supabase 认证错误码映射
 * 参考：https://supabase.com/docs/reference/javascript/auth-error-codes
 */
const SUPABASE_ERROR_CODES: ErrorCodeMap = {
  // 邮箱相关
  // ⚠️ Supabase 安全设计说明：
  // email_address_invalid 在 Supabase 中可能表示两种情况：
  // 1. 真正的邮箱格式错误（如使用了测试域名、示例域名等）
  // 2. 邮箱验证关闭时，已注册邮箱也可能返回此错误码（防止邮箱枚举攻击）
  //
  // Supabase 为了防止攻击者通过尝试注册来探测哪些邮箱已注册（Email Enumeration Attack），
  // 在某些配置下会故意模糊错误信息，返回 email_address_invalid 而不是 email_exists。
  //
  // 官方文档中，email_exists 应该明确表示邮箱已存在，但在实际使用中（特别是邮箱验证关闭时），
  // Supabase 可能返回 email_address_invalid 来保护用户隐私。
  //
  // 因此我们在 useSupabaseAuth.ts 中添加了特殊处理：
  // - 如果邮箱格式正确但返回 email_address_invalid，判断为"可能已注册"
  // - 这里使用通用描述，具体判断由业务逻辑处理
  email_address_invalid: "邮箱地址无效，请检查后重试",
  email_address_not_authorized: "该邮箱未授权，请联系管理员",
  email_already_registered: "该邮箱已被注册，请直接登录或使用其他邮箱",
  email_exists: "该邮箱已被注册，请直接登录或使用其他邮箱",
  email_not_confirmed:
    "请先验证邮箱。请检查您的邮箱并点击验证链接完成注册后才能登录",
  email_not_verified:
    "请先验证邮箱。请检查您的邮箱并点击验证链接完成注册后才能登录",
  email_rate_limit_exceeded:
    "发送邮件过于频繁，请稍后再试（建议等待 15-60 分钟后重试，或使用其他邮箱地址）",
  over_email_send_rate_limit:
    "发送邮件过于频繁，请稍后再试（建议等待 15-60 分钟后重试，或使用其他邮箱地址）",

  // 密码相关
  weak_password: "密码不符合安全要求，必须至少8位，包含字母和数字",
  password_too_short: "密码长度不足，必须至少8位",
  password_requires_uppercase: "密码必须包含至少一个大写字母",
  password_requires_lowercase: "密码必须包含至少一个小写字母",
  password_requires_number: "密码必须包含至少一个数字",
  password_requires_special: "密码必须包含至少一个特殊字符",
  invalid_password: "密码格式不正确",

  // 登录相关
  invalid_credentials: "邮箱或密码错误，请检查后重试。如果刚注册，请先验证邮箱",
  invalid_email: "邮箱格式不正确",
  invalid_email_or_password: "邮箱或密码错误，请检查后重试",
  user_not_found: "用户不存在，请先注册",
  user_not_authorized: "用户未授权，请联系管理员",

  // Token 相关
  invalid_token: "令牌无效，请重新登录",
  expired_token: "令牌已过期，请重新登录",
  invalid_refresh_token: "刷新令牌无效，请重新登录",
  expired_refresh_token: "刷新令牌已过期，请重新登录",
  missing_refresh_token: "缺少刷新令牌",
  token_not_found: "未找到令牌",

  // 注册相关
  signup_disabled: "注册功能已禁用，请联系管理员",
  signup_not_allowed: "注册不允许，请联系管理员",

  // OAuth 相关
  oauth_provider_error: "OAuth 登录失败，请稍后重试",
  oauth_state_mismatch: "OAuth 状态不匹配，请重试",
  oauth_provider_unavailable: "OAuth 服务提供商暂时不可用，请稍后重试",

  // 请求限制
  too_many_requests: "请求过于频繁，请稍后再试",
  rate_limit_exceeded: "操作过于频繁，请稍后再试",

  // 会话相关
  session_not_found: "会话不存在，请重新登录",
  session_expired: "会话已过期，请重新登录",

  // 通用错误
  network_error: "网络连接失败，请检查网络后重试",
  server_error: "服务器错误，请稍后重试",
  unknown_error: "发生未知错误，请稍后重试",
};

/**
 * 后端自定义错误码
 */
const AUTH_ERROR_CODES: ErrorCodeMap = {
  // 注册相关
  email_already_registered: "该邮箱已被注册，请直接登录或使用其他邮箱",
  invalid_email: "邮箱格式不正确",
  weak_password: "密码不符合安全要求，必须至少8位，包含字母和数字",

  // 登录相关
  "invalid email or password": "邮箱或密码错误",
  "account temporarily locked": "账户暂时被锁定，请稍后再试",

  // Token 相关
  "invalid refreshToken": "刷新令牌无效",
  "expired refreshToken": "刷新令牌已过期",
  invalid_token: "令牌无效",
  "invalid or expired token": "令牌无效或已过期",
  "invalid old password": "原密码错误",

  // 授权相关
  unauthorized: "未授权，请先登录",
  forbidden: "没有权限访问该资源",

  // 系统错误
  "database not configured": "数据库未配置",
  "missing refreshToken": "缺少刷新令牌",
  "missing code": "缺少授权码",
  "missing code_verifier": "缺少验证码",
  "missing redirect_uri": "缺少重定向地址",
  "invalid redirect_uri": "无效的重定向地址",
};

/**
 * 通用错误码
 */
const GENERAL_ERROR_CODES: ErrorCodeMap = {
  "Method not allowed": "请求方法不允许",
  "missing prompt or messages": "缺少提示或消息",
  "missing text": "缺少文本内容",
  "missing url": "缺少 URL",
  "missing text or vector": "缺少文本或向量",
  "missing vectors": "缺少向量",
  "no valid vectors": "没有有效的向量",
};

/**
 * 所有错误码映射（合并所有错误码）
 * 优先级：Supabase > 后端自定义 > 通用
 */
export const ERROR_CODE_MAP: ErrorCodeMap = {
  ...GENERAL_ERROR_CODES,
  ...AUTH_ERROR_CODES,
  ...SUPABASE_ERROR_CODES,
};

/**
 * 根据错误码获取错误文案
 *
 * @param errorCode - 后端返回的错误码
 * @param fallback - 如果找不到对应的错误码，返回的默认文案
 * @returns 错误文案
 */
export function getErrorMessage(
  errorCode: string | undefined,
  fallback = "请求失败，请稍后重试",
): string {
  if (!errorCode) {
    return fallback;
  }

  const normalizedCode = errorCode.toLowerCase().trim();

  const directMatch = ERROR_CODE_MAP[normalizedCode];
  if (directMatch) {
    return directMatch;
  }

  const partialMatch = findPartialMatch(normalizedCode);
  if (partialMatch) {
    return partialMatch;
  }

  const heuristicMatch = findHeuristicMatch(normalizedCode);
  if (heuristicMatch) {
    return heuristicMatch;
  }

  return fallback;
}

/**
 * 查找部分匹配的错误码
 */
function findPartialMatch(normalizedCode: string): string | undefined {
  for (const [code, message] of Object.entries(ERROR_CODE_MAP)) {
    if (normalizedCode.includes(code.toLowerCase())) {
      return message;
    }
  }
  return undefined;
}

/**
 * 根据启发式规则查找匹配的错误消息
 */
function findHeuristicMatch(normalizedCode: string): string | undefined {
  if (normalizedCode.includes("email") && normalizedCode.includes("invalid")) {
    return "邮箱格式不正确，请检查后重试";
  }
  if (normalizedCode.includes("password") && normalizedCode.includes("weak")) {
    return "密码不符合安全要求，必须至少8位，包含字母和数字";
  }
  if (normalizedCode.includes("already") || normalizedCode.includes("exists")) {
    return "该邮箱已被注册，请直接登录或使用其他邮箱";
  }
  if (normalizedCode.includes("not found")) {
    return "未找到相关资源";
  }
  if (
    normalizedCode.includes("unauthorized") ||
    normalizedCode.includes("forbidden")
  ) {
    return "未授权，请先登录";
  }
  if (
    normalizedCode.includes("network") ||
    normalizedCode.includes("timeout")
  ) {
    return "网络连接失败，请检查网络后重试";
  }
  return undefined;
}

/**
 * 从错误响应中提取错误码
 * 支持多种错误格式：
 * - Supabase: { code: 'email_address_invalid', message: '...' }
 * - 后端: { error: 'email_already_registered' }
 * - 通用: { code: '...', error: '...' }
 *
 * @param errorData - 错误响应数据
 * @returns 错误码
 */
export function extractErrorCode(errorData: unknown): string | undefined {
  if (!errorData || typeof errorData !== "object") {
    return undefined;
  }

  const data = errorData as {
    error?: string;
    code?: string;
    message?: string;
    status?: string | number;
  };

  // 优先使用 code，然后是 error，最后是 status
  return data.code || data.error || String(data.status || "");
}
