/** 首页客户端交互：导航 Hero 态、scroll reveal、waitlist 表单 */

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

function bindWaitlist(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('[data-waitlist-form]')
  const emailInput = root.querySelector<HTMLInputElement>('[data-waitlist-email]')
  const companyInput = root.querySelector<HTMLInputElement>('[data-waitlist-company]')
  const submitBtn = root.querySelector<HTMLButtonElement>('[data-waitlist-submit]')
  const errEl = root.querySelector<HTMLElement>('[data-waitlist-err]')
  const okEl = root.querySelector<HTMLElement>('[data-waitlist-ok]')
  const formWrap = root.querySelector<HTMLElement>('[data-waitlist-form-wrap]')
  const apiBase = (root.dataset.apiBase || 'https://api.yiveno.com').replace(/\/$/, '')
  if (!form || !emailInput || !submitBtn || !errEl || !okEl || !formWrap) return

  const clearError = (): void => {
    errEl.hidden = true
    errEl.textContent = ''
    emailInput.classList.remove('waitlist__input--error')
  }

  emailInput.addEventListener('input', clearError)

  form.addEventListener('submit', async (event: SubmitEvent) => {
    event.preventDefault()
    clearError()
    const trimmed = emailInput.value.trim()
    if (!isValidEmail(trimmed)) {
      errEl.hidden = false
      errEl.textContent = 'Enter a valid email so we can reach you.'
      emailInput.classList.add('waitlist__input--error')
      return
    }

    submitBtn.disabled = true
    submitBtn.textContent = '···'
    emailInput.disabled = true
    try {
      const response = await fetch(`${apiBase}/api/website/waitlist`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          company: companyInput?.value ?? ''
        })
      })
      if (response.status === 429) {
        errEl.hidden = false
        errEl.textContent = 'Too many tries from here. Please try again tomorrow.'
        emailInput.classList.add('waitlist__input--error')
        return
      }
      if (!response.ok) {
        errEl.hidden = false
        errEl.textContent = 'Something went wrong. Try again.'
        emailInput.classList.add('waitlist__input--error')
        return
      }
      formWrap.hidden = true
      okEl.hidden = false
    } catch {
      errEl.hidden = false
      errEl.textContent = 'Something went wrong. Try again.'
      emailInput.classList.add('waitlist__input--error')
    } finally {
      if (okEl.hidden) {
        submitBtn.disabled = false
        submitBtn.textContent = 'Notify me'
        emailInput.disabled = false
      }
    }
  })
}

/** 绑定首页 scroll / nav / waitlist 行为 */
export function initHomePage(): void {
  const hero = document.getElementById('hero')
  if (hero) {
    const navObs = new IntersectionObserver(
      ([entry]) => {
        document.body.dataset.navOverHero = entry?.isIntersecting ? 'true' : 'false'
      },
      { rootMargin: '-68px 0px 0px 0px', threshold: 0 }
    )
    navObs.observe(hero)
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

  document.querySelectorAll<HTMLElement>('[data-waitlist]').forEach(bindWaitlist)
}
