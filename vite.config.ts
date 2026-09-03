import { defineConfig, type Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export const SITE_URL = 'https://zaumu.com'
const SITE_NAME = 'Zaumu'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo-black.png`,
  description:
    'Zaumu is a creator-first marketplace where African photographers, filmmakers, designers and content creators build a verified profile, get discovered by brands, run campaigns and get paid on milestones.',
  slogan: 'Create · Connect · Collaborate',
  foundingLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Nairobi', addressCountry: 'KE' } },
  areaServed: 'Africa',
  email: 'support@zaumu.com',
  sameAs: ['https://www.instagram.com/zaumu.ke'],
}

const WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: SITE_NAME,
  publisher: { '@id': `${SITE_URL}/#organization` },
  inLanguage: 'en',
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/**
 * Site-wide HTML plugin:
 *
 *  <!--@include name-->                      → src/partials/name.html
 *  <!--@seo path="/pricing" type="website"--> → canonical + Open Graph + Twitter card
 *                                              + Organization/WebSite JSON-LD, using the
 *                                              page's own <title> and meta description.
 *                                              Optional attrs: image, published, modified.
 *  Clean URLs in dev/preview (/pricing → /pricing.html) to match Vercel's cleanUrls.
 */
function site(): Plugin {
  const partial = (name: string): string => readFileSync(resolve(__dirname, 'src/partials', `${name}.html`), 'utf8')

  const seo = (html: string, attrs: Record<string, string>): string => {
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? SITE_NAME
    const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1] ?? ''
    const path = attrs.path ?? '/'
    const url = SITE_URL + (path === '/' ? '/' : path.replace(/\.html$/, ''))
    const type = attrs.type ?? 'website'
    const image = attrs.image ? (attrs.image.startsWith('http') ? attrs.image : SITE_URL + attrs.image) : DEFAULT_OG_IMAGE
    const tags = [
      `<link rel="canonical" href="${url}" />`,
      `<meta property="og:site_name" content="${SITE_NAME}" />`,
      `<meta property="og:locale" content="en_KE" />`,
      `<meta property="og:type" content="${type}" />`,
      `<meta property="og:url" content="${url}" />`,
      `<meta property="og:title" content="${title}" />`,
      `<meta property="og:description" content="${description}" />`,
      `<meta property="og:image" content="${image}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="${esc(SITE_NAME + ' — ' + title.replace(/ — Zaumu$/, ''))}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${title}" />`,
      `<meta name="twitter:description" content="${description}" />`,
      `<meta name="twitter:image" content="${image}" />`,
    ]
    if (attrs.published) tags.push(`<meta property="article:published_time" content="${attrs.published}" />`)
    if (attrs.modified) tags.push(`<meta property="article:modified_time" content="${attrs.modified}" />`)
    tags.push(`<script type="application/ld+json">${JSON.stringify([ORGANIZATION, WEBSITE])}</script>`)
    return tags.join('\n    ')
  }

  const cleanUrl = (root: string) => (req: { url?: string }, _res: unknown, next: () => void) => {
    const url = req.url ?? ''
    const path = url.split('?')[0]!
    if (path !== '/' && !/\.[a-z0-9]+$/i.test(path) && !path.startsWith('/@') && existsSync(resolve(root, `.${path}.html`))) {
      req.url = `${path}.html${url.slice(path.length)}`
    }
    next()
  }

  return {
    name: 'zaumu-site',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html
          .replace(/<!--@include\s+([\w-]+)-->/g, (_, name) => partial(name))
          .replace(/<!--@seo([^>]*)-->/g, (_, raw: string) => {
            const attrs: Record<string, string> = {}
            for (const [, k, v] of raw.matchAll(/(\w+)="([^"]*)"/g)) attrs[k!] = v!
            return seo(html, attrs)
          }),
    },
    configureServer: (server) => { server.middlewares.use(cleanUrl(server.config.root)) },
    configurePreviewServer: (server) => { server.middlewares.use(cleanUrl(resolve(server.config.root, server.config.build.outDir))) },
  }
}

/** All generated pages in a folder, keyed for Rollup. */
function generated(dir: string, recursive = false): Record<string, string> {
  const abs = resolve(__dirname, dir)
  if (!existsSync(abs)) return {}
  return Object.fromEntries(
    readdirSync(abs, { recursive, encoding: 'utf8' })
      .filter((f) => f.endsWith('.html'))
      .map((f) => [`${dir}/${f.replace(/\\/g, '/').replace(/\.html$/, '')}`, resolve(abs, f)]),
  )
}

const rootPage = (name: string): Record<string, string> =>
  existsSync(resolve(__dirname, `${name}.html`)) ? { [name]: resolve(__dirname, `${name}.html`) } : {}

export default defineConfig({
  plugins: [tailwindcss(), site()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        pricing: resolve(__dirname, 'pricing.html'),
        demo: resolve(__dirname, 'demo.html'),
        // Generated by `node scripts/content.mjs` (runs in the dev/build scripts)
        ...rootPage('resources'),
        ...rootPage('terms'),
        ...rootPage('privacy'),
        ...rootPage('creators'),
        ...generated('creators', true),
        ...generated('resources'),
        ...generated('legal'),
      },
    },
  },
})
