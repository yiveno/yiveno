/**
 * 异步搜索选择器组件类型定义
 */

/**
 * 选项接口
 */
export interface SelectOption {
  /** 选项值（唯一标识） */
  value: string;
  /** 选项标签（显示文本） */
  label: string;
  /** 选项描述（可选） */
  description?: string;
  /** 原始数据（可选） */
  raw?: unknown;
}

/**
 * 组件 Props
 */
export interface AsyncSearchSelectProps {
  /** 标签 */
  label?: string;
  /** 占位符 */
  placeholder?: string;
  /** 是否多选 */
  multiple?: boolean;
  /** 空结果提示文本 */
  emptyText?: string;
  /** 防抖延迟（毫秒） */
  debounce?: number;
}

/**
 * 组件 Emits
 */
export interface AsyncSearchSelectEmits {
  /** 搜索事件（返回搜索关键词） */
  (e: "search", query: string): void;
  /** 选择变化事件（返回选中的值数组） */
  (e: "change", values: string[]): void;
  /** 选择变化事件（返回选中的选项对象数组） */
  (e: "update:selected", options: SelectOption[]): void;
}

/**
 * 组件实例方法
 */
export interface AsyncSearchSelectInstance {
  /** 设置搜索结果 */
  setOptions: (options: SelectOption[]) => void;
  /** 设置 loading 状态 */
  setLoading: (loading: boolean) => void;
  /** 清空选择 */
  clearSelection: () => void;
  /** 获取选中的值 */
  getSelectedValues: () => string[];
  /** 获取选中的选项 */
  getSelectedOptions: () => SelectOption[];
}
