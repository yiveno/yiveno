/**
 * 任意输入压力集（R10 · H12）。
 * 只汇报、不挡门禁：`expectedIntent` 是对照用的假设，不是断言；
 * 跑完看现状，再决定哪些进 must。本文件是普通 `.ts`（非 `.test.ts`），
 * 不进 test:must / test:run。
 */
export interface PressureCase {
  id: string
  /** 审计 R10 的 8 类 */
  group:
    'multilingual' | 'long' | 'mixed' | 'instruction' | 'question' | 'repeated' | 'code' | 'generic'
  clue: string
  /** 期望意图（假设；只用于对照汇报） */
  expectedIntent: 'recall' | 'chitchat' | 'question' | 'instruction'
  /** 观察点（本用例真正要看的东西） */
  note: string
}

export const PRESSURE_CASES: PressureCase[] = [
  // 多语言线索
  {
    id: 'p01',
    group: 'multilingual',
    clue: '어제 본 시',
    expectedIntent: 'recall',
    note: '韩语“昨天看的诗”：时间+对象是否被理解'
  },
  {
    id: 'p02',
    group: 'multilingual',
    clue: 'вчерашнее стихотворение',
    expectedIntent: 'recall',
    note: '俄语“昨天的诗”'
  },
  {
    id: 'p03',
    group: 'multilingual',
    clue: 'القصيدة التي قرأتها أمس',
    expectedIntent: 'recall',
    note: '阿拉伯语“昨天读的诗”'
  },
  {
    id: 'p04',
    group: 'multilingual',
    clue: '昨日読んだ詩',
    expectedIntent: 'recall',
    note: '日语“昨天读的诗”'
  },
  {
    id: 'p05',
    group: 'multilingual',
    clue: 'きのう読んだ歌',
    expectedIntent: 'recall',
    note: '日语平假名“昨天读的歌”'
  },

  // 超长粘贴
  {
    id: 'p06',
    group: 'long',
    clue: 'I read a long article about how people organize information and memory. The author discussed retrieval, bookmarks, and the way we forget things we once saved. I want to find that article again. '.repeat(
      12
    ),
    expectedIntent: 'recall',
    note: 'clueTruncated 应为 true；仍 proceed 且有检索输入（不是 reject_noise）'
  },
  {
    id: 'p07',
    group: 'long',
    clue: '昨天我读到一篇关于记忆与检索的长文章，作者讨论了人们如何组织信息、为什么会忘记曾经保存的东西，我想再找到它。'.repeat(
      40
    ),
    expectedIntent: 'recall',
    note: '同 p06'
  },

  // 混合语言
  {
    id: 'p08',
    group: 'mixed',
    clue: '昨天看的那个 about memory 的文章',
    expectedIntent: 'recall',
    note: '中英混合：时间+英文主题词是否进 contentTerms'
  },
  {
    id: 'p09',
    group: 'mixed',
    clue: '帮我找一下 yesterday 的诗',
    expectedIntent: 'recall',
    note: '中英混合 + 填充词'
  },

  // 指令（换金标说法）
  {
    id: 'p10',
    group: 'instruction',
    clue: '提醒我明天早上九点开会',
    expectedIntent: 'instruction',
    note: '提醒类（金标 i01 是下午三点打电话；换时间+事项）'
  },
  {
    id: 'p11',
    group: 'instruction',
    clue: '帮我写一封给客户的邮件',
    expectedIntent: 'instruction',
    note: '生成类（金标 i02 是写首诗；换文体+对象）'
  },
  {
    id: 'p12',
    group: 'instruction',
    clue: '把这篇文章翻译成英文',
    expectedIntent: 'instruction',
    note: '翻译类（金标 i04 是翻译这句话；换对象+目标语言）'
  },

  // 事实问题
  {
    id: 'p13',
    group: 'question',
    clue: '中国的首都是哪？',
    expectedIntent: 'question',
    note: '首都类（金标 q01 是法国首都；换国家）'
  },
  {
    id: 'p14',
    group: 'question',
    clue: 'who wrote Hamlet?',
    expectedIntent: 'question',
    note: '英文事实问题（金标 q03 是日本首都；换问题类型）'
  },
  {
    id: 'p15',
    group: 'question',
    clue: '现在几点了？',
    expectedIntent: 'question',
    note: '时钟类（主路径是否答对；fallback 无时钟是已知边界）'
  },

  // 重复表达
  {
    id: 'p16',
    group: 'repeated',
    clue: '哈哈哈哈',
    expectedIntent: 'chitchat',
    note: '笑声：不应被 Gate A 当 keyboard_mash 拒绝'
  },
  {
    id: 'p17',
    group: 'repeated',
    clue: '呜呜呜',
    expectedIntent: 'chitchat',
    note: '哭声：同上'
  },
  {
    id: 'p18',
    group: 'repeated',
    clue: '啊啊啊',
    expectedIntent: 'chitchat',
    note: '感叹：同上'
  },

  // 数字码
  {
    id: 'p19',
    group: 'code',
    clue: '123456',
    expectedIntent: 'recall',
    note: '纯数字码：是否 proceed（而非 reject_noise）'
  },
  {
    id: 'p20',
    group: 'code',
    clue: 'AB-1234-XYZ',
    expectedIntent: 'recall',
    note: '字母数字混合码：是否 proceed'
  },

  // 泛指
  {
    id: 'p21',
    group: 'generic',
    clue: '那玩意儿',
    expectedIntent: 'recall',
    note: '已知 LLM 可能判 chitchat（与规则 missing_topic 分歧）；记 actual，不改判'
  },
  {
    id: 'p22',
    group: 'generic',
    clue: '那啥',
    expectedIntent: 'recall',
    note: '同 p21'
  },
  {
    id: 'p23',
    group: 'generic',
    clue: 'that thingy',
    expectedIntent: 'recall',
    note: '英文泛指；规则应走 missing_topic'
  },
  {
    id: 'p24',
    group: 'generic',
    clue: '那个东西',
    expectedIntent: 'recall',
    note: '中文泛指；规则应走 missing_topic'
  }
]
