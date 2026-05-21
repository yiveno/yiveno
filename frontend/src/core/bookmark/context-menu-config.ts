/**
 * 📋 书签树右键菜单配置管理器
 * 
 * 设计原则：
 * 1. 数据驱动：菜单配置集中管理，易于维护
 * 2. 高复用：统一的菜单项配置接口
 * 3. 低耦合：菜单配置与组件逻辑分离
 * 4. 条件渲染：根据节点类型、状态、权限动态生成菜单
 */

import type { BookmarkNode } from '@/types'

/**
 * 菜单项配置接口
 */
export interface MenuItemConfig {
  /** 唯一标识 */
  id: string
  /** 显示文本 */
  label: string
  /** 图标名称 */
  icon?: string
  /** 快捷键提示 */
  shortcut?: string
  /** 颜色主题 */
  color?: 'default' | 'error' | 'warning' | 'success' | 'primary'
  /** 是否禁用 */
  disabled?: boolean
  /** 是否显示（默认 true） */
  visible?: boolean
  /** 触发的事件名称 */
  action: string
}

/**
 * 树配置接口（从 TreeNode props 中提取）
 */
export interface TreeConfig {
  editable?: boolean
  showAddButton?: boolean
  showEditButton?: boolean
  showDeleteButton?: boolean
  showOpenNewTabButton?: boolean
  showCopyUrlButton?: boolean
  showShareButton?: boolean
  showFavoriteButton?: boolean
}

/**
 * 菜单配置构建器
 * 
 * 负责根据节点类型、状态、权限生成对应的菜单配置
 */
export class ContextMenuBuilder {
  /**
   * 为文件夹节点生成菜单
   * 
   * @param node - 文件夹节点
   * @param config - 树配置
   * @returns 菜单项配置数组
   */
  static buildFolderMenu(
    node: BookmarkNode,
    config: TreeConfig
  ): MenuItemConfig[] {
    // 判断是否为根文件夹（书签栏、其他书签等）
    const isRootFolder = !node.parentId || node.parentId === '0'
    
    // 计算文件夹内的书签数量（递归统计）
    const bookmarkCount = this.countBookmarksInFolder(node)

    const items: MenuItemConfig[] = [
      // ✅ 四种"打开全部"选项
      {
        id: 'open-all-incognito',
        label: `在无痕窗口打开全部（${bookmarkCount}个）`,
        icon: 'icon-incognito',
        action: 'folder:open-all-incognito',
        visible: bookmarkCount > 0
      },
      {
        id: 'open-all-tab-group',
        label: `在新标签页分组中打开全部（${bookmarkCount}个）`,
        icon: 'icon-tab-group',
        action: 'folder:open-all-tab-group',
        visible: bookmarkCount > 0
      },
      {
        id: 'open-all',
        label: `打开全部（${bookmarkCount}个）`,
        icon: 'icon-open-link',
        action: 'folder:open-all',
        visible: bookmarkCount > 0
      },
      {
        id: 'open-all-new-window',
        label: `在新窗口打开全部（${bookmarkCount}个）`,
        icon: 'icon-window',
        action: 'folder:open-all-new-window',
        visible: bookmarkCount > 0
      },
      {
        id: 'add',
        label: '添加书签',
        icon: 'icon-add-circle',
        action: 'folder:add',
        visible: config.showAddButton || config.editable
      },
      {
        id: 'edit',
        label: '编辑文件夹',
        icon: 'icon-edit-folder',
        action: 'folder:edit',
        visible: !isRootFolder && (config.showEditButton || config.editable)
      },
      {
        id: 'delete',
        label: '删除文件夹',
        icon: 'icon-folder-delete',
        color: 'error',
        action: 'folder:delete',
        visible: !isRootFolder && (config.showDeleteButton || config.editable)
      },
      {
        id: 'share',
        label: '分享文件夹',
        icon: 'icon-share',
        action: 'folder:share',
        visible: config.showShareButton
      }
    ]

    // 过滤掉不可见的菜单项
    return items.filter(item => item.visible !== false)
  }

  /**
   * 递归统计文件夹内的书签数量
   * 
   * @param node - 文件夹节点
   * @returns 书签数量
   */
  private static countBookmarksInFolder(node: BookmarkNode): number {
    if (!node.children || node.children.length === 0) {
      return 0
    }

    let count = 0
    for (const child of node.children) {
      if (child.url) {
        // 是书签，计数 +1
        count++
      } else if (child.children) {
        // 是文件夹，递归统计
        count += this.countBookmarksInFolder(child)
      }
    }

    return count
  }

  /**
   * 为书签节点生成菜单
   * 
   * @param node - 书签节点
   * @param config - 树配置
   * @returns 菜单项配置数组
   */
  static buildBookmarkMenu(
    node: BookmarkNode,
    config: TreeConfig
  ): MenuItemConfig[] {
    const isFavorited = Boolean(node.isFavorite)

    const items: MenuItemConfig[] = [
      {
        id: 'open-new-tab',
        label: '在新标签页中打开',
        icon: 'icon-open-link',
        // shortcut: 'Ctrl+Click',
        action: 'bookmark:open-new-tab',
        visible: config.showOpenNewTabButton || config.editable
      },
      {
        id: 'copy-url',
        label: '复制链接',
        icon: 'icon-link',
        action: 'bookmark:copy-url',
        visible: config.showCopyUrlButton || config.editable
      },
      {
        id: 'favorite',
        label: isFavorited ? '取消收藏' : '收藏',
        icon: isFavorited ? 'icon-favorite-outline' : 'icon-favorite',
        color: isFavorited ? 'warning' : 'default',
        action: 'bookmark:toggle-favorite',
        visible: true // ✅ 始终显示收藏选项
      },
      {
        id: 'edit',
        label: '编辑书签',
        icon: 'icon-edit-bookmark',
        action: 'bookmark:edit',
        visible: config.showEditButton || config.editable
      },
      {
        id: 'delete',
        label: '删除书签',
        icon: 'icon-bookmark-delete',
        color: 'error',
        action: 'bookmark:delete',
        visible: config.showDeleteButton || config.editable
      }
    ]

    // 过滤掉不可见的菜单项
    return items.filter(item => item.visible !== false)
  }

  /**
   * 为多选状态生成菜单
   * 
   * @param selectedNodes - 选中的节点数组
   * @param config - 树配置
   * @returns 菜单项配置数组
   */
  static buildMultiSelectMenu(
    selectedNodes: BookmarkNode[],
    config: TreeConfig
  ): MenuItemConfig[] {
    const hasBookmarks = selectedNodes.some(n => n.url)
    const count = selectedNodes.length

    const items: MenuItemConfig[] = [
      {
        id: 'open-all',
        label: `打开选中的 ${count} 个书签`,
        icon: 'icon-open-link',
        action: 'multi:open-all',
        visible: hasBookmarks
      },
      {
        id: 'delete',
        label: `删除选中的 ${count} 项`,
        icon: 'icon-delete',
        color: 'error',
        action: 'multi:delete',
        visible: config.showDeleteButton || config.editable
      },
      {
        id: 'export',
        label: '导出选中项',
        icon: 'icon-export',
        action: 'multi:export',
        visible: true
      }
    ]

    // 过滤掉不可见的菜单项
    return items.filter(item => item.visible !== false)
  }

  /**
   * 根据节点和配置自动选择合适的菜单
   * 
   * @param node - 节点
   * @param config - 树配置
   * @param isMultiSelect - 是否为多选状态
   * @param selectedNodes - 选中的节点数组（多选时使用）
   * @returns 菜单项配置数组
   */
  static buildMenu(
    node: BookmarkNode,
    config: TreeConfig,
    isMultiSelect = false,
    selectedNodes: BookmarkNode[] = []
  ): MenuItemConfig[] {
    // 多选状态
    if (isMultiSelect && selectedNodes.length > 1) {
      return this.buildMultiSelectMenu(selectedNodes, config)
    }

    // 文件夹节点
    if (!node.url) {
      return this.buildFolderMenu(node, config)
    }

    // 书签节点
    return this.buildBookmarkMenu(node, config)
  }
}
