/**
 * 认证相关验证器
 */

import type { ValidationResult } from './types'

/**
 * 邮箱格式验证
 */
export function validateEmail(email: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const valid = emailRegex.test(email)

  if (valid) {
    return { valid: true }
  }

  return {
    valid: false,
    message: '邮箱格式不正确'
  }
}

/**
 * 密码强度验证
 * 要求：至少8位，包含字母和数字
 */
export function validatePassword(password: string): ValidationResult {
  if (password.length < 8) {
    return {
      valid: false,
      message: '密码长度不足，必须至少8位'
    }
  }

  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)

  if (!hasLetter || !hasNumber) {
    return {
      valid: false,
      message: '密码必须包含字母和数字'
    }
  }

  return {
    valid: true
  }
}

/**
 * 辅助函数：检查邮箱是否有效（仅格式）
 */
export function isEmailValid(email: string): boolean {
  return validateEmail(email).valid
}

/**
 * 辅助函数：检查密码是否有效
 */
export function isPasswordValid(password: string): boolean {
  return validatePassword(password).valid
}

/**
 * 获取密码错误消息
 */
export function getPasswordErrorMessage(password: string): string {
  return validatePassword(password).message || ''
}
