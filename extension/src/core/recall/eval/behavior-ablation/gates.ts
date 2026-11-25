/**
 * 冻结门槛机械裁决（跑完不许改门槛）。
 */

import { BEHAVIOR_ABLATION_GATES } from '@/core/recall/eval/behavior-ablation/constants'
import type { DeltaCi, GateVerdict } from '@/core/recall/eval/behavior-ablation/types'

export function evaluateFrozenGates(input: {
  prodR1: DeltaCi
  prodMrr: DeltaCi
  prodFalseOpen: DeltaCi
  mechR1: DeltaCi
}): { verdicts: GateVerdict[]; allPassed: boolean } {
  const g = BEHAVIOR_ABLATION_GATES

  const prodR1: GateVerdict = {
    id: 'prod_r1',
    observed: input.prodR1.delta,
    threshold: g.prodR1DeltaMin,
    passed:
      input.prodR1.delta >= g.prodR1DeltaMin &&
      (!g.prodR1CiLowerMustBePositive || input.prodR1.ci95Lower > 0),
    detail: `ON-prod−OFF R@1 delta=${fmt(input.prodR1.delta)}（门槛 ≥${fmt(g.prodR1DeltaMin)}）; 95% CI [${fmt(input.prodR1.ci95Lower)}, ${fmt(input.prodR1.ci95Upper)}]（下限须 >0）`
  }

  const prodMrr: GateVerdict = {
    id: 'prod_mrr',
    observed: input.prodMrr.delta,
    threshold: g.prodMrrDeltaMin,
    passed: input.prodMrr.delta >= g.prodMrrDeltaMin,
    detail: `ON-prod−OFF MRR delta=${fmt(input.prodMrr.delta)}（门槛 ≥${fmt(g.prodMrrDeltaMin)}）; 95% CI [${fmt(input.prodMrr.ci95Lower)}, ${fmt(input.prodMrr.ci95Upper)}]`
  }

  const prodFalseOpen: GateVerdict = {
    id: 'prod_false_open',
    observed: input.prodFalseOpen.delta,
    threshold: g.prodFalseOpenDeltaMax,
    passed: input.prodFalseOpen.delta <= g.prodFalseOpenDeltaMax,
    detail: `ON-prod−OFF 误打开率增幅=${fmt(input.prodFalseOpen.delta)}（门槛 ≤${fmt(g.prodFalseOpenDeltaMax)}）; 95% CI [${fmt(input.prodFalseOpen.ci95Lower)}, ${fmt(input.prodFalseOpen.ci95Upper)}]`
  }

  const mechR1: GateVerdict = {
    id: 'mech_r1',
    observed: input.mechR1.delta,
    threshold: g.mechConflictR1DeltaMin,
    passed: input.mechR1.delta >= g.mechConflictR1DeltaMin,
    detail: `机制轨 B-on−B-off 冲突子集 R@1 delta=${fmt(input.mechR1.delta)}（门槛 ≥${fmt(g.mechConflictR1DeltaMin)}）; 95% CI [${fmt(input.mechR1.ci95Lower)}, ${fmt(input.mechR1.ci95Upper)}]`
  }

  const verdicts = [prodR1, prodMrr, prodFalseOpen, mechR1]
  return {
    verdicts,
    allPassed: verdicts.every(row => row.passed)
  }
}

function fmt(n: number): string {
  return (Math.round(n * 10000) / 10000).toFixed(4)
}
