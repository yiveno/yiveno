/**
 * JWT 工具函数
 *
 * 使用 jose 库处理 JWT 签名和验证
 */

import { SignJWT } from 'jose'

/** 默认 JWT 过期时间（秒）。 */
const DEFAULT_JWT_EXPIRES_IN = 7 * 24 * 60 * 60 // 7 days in seconds

/**
 * 使用 jose 库生成 JWT
 *
 * @param secret - JWT 密钥
 * @param payload - JWT payload
 * @param expiresInSec - 过期时间（秒）
 * @returns JWT 字符串
 */
export async function signJWT(
  secret: string,
  payload: Record<string, unknown>,
  expiresInSec = DEFAULT_JWT_EXPIRES_IN
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret)

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(
      Math.floor(Date.now() / 1000) + Number(expiresInSec || DEFAULT_JWT_EXPIRES_IN)
    )
    .sign(secretKey)

  return jwt
}
