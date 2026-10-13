/**
 * 带稳定 errorCode 的业务错误（可跨 application → handler 传递）。
 */
export class CodedError extends Error {
  readonly errorCode: string

  constructor(errorCode: string, message?: string) {
    super(message ?? errorCode)
    this.name = 'CodedError'
    this.errorCode = errorCode
  }
}

/** 判断是否为带 errorCode 的错误。 */
export function isCodedError(error: unknown): error is CodedError {
  return error instanceof CodedError
}
