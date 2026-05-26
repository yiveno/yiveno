/**
 * Lucide Icons 导入和映射
 *
 * 这个文件集中管理所有使用的 Lucide 图标
 * 按需导入,减少打包体积
 */

import type { Component } from 'vue'

// 导入常用图标
import {
  // 基础操作
  Plus,
  Minus,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronsRight,
  ChevronsLeft,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Circle,
  MinusCircle,

  // 编辑操作
  Edit,
  Trash2,
  Copy,
  Clipboard,
  Save,
  Download,
  Upload,

  // 文件和文件夹
  File,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderMinus,

  // 书签相关
  Bookmark,
  BookmarkPlus,
  BookmarkMinus,
  BookmarkCheck,
  Star,
  StarOff,

  // 搜索和筛选
  Search,
  Filter,
  SlidersHorizontal,

  // 设置和配置
  Settings,
  MoreVertical,
  MoreHorizontal,
  Menu,

  // 状态指示
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  HelpCircle,

  // 用户和账户
  User,
  UserCircle,
  Users,
  UserPlus,

  // 时间和日期
  Clock,
  Calendar,

  // 网络和同步
  Cloud,
  CloudOff,
  RefreshCw,
  Loader2,

  // 视图和布局
  Eye,
  EyeOff,
  Layout,
  Grid,
  List,

  // 导航
  Home,
  ExternalLink,
  Link,
  Unlink,

  // 主题
  Sun,
  Moon,
  Monitor,

  // 其他
  Tag,
  Tags,
  Hash,
  Zap,
  Crown,
  Brain,
  Sparkles,
  Lock,
  Unlock,
  Shield,
  Ban,
  // 通知
  Bell,
  Inbox,
  // 用户操作
  LogOut,
  LogIn,
  // 展开收起
  ChevronsUp,
  ChevronsDown,
  // 布局
  PanelLeft,
  // 数据库
  Database,
  // 其他补充
  Globe,
  Lightbulb,
  Keyboard,
  Radar,
  Cpu,
  Glasses,
  NotebookTabs,
  AppWindow,
  Palette,
  // 分享相关
  Send,
  Image
} from 'lucide-vue-next'

/**
 * Lucide 图标映射表
 * key: 图标名称 (kebab-case)
 * value: Lucide 图标组件
 */
export const lucideIcons: Record<string, Component> = {
  // 基础操作
  plus: Plus,
  minus: Minus,
  x: X,
  close: X,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-up': ChevronUp,
  'chevrons-right': ChevronsRight,
  'chevrons-left': ChevronsLeft,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  circle: Circle,
  'circle-outline': Circle,
  'minus-circle': MinusCircle,
  'circle-minus': MinusCircle,

  // 编辑操作
  edit: Edit,
  delete: Trash2,
  trash: Trash2,
  'trash-2': Trash2,
  copy: Copy,
  clipboard: Clipboard,
  save: Save,
  download: Download,
  upload: Upload,

  // 文件和文件夹
  file: File,
  folder: Folder,
  'folder-open': FolderOpen,
  'folder-plus': FolderPlus,
  'folder-add': FolderPlus,
  'folder-minus': FolderMinus,
  'folder-delete': FolderMinus,

  // 书签相关
  bookmark: Bookmark,
  'bookmark-plus': BookmarkPlus,
  'bookmark-add': BookmarkPlus,
  'bookmark-minus': BookmarkMinus,
  'bookmark-delete': BookmarkMinus,
  'bookmark-check': BookmarkCheck,
  star: Star,
  favorite: Star,
  'star-off': StarOff,
  'favorite-outline': StarOff,

  // 搜索和筛选
  search: Search,
  filter: Filter,
  sliders: SlidersHorizontal,

  // 设置和配置
  settings: Settings,
  'more-vertical': MoreVertical,
  'more-horizontal': MoreHorizontal,
  menu: Menu,

  // 状态指示
  alert: AlertCircle,
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
  'check-circle': CheckCircle,
  error: XCircle,
  'x-circle': XCircle,
  help: HelpCircle,
  'help-circle': HelpCircle,

  // 用户和账户
  user: User,
  'user-circle': UserCircle,
  account: User,
  users: Users,
  'user-plus': UserPlus,

  // 时间和日期
  clock: Clock,
  calendar: Calendar,

  // 网络和同步
  cloud: Cloud,
  'cloud-off': CloudOff,
  'cloud-sync': RefreshCw,
  refresh: RefreshCw,
  sync: RefreshCw,
  loader: Loader2,
  'loader-2': Loader2,
  loading: Loader2,

  // 视图和布局
  eye: Eye,
  'eye-off': EyeOff,
  layout: Layout,
  grid: Grid,
  list: List,
  heart: Star, // heart 映射到 star（收藏）

  // 导航
  home: Home,
  'external-link': ExternalLink,
  link: Link,
  unlink: Unlink,

  // 主题
  sun: Sun,
  light: Sun,
  moon: Moon,
  dark: Moon,
  monitor: Monitor,
  system: Monitor,

  // 其他
  tag: Tag,
  tags: Tags,
  hash: Hash,
  flash: Zap,
  zap: Zap,
  crown: Crown,
  brain: Brain,
  sparkles: Sparkles,
  ai: Sparkles,
  auto: Sparkles,
  /** 配色 / 主题色 */
  palette: Palette,
  'color-palette': Palette,
  lock: Lock,
  unlock: Unlock,
  shield: Shield,
  ban: Ban,
  block: Ban,

  // 通知
  bell: Bell,
  notification: Bell,
  inbox: Inbox,

  // 用户操作
  'log-out': LogOut,
  logout: LogOut,
  'log-in': LogIn,
  login: LogIn,

  // 展开收起
  'chevrons-up': ChevronsUp,
  'chevrons-down': ChevronsDown,

  // 布局
  'panel-left': PanelLeft,
  sidebar: PanelLeft,

  // 数据库
  database: Database,

  // 其他补充
  globe: Globe,
  web: Globe,
  lightbulb: Lightbulb,
  keyboard: Keyboard,
  radar: Radar,
  cpu: Cpu,

  /** 浏览器 / 窗口 / 标签组（右键菜单等） */
  glasses: Glasses,
  'notebook-tabs': NotebookTabs,
  'app-window': AppWindow,

  // 分享相关
  send: Send,
  image: Image
}

/**
 * Material Icons 到 Lucide Icons 的映射
 * 用于平滑迁移
 */
export const materialToLucideMap: Record<string, string> = {
  // 基础操作
  'icon-add': 'plus',
  'icon-add-circle': 'plus',
  'icon-cancel': 'x',
  'icon-check': 'check',
  'icon-chevron-down': 'chevron-down',
  'icon-chevron-right': 'chevron-right',
  'icon-arrow-right-double': 'chevrons-right',

  // 编辑操作
  'icon-edit-bookmark': 'edit',
  'icon-edit-folder': 'edit',
  'icon-folder-edit': 'edit',
  'icon-delete': 'trash',
  'icon-delete-sweep': 'trash',
  'icon-copy': 'copy',
  'icon-duplicate': 'copy',

  // 文件和文件夹
  'icon-file': 'file',
  'icon-folder': 'folder',
  'icon-folder-add': 'folder-plus',
  'icon-folder-delete': 'folder-minus',

  // 书签相关
  'icon-bookmark': 'bookmark',
  'icon-bookmark-Add': 'bookmark-plus',
  'icon-bookmark-delete': 'bookmark-minus',
  'icon-favorite': 'star',
  'icon-favorite-outline': 'star-off',
  'icon-star': 'star',

  // 状态指示
  'icon-alert': 'alert-circle',
  'icon-error': 'x-circle',
  'icon-success': 'check-circle',
  'icon-approval': 'check-circle',
  'icon-circle-outline': 'circle',
  'icon-circle-minus': 'minus-circle',
  'icon-warning': 'alert-triangle',

  // 用户
  'icon-account': 'user',

  // 时间
  'icon-clock': 'clock',

  // 网络和同步
  'icon-cloud-sync': 'refresh',
  'icon-swap': 'refresh',
  'icon-sync-alert': 'alert-circle',

  // 视图
  'icon-expand-All': 'chevrons-up',
  'icon-collapse-All': 'chevrons-down',

  // 主题
  'icon-dark': 'moon',

  // 分享
  'icon-share': 'external-link',
  'icon-link': 'link',

  /** 文件夹「打开全部」等菜单（原 Material 名 → Lucide 键） */
  'icon-incognito': 'glasses',
  'icon-tab-group': 'notebook-tabs',
  'icon-open-link': 'external-link',
  'icon-window': 'app-window',

  // 其他
  'icon-flash': 'zap',
  'icon-crown': 'crown',
  'icon-brain': 'brain',
  'icon-auto': 'sparkles',
  'icon-block': 'ban',
  'icon-clean': 'sparkles',
  'icon-comparison': 'arrow-right',
  'icon-down-arrow': 'arrow-down',
  'icon-check-outline': 'check',
  'icon-check-blank': 'minus'
}
