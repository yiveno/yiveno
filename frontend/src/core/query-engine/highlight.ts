/**
 * 查询结果高亮引擎
 *
 * 职责：
 * - 在查询结果中高亮显示匹配的关键词
 * - 支持精确匹配和模糊匹配
 * - 处理多个关键词的高亮
 * - 提供 HTML 安全的输出
 *
 * 功能：
 * - 自动分词并查找所有匹配位置
 * - 合并重叠的匹配区域
 * - 生成高亮段落数组
 * - 提取包含匹配的上下文片段
 * - 转换为 HTML 格式
 */

import type { HighlightSegment } from "./query-types";

/**
 * 高亮引擎类
 */
export class HighlightEngine {
  /**
   * 高亮文本中的关键词
   *
   * @param text - 原始文本
   * @param query - 查询字符串
   * @returns 高亮段落数组，包含匹配和未匹配的部分
   */
  highlight(text: string, query: string): HighlightSegment[] {
    if (!text || !query) {
      return [{ text, isMatch: false, start: 0, end: text.length }];
    }

    const segments: HighlightSegment[] = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // 分割查询词
    const queryTerms = this.tokenize(lowerQuery);

    // 查找所有匹配位置
    const matches = this.findMatches(lowerText, queryTerms);

    // 合并重叠的匹配
    const mergedMatches = this.mergeOverlaps(matches);

    // 生成高亮段落
    let lastEnd = 0;
    for (const match of mergedMatches) {
      // 添加未匹配的部分
      if (match.start > lastEnd) {
        segments.push({
          text: text.substring(lastEnd, match.start),
          isMatch: false,
          start: lastEnd,
          end: match.start,
        });
      }

      // 添加匹配的部分
      segments.push({
        text: text.substring(match.start, match.end),
        isMatch: true,
        start: match.start,
        end: match.end,
      });

      lastEnd = match.end;
    }

    // 添加剩余部分
    if (lastEnd < text.length) {
      segments.push({
        text: text.substring(lastEnd),
        isMatch: false,
        start: lastEnd,
        end: text.length,
      });
    }

    return segments.length > 0
      ? segments
      : [{ text, isMatch: false, start: 0, end: text.length }];
  }

  /**
   * 分词
   *
   * 按空格、标点符号等分割文本为词语数组
   *
   * @param text - 待分词的文本
   * @returns 词语数组
   */
  private tokenize(text: string): string[] {
    // 按空格、标点符号等分割
    return text
      .split(/[\s\-_./\\,;:!?]+/)
      .filter((term) => term.length > 0)
      .map((term) => term.trim());
  }

  /**
   * 查找所有匹配位置
   *
   * 对每个查询词在文本中查找所有出现位置
   *
   * @param text - 待查询的文本
   * @param queryTerms - 查询词数组
   * @returns 匹配位置数组（按起始位置排序）
   */
  private findMatches(
    text: string,
    queryTerms: string[],
  ): Array<{ start: number; end: number }> {
    const matches: Array<{ start: number; end: number }> = [];

    for (const term of queryTerms) {
      if (!term) continue;

      // 精确匹配
      let index = 0;
      while ((index = text.indexOf(term, index)) !== -1) {
        matches.push({
          start: index,
          end: index + term.length,
        });
        index += term.length;
      }

      // 模糊匹配（如果精确匹配失败）
      if (matches.length === 0 && term.length > 3) {
        const fuzzyMatches = this.fuzzyMatch(text, term);
        matches.push(...fuzzyMatches);
      }
    }

    return matches.sort((a, b) => a.start - b.start);
  }

  /**
   * 模糊匹配
   *
   * 使用编辑距离算法查找近似匹配
   *
   * @param text - 待查询的文本
   * @param pattern - 匹配模式
   * @param maxDistance - 最大编辑距离，默认 2
   * @returns 模糊匹配的位置数组
   */
  private fuzzyMatch(
    text: string,
    pattern: string,
    maxDistance: number = 2,
  ): Array<{ start: number; end: number }> {
    const matches: Array<{ start: number; end: number }> = [];
    const windowSize = pattern.length + maxDistance;

    for (let i = 0; i <= text.length - pattern.length; i++) {
      const window = text.substring(i, Math.min(i + windowSize, text.length));
      const distance = this.levenshteinDistance(
        pattern,
        window.substring(0, pattern.length),
      );

      if (distance <= maxDistance) {
        matches.push({
          start: i,
          end: i + pattern.length,
        });
      }
    }

    return matches;
  }

  /**
   * 计算 Levenshtein 编辑距离
   *
   * 用于模糊匹配，计算两个字符串之间的相似度
   *
   * @param a - 第一个字符串
   * @param b - 第二个字符串
   * @returns 编辑距离（需要的最少编辑操作数）
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      if (!matrix[0]) {
        matrix[0] = [];
      }
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const currentRow = matrix[i];
        const previousRow = matrix[i - 1];
        if (!currentRow || !previousRow) {
          continue;
        }
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          const diagonal = previousRow[j - 1];
          if (diagonal === undefined) {
            continue;
          }
          currentRow[j] = diagonal;
        } else {
          const diagonal = previousRow[j - 1];
          const left = currentRow[j - 1];
          const up = previousRow[j];
          if (
            diagonal === undefined ||
            left === undefined ||
            up === undefined
          ) {
            continue;
          }
          currentRow[j] = Math.min(diagonal + 1, left + 1, up + 1);
        }
      }
    }

    return matrix[b.length]?.[a.length] ?? 0;
  }

  /**
   * 合并重叠的匹配区域
   *
   * 将相邻或重叠的匹配合并为连续区域
   *
   * @param matches - 匹配位置数组
   * @returns 合并后的匹配位置数组
   */
  private mergeOverlaps(
    matches: Array<{ start: number; end: number }>,
  ): Array<{ start: number; end: number }> {
    if (matches.length === 0) return [];

    const merged: Array<{ start: number; end: number }> = [];
    let current = matches[0];
    if (!current) {
      return merged;
    }

    for (let i = 1; i < matches.length; i++) {
      const next = matches[i];
      if (!next) continue;

      if (next.start <= current.end) {
        // 合并重叠或相邻的匹配
        current = {
          start: current.start,
          end: Math.max(current.end, next.end),
        };
      } else {
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * 将高亮段落转换为 HTML
   *
   * @param segments - 高亮段落数组
   * @param tag - 高亮使用的 HTML 标签，默认 'mark'
   * @returns HTML 字符串
   */
  toHTML(segments: HighlightSegment[], tag: string = "mark"): string {
    return segments
      .map((segment) => {
        const escaped = this.escapeHTML(segment.text);
        return segment.isMatch ? `<${tag}>${escaped}</${tag}>` : escaped;
      })
      .join("");
  }

  /**
   * HTML 转义
   *
   * 防止 XSS 攻击，转义特殊 HTML 字符
   *
   * @param text - 待转义的文本
   * @returns 转义后的文本
   */
  private escapeHTML(text: string): string {
    // Service Worker 环境检查
    if (typeof document === "undefined") {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
    }

    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 获取包含匹配的上下文片段
   *
   * 提取包含第一个匹配的文本片段，用于查询结果预览
   *
   * @param text - 完整文本
   * @param query - 查询字符串
   * @param maxLength - 片段最大长度，默认 100
   * @returns 包含片段文本和高亮信息的对象
   */
  getContextSnippet(
    text: string,
    query: string,
    maxLength: number = 100,
  ): { snippet: string; highlights: HighlightSegment[] } {
    const segments = this.highlight(text, query);

    // 找到第一个匹配
    const firstMatchIndex = segments.findIndex((s) => s.isMatch);

    if (firstMatchIndex === -1) {
      // 没有匹配，返回开头
      const snippet = text.substring(0, maxLength);
      return {
        snippet,
        highlights: [
          { text: snippet, isMatch: false, start: 0, end: snippet.length },
        ],
      };
    }

    // 计算上下文范围
    const firstMatch = segments[firstMatchIndex];
    if (!firstMatch) {
      return {
        snippet: text.substring(0, maxLength),
        highlights: [],
      };
    }

    const matchStart = firstMatch.start;
    const contextStart = Math.max(0, matchStart - Math.floor(maxLength / 2));
    const contextEnd = Math.min(text.length, contextStart + maxLength);

    // 提取上下文
    const snippet = text.substring(contextStart, contextEnd);

    // 调整高亮段落到上下文范围
    const adjustedHighlights = segments
      .filter((s) => s.end > contextStart && s.start < contextEnd)
      .map((s) => ({
        text: text.substring(
          Math.max(s.start, contextStart),
          Math.min(s.end, contextEnd),
        ),
        isMatch: s.isMatch,
        start: Math.max(0, s.start - contextStart),
        end: Math.min(maxLength, s.end - contextStart),
      }));

    return {
      snippet:
        (contextStart > 0 ? "..." : "") +
        snippet +
        (contextEnd < text.length ? "..." : ""),
      highlights: adjustedHighlights,
    };
  }
}
