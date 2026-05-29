export interface AccordionProps {
  /**
   * 是否独占模式（一次只能展开一个）
   * @default true
   */
  exclusive?: boolean

  /**
   * 默认展开的项目 ID
   * 独占模式下传字符串，多选模式下传数组
   */
  defaultExpanded?: string | string[]
}

export interface AccordionItemProps {
  /**
   * 项目唯一标识
   */
  id: string

  /**
   * 标题
   */
  title: string

  /**
   * 图标名称
   */
  icon?: string

  /**
   * 图标大小
   * @default 16
   */
  iconSize?: number
}
