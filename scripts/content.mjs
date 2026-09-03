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
import { buildCreators } from './creators.mjs'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const CONTENT = join(ROOT, 'content')
const OUT = join(ROOT, 'resources')
const TPL = (name) => readFileSync(join(ROOT, 'src/templates', name), 'utf8')
const SITE_URL = 'https://zaumu.com'
const ORG = { '@id': `${SITE_URL}/#organization` }
const jsonld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`
const breadcrumb = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE_URL + url })),
})

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
  const seen = new Map()
  const renderer = new marked.Renderer()
  renderer.heading = ({ text, depth }) => {
    let id = slugify(text)
    const n = (seen.get(id) ?? 0) + 1
    seen.set(id, n)
    if (n > 1) id = `${id}-${n}`
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
<a href="/resources/${a.slug}" data-card data-type="${a.type}" data-search="${esc((a.title + ' ' + a.description + ' ' + a.tags.join(' ')).toLowerCase())}"
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
    jsonld: jsonld([
      {
        '@context': 'https://schema.org',
        '@type': a.type === 'guides' ? 'HowTo' : 'Article',
        headline: a.title,
        description: a.description,
        datePublished: a.date,
        dateModified: a.date,
        author: { '@type': 'Organization', name: a.author, ...(a.author === 'Zaumu Team' ? ORG : {}) },
        publisher: ORG,
        mainEntityOfPage: `${SITE_URL}/resources/${a.slug}`,
        image: `${SITE_URL}/og-image.png`,
        inLanguage: 'en',
        keywords: a.tags.join(', ') || undefined,
        ...(a.type === 'guides' ? { name: a.title, step: toc.map((h) => ({ '@type': 'HowToStep', name: h.text, url: `${SITE_URL}/resources/${a.slug}#${h.id}` })) } : {}),
      },
      breadcrumb([['Resources', '/resources'], [t.label, `/resources?type=${a.type}`], [a.title, `/resources/${a.slug}`]]),
    ]),
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

/* --------------------------------------------------------------- legal */
const LEGAL_DIR = join(CONTENT, 'legal')
const LEGAL_OUT = join(ROOT, 'legal')
// Order of the document switcher. `alias` also writes a copy at the site root
// so /terms.html and /privacy.html work as footer links and app deep-links.
const LEGAL = [
  { slug: 'terms-creators', group: 'Terms of Service', short: 'Creators', alias: 'terms' },
  { slug: 'terms-brands', group: 'Terms of Service', short: 'Brands' },
  { slug: 'terms-agencies', group: 'Terms of Service', short: 'Agencies' },
  { slug: 'escrow-policy', short: 'Escrow Trust Policy' },
  { slug: 'privacy', short: 'Privacy Policy', alias: 'privacy' },
]
if (existsSync(LEGAL_DIR)) {
  if (existsSync(LEGAL_OUT)) rmSync(LEGAL_OUT, { recursive: true })
  mkdirSync(LEGAL_OUT, { recursive: true })
  const legalTpl = TPL('legal.html')
  const docs = LEGAL.filter((d) => existsSync(join(LEGAL_DIR, d.slug + '.md'))).map((d) => ({ ...d, ...parse(join(LEGAL_DIR, d.slug + '.md'), 'legal') }))
  for (const d of docs) {
    const { html, toc } = render(d.body)
    const switcher = docs
      .map((o) => {
        const label = o.group ? `${o.group}: ${o.short}` : o.short
        const active = o.slug === d.slug
        return `            <a href="/legal/${o.slug}" ${active ? 'aria-current="page"' : ''} class="rounded-full px-4 py-2 transition ${active ? 'bg-black text-white' : 'border border-black/15 bg-white hover:border-black'}">${label}</a>`
      })
      .join('\n')
    const page = fill(legalTpl, {
      title: esc(d.title),
      description: esc(d.description),
      slug: d.slug,
      date: fmtDate(d.date),
      isoDate: d.date,
      body: html,
      switcher,
      toc: `<nav aria-label="On this page" class="text-[13px]"><p class="font-bold uppercase tracking-[0.1em] text-black/45">On this page</p><ol class="mt-3 space-y-2 font-semibold">${toc.map((h) => `<li><a href="#${h.id}" class="text-black/70 transition hover:text-black">${h.text}</a></li>`).join('')}</ol></nav>`,
      jsonld: jsonld([
        { '@context': 'https://schema.org', '@type': 'WebPage', name: d.title, description: d.description, url: `${SITE_URL}/legal/${d.slug}`, dateModified: d.date, publisher: ORG, inLanguage: 'en' },
        breadcrumb([['Legal', '/legal/terms-creators'], [d.title, `/legal/${d.slug}`]]),
      ]),
    })
    writeFileSync(join(LEGAL_OUT, `${d.slug}.html`), page)
    if (d.alias) writeFileSync(join(ROOT, `${d.alias}.html`), page.replace(`data-legal="${d.slug}"`, `data-legal="${d.slug}" data-legal-alias="${d.alias}"`))
  }
  console.log(`legal: ${docs.length} documents → legal/ + terms.html, privacy.html`)
}

/* ------------------------------------------------------ sitemap + llms.txt */
const creatorUrls = buildCreators()
const today = new Date().toISOString().slice(0, 10)
const legalDocs = existsSync(LEGAL_DIR) ? LEGAL.filter((d) => existsSync(join(LEGAL_DIR, d.slug + '.md'))).map((d) => ({ ...d, ...parse(join(LEGAL_DIR, d.slug + '.md'), 'legal') })) : []
const urls = [
  { loc: '/', priority: '1.0', changefreq: 'weekly', lastmod: today },
  { loc: '/about', priority: '0.7', changefreq: 'monthly', lastmod: today },
  { loc: '/pricing', priority: '0.9', changefreq: 'monthly', lastmod: today },
  { loc: '/demo', priority: '0.8', changefreq: 'monthly', lastmod: today },
  { loc: '/resources', priority: '0.8', changefreq: 'weekly', lastmod: articles[0]?.date ?? today },
  ...articles.map((a) => ({ loc: `/resources/${a.slug}`, priority: a.type === 'guides' ? '0.7' : '0.6', changefreq: 'monthly', lastmod: a.date })),
  ...legalDocs.map((d) => ({ loc: `/legal/${d.slug}`, priority: '0.3', changefreq: 'yearly', lastmod: d.date })),
  ...creatorUrls,
]
mkdirSync(join(ROOT, 'public'), { recursive: true })
writeFileSync(
  join(ROOT, 'public/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${SITE_URL}${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n') +
    `\n</urlset>\n`,
)

const llms = `# Zaumu

> Zaumu is a creator-first marketplace for Africa. Photographers, filmmakers, designers, influencers and content creators build one verified profile, get discovered by brands, run campaigns and get paid on milestones. Brands and agencies find verified creators, brief and chat in one place, track performance and release payment when work is approved. Based in Nairobi, Kenya. Free for creators; a flat 15% service fee applies only to completed campaigns. Payouts via M-Pesa or bank transfer.

## Key facts

- Audience: African creators (supply) and brands/agencies hiring them (demand).
- Pricing: free to join for everyone; 15% service fee on completed campaigns; paid plans for brands running campaigns every month. See /pricing.
- Payments: brand funds the full campaign up front into escrow; released per milestone on approval. See /legal/escrow-policy.
- Invoicing: creators issue KRA eTIMS invoices per milestone. See /resources/etims-invoice-for-a-campaign.
- Contact: support@zaumu.com · Instagram @zaumu.ke

## Pages

- [Home](${SITE_URL}/): what Zaumu does for creators and brands
- [About](${SITE_URL}/about): mission, values, team
- [Pricing](${SITE_URL}/pricing): creator plan (free) and brand plans
- [Request a demo](${SITE_URL}/demo): brand demo / creator sign-up form

## Creator insights
${articles.filter((a) => a.type === 'insights').map((a) => `- [${a.title}](${SITE_URL}/resources/${a.slug}): ${a.description}`).join('\n')}

## Platform guides
${articles.filter((a) => a.type === 'guides').map((a) => `- [${a.title}](${SITE_URL}/resources/${a.slug}): ${a.description}`).join('\n')}

## Creator directory
- [Creators in Kenya](${SITE_URL}/creators): verified creators ranked by Zaumu Score, by category and city, with public profiles at /creators/<handle>

## Legal
${legalDocs.map((d) => `- [${d.title}](${SITE_URL}/legal/${d.slug})`).join('\n')}
`
writeFileSync(join(ROOT, 'public/llms.txt'), llms)
console.log(`sitemap: ${urls.length} urls → public/sitemap.xml · public/llms.txt`)
