/**
 * 闲聊意图（Gate A+）金标用例。
 * 用于 `nlu:try` live 验收；不进 CI must（真实模型）。
 */

export interface IntentEvalCase {
  id: string
  clue: string
  expectedIntent: 'recall' | 'chitchat' | 'question' | 'instruction'
}

export const INTENT_EVAL_MUST: IntentEvalCase[] = [
  { id: 'c01', clue: '今天天气不错', expectedIntent: 'chitchat' },
  { id: 'c02', clue: 'nice weather today', expectedIntent: 'chitchat' },
  { id: 'c03', clue: 'hello', expectedIntent: 'chitchat' },
  { id: 'c04', clue: 'hi there', expectedIntent: 'chitchat' },
  { id: 'c05', clue: '你好', expectedIntent: 'chitchat' },
  { id: 'c06', clue: 'i feel bored', expectedIntent: 'chitchat' },
  { id: 'c07', clue: 'how are you', expectedIntent: 'chitchat' },
  { id: 'c08', clue: 'good morning', expectedIntent: 'chitchat' },
  { id: 'c09', clue: "I'm so tired today", expectedIntent: 'chitchat' },
  { id: 'c10', clue: '今天过得怎么样', expectedIntent: 'chitchat' },
  { id: 'r01', clue: 'yesterday poem', expectedIntent: 'recall' },
  { id: 'r02', clue: 'yesterday poem about Li Bai', expectedIntent: 'recall' },
  { id: 'r03', clue: '昨天那个东西', expectedIntent: 'recall' },
  { id: 'r04', clue: '我昨天看到一个东西', expectedIntent: 'recall' },
  { id: 'r05', clue: 'the article I read last week', expectedIntent: 'recall' },
  { id: 'r06', clue: 'my password for github', expectedIntent: 'recall' },
  { id: 'r07', clue: 'that song I kept listening to', expectedIntent: 'recall' },
  { id: 'r08', clue: '今天天气不错，顺便找找昨天的诗', expectedIntent: 'recall' },
  { id: 'r09', clue: '昨天天气不错，我看到一首诗', expectedIntent: 'recall' },
  { id: 'r10', clue: 'hello, find me that poem from yesterday', expectedIntent: 'recall' },
  { id: 'c11', clue: '你是什么', expectedIntent: 'chitchat' },
  { id: 'c12', clue: '你是谁', expectedIntent: 'chitchat' },
  { id: 'c13', clue: '你叫什么', expectedIntent: 'chitchat' },
  { id: 'c14', clue: '你会干什么', expectedIntent: 'chitchat' },
  { id: 'c15', clue: '介绍下自己', expectedIntent: 'chitchat' },
  { id: 'c16', clue: 'what are you', expectedIntent: 'chitchat' },
  { id: 'c17', clue: 'who are you', expectedIntent: 'chitchat' },
  { id: 'c18', clue: 'what can you do', expectedIntent: 'chitchat' },
  { id: 'r11', clue: '你是什么时候保存的那篇文章', expectedIntent: 'recall' },
  { id: 'r12', clue: '介绍一下昨天那首诗', expectedIntent: 'recall' },
  { id: 'q01', clue: '法国首都是哪？', expectedIntent: 'question' },
  { id: 'q02', clue: '今天星期几？', expectedIntent: 'question' },
  { id: 'q03', clue: "what's the capital of Japan?", expectedIntent: 'question' },
  { id: 'q04', clue: '水在多少度结冰？', expectedIntent: 'question' },
  { id: 'i01', clue: '提醒我下午三点打电话', expectedIntent: 'instruction' },
  { id: 'i02', clue: '写首诗', expectedIntent: 'instruction' },
  { id: 'i03', clue: '把书签全删了', expectedIntent: 'instruction' },
  { id: 'i04', clue: '翻译这句话', expectedIntent: 'instruction' }
]
