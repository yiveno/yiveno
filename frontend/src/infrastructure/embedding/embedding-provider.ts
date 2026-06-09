/**
 * Embedding Provider 抽象接口
 *
 * 本地 ONNX E5 检索模型：query / passage 分离编码。
 */

export interface EmbeddingProvider {
  /** 向量存储用的模型版本键 */
  readonly name: string

  readonly dimensions: number

  isAvailable(): Promise<boolean>

  /** @deprecated 请使用 embedPassage；保留供过渡期兼容 */
  embed(text: string): Promise<number[]>

  /** @deprecated 请使用 embedPassageBatch */
  embedBatch?(texts: string[]): Promise<number[][]>

  /** 编码用户检索查询（E5 query 前缀） */
  embedQuery(text: string): Promise<number[]>

  /** 编码文档 passage（书签、文件夹等） */
  embedPassage(text: string): Promise<number[]>

  /** 批量编码 passage */
  embedPassageBatch(texts: string[]): Promise<number[][]>
}
