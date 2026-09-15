/**
 * Hybrid eval 用例集。
 *
 * 维度（与 R0/R4 等契约对齐）：
 * 1. **R0 严格保真**：Hybrid 不能用「语义近邻填空」绕过零锚点拦截；生活助手场景同样禁。
 * 2. **关键词领先者保护**：强词面 Top1 不得被单共享词 + 强语义近邻挤出首位。
 * 3. **纯语义召回**：词面几乎无重叠时，语义近邻应进入邻域。
 * 4. **佐证门抑制**：时窗内但与 clue 准正交的条目不得交卷。
 * 5. **ADR-011 时窗**：high 硬筛一视同仁作用于 Hybrid 语义路。
 * 6. **同域软加成**：currentTabDomain 对齐时压过同语义近邻对手。
 *
 * `must` 门禁 CI；`stretch` 仅 console.info 汇报趋势。
 *
 * **`embeddingAnchor` 约定**：每个非 R0 用例必须显式给出对应目标 item 的 anchor string。
 * runner 会把它拼进 `clueEmbeddingText`，fake embedding 据此与目标 item 余弦恒为 1。
 * 这样 fake hash 算法不论如何演化，语义同向关系都稳。
 */

import type { HybridEvalItemId } from '@/core/recall/eval/hybrid-eval-ids'
import { HYBRID_EVAL_IDS } from '@/core/recall/eval/hybrid-eval-ids'
import { HYBRID_EVAL_ANCHORS } from '@/core/recall/eval/hybrid-eval-corpus'

export type HybridEvalGate = 'must' | 'stretch'

export type HybridEvalExpectation =
  | { kind: 'no_match' }
  | { kind: 'top1'; expectedId: HybridEvalItemId }
  | { kind: 'in_topk'; expectedId: HybridEvalItemId; k?: number }

export interface HybridEvalCase {
  id: string
  /** 用户提交口语线索（单轮）。 */
  clue: string
  /**
   * 显式 anchor：用于 fake embedding 对齐。
   * runner 会把此 anchor 拼进 clueEmbeddingText；与目标 item 的 fake embedding 完全一致，
   * 余弦恒为 1。
   * R0 no_match 用例不需要 anchor。
   */
  embeddingAnchor?: string
  /** 模拟当前 tab 域；可选；缺省不传同名加成。 */
  currentTabDomain?: string
  /** 模拟本会话排除的 MemoryItem id。 */
  dismissedIds?: readonly HybridEvalItemId[]
  gate: HybridEvalGate
  expectation: HybridEvalExpectation
  /** 中文备注：为何这样出题；对应 R0/R4/ADR-011 等契约。 */
  note: string
}

const TARGET_SEMANTIC_NEAR = HYBRID_EVAL_IDS.semanticNearNeighborExcerpt
const TARGET_KEYWORD_LEADER = HYBRID_EVAL_IDS.keywordLeaderPage
const TARGET_PURE_SEMANTIC = HYBRID_EVAL_IDS.pureSemanticMovieNote
const TARGET_IN_WINDOW = HYBRID_EVAL_IDS.inWindowRecentExcerpt
const TARGET_SAME_DOMAIN = HYBRID_EVAL_IDS.sameDomainArticle

export const HYBRID_EVAL_CASES: HybridEvalCase[] = [
  // —— R0：Hybrid 不得用语义近邻填空 ——
  {
    id: 'r0-assistant-play-songs',
    clue: 'play some songs I like',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'R0：零锚点助手发令；corpus 故意放了准正交的「音乐草稿」item；Hybrid 不能借向量填空'
  },
  {
    id: 'r0-non-recall-weather',
    clue: 'what is the weather going to be like tomorrow',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'R0：非 Recall（天气问答）；Hybrid 库内准正交的 weather 摘录不能借此填空'
  },

  // —— 词面领先者保护 ——
  {
    id: 'keyword-leader-protection-against-semantic-rival',
    clue: 'atomic bomb documentary notes',
    embeddingAnchor: HYBRID_EVAL_ANCHORS.keywordLeader,
    gate: 'must',
    expectation: { kind: 'top1', expectedId: TARGET_KEYWORD_LEADER },
    note: '关键词 Top1 强词面领先（HYBRID_KEYWORD_LEADER_MARGIN）；不得被单共享词 + 语义近邻挤首位'
  },

  // —— 纯语义召回 ——
  {
    id: 'pure-semantic-movie-near-neighbor',
    clue: 'that movie review about the first nuclear detonation',
    embeddingAnchor: HYBRID_EVAL_ANCHORS.semanticNear,
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: TARGET_SEMANTIC_NEAR, k: 3 },
    note: 'semantic 同向 item 须进邻域（词面只 shared「movie」）'
  },
  {
    id: 'pure-semantic-physicists-only',
    clue: 'review of physicists behind the first chain reaction',
    embeddingAnchor: HYBRID_EVAL_ANCHORS.pureSemantic,
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: TARGET_PURE_SEMANTIC, k: 3 },
    note: '词面完全无重叠；语义同向仍可召回（stretch 候选升级 must）'
  },

  // —— 佐证门抑制 ——
  {
    id: 'corroboration-suppress-window-only-unrelated',
    clue: 'the privacy article I saved yesterday',
    embeddingAnchor: HYBRID_EVAL_ANCHORS.inWindowRecent,
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: TARGET_IN_WINDOW, k: 3 },
    note: '时窗内 + 词面命中「privacy article」应 Top；窗内准正交 weather 摘录被佐证门剔除'
  },

  // —— ADR-011 时窗硬筛 ——
  {
    id: 'adr011-high-time-hard-window',
    clue: 'the privacy article from a few days ago',
    embeddingAnchor: HYBRID_EVAL_ANCHORS.inWindowRecent,
    gate: 'must',
    expectation: { kind: 'top1', expectedId: TARGET_IN_WINDOW },
    note: 'ADR-011「recent」（low）→ soft 软排；窗外古老 burial item 仍不抢 Top1'
  },

  // —— 同域软加成 ——
  {
    id: 'same-domain-beats-semantic-tie',
    clue: 'Yiveno docs I saved',
    embeddingAnchor: HYBRID_EVAL_ANCHORS.sameDomain,
    currentTabDomain: 'docs.yiveno.com',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: TARGET_SAME_DOMAIN },
    note: 'currentTabDomain 与 `docs.yiveno.com` 命中同域加成；压过 design host 的语义近邻对手'
  },

  // —— stretch：跨语言 / 跨 host 边界（待生产 LLM 协同后再收紧）——
  {
    id: 'stretch-mixed-language-semantic',
    clue: '一篇关于第一颗原子弹的影评',
    embeddingAnchor: HYBRID_EVAL_ANCHORS.semanticNear,
    gate: 'stretch',
    expectation: { kind: 'in_topk', expectedId: TARGET_SEMANTIC_NEAR, k: 3 },
    note: '中文 clue → 英文摘录：模拟 Hybrid Phase B；语义同向时仍可能在邻域'
  },
  {
    id: 'stretch-host-clue-cross-host-rival',
    clue: 'docs.yiveno.com',
    embeddingAnchor: HYBRID_EVAL_ANCHORS.sameDomain,
    dismissedIds: [TARGET_SAME_DOMAIN],
    gate: 'stretch',
    expectation: { kind: 'in_topk', expectedId: HYBRID_EVAL_IDS.offDomainNearNeighbor, k: 3 },
    note: 'host 线索 + 同域条目被 dismiss；Hybrid 邻域里须出现 design host 的语义近邻'
  }
]
