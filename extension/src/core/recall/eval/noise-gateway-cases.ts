import type { ClueProcessingRejectReason } from '@/core/recall/understand/select-clue-processing-disposition'

/**
 * 门禁级别。
 * - must：当前网关必须通过（零误伤 + 硬噪音必拦）
 * - stretch：灰区 / 更脏合成；仅汇报，不挡 CI
 */
export type NoiseGatewayGate =
  | 'must' // 必过：挡门禁
  | 'stretch' // 拉伸：仅汇报

/**
 * 期望结论。
 * - proceed：必须放行（防误伤）
 * - reject_noise：必须拒绝，并可校验 rejectReason
 */
export type NoiseGatewayExpect =
  | { disposition: 'proceed' } // 放行
  | {
      disposition: 'reject_noise' // 拒绝噪音
      rejectReason: ClueProcessingRejectReason
    }

export interface NoiseGatewayCase {
  /** 用例稳定 id */
  id: string
  /** 输入线索原文 */
  clue: string
  /** must 挡门禁 / stretch 仅汇报 */
  gate: NoiseGatewayGate
  /** 期望网关结论 */
  expect: NoiseGatewayExpect
  /** 中文：出题意图 */
  note: string
}

/**
 * 人手金标 / 硬负例 / 硬噪音。
 * 与合成集正交；合成见 buildSynthNoiseGatewayCases。
 */
export const NOISE_GATEWAY_HAND_CASES: NoiseGatewayCase[] = [
  // —— must proceed：真短词 / 专名 / URL ——
  {
    id: 'proceed-short-poem',
    clue: 'poem',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '真短词不可当砸键盘'
  },
  {
    id: 'proceed-proper-cloudflare',
    clue: 'Cloudflare',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '专名'
  },
  {
    id: 'proceed-multi-cloudflare-workers',
    clue: 'Cloudflare Workers',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '多词专名'
  },
  {
    id: 'proceed-url-path',
    clue: 'github.com/cqw',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: 'URL-like 路径'
  },
  {
    id: 'proceed-url-https',
    clue: 'https://example.com/a',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '完整 URL'
  },
  {
    id: 'proceed-short-auth',
    clue: 'auth',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '短内容词'
  },
  {
    id: 'proceed-name-li-bai',
    clue: 'Li Bai',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '人名'
  },
  {
    id: 'proceed-han-short',
    clue: 'Li Bai poem',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '短专名短语：本层不应误拦'
  },

  // —— must proceed：口语 ——
  {
    id: 'proceed-oral-movie',
    clue: 'The movie that I watched yesterday',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '口语长句'
  },
  {
    id: 'proceed-oral-forgotten',
    clue: "I recently came across a news article about a legal case. I've forgotten the details.",
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '含 forgotten 等自然语言信号'
  },
  {
    id: 'proceed-oral-li-bai-poem',
    clue: 'yesterday saved a poem about Li Bai',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: 'P0 典型口语'
  },

  // —— must proceed：硬负例（像脏但必须放行） ——
  {
    id: 'hardneg-qwerty-word',
    clue: 'qwerty',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '整词 qwerty：短且可能是真线索，灰区放行'
  },
  {
    id: 'hardneg-code-snippet-auth',
    clue: 'last week the code snippet about auth',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '口语+内容词，不可因夹杂怪词误伤'
  },

  // —— must reject：空 / 纯符号 ——
  {
    id: 'reject-empty',
    clue: '',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'empty' },
    note: '空串'
  },
  {
    id: 'reject-whitespace',
    clue: '   ',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'empty' },
    note: '纯空白'
  },
  {
    id: 'reject-bang',
    clue: '!!!',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'pure_symbol' },
    note: '纯符号'
  },
  {
    id: 'reject-semicolons',
    clue: ';;;',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'pure_symbol' },
    note: '纯分号'
  },

  // —— must reject：数字糊 / 砸键盘 ——
  {
    id: 'reject-digit-123123',
    clue: '123123',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'digit_mash' },
    note: '重复数字单元'
  },
  {
    id: 'reject-kbd-asdasd',
    clue: 'asdasd',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '重复音节砸键'
  },
  {
    id: 'reject-kbd-asdf-repeat',
    clue: 'asdfasdfasdfasdf',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: 'asdf 行重复'
  },
  {
    id: 'reject-kbd-long-mash',
    clue: 'alsjdlkasjdweq;lkaskdl;aksd;lasd;hasjldhaksd',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '长无语义字母糊'
  },

  // —— must reject：带空格多段乱输（P0 Gate A） ——
  {
    id: 'reject-kbd-multi-asdfg-aksdjh',
    clue: 'asdfg aksdjhaksjhd',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '带空格多段乱输：用户原例'
  },
  {
    id: 'reject-kbd-multi-rows',
    clue: 'asdfghjkl qwertyuiop',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '两行键盘'
  },
  {
    id: 'reject-kbd-multi-qwer-asdf-zxcv',
    clue: 'qwer asdf zxcv',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '三行键盘短串'
  },
  {
    id: 'reject-kbd-multi-aksdjh-asdfg',
    clue: 'aksdjhaksjhd asdfg',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '顺序调换'
  },
  {
    id: 'reject-kbd-multi-zxcv-qwerty',
    clue: 'zxcvbnm qwertyuiop',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '底行+顶行'
  },
  {
    id: 'reject-kbd-multi-lkjhgf',
    clue: 'lkjhgf asdfgh',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '两段六键'
  },
  {
    id: 'reject-kbd-multi-asdf-zxcv-qwer',
    clue: 'asdf zxcv qwer',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '三段短串'
  },
  {
    id: 'reject-kbd-multi-qwerty-asdfgh',
    clue: 'qwerty asdfgh',
    gate: 'must',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '键盘词+六键'
  },

  // —— must proceed：多段真短语不可误伤 ——
  {
    id: 'proceed-multi-sweet-street',
    clue: 'sweet street',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '去空白后 unique 比 ≤ 0.5，靠辅音簇条件保住'
  },
  {
    id: 'proceed-multi-deer-street',
    clue: 'deer street',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '同上'
  },
  {
    id: 'proceed-multi-street-sweeper',
    clue: 'street sweeper',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '同上'
  },
  {
    id: 'proceed-multi-tree-street',
    clue: 'tree street',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '同上'
  },
  {
    id: 'proceed-multi-free-street',
    clue: 'free street',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '同上'
  },
  {
    id: 'proceed-multi-green-trees',
    clue: 'green trees',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '10 字母，低于邻接下限 12'
  },
  {
    id: 'proceed-multi-sweetest-dreams',
    clue: 'sweetest dreams',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '邻接比 0.4，真短语上限样本'
  },
  {
    id: 'proceed-multi-cloudflare-workers-ts',
    clue: 'cloudflare workers typescript',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '多词专名'
  },
  {
    id: 'proceed-multi-new-york',
    clue: 'New York New York',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '重复真短语'
  },
  {
    id: 'proceed-multi-asdfg-poem',
    clue: 'asdfg poem',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '夹真词必须放行'
  },
  {
    id: 'proceed-multi-rhythm-blues',
    clue: 'rhythm blues',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '高邻接真词组合'
  },
  {
    id: 'proceed-multi-banana-bread',
    clue: 'banana bread recipe',
    gate: 'must',
    expect: { disposition: 'proceed' },
    note: '含重复字母真词'
  },

  // —— stretch：灰区（可漏拦；用于观察阈值） ——
  {
    id: 'stretch-border-asdfgh',
    clue: 'asdfgh',
    gate: 'stretch',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '单行六键：理想拦，当前可能漏'
  },
  {
    id: 'stretch-border-111111',
    clue: '111111',
    gate: 'stretch',
    expect: { disposition: 'reject_noise', rejectReason: 'digit_mash' },
    note: '重复数字：理想拦'
  },
  {
    id: 'stretch-proceed-typo-ish',
    clue: 'cloudfalre',
    gate: 'stretch',
    expect: { disposition: 'proceed' },
    note: '专名拼写错误仍应放行'
  },
  {
    id: 'stretch-reject-multi-asdf-jkl-qwer',
    clue: 'asdf jkl qwer',
    gate: 'stretch',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '理想拦：11 字母低于邻接下限 12，当前漏'
  },
  {
    id: 'stretch-reject-multi-asdfg-double',
    clue: 'asdfg asdfg',
    gate: 'stretch',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '理想拦：短串重复、无 5+ 辅音簇，当前漏'
  },
  {
    id: 'stretch-reject-multi-diluted',
    clue: 'asdfg aksdjhaksjhd qwerty',
    gate: 'stretch',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '理想拦：qwerty 稀释了重复比，当前漏'
  },
  {
    id: 'stretch-reject-short-asdfg',
    clue: 'asdfg',
    gate: 'stretch',
    expect: { disposition: 'reject_noise', rejectReason: 'keyboard_mash' },
    note: '理想拦：5 字符短串，当前漏（短串暂不追）'
  },
  {
    id: 'stretch-proceed-greeting',
    clue: 'hello',
    gate: 'stretch',
    expect: { disposition: 'proceed' },
    note: '问候语不在 Gate A 职责内'
  },
  {
    id: 'stretch-proceed-command',
    clue: 'open settings',
    gate: 'stretch',
    expect: { disposition: 'proceed' },
    note: '指令不在 Gate A 职责内'
  }
]
