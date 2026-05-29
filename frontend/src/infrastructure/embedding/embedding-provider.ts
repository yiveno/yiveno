/**
 * Embedding Provider 抽象接口
 *
 * 统一本地 ONNX（方案2）和 Chrome Built-in AI（方案1）的调用方式，
 * 便于未来无缝切换。
 */

export interface EmbeddingProvider {
  /** Provider 名称，用于日志和调试 */
  readonly name: string

  /** 检查当前环境是否支持此 Provider */
  isAvailable(): Promise<boolean>

  /**
   * 生成单条文本的 embedding 向量
   * @param text 输入文本
   * @returns 归一化后的浮点数向量
   */
  embed(text: string): Promise<number[]>

  /**
   * 批量生成 embedding（可选优化，默认串行调用 embed）
   * @param texts 输入文本数组
   * @returns 向量数组，顺序与输入一致
   */
  embedBatch?(texts: string[]): Promise<number[][]>

  /** 向量维度，用于初始化存储 */
  readonly dimensions: number
}
