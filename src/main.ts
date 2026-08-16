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

initMobileNav()
initTestimonialDots()
