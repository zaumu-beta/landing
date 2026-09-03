/**
 * Builds the Resources section from Markdown.
 *
 *   content/insights/*.md  →  resources/<slug>.html   (Creator insights)
 *   content/guides/*.md    →  resources/<slug>.html   (Platform guides)
 *   resources.html                                     (hub: tabs + search)
 *
 * Each .md starts with a front-matter block:
 *   ---
 *   title: Know your usage rights before you sign anything
 *   description: One sentence shown on the card and in <meta>.
 *   date: 2026-04-20
 *   author: Zaumu Team           (optional)
 *   readTime: 4                  (minutes, optional — estimated if absent)
 *   featured: true               (optional — pinned to the top of the hub)
 *   tags: rates, contracts       (optional)
 *   ---
 *
 * Runs before `vite` / `vite build` (see package.json scripts). The generated
 * HTML is git-ignored — edit the Markdown and the templates, not the output.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { marked } from 'marked'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const CONTENT = join(ROOT, 'content')
const OUT = join(ROOT, 'resources')
const TPL = (name) => readFileSync(join(ROOT, 'src/templates', name), 'utf8')

const TYPES = {
  insights: {
    label: 'Creator insights',
    short: 'Insight',
    blurb: 'Rates, rights, negotiation and the business of being a creator in Africa.',
    color: 'brand',
    soft: 'brand-soft',
  },
  guides: {
    label: 'Platform guides',
    short: 'Guide',
    blurb: 'Step-by-step help for using Zaumu — profiles, campaigns, milestones, invoices.',
    color: 'violet',
    soft: 'lavender-soft',
  },
}

/* ------------------------------------------------------------ helpers */
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const fmtDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function parse(file, type) {
  const raw = readFileSync(file, 'utf8')
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) throw new Error(`${file}: missing front-matter`)
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  const body = m[2]
  const words = body.split(/\s+/).filter(Boolean).length
  return {
    type,
    slug: basename(file, '.md'),
    title: meta.title ?? basename(file, '.md'),
    description: meta.description ?? '',
    date: meta.date ?? '1970-01-01',
    author: meta.author ?? 'Zaumu Team',
    readTime: Number(meta.readTime) || Math.max(2, Math.round(words / 200)),
    featured: meta.featured === 'true',
    tags: (meta.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    body,
  }
}

/* Heading ids + table of contents for the article sidebar */
function render(md) {
  const toc = []
  const renderer = new marked.Renderer()
  renderer.heading = ({ text, depth }) => {
    const id = slugify(text)
    if (depth === 2) toc.push({ id, text })
    return `<h${depth} id="${id}">${text}</h${depth}>\n`
  }
  const html = marked.parse(md, { renderer, gfm: true })
  return { html, toc }
}

function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : ''))
}

/* --------------------------------------------------------------- cards */
function card(a, { large = false } = {}) {
  const t = TYPES[a.type]
  return `
<a href="/resources/${a.slug}.html" data-card data-type="${a.type}" data-search="${esc((a.title + ' ' + a.description + ' ' + a.tags.join(' ')).toLowerCase())}"
   class="group flex flex-col rounded-2xl border border-black/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgb(0_0_0/0.08)] ${large ? 'lg:col-span-2 lg:flex-row lg:items-center lg:gap-10 lg:p-8' : ''}">
  ${large ? `<div class="mb-6 flex h-[180px] items-center justify-center rounded-xl bg-${t.soft} lg:mb-0 lg:h-[220px] lg:w-[40%] lg:shrink-0"><span class="scribble scribble-${a.type === 'insights' ? 'swoosh' : 'ring'} w-[60%] text-${t.color} opacity-90" aria-hidden="true"></span></div>` : ''}
  <div class="flex flex-1 flex-col">
    <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em]">
      <span class="rounded-full bg-${t.soft} px-2.5 py-1 text-black">${t.label}</span>
      <span class="text-black/45">${a.readTime} min read</span>
    </div>
    <h3 class="mt-4 text-[${large ? '24' : '17'}px] font-extrabold leading-[1.25] tracking-[-0.3px] group-hover:underline group-hover:decoration-brand group-hover:decoration-[3px] group-hover:underline-offset-4">${esc(a.title)}</h3>
    <p class="mt-2.5 text-[14px] leading-[22px] text-black/70">${esc(a.description)}</p>
    <p class="mt-auto pt-5 text-[12px] font-semibold text-black/45">${fmtDate(a.date)} · ${esc(a.author)}</p>
  </div>
</a>`
}

/* ---------------------------------------------------------------- build */
if (existsSync(OUT)) rmSync(OUT, { recursive: true })
mkdirSync(OUT, { recursive: true })

const articles = []
for (const type of Object.keys(TYPES)) {
  const dir = join(CONTENT, type)
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.md'))) articles.push(parse(join(dir, f), type))
}
articles.sort((a, b) => (b.featured - a.featured) || b.date.localeCompare(a.date))

const articleTpl = TPL('article.html')
for (const a of articles) {
  const { html, toc } = render(a.body)
  const t = TYPES[a.type]
  const related = articles.filter((x) => x.slug !== a.slug && x.type === a.type).slice(0, 3)
  const page = fill(articleTpl, {
    title: esc(a.title),
    description: esc(a.description),
    slug: a.slug,
    type: a.type,
    typeLabel: t.label,
    typeColor: t.color,
    typeSoft: t.soft,
    date: fmtDate(a.date),
    isoDate: a.date,
    author: esc(a.author),
    readTime: a.readTime,
    body: html,
    toc: toc.length > 1
      ? `<nav aria-label="On this page" class="text-[13px]"><p class="font-bold uppercase tracking-[0.1em] text-black/45">On this page</p><ol class="mt-3 space-y-2 font-semibold">${toc.map((h) => `<li><a href="#${h.id}" class="text-black/70 transition hover:text-black">${h.text}</a></li>`).join('')}</ol></nav>`
      : '',
    related: related.length ? `<h2 class="text-[22px] font-extrabold">More ${t.label.toLowerCase()}</h2><div class="mt-6 grid gap-5 md:grid-cols-3">${related.map((r) => card(r)).join('')}</div>` : '',
    tags: a.tags.map((tag) => `<span class="rounded-full border border-black/10 px-3 py-1 text-[12px] font-semibold">${esc(tag)}</span>`).join(''),
  })
  writeFileSync(join(OUT, `${a.slug}.html`), page)
}

const [featured, ...rest] = articles
const hub = fill(TPL('resources-index.html'), {
  cards: [featured ? card(featured, { large: true }) : '', ...rest.map((a) => card(a))].join('\n'),
  countInsights: articles.filter((a) => a.type === 'insights').length,
  countGuides: articles.filter((a) => a.type === 'guides').length,
})
writeFileSync(join(ROOT, 'resources.html'), hub)

console.log(`resources: ${articles.length} articles → resources/ + resources.html`)
