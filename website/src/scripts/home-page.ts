/** 首页客户端交互：Nav 深底态、scroll reveal */

import { t } from '../i18n/t'

/** 顶栏高度（与 site-critical Nav padding / rootMargin 约定一致） */
const NAV_BAND_PX = 68

/**
 * Nav 叠在 Ink 深底上 → 浅色字标 + on-dark mark；叠在 Paper → 深色。
 * 只看「顶栏背后那条带」落在哪个段上，不能用「视口内是否还有 ink」——否则 Paper 顶栏会被下方 ink 误切浅色。
 */
export function initHomePage(): void {
  const inkSections = Array.from(document.querySelectorAll<HTMLElement>('#hero, .home-sec--ink'))
  if (inkSections.length > 0) {
    /** 采样点：顶栏垂直中线 */
    const sampleY = (): number => NAV_BAND_PX / 2

    const inkBehindNav = (): boolean => {
      const y = sampleY()
      return inkSections.some(el => {
        const r = el.getBoundingClientRect()
        return r.top <= y && r.bottom >= y
      })
    }

    const syncNavOverInk = (): void => {
      document.body.dataset.navOverHero = inkBehindNav() ? 'true' : 'false'
    }

    let raf = 0
    const scheduleSync = (): void => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        syncNavOverInk()
      })
    }

    syncNavOverInk()
    window.addEventListener('scroll', scheduleSync, { passive: true })
    window.addEventListener('resize', scheduleSync)
  }

  const nodes = document.querySelectorAll('.reveal')
  if (nodes.length && 'IntersectionObserver' in window) {
    const revealObs = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in', 'is-in')
            revealObs.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.1 }
    )
    nodes.forEach(el => revealObs.observe(el))
  } else {
    nodes.forEach(el => el.classList.add('in', 'is-in'))
  }

  initHomeFlowDemo()
}

const FLOW_PHASES = ['save', 'forget', 'recall'] as const
type FlowPhase = (typeof FLOW_PHASES)[number]

/** 流程 live 区文案：跟官网 locale（与 data-yiveno-i18n 同源） */
function flowLiveCopy(phase: FlowPhase): string {
  if (phase === 'save') return t('home.flow.live_save')
  if (phase === 'forget') return t('home.flow.live_forget')
  return t('home.flow.live_recall')
}

const FLOW_DWELL_MS = 3400

/** Save → Forget → Recall 循环；入视口才跑；尊重 prefers-reduced-motion */
function initHomeFlowDemo(): void {
  const root = document.querySelector<HTMLElement>('[data-flow-demo]')
  if (!root) return

  const live = root.querySelector<HTMLElement>('[data-flow-live]')
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-flow-tab]'))
  let phaseIndex = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let running = false

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const setPhase = (phase: FlowPhase): void => {
    root.dataset.phase = phase
    phaseIndex = FLOW_PHASES.indexOf(phase)
    for (const tab of tabs) {
      const id = tab.dataset.flowTab
      tab.setAttribute('aria-selected', id === phase ? 'true' : 'false')
    }
    if (live) live.textContent = flowLiveCopy(phase)
  }

  const tick = (): void => {
    phaseIndex = (phaseIndex + 1) % FLOW_PHASES.length
    setPhase(FLOW_PHASES[phaseIndex]!)
  }

  const stop = (): void => {
    if (timer != null) {
      clearInterval(timer)
      timer = null
    }
    running = false
  }

  const start = (): void => {
    if (reduceMotion || running) return
    running = true
    timer = setInterval(tick, FLOW_DWELL_MS)
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      const id = tab.dataset.flowTab
      if (id !== 'save' && id !== 'forget' && id !== 'recall') return
      setPhase(id)
      stop()
      if (!reduceMotion) start()
    })
  }

  if (reduceMotion) {
    setPhase('recall')
    return
  }

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) start()
          else stop()
        }
      },
      { threshold: 0.35 }
    )
    obs.observe(root)
  } else {
    start()
  }
}
