/**
 * Builds the public creator directory (programmatic SEO) — see TODO.md.
 *
 *   content/creators/sample.json   →  DUMMY source. Replace `loadData()` with
 *                                     the Laravel public API (TODO.md §2).
 *
 *   creators.html                  →  hub (all locations / categories)
 *   creators/<location>.html       →  "Top creators in Kenya"
 *   creators/<location>/<cat>.html →  "Top comedy creators in Kenya"
 *   creators/<city>.html           →  "Top creators in Nairobi"
 *   creators/<city>/<cat>.html     →  "Top food creators in Nairobi"
 *   creators/<handle>.html         →  public profile
 *
 * A directory page is only generated when it has >= MIN_PER_PAGE creators,
 * otherwise it's thin content and hurts the whole /creators subtree.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const OUT = join(ROOT, 'creators')
const TPL = (name) => readFileSync(join(ROOT, 'src/templates', name), 'utf8')
const SITE_URL = 'https://zaumu.com'
const ORG = { '@id': `${SITE_URL}/#organization` }

export const MIN_PER_PAGE = 3 // TODO.md: raise to 8 with real data
const TOP_N = 20

/* ----------------------------------------------------------- load data */
// TODO(api): replace with fetch(`${process.env.API_URL}/public/creators/export`) — TODO.md §2
function loadData() {
  return JSON.parse(readFileSync(join(ROOT, 'content/creators/sample.json'), 'utf8'))
}

/* ------------------------------------------------------------- helpers */
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : ''))
const jsonld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`
const num = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(n))
const monthYear = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const relTime = (iso) => {
  const d = (Date.now() - new Date(iso).getTime()) / 864e5
  return d < 1 ? 'today' : d < 2 ? 'yesterday' : d < 7 ? `${Math.floor(d)} days ago` : d < 30 ? `${Math.floor(d / 7)} weeks ago` : 'this month'
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

const PLATFORM = {
  tiktok: { label: 'TikTok', url: (h) => `https://www.tiktok.com/${h}`, icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 3c.4 2.6 2 4.2 4.5 4.4v3.2c-1.7 0-3.2-.5-4.5-1.4v6.3c0 3.4-2.7 6-6.1 6S4.3 18.9 4.3 15.5c0-3.3 2.5-5.9 5.9-6v3.3a2.7 2.7 0 1 0 2.7 2.7V3h3.6Z"/></svg>' },
  instagram: { label: 'Instagram', url: (h) => `https://www.instagram.com/${h.replace('@', '')}`, icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>' },
  youtube: { label: 'YouTube', url: (h) => `https://www.youtube.com/${h}`, icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 8.2c-.2-1.4-.9-2.3-2.3-2.5C17.5 5.4 12 5.4 12 5.4s-5.5 0-7.7.3C2.9 5.9 2.2 6.8 2 8.2 1.8 9.6 1.8 12 1.8 12s0 2.4.2 3.8c.2 1.4.9 2.3 2.3 2.5 2.2.3 7.7.3 7.7.3s5.5 0 7.7-.3c1.4-.2 2.1-1.1 2.3-2.5.2-1.4.2-3.8.2-3.8s0-2.4-.2-3.8ZM10 15V9l5.2 3L10 15Z"/></svg>' },
  facebook: { label: 'Facebook', url: () => `https://www.facebook.com/`, icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.2c0-.9.3-1.5 1.5-1.5h1.5V5.1c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8V11H8v3h2.6v7h2.9Z"/></svg>' },
  x: { label: 'X', url: (h) => `https://x.com/${h.replace('@', '')}`, icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3l-6.7 7.7L22 21h-6.2l-4.8-6.3L5.4 21h-3l7.2-8.2L2 3h6.3l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/></svg>' },
}

/* Placeholder avatar: initials on a brand-tinted circle. Replace with the
   creator's avatar URL when the API provides one (TODO.md §2). */
const PALETTE = ['#a9e724', '#7029f3', '#2bb3e6', '#f7941d', '#f5c518', '#e5484d']
function avatar(c, size = 88, cls = '') {
  const initials = c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')
  const bg = PALETTE[c.name.length % PALETTE.length]
  const fg = ['#7029f3', '#e5484d'].includes(bg) ? '#fff' : '#111'
  return `<span class="${cls} flex shrink-0 items-center justify-center rounded-full font-extrabold" style="width:${size}px;height:${size}px;background:${bg};color:${fg};font-size:${Math.round(size * 0.34)}px" aria-hidden="true">${initials}</span>`
}

/* Placeholder post thumbnail: gradient tile with the caption. Replace with
   the post's media thumbnail when available (TODO.md §2). */
function postTile(p) {
  return `<div class="flex h-full w-full items-end p-3" style="background:linear-gradient(160deg,${p.color} 0%,#141517 140%)"><span class="rounded bg-white/90 px-2 py-1 text-[10px] font-extrabold uppercase leading-tight line-clamp-2 text-black">${esc(p.caption.length > 26 ? p.caption.slice(0, 24) + "…" : p.caption)}</span></div>`
}

/* --------------------------------------------------------- components */
function platformIcons(c, size = 'size-4') {
  return Object.keys(c.accounts).map((k) => `<span class="${size} text-black/70" title="${PLATFORM[k].label}">${PLATFORM[k].icon}</span>`).join('')
}

/* Three small Chart.js charts per row, in the reports-page style.
   Rendered client-side by initCharts() in src/main.ts from data-chart attrs. */
const PLATFORM_LABEL = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', facebook: 'Facebook', x: 'X' }
const PLATFORM_SHORT = { tiktok: 'TikTok', instagram: 'IG', youtube: 'YT', facebook: 'FB', x: 'X' }
function chartTrio(c) {
  const keys = Object.keys(c.accounts)
  const labels = keys.map((k) => PLATFORM_LABEL[k])
  const attr = (o) => esc(JSON.stringify(o))
  const posts = { labels, platforms: keys, values: keys.map((k) => c.accounts[k].posts) }
  const followers = { labels: keys.map((k) => PLATFORM_SHORT[k]), full: labels, platforms: keys, values: keys.map((k) => c.accounts[k].followers) }
  const t = c.metrics.trend ?? { likes: [], views: [], comments: [] }
  const trend = { likes: t.likes, views: t.views, comments: t.comments }
  const box = (title, type, data, extra = '') => `<div class="min-w-0"><p class="mb-1.5 truncate text-[10px] font-bold uppercase tracking-[0.1em] text-black/45">${title}</p><div class="relative h-[150px]"><canvas data-chart="${type}" data-series="${attr(data)}" ${extra} aria-label="${title}" role="img"></canvas></div></div>`
  return `<div class="grid grid-cols-2 gap-3 rounded-xl bg-cream/60 p-4 sm:grid-cols-3">${box('Posts', 'doughnut', posts)}${box('Followers', 'bar', followers)}<div class="col-span-2 sm:col-span-1">${box('30-day engagement', 'line', trend)}</div></div>`
}

function creatorRow(c, rank, data) {
  const cats = c.categories.map((k) => `<a href="/creators/${c.city}/${k}" class="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold hover:bg-brand-soft">${data.categories[k]}</a>`).join('')
  const charts = chartTrio(c)
  return `
<li class="rounded-2xl border border-black/10 bg-white p-5 transition hover:shadow-[0_12px_30px_rgb(0_0_0/0.08)] lg:p-6">
  <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-center">
    <div class="flex gap-4">
      <div class="relative shrink-0">${avatar(c, 72)}<span class="absolute -left-2 -top-2 flex size-7 items-center justify-center rounded-full bg-black text-[12px] font-extrabold text-white">${rank}</span></div>
      <div class="min-w-0 flex-1">
        <h3 class="flex flex-wrap items-center gap-2 text-[18px] font-extrabold leading-tight"><a href="/creators/${c.handle}" class="hover:underline hover:decoration-brand hover:decoration-[3px] hover:underline-offset-4">${esc(c.name)}</a>${c.verified ? '<svg class="size-4 text-brand-deep" viewBox="0 0 20 20" fill="currentColor" aria-label="Verified"><path d="M10 1.5 12.4 3.4l3-.3.8 2.9 2.6 1.5-1.2 2.8 1.2 2.8-2.6 1.5-.8 2.9-3-.3L10 18.5 7.6 16.6l-3 .3-.8-2.9-2.6-1.5 1.2-2.8L1.2 7.5l2.6-1.5.8-2.9 3 .3L10 1.5Zm-1 11.1 5-5-1.4-1.4-3.6 3.6-1.6-1.6L6 9.6l2.9 3Z"/></svg>' : ''}</h3>
        <p class="mt-0.5 text-[13px] font-semibold text-black/60">${esc(c.headline)} · ${data.cities[c.city]}</p>
        <div class="mt-2.5 flex flex-wrap items-center gap-1.5">${cats}<span class="ml-1 flex items-center gap-1.5">${platformIcons(c)}</span></div>
        <dl class="mt-4 grid grid-cols-3 gap-x-2 gap-y-3 text-[11px] font-semibold text-black/55 sm:grid-cols-5 sm:text-[12px] [&_dt]:whitespace-nowrap">
          <div><dt>Followers</dt><dd class="text-[16px] font-extrabold text-black">${num(c.metrics.followers)}</dd></div>
          <div><dt>Engagement</dt><dd class="text-[16px] font-extrabold text-black">${c.metrics.engagementRate}%</dd></div>
          <div><dt>Avg. views</dt><dd class="text-[16px] font-extrabold text-black">${num(c.metrics.avgViews)}</dd></div>
          <div class="hidden sm:block"><dt>Campaigns</dt><dd class="text-[16px] font-extrabold text-black">${c.campaigns}</dd></div>
          <div class="hidden sm:block"><dt>Zaumu Score</dt><dd class="text-[16px] font-extrabold text-brand-deep">${c.metrics.zaumuScore}</dd></div>
        </dl>
      </div>
    </div>
    ${charts}
  </div>
</li>`
}

function chip(href, label, active = false) {
  return `<a href="${href}" ${active ? 'aria-current="page"' : ''} class="rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${active ? 'bg-black text-white' : 'border border-black/15 bg-white hover:border-black'}">${label}</a>`
}

function faq(items) {
  return items.map(([q, a]) => `            <details class="group py-5"><summary class="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-bold">${q}<span class="text-black/40 transition group-open:rotate-45">+</span></summary><p class="mt-3 text-[14px] leading-[22px] text-black/75">${a}</p></details>`).join('\n')
}

/* ------------------------------------------------------ directory page */
function directoryPage(tpl, data, { path, locationKey, locationName, cityKey, categoryKey }, creators, allPages) {
  const catName = categoryKey ? data.categories[categoryKey] : null
  const where = locationName
  const month = monthYear(data.generatedAt)
  const sorted = [...creators].sort((a, b) => b.metrics.zaumuScore - a.metrics.zaumuScore)
  const shown = sorted.slice(0, TOP_N)
  const h1 = catName ? `Top ${shown.length} ${catName} Creators in ${where} (${month})` : `Top ${shown.length} Creators &amp; Influencers in ${where} (${month})`
  const title = catName ? `Top ${catName} Creators in ${where} (${month}) — Find ${catName} Influencers` : `Top Creators & Influencers in ${where} (${month}) — Find Influencers in ${where}`
  const description = `${sorted.length} verified ${catName ? catName.toLowerCase() + ' ' : ''}creators in ${where} on Zaumu, ranked by engagement and campaign record. Followers, engagement rate and reach — updated ${month}.`
  const intro = catName
    ? `These are the ${catName.toLowerCase()} creators in ${where} with verified accounts on Zaumu, ranked by Zaumu Score. Every number below comes straight from the connected platforms. Brands can filter the full list by audience, budget and engagement inside Zaumu, and invite any of them to a campaign.`
    : `These are the creators and influencers in ${where} with verified accounts on Zaumu, ranked by Zaumu Score, not follower count. Every number below comes straight from the connected platforms. Browse by category or city, or run a custom search inside Zaumu.`

  // sibling links
  const cats = Object.keys(data.categories).filter((k) => allPages.has(`${cityKey ?? locationKey}/${k}`))
  const cities = cityKey ? [] : data.locations[locationKey].cities.filter((k) => allPages.has(k))
  const filters = [
    `<div class="flex flex-wrap items-center gap-2"><span class="mr-1 text-[12px] font-bold uppercase tracking-[0.1em] text-black/45">Category</span>${chip(`/creators/${cityKey ?? locationKey}`, 'All', !categoryKey)}${cats.map((k) => chip(`/creators/${cityKey ?? locationKey}/${k}`, data.categories[k], k === categoryKey)).join('')}</div>`,
    cities.length ? `<div class="flex flex-wrap items-center gap-2"><span class="mr-1 text-[12px] font-bold uppercase tracking-[0.1em] text-black/45">City</span>${cities.map((k) => chip(`/creators/${k}${categoryKey && allPages.has(`${k}/${categoryKey}`) ? '/' + categoryKey : ''}`, data.cities[k])).join('')}</div>` : '',
    cityKey ? `<div class="flex flex-wrap items-center gap-2"><span class="mr-1 text-[12px] font-bold uppercase tracking-[0.1em] text-black/45">Country</span>${chip(`/creators/${locationKey}${categoryKey ? '/' + categoryKey : ''}`, `All of ${data.locations[locationKey].name}`)}</div>` : '',
  ].join('\n')

  const related = [...allPages.entries()].filter(([k]) => k !== path.replace('/creators/', '')).slice(0, 8)
    .map(([, p]) => `<li><a href="${p.path}" class="text-black/70 hover:text-black">${p.label}</a></li>`).join('')

  const crumbs = [['Creators', '/creators']]
  if (cityKey) crumbs.push([data.locations[locationKey].name, `/creators/${locationKey}`])
  crumbs.push([where, `/creators/${cityKey ?? locationKey}`])
  if (catName) crumbs.push([catName, path])

  return fill(tpl, {
    title: esc(title), description: esc(description), path, h1, intro,
    isoDate: data.generatedAt, date: fmtDate(data.generatedAt), count: sorted.length, shown: shown.length,
    robots: '', // TODO.md §5: '<meta name="robots" content="noindex" />' for pages under MIN_PER_PAGE
    breadcrumbs: crumbs.map(([n, u], i) => (i === crumbs.length - 1 ? `<span class="text-black">${n}</span>` : `<a href="${u}" class="hover:text-black">${n}</a><span class="mx-2" aria-hidden="true">/</span>`)).join(''),
    filters,
    list: shown.map((c, i) => creatorRow(c, i + 1, data)).join('\n'),
    whoText: catName ? `Creators can list several categories, so someone here may also appear in other ${where} lists.` : `Creators tagged with a city appear in that city's list as well as the national one.`,
    related,
    faq: faq([
      [`How much do ${catName ? catName.toLowerCase() + ' ' : ''}creators in ${where} charge?`, `Rates depend on deliverables, audience and usage rights rather than follower count. On Zaumu, creators publish a starting rate on their profile and quote per campaign; most first collaborations with mid-size creators land between KES 15,000 and 60,000 for a short-video package. See <a href="/resources/pricing-your-first-brand-deal-in-kenya" class="font-bold underline">how creators price a brand deal</a>.`],
      ['Are the follower and engagement numbers real?', 'Yes. Creators connect their accounts directly, and Zaumu reads the figures from the platforms. Nothing on this page is typed in by the creator.'],
      ['How do I contact a creator on this list?', 'Create a free brand account, open the creator\'s profile and send a campaign invitation. Briefs, contracts, milestone payments and invoices are all handled inside Zaumu, so you never need to negotiate over DMs.'],
      ['How is Zaumu Score calculated?', 'It combines engagement rate, audience quality (real followers, relevant location), on-time delivery and ratings from completed campaigns, and recent activity. It is designed to surface creators who will actually deliver, not just the largest accounts.'],
    ]),
    jsonld: jsonld([
      { '@context': 'https://schema.org', '@type': 'ItemList', name: h1.replace('&amp;', '&'), description, url: SITE_URL + path, numberOfItems: shown.length,
        itemListElement: shown.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/creators/${c.handle}`, name: c.name })) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE_URL + u })) },
    ]),
  })
}

/* -------------------------------------------------------- profile page */
function profilePage(tpl, data, c) {
  const countryName = data.locations[Object.keys(data.locations).find((k) => data.locations[k].country === c.country)].name
  const cityName = data.cities[c.city]
  const description = `${c.name} is a ${c.headline.toLowerCase()} in ${cityName}, ${countryName} with ${num(c.metrics.followers)} followers and ${c.metrics.engagementRate}% engagement. Verified profile on Zaumu — invite to a campaign.`
  const accountRows = Object.entries(c.accounts).map(([k, a]) => `<li class="flex items-center justify-between gap-3 py-3 text-[13px] font-semibold"><span class="flex items-center gap-2.5"><span class="size-5 text-black/75">${PLATFORM[k].icon}</span><a href="${PLATFORM[k].url(a.handle)}" rel="nofollow noopener" target="_blank" class="hover:underline">${esc(a.handle)}</a></span><span class="text-right"><span class="block text-[15px] font-extrabold">${num(a.followers)}</span><span class="text-[11px] text-black/50">${num(a.posts)} posts</span></span></li>`).join('')
  const ages = Object.entries(c.metrics.audienceAges).map(([k, v]) => `<div><div class="mx-auto flex h-16 w-full items-end rounded-md bg-black/5"><div class="w-full rounded-md bg-brand" style="height:${v}%"></div></div><p class="mt-1.5 text-black/60">${k}</p><p class="font-extrabold">${v}%</p></div>`).join('')
  const postCards = c.posts.map((p, i) => `<button type="button" data-post="${i}" data-likes="${p.likes}" data-at="${p.postedAt}" class="group relative aspect-[4/5] overflow-hidden rounded-xl text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgb(0_0_0/0.15)]">${postTile(p)}<span class="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-black">${PLATFORM[p.platform].icon.replace('<svg', '<svg class="size-4"')}</span><span class="absolute bottom-2 left-2 hidden rounded bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white group-hover:block">♥ ${num(p.likes)} · ${num(p.comments)} comments</span></button>`).join('\n')
  const similar = data.creators.filter((o) => o.handle !== c.handle && o.categories.some((k) => c.categories.includes(k))).slice(0, 4)
    .map((o) => `<li><a href="/creators/${o.handle}" class="flex items-center gap-3 rounded-2xl border border-black/10 p-4 transition hover:shadow-[0_12px_30px_rgb(0_0_0/0.08)]">${avatar(o, 48)}<span class="min-w-0"><span class="block truncate text-[14px] font-extrabold">${esc(o.name)}</span><span class="block truncate text-[12px] font-semibold text-black/60">${esc(o.headline)} · ${data.cities[o.city]}</span><span class="block text-[12px] font-bold">${num(o.metrics.followers)} · ${o.metrics.engagementRate}%</span></span></a></li>`).join('')
  const crumbs = [['Creators', '/creators'], [countryName, `/creators/${c.country === 'KE' ? 'kenya' : c.country.toLowerCase()}`], [cityName, `/creators/${c.city}`], [c.name, `/creators/${c.handle}`]]

  return fill(tpl, {
    name: esc(c.name), handle: c.handle, headline: esc(c.headline), bio: esc(c.bio), description: esc(description),
    cityName, countryName, isoDate: data.generatedAt, robots: '',
    lastActive: relTime(c.lastActive), joined: monthYear(c.joined),
    avatar: avatar(c, 112, 'ring-4 ring-white shadow'),
    verifiedBadge: c.verified ? '<span class="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em]"><svg class="size-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="m8 13.5-4-4 1.4-1.4L8 10.7l6.6-6.6L16 5.5l-8 8Z"/></svg>Verified</span>' : '',
    categoryChips: c.categories.map((k) => `<a href="/creators/${c.city}/${k}" class="rounded-full bg-white px-3 py-1.5 text-[12px] font-bold ring-1 ring-black/10 hover:ring-black">${data.categories[k]}</a>`).join(''),
    platformLinks: Object.entries(c.accounts).map(([k, a]) => `<a href="${PLATFORM[k].url(a.handle)}" rel="nofollow noopener" target="_blank" class="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold ring-1 ring-black/10 hover:ring-black"><span class="size-4">${PLATFORM[k].icon}</span>${esc(a.handle)}</a>`).join(''),
    score: c.metrics.zaumuScore, followers: num(c.metrics.followers), engagement: c.metrics.engagementRate, reach: num(c.metrics.derivedReach),
    campaigns: c.campaigns, rating: c.rating.toFixed(1),
    avgLikes: num(c.metrics.avgLikes), avgComments: num(c.metrics.avgComments), avgViews: num(c.metrics.avgViews), sentiment: c.metrics.sentiment,
    audienceFemale: c.metrics.audienceFemale, audienceMale: c.metrics.audienceMale, ageBars: ages,
    accountRows, postCards,
    noPosts: c.posts.length ? '' : '<p class="mt-6 rounded-2xl border border-dashed border-black/20 p-6 text-center text-[14px] font-medium text-black/60">Recent content appears here once the creator\'s accounts have synced.</p>',
    postsJson: JSON.stringify(c.posts.map((p) => ({ ...p, platformLabel: PLATFORM[p.platform].label, tile: postTile(p) }))).replace(/</g, '\\u003c'),
    similar,
    breadcrumbs: crumbs.map(([n, u], i) => (i === crumbs.length - 1 ? `<span class="text-black">${n}</span>` : `<a href="${u}" class="hover:text-black">${n}</a><span class="mx-2" aria-hidden="true">/</span>`)).join(''),
    jsonld: jsonld([
      { '@context': 'https://schema.org', '@type': 'ProfilePage', dateModified: data.generatedAt, mainEntity: {
          '@type': 'Person', name: c.name, description: c.bio, jobTitle: c.headline, url: `${SITE_URL}/creators/${c.handle}`,
          address: { '@type': 'PostalAddress', addressLocality: cityName, addressCountry: c.country },
          sameAs: Object.entries(c.accounts).map(([k, a]) => PLATFORM[k].url(a.handle)),
          interactionStatistic: [{ '@type': 'InteractionCounter', interactionType: 'https://schema.org/FollowAction', userInteractionCount: c.metrics.followers }],
          memberOf: ORG } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE_URL + u })) },
    ]),
  })
}

/* ---------------------------------------------------------------- build */
export function buildCreators() {
  const data = loadData()
  if (existsSync(OUT)) rmSync(OUT, { recursive: true })
  mkdirSync(OUT, { recursive: true })
  const dirTpl = TPL('creators-directory.html')
  const profTpl = TPL('creator-profile.html')
  const urls = []

  // 1. work out which directory pages have enough creators
  const pages = new Map() // key → { path, label, creators, opts }
  for (const [locKey, loc] of Object.entries(data.locations)) {
    const inCountry = data.creators.filter((c) => c.country === loc.country)
    const add = (key, label, creators, opts) => { if (creators.length >= MIN_PER_PAGE) pages.set(key, { path: `/creators/${key}`, label, creators, opts }) }
    add(locKey, `Creators in ${loc.name}`, inCountry, { locationKey: locKey, locationName: loc.name })
    for (const cat of Object.keys(data.categories)) add(`${locKey}/${cat}`, `${data.categories[cat]} creators in ${loc.name}`, inCountry.filter((c) => c.categories.includes(cat)), { locationKey: locKey, locationName: loc.name, categoryKey: cat })
    for (const city of loc.cities) {
      const inCity = inCountry.filter((c) => c.city === city)
      add(city, `Creators in ${data.cities[city]}`, inCity, { locationKey: locKey, locationName: data.cities[city], cityKey: city })
      for (const cat of Object.keys(data.categories)) add(`${city}/${cat}`, `${data.categories[cat]} creators in ${data.cities[city]}`, inCity.filter((c) => c.categories.includes(cat)), { locationKey: locKey, locationName: data.cities[city], cityKey: city, categoryKey: cat })
    }
  }

  // 2. write them
  for (const [key, p] of pages) {
    const html = directoryPage(dirTpl, data, { path: p.path, ...p.opts }, p.creators, pages)
    const file = join(OUT, `${key}.html`)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, html)
    urls.push({ loc: p.path, priority: key.includes('/') ? '0.6' : '0.7', changefreq: 'weekly', lastmod: data.generatedAt })
  }

  // 3. hub = the country page at /creators (Kenya only for now)
  const hubKey = Object.keys(data.locations)[0]
  writeFileSync(join(ROOT, 'creators.html'), directoryPage(dirTpl, data, { path: '/creators', ...pages.get(hubKey).opts }, pages.get(hubKey).creators, pages))
  urls.push({ loc: '/creators', priority: '0.8', changefreq: 'weekly', lastmod: data.generatedAt })

  // 4. profiles — TODO.md §4: move to an edge-cached function when the count grows
  for (const c of data.creators) {
    writeFileSync(join(OUT, `${c.handle}.html`), profilePage(profTpl, data, c))
    urls.push({ loc: `/creators/${c.handle}`, priority: '0.5', changefreq: 'weekly', lastmod: data.generatedAt })
  }

  console.log(`creators: ${pages.size} directory pages + ${data.creators.length} profiles → creators/ (DUMMY DATA — see TODO.md)`)
  return urls
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) buildCreators()
