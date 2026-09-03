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

/* ------------------------------------------------------------------
   Creator profile — content tabs (latest/best) + post detail dialog
   ------------------------------------------------------------------ */
interface PostComment { user: string; at: string; text: string; sentiment: number; likes: number }
interface Post {
  caption: string; platformLabel: string; postedAt: string; likes: number; comments: number; views: number
  plays: number; engagementRate: number; derivedReach: number; sentiment: number; series: number[]
  tile: string; commentSample: PostComment[]
}

const fmtNum = (n: number): string => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K` : String(n))

function initCreatorProfile(): void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-post-dialog]')
  const grid = document.querySelector<HTMLElement>('[data-post-grid]')
  const dataEl = document.querySelector<HTMLScriptElement>('[data-posts]')
  if (!dialog || !grid || !dataEl) return
  const posts = JSON.parse(dataEl.textContent || '[]') as Post[]

  document.querySelectorAll<HTMLButtonElement>('[data-content-tabs] [data-sort]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll<HTMLButtonElement>('[data-content-tabs] [data-sort]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)))
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-post]'))
      cards.sort((a, b) =>
        tab.dataset.sort === 'best'
          ? Number(b.dataset.likes) - Number(a.dataset.likes)
          : new Date(b.dataset.at!).getTime() - new Date(a.dataset.at!).getTime(),
      )
      cards.forEach((c) => grid.appendChild(c))
    })
  })

  const set = (name: string, value: string): void => {
    const el = dialog.querySelector<HTMLElement>(`[data-f="${name}"]`)
    if (el) el.textContent = value
  }

  const open = (p: Post): void => {
    set('likes', fmtNum(p.likes)); set('comments', fmtNum(p.comments)); set('views', p.views ? fmtNum(p.views) : '—')
    set('plays', p.plays ? fmtNum(p.plays) : '—'); set('engagementRate', `${p.engagementRate}%`)
    set('derivedReach', p.derivedReach ? fmtNum(p.derivedReach) : '—'); set('sentiment', `${p.sentiment}%`)
    set('caption', p.caption)
    set('postedAt', `${p.platformLabel} · Posted ${new Date(p.postedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`)
    dialog.querySelector<HTMLElement>('[data-post-media]')!.innerHTML = p.tile
    dialog.querySelector<HTMLElement>('[data-post-comments]')!.innerHTML = p.commentSample.length
      ? p.commentSample.map((c) => `<li class="rounded-lg bg-white p-3"><p class="flex items-center justify-between text-[12px] font-bold"><span>${c.user}</span><span class="${c.sentiment >= 70 ? 'text-brand-deep' : c.sentiment >= 40 ? 'text-[#f7941d]' : 'text-[#e5484d]'}">${c.sentiment}% positive</span></p><p class="mt-1 text-[13px] font-medium">${c.text}</p><p class="mt-1 text-[11px] text-black/45">${new Date(c.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ♥ ${c.likes}</p></li>`).join('')
      : '<li class="text-[13px] font-medium text-black/55">Comment analysis appears once the post has synced.</li>'

    const svg = dialog.querySelector<SVGSVGElement>('[data-post-chart]')!
    const max = Math.max(...p.series, 1)
    const pts = p.series.map((v, i) => [40 + (i * 520) / Math.max(p.series.length - 1, 1), 105 - (v / max) * 90] as const)
    svg.innerHTML =
      `<line x1="40" y1="105" x2="560" y2="105" stroke="rgba(0,0,0,.1)"/>` +
      `<text x="0" y="20" font-size="10" fill="rgba(0,0,0,.5)">${fmtNum(max)}</text><text x="0" y="108" font-size="10" fill="rgba(0,0,0,.5)">0</text>` +
      `<polyline fill="none" stroke="#a9e724" stroke-width="3" stroke-linejoin="round" points="${pts.map(([x, y]) => `${x},${y}`).join(' ')}"/>` +
      pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#141517"/>`).join('') +
      ['0h', '24h', '48h', '72h'].map((l, i) => `<text x="${40 + (i * 520) / 3}" y="120" font-size="10" text-anchor="middle" fill="rgba(0,0,0,.5)">${l}</text>`).join('')
    dialog.showModal()
  }

  grid.querySelectorAll<HTMLButtonElement>('[data-post]').forEach((btn) => {
    btn.addEventListener('click', () => open(posts[Number(btn.dataset.post)]!))
  })
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close() })
}

/* ------------------------------------------------------------------
   Charts — Chart.js is loaded only on pages that have <canvas data-chart>,
   and each chart is created when it scrolls into view.
   ------------------------------------------------------------------ */
function initCharts(): void {
  const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas[data-chart]'))
  if (canvases.length === 0) return
  const lib = import('./charts')
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return
      io.unobserve(e.target)
      lib.then(({ render }) => render(e.target as HTMLCanvasElement))
    })
  }, { rootMargin: '200px' })
  canvases.forEach((c) => io.observe(c))
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
initCreatorProfile()
initCharts()

/* /terms.html?account=brand|agency — the app links here; route to the right document */
{
  const alias = document.body.dataset.legalAlias
  const account = new URLSearchParams(location.search).get('account')
  if (alias === 'terms' && (account === 'brand' || account === 'agency')) {
    location.replace(`/legal/terms-${account === 'brand' ? 'brands' : 'agencies'}`)
  }
}
initActiveNav()
initDemoForm()
initPricing()
