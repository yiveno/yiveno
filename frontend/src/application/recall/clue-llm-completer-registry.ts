/**
 * 线索理解用 LLM completer 注册表（Background 进程内）。
 * 无注册时理解层对 semantic 降级规则。
 */

import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'

let registeredCompleter: LlmChatCompleter | null = null

/** 注册 completer；传 null 清空。 */
export function setClueLlmCompleter(completer: LlmChatCompleter | null): void {
  registeredCompleter = completer
}

/** 读取当前 completer。 */
export function getClueLlmCompleter(): LlmChatCompleter | null {
  return registeredCompleter
}
