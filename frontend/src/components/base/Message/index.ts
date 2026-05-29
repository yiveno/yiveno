/**
 * Message 组件导出
 *
 * @module components/base/Message
 */

export { default as Message } from "./Message.vue";
export { message, messageService } from "@/application/message/message-service";
export type {
  MessageLevel,
  MessageOptions,
  QueuedMessage,
  MessageServiceConfig,
} from "@/types/application/message";
