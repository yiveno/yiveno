/**
 * 书签变更应用服务
 *
 * 职责：
 * - 封装书签变更的规划和执行流程
 * - 计算书签树之间的差异
 * - 执行书签变更操作
 * - 提供统一的错误处理
 *
 * 功能：
 * - 差异计算（planChanges）
 * - 执行变更计划（executePlan）
 * - 一键规划并执行（planAndExecute）
 */

import type { Result } from "@/core/common/result";
import { ok as Ok, err as Err } from "@/core/common/result";
import {
  smartBookmarkDiffEngine,
  type DiffResult,
} from "@/core/bookmark/services/diff-engine";
import {
  SmartBookmarkExecutor,
  type ExecutionResult,
} from "@/core/bookmark/services/executor";
import type { ChromeBookmarkTreeNode, BookmarkNode } from "@/types";
import type { PlanAndExecuteOptions } from "@/types/application/bookmark";

// 使用 core 层的实际类型，而不是 types 中的声明
type CoreDiffResult = DiffResult;
type CoreExecutionResult = ExecutionResult;

/**
 * 书签变更应用服务类
 */
class BookmarkChangeAppService {
  /**
   * 规划书签变更
   *
   * 计算原始树和目标树之间的差异，生成操作计划
   *
   * @param original - 原始书签树
   * @param target - 目标书签树
   * @returns 包含差异结果的 Result 对象
   */
  async planChanges(
    original: ChromeBookmarkTreeNode[],
    target: ChromeBookmarkTreeNode[],
  ): Promise<Result<CoreDiffResult>> {
    try {
      const diff = await smartBookmarkDiffEngine.computeDiff(
        original as BookmarkNode[],
        target as BookmarkNode[],
      );
      return Ok(diff);
    } catch (e: unknown) {
      return Err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * 执行变更计划
   *
   * 根据差异结果执行实际的书签操作
   *
   * @param diffResult - 差异计算结果
   * @param options - 执行选项（包括进度回调、执行器等）
   * @returns 包含执行结果的 Result 对象
   */
  async executePlan(
    diffResult: CoreDiffResult,
    options: PlanAndExecuteOptions = {},
  ): Promise<Result<CoreExecutionResult>> {
    try {
      const executor =
        options.executor instanceof SmartBookmarkExecutor
          ? options.executor
          : new SmartBookmarkExecutor();
      const res = await executor.executeDiff(diffResult, options.onProgress);
      return Ok(res as CoreExecutionResult);
    } catch (e: unknown) {
      return Err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * 规划并执行书签变更
   *
   * 一步完成差异计算和执行，是最常用的接口
   *
   * @param original - 原始书签树
   * @param target - 目标书签树
   * @param options - 执行选项
   * @returns 包含差异和执行结果的 Result 对象
   */
  async planAndExecute(
    original: ChromeBookmarkTreeNode[],
    target: ChromeBookmarkTreeNode[],
    options: PlanAndExecuteOptions = {},
  ): Promise<Result<{ diff: CoreDiffResult; execution: CoreExecutionResult }>> {
    const plan = await this.planChanges(original, target);
    if (!plan.ok) return Err(plan.error);
    const exec = await this.executePlan(plan.value, options);
    if (!exec.ok) return Err(exec.error);
    return Ok({ diff: plan.value, execution: exec.value });
  }
}

/**
 * 书签变更应用服务单例
 *
 * 全局共享的服务实例
 */
export const bookmarkChangeAppService = new BookmarkChangeAppService();
