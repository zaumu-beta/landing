import './style.css'

/* ------------------------------------------------------------------
   Mobile navigation
   ------------------------------------------------------------------ */
function initMobileNav(): void {
  const toggle = document.querySelector<HTMLButtonElement>('[data-nav-toggle]')
  const menu = document.querySelector<HTMLElement>('[data-nav-menu]')
  const iconOpen = document.querySelector<SVGPathElement>('[data-nav-icon-open]')
  const iconClose = document.querySelector<SVGPathElement>('[data-nav-icon-close]')

  if (!toggle || !menu) return

  const setOpen = (open: boolean): void => {
    menu.classList.toggle('hidden', !open)
    iconOpen?.classList.toggle('hidden', open)
    iconClose?.classList.toggle('hidden', !open)
    toggle.setAttribute('aria-expanded', String(open))
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
  }

  toggle.addEventListener('click', () => {
    setOpen(menu.classList.contains('hidden'))
  })

  // Close after tapping a link, and on Escape.
  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false))
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false)
  })

  // Reset state when resizing up into the desktop breakpoint.
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
    if (event.matches) setOpen(false)
  })
}

/* ------------------------------------------------------------------
   Testimonial pagination

   The Figma design shows three dots beneath the testimonials. On desktop
   all three cards are visible at once, so the dots only do real work on
   small screens where the list scrolls horizontally.
   ------------------------------------------------------------------ */
function initTestimonialDots(): void {
  const dotGroup = document.querySelector<HTMLElement>('[data-testimonial-dots]')
  if (!dotGroup) return

  const dots = Array.from(dotGroup.querySelectorAll<HTMLButtonElement>('button'))
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>('[data-testimonial-dots]')
  )
    .map((group) => group.previousElementSibling)
    .flatMap((list) => (list ? Array.from(list.children) : []))

  if (cards.length === 0) return

  const activate = (index: number): void => {
    dots.forEach((dot, i) => {
      const isActive = i === index
      dot.classList.toggle('bg-brand', isActive)
      dot.classList.toggle('bg-black/20', !isActive)
      if (isActive) {
        dot.setAttribute('aria-current', 'true')
      } else {
        dot.removeAttribute('aria-current')
      }
    })
  }

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      cards[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      activate(index)
    })
  })
}

/* ------------------------------------------------------------------
   Active nav link — driven by <body data-page="…">
   ------------------------------------------------------------------ */
function initActiveNav(): void {
  const page = document.body.dataset.page
  if (!page) return
  document.querySelectorAll<HTMLAnchorElement>(`[data-nav="${page}"]`).forEach((a) => {
    a.classList.add('text-brand')
    a.setAttribute('aria-current', 'page')
  })
}

/* ------------------------------------------------------------------
   Audience switch (demo page) — every [data-audience] element shows
   only for the chosen audience. Initial value comes from ?for=creator.
   ------------------------------------------------------------------ */
type Audience = 'brand' | 'creator'

function setAudience(audience: Audience): void {
  document.querySelectorAll<HTMLElement>('[data-audience]').forEach((el) => {
    el.hidden = el.dataset.audience !== audience
  })
  document.querySelectorAll<HTMLButtonElement>('[data-audience-tab]').forEach((tab) => {
    tab.setAttribute('aria-selected', String(tab.dataset.audienceTab === audience))
  })
  const url = new URL(window.location.href)
  if (audience === 'creator') url.searchParams.set('for', 'creator')
  else url.searchParams.delete('for')
  history.replaceState(null, '', url)
}

/* ------------------------------------------------------------------
   Demo request form — single step + done state. No backend yet: the
   submit handler is where the POST to /api/demo goes.
   ------------------------------------------------------------------ */
function initDemoForm(): void {
  const form = document.querySelector<HTMLFormElement>('[data-demo-form]')
  if (!form) return

  const fields = form.querySelector<HTMLFieldSetElement>('[data-step="1"]')!
  const done = form.querySelector<HTMLElement>('[data-step="done"]')!
  const submit = form.querySelector<HTMLButtonElement>('[data-submit]')!
  const email = form.elements.namedItem('email') as HTMLInputElement
  const emailError = form.querySelector<HTMLElement>('[data-error="email"]')!

  const audience = (): Audience =>
    new URLSearchParams(location.search).get('for') === 'creator' ? 'creator' : 'brand'

  const isVisible = (el: Element): boolean => !el.closest<HTMLElement>('[data-audience]')?.hidden

  const validate = (): boolean => {
    const required = Array.from(fields.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[required], select'))
      .filter(isVisible)
    let ok = required.every((el) => el.value.trim() !== '' && (el.type !== 'email' || el.checkValidity()))
    if (audience() === 'brand') {
      ok = ok && fields.querySelectorAll('input[name="goals"]:checked').length > 0
    }
    submit.disabled = !ok
    return ok
  }

  setAudience(audience())
  form.querySelectorAll<HTMLButtonElement>('[data-audience-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      setAudience(tab.dataset.audienceTab as Audience)
      validate()
    })
  })

  fields.addEventListener('input', validate)
  fields.addEventListener('change', validate)
  email.addEventListener('blur', () => {
    emailError.classList.toggle('hidden', email.value === '' || email.checkValidity())
  })

  const formError = form.querySelector<HTMLElement>('[data-error="form"]')!
  const submitLabel = submit.innerHTML

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!validate()) return

    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>
    data.audience = audience()
    data.goals = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="goals"]:checked')).map((c) => c.value).join(',')
    data.page = location.href

    submit.disabled = true
    submit.textContent = 'Sending…'
    formError.hidden = true

    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !result.ok) throw new Error(result.error || 'Something went wrong. Please try again.')

      fields.hidden = true
      done.hidden = false
      form.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (err) {
      formError.textContent = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      formError.hidden = false
    } finally {
      submit.innerHTML = submitLabel
      setAudience(audience())
      validate()
    }
  })
}

/* ------------------------------------------------------------------
   Pricing page — brand/creator tabs and monthly/annual toggle
   ------------------------------------------------------------------ */
function initPricing(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>('[data-pricing-tab]')
  if (tabs.length === 0) return

  const select = (which: string): void => {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.pricingTab === which)))
    document.querySelectorAll<HTMLElement>('[data-pricing-panel]').forEach((p) => {
      p.hidden = p.dataset.pricingPanel !== which
    })
  }
  tabs.forEach((t) => t.addEventListener('click', () => select(t.dataset.pricingTab!)))
  if (new URLSearchParams(location.search).get('for') === 'creator') select('creators')

  const toggle = document.querySelector<HTMLButtonElement>('[data-billing-toggle]')
  const knob = document.querySelector<HTMLElement>('[data-billing-knob]')
  if (!toggle || !knob) return
  toggle.addEventListener('click', () => {
    const annual = toggle.getAttribute('aria-checked') !== 'true'
    toggle.setAttribute('aria-checked', String(annual))
    knob.style.transform = annual ? 'translateX(20px)' : 'translateX(0)'
    document.querySelectorAll<HTMLElement>('[data-price]').forEach((p) => {
      p.textContent = annual ? p.dataset.annual! : p.dataset.monthly!
    })
  })
}

/* ------------------------------------------------------------------
   Header dropdown (Resources)
   ------------------------------------------------------------------ */
function initDropdowns(): void {
  document.querySelectorAll<HTMLElement>('[data-dropdown]').forEach((root) => {
    const toggle = root.querySelector<HTMLButtonElement>('[data-dropdown-toggle]')!
    const menu = root.querySelector<HTMLElement>('[data-dropdown-menu]')!
    const set = (open: boolean): void => {
      menu.hidden = !open
      toggle.setAttribute('aria-expanded', String(open))
    }
    toggle.addEventListener('click', () => set(menu.hidden === true))
    root.addEventListener('mouseenter', () => set(true))
    root.addEventListener('mouseleave', () => set(false))
    root.addEventListener('focusout', (e) => {
      if (!root.contains(e.relatedTarget as Node | null)) set(false)
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') set(false)
    })
  })
}

/* ------------------------------------------------------------------
   Resources hub — type tabs + search, state mirrored in ?type= & ?q=
   ------------------------------------------------------------------ */
function initResources(): void {
  const grid = document.querySelector<HTMLElement>('[data-resource-grid]')
  if (!grid) return
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-resource-tabs] [data-type]'))
  const search = document.querySelector<HTMLInputElement>('[data-resource-search]')!
  const empty = document.querySelector<HTMLElement>('[data-resource-empty]')!
  const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-card]'))
  let type = 'all'

  const apply = (): void => {
    const q = search.value.trim().toLowerCase()
    let shown = 0
    cards.forEach((card) => {
      const ok = (type === 'all' || card.dataset.type === type) && (!q || (card.dataset.search ?? '').includes(q))
      card.hidden = !ok
      if (ok) shown++
    })
    empty.hidden = shown > 0
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.type === type)))
    const url = new URL(location.href)
    type === 'all' ? url.searchParams.delete('type') : url.searchParams.set('type', type)
    q ? url.searchParams.set('q', q) : url.searchParams.delete('q')
    history.replaceState(null, '', url)
  }

  tabs.forEach((t) => t.addEventListener('click', () => { type = t.dataset.type!; apply() }))
  document.querySelectorAll<HTMLAnchorElement>('[data-type-link]').forEach((a) =>
    a.addEventListener('click', () => { type = a.dataset.typeLink!; apply() }),
  )
  search.addEventListener('input', apply)

  const params = new URLSearchParams(location.search)
  const t = params.get('type')
  if (t && tabs.some((b) => b.dataset.type === t)) type = t
  search.value = params.get('q') ?? ''
  apply()
}

/* Article page: native share, clipboard fallback */
function initShare(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-share]')
  if (!btn) return
  btn.addEventListener('click', async () => {
    const data = { title: document.title, url: location.href }
    try {
      if (navigator.share) await navigator.share(data)
      else {
        await navigator.clipboard.writeText(location.href)
        const label = btn.textContent
        btn.textContent = 'Link copied'
        setTimeout(() => (btn.textContent = label), 1600)
      }
    } catch { /* user cancelled */ }
  })
}

initMobileNav()
initTestimonialDots()
initDropdowns()
initResources()
initShare()
initActiveNav()
initDemoForm()
initPricing()
