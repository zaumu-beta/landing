# Creator directory — implementation guide

The `/creators` section is a programmatic-SEO directory in the style of Modash's
"Find influencers in Kenya" pages, built on the site's existing static pipeline.
**Right now it renders from dummy data** (`content/creators/sample.json`, fictional
people). This file is the plan for switching it to the Laravel API and shipping it.

Files involved:

| File | Role |
| --- | --- |
| `scripts/creators.mjs` | Generator. Reads data → writes `creators.html`, `creators/<location>[/<category>].html`, `creators/<handle>.html`. Called from `scripts/content.mjs`, which also feeds the URLs into `sitemap.xml` and `llms.txt`. |
| `src/templates/creators-directory.html` | Directory page template ("Top N {category} creators in {place} ({month})"). |
| `src/templates/creator-profile.html` | Public profile template, incl. the post-detail `<dialog>`. |
| `src/main.ts` → `initCreatorProfile()` | Latest/Best sort and the post dialog (stats, comments, 72-hour sparkline). |
| `src/main.ts` → `initCharts()`, `src/charts.ts` | Chart.js (lazy-loaded chunk) for the three per-row charts: posts by platform, followers by platform, 30-day likes/views/comments. Colours mirror the app's Reports page. |
| `content/creators/sample.json` | Dummy data. Its **shape is the API contract** — see §2. Delete once the API is live. |

Search for `TODO(api)` in the code for the exact swap points.

---

## 1. Decisions to make first

- [ ] **Consent.** Only creators who have explicitly opted in to a public profile
      may appear. Add `public_profile` (bool, default **false**) to the creator
      model, a toggle in the creator's settings, and a line in the privacy policy
      (`content/legal/privacy.md`) describing what is shown publicly. Everything in
      §2 must filter on it.
- [ ] **What is public.** Recommended: name, handle, headline, bio, city/country,
      categories, connected platforms + follower counts, engagement rate, avg
      views/likes/comments, Zaumu Score, campaign count + rating, and the last
      ~12 posts with public metrics. **Not** public: email/phone, rate card,
      audience gender/age (keep behind login unless the creator opts in
      separately — it's audience data, not creator data), earnings, private
      notes, exact last-active timestamp (round to "this week").
- [ ] **Zaumu Score** formula must be stable and explainable — the directory
      pages say what goes into it (engagement, audience quality, delivery
      record, recency). Update `creators-directory.html` "How this list is made"
      if the definition differs.
- [ ] **Which combinations get a page.** Countries × categories × cities. A page
      is only generated when it has `MIN_PER_PAGE` creators (currently 3 for the
      demo data — **raise to 8** with real data). Thin pages get the whole
      subtree penalised.
- [ ] **Platform ToS check.** Displaying follower counts pulled via official
      APIs (Instagram Graph, TikTok Display API, YouTube Data) on a public page
      is generally fine when the creator authorised it; re-displaying scraped
      data or other users' comments verbatim is not. Comment text in the post
      dialog should be limited to counts + sentiment unless legal is happy.

## 2. Laravel: public read-only API

All endpoints: unauthenticated, `GET` only, `Cache-Control: public, s-maxage=3600`,
rate-limited, return **only `public_profile = true`** creators, and only the
fields in §1. Suggested routes under `/api/public/`:

### `GET /api/public/creators/export`
One call that returns everything the build needs (the build runs weekly; one
big JSON is simpler than paginating). Shape = `content/creators/sample.json`:

```jsonc
{
  "generatedAt": "2026-09-03",                    // ISO date; shown as "Last updated"
  "locations": { "kenya": { "name": "Kenya", "country": "KE", "cities": ["nairobi", "..."] } },
  "cities":    { "nairobi": "Nairobi", "...": "..." },
  "categories":{ "comedy": "Comedy", "...": "..." },  // slug → label, slugs are URL segments
  "creators": [ { ...CreatorSummary, "posts": [ ...Post ] } ]
}
```

`CreatorSummary`:

```jsonc
{
  "handle": "otienowera",           // URL slug, lowercase, [a-z0-9.-], unique, stable
  "name": "…", "headline": "…", "bio": "…",
  "avatar": "https://cdn…/avatar.jpg",   // NEW — template falls back to initials
  "city": "kisumu", "country": "KE", "gender": "male|female|other|null",
  "categories": ["comedy"],          // slugs from `categories`
  "verified": true,
  "joined": "2025-06-12",            // month is shown
  "lastActive": "2026-09-01T14:21:00+03:00",  // rounded server-side is fine
  "accounts": { "tiktok": { "handle": "@…", "followers": 388700, "posts": 2265, "url": "https://…" } },
  "metrics": {
    "followers": 664600,             // sum across accounts
    "engagementRate": 6.8, "avgLikes": 21400, "avgComments": 640, "avgViews": 310000,
    "derivedReach": 412000, "sentiment": 81, "zaumuScore": 84,
    "trend": { "days": 30, "likes": [/* 30 daily totals, oldest first */], "views": [...], "comments": [...] },  // feeds the row charts
    "audienceFemale": 44, "audienceMale": 56,               // omit if not public
    "audienceAges": { "18-24": 47, "25-34": 36, "35-44": 12, "45+": 5 }
  },
  "campaigns": 6, "rating": 4.9
}
```

`Post` (last ~12, newest first):

```jsonc
{
  "id": "…", "platform": "instagram", "type": "reel|video|photo",
  "url": "https://www.instagram.com/p/…",  // NEW — link out
  "thumbnail": "https://cdn…/thumb.jpg",   // NEW — template falls back to a gradient tile
  "caption": "…", "postedAt": "2026-08-30T10:08:00+03:00",
  "likes": 452, "comments": 31, "views": 0, "plays": 0,
  "engagementRate": 0, "derivedReach": 0, "sentiment": 75.17,
  "series": [400, 428, 446, 452],   // likes at 0/24/48/72h (or whatever cadence you store)
  "commentSample": [ { "user": "…", "at": "…", "text": "…", "sentiment": 85, "likes": 0 } ]
}
```

### `GET /api/public/creators/{handle}`
Same `CreatorSummary + posts` for one creator. Used by the profile function
in §4 (fresher than the weekly build). `404` when not public.

### Notes
- Add `avatar` and post `thumbnail`/`url` — the templates already have the
  fallbacks and the TODOs. Serve images from a CDN with long cache headers;
  the site's `vercel.json` only caches `/assets` and `/brush`.
- Slugs: `handle` is the profile URL. If a creator changes their handle, keep a
  redirect map (old → new) so indexed URLs don't 404. Simplest: never change
  it; expose `display_handle` separately.
- Protect with a shared token if you don't want the export publicly
  scrapable: `Authorization: Bearer $API_TOKEN`, set `API_TOKEN` in Vercel.

## 3. Site: switch the generator to the API

- [ ] In `scripts/creators.mjs`, replace `loadData()`:
      ```js
      async function loadData() {
        const res = await fetch(`${process.env.API_URL}/api/public/creators/export`, {
          headers: process.env.API_TOKEN ? { authorization: `Bearer ${process.env.API_TOKEN}` } : {},
        })
        if (!res.ok) throw new Error(`creators export ${res.status}`)
        return res.json()
      }
      ```
      and make `buildCreators()` async (it's `await`ed from `content.mjs`).
      Add `API_URL` / `API_TOKEN` to `.env.example` and Vercel.
- [ ] **Fail safe:** if the API is down at build time, fall back to the last
      good export (commit `content/creators/last-export.json` from the previous
      build, or read it from Vercel blob) rather than shipping an empty
      directory. Never fall back to `sample.json` in production.
- [ ] Use `avatar` / `thumbnail` when present (`avatar()` and `postTile()` in
      `creators.mjs`), keep the initials/gradient fallback.
- [ ] Set `MIN_PER_PAGE = 8` and add `robots: '<meta name="robots" content="noindex" />'`
      for any page you still want to exist but not index (e.g. cities with 3–7).
- [ ] Remove the audience block from the template if audience data is not public.
- [ ] `content.mjs` already pushes every generated URL into `sitemap.xml` and
      a directory entry into `llms.txt`. Nothing to do.
- [ ] Delete `content/creators/sample.json` and the "DUMMY DATA" console note.

## 4. Profiles: edge-cached function (when there are more than ~500 creators)

Directory pages are finite and can stay build-time. Profiles are unbounded and
should be fresher, so move them to a Vercel function that renders on demand and
is cached at the edge (ISR without a framework):

- [ ] `api/creators/[handle].ts`: fetch `GET /api/public/creators/{handle}`,
      render with the same `creator-profile.html` template (move the render
      functions from `creators.mjs` into `scripts/lib/creator-render.mjs` so both
      the build and the function import them; inline `header`/`footer` partials
      the same way `vite.config.ts` does), return HTML with
      `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`.
      Return `404` with `X-Robots-Tag: noindex` when the API 404s.
- [ ] `vercel.json` rewrite: `{ "source": "/creators/:handle((?!.*/).*)", "destination": "/api/creators/:handle" }`
      placed **after** the static directory pages so `/creators/kenya` still hits
      the built file (Vercel serves static files before rewrites — verify).
- [ ] Stop writing `creators/<handle>.html` in `creators.mjs`; keep the
      handles in the sitemap.
- [ ] Purge: when a creator edits their profile, Laravel can call Vercel's
      cache purge (or simply wait for `s-maxage` to expire).

## 5. Rebuild schedule

- [ ] Vercel → Project → Settings → Git → **Deploy Hooks**: create one for `main`.
- [ ] Laravel scheduler: `POST` that hook weekly (Monday 03:00 EAT) and whenever
      `public_profile` flips or a creator is verified. Debounce to at most one
      build per 10 minutes.
- [ ] The build already stamps `generatedAt` into titles ("(Sept 2026)") and the
      "Last updated" chip. Make sure `generatedAt` is the export date, not the
      build date, so it's honest.

## 6. SEO details to finish

- [ ] Review the generated `<title>`s — target queries are "top {category}
      creators in {place}", "{category} influencers {place}", "find influencers
      in {place}". Add `content/creators/copy.json` for hand-written intros on the
      10 most valuable pages (Kenya, Nairobi, and the top categories); the
      template's generic intro is fine for the long tail.
- [ ] Each directory page emits `ItemList` + `BreadcrumbList` JSON-LD; each
      profile emits `ProfilePage`/`Person` with `sameAs` to the social accounts.
      Validate with Google's Rich Results test once live.
- [ ] Link the directory from the home page ("Brands" section) and from
      relevant Resources articles — internal links are what get these pages
      crawled quickly.
- [ ] Submit `sitemap.xml` in Search Console after the first real build and
      watch the Pages report for "Crawled – currently not indexed" (= thin
      pages → raise `MIN_PER_PAGE` or add copy).
- [ ] Add a "Report a problem with this profile" mailto on profile pages
      (privacy requests must have an obvious path).

## 7. Product hooks

- [ ] "Invite to a campaign" currently links to `/demo?creator={handle}`. Point
      it at the app (`https://app.zaumu.com/dashboard/discover?creator={handle}`)
      once the app can deep-link to a profile; keep the demo fallback for
      logged-out brands.
- [ ] Track clicks on invite/share/platform links (Plausible/GA event) so you can
      see which pages generate demos.
- [ ] Consider a "Claim your profile" CTA on non-verified profiles.

## 8. Testing checklist before launch

- [ ] `npm run build` completes with the real export and no page below `MIN_PER_PAGE`.
- [ ] Spot-check 5 profiles against the app for numbers and links.
- [ ] Every profile shown has `public_profile = true` (query the DB for the
      handles in `sitemap.xml`).
- [ ] Lighthouse on a directory page ≥ 90 performance (thumbnails lazy-loaded,
      sized, WebP).
- [ ] Post dialog works with posts that have no `series`/`commentSample`.
- [ ] `/creators/<unknown>` returns 404, not the home page.
