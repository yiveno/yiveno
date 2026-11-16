/**
 * 线索理解用 LLM completer 注册表（Background 进程内）。
 * 无注册时理解层对 semantic 降级规则。
 */

import type {
  LlmChatCompleter,
  LlmChatCompleterDetailed
} from '@/core/recall/understand/parse-recall-clue-with-llm'

let registeredCompleter: LlmChatCompleter | null = null
let registeredCompleterDetailed: LlmChatCompleterDetailed | null = null

/** 注册 completer；传 null 清空。 */
export function setClueLlmCompleter(completer: LlmChatCompleter | null): void {
  registeredCompleter = completer
}

/** 读取当前 completer。 */
export function getClueLlmCompleter(): LlmChatCompleter | null {
  return registeredCompleter
}

/** 注册 detailed completer（Q7 计量）；传 null 清空。 */
export function setClueLlmCompleterDetailed(completer: LlmChatCompleterDetailed | null): void {
  registeredCompleterDetailed = completer
}

/** 读取当前 detailed completer。 */
export function getClueLlmCompleterDetailed(): LlmChatCompleterDetailed | null {
  return registeredCompleterDetailed
}
