/** 首页客户端交互：Nav 深底态、scroll reveal */

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
}
