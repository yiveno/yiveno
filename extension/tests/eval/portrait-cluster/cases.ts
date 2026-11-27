/**
 * portrait_cluster label 语义评测用例（12 组）。
 * 每组：待确认 value 列表 + 期望上位词关键词集（label 命中任一词即 pass）。
 */

export type PortraitClusterEvalCase = {
  id: string
  /** 待确认项 value 列表 */
  values: string[]
  /**
   * 期望上位词关键词集（子串、大小写不敏感）。
   * 多簇时：每个非单成员簇的 label 须命中该集合任一词；
   * 单成员簇 label===value，不要求命中关键词。
   */
  expectedLabelKeywords: string[]
  /** 用例说明（开发者向） */
  noteZh: string
}

export const PORTRAIT_CLUSTER_EVAL_CASES: PortraitClusterEvalCase[] = [
  {
    id: 'fruit_zh',
    values: ['苹果', '梨', '香蕉'],
    expectedLabelKeywords: ['水果', 'fruit'],
    noteZh: '典型中文水果簇'
  },
  {
    id: 'tech_reading_en',
    values: ['Hacker News', 'Ars Technica', 'The Verge'],
    expectedLabelKeywords: ['tech', 'technology', 'reading', 'news', '科技', '阅读'],
    noteZh: '科技阅读英文源'
  },
  {
    id: 'web_dev',
    values: ['React', 'Vue', 'TypeScript', 'CSS'],
    expectedLabelKeywords: ['web', 'frontend', 'front-end', '开发', '编程', 'code', 'dev'],
    noteZh: '网页开发技术栈'
  },
  {
    id: 'music',
    values: ['Jazz', 'Blues', 'Soul'],
    expectedLabelKeywords: ['music', '音乐', 'genre', '流派'],
    noteZh: '音乐流派'
  },
  {
    id: 'cooking',
    values: ['pasta', 'risotto', 'gnocchi'],
    expectedLabelKeywords: ['food', 'cook', 'italian', 'pasta', '美食', '意面', '烹饪'],
    noteZh: '意式烹饪'
  },
  {
    id: 'cities_cn',
    values: ['长春', '哈尔滨', '沈阳'],
    expectedLabelKeywords: ['东北', '城市', 'city', 'northeast'],
    noteZh: '东北城市'
  },
  {
    id: 'single_member',
    values: ['孤立兴趣项'],
    expectedLabelKeywords: [],
    noteZh: '单成员：label 须等于 value，不要求关键词'
  },
  {
    id: 'noise_mixed_fruit',
    values: ['苹果', '梨', '香蕉', '随机噪声xyz'],
    expectedLabelKeywords: ['水果', 'fruit'],
    noteZh: '水果簇 + 噪声项混入（噪声可单成簇）'
  },
  {
    id: 'sports',
    values: ['篮球', '足球', '网球'],
    expectedLabelKeywords: ['体育', '运动', 'sport', 'ball'],
    noteZh: '球类运动'
  },
  {
    id: 'ai_tools',
    values: ['ChatGPT', 'Claude', 'Gemini'],
    expectedLabelKeywords: ['ai', 'llm', 'assistant', '模型', '智能'],
    noteZh: 'AI 助手工具'
  },
  {
    id: 'design_tools',
    values: ['Figma', 'Sketch', 'Adobe XD'],
    expectedLabelKeywords: ['design', '设计', 'ui', 'ux', 'tool'],
    noteZh: '设计工具'
  },
  {
    id: 'two_clusters_hint',
    values: ['苹果', '梨', 'React', 'Vue'],
    expectedLabelKeywords: ['水果', 'fruit', 'web', 'frontend', '开发', '编程', 'code'],
    noteZh: '双主题混排：水果 + 前端（关键词并集）'
  }
]
