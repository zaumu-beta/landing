/**
 * POST /api/demo — Vercel serverless function (Node runtime).
 *
 * Receives the demo / creator sign-up form, then sends two emails through
 * the ZeptoMail API:
 *   1. a lead notification to the sales inbox (reply-to = the submitter)
 *   2. a branded auto-reply to the submitter
 *
 * Environment variables (Vercel → Project → Settings → Environment Variables):
 *   ZEPTOMAIL_TOKEN      Send Mail token from ZeptoMail → Mail Agent → Setup Info
 *   ZEPTOMAIL_FROM       Verified sender address, e.g. hello@zaumu.co.ke
 *   ZEPTOMAIL_FROM_NAME  Display name, default "Zaumu"
 *   SALES_TO             Comma-separated sales recipients
 *   ZEPTOMAIL_API_URL    Optional. Default https://api.zeptomail.com/v1.1/email
 *                        (EU data centre: https://api.zeptomail.eu/v1.1/email)
 */

type Audience = 'brand' | 'creator'

interface Lead {
  audience: Audience
  name: string
  email: string
  goals: string[]
  craft?: string
  handle?: string
  page?: string
}

const GOAL_LABELS: Record<string, string> = {
  find: 'Find creators',
  campaigns: 'Run campaigns',
  track: 'Track performance',
  pay: 'Pay creators',
  agency: 'Manage many clients',
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

const escape = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const clean = (v: unknown, max = 200): string =>
  typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : ''

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function parseLead(body: Record<string, unknown>): Lead | string {
  // Honeypot: real users never fill the hidden "website" field.
  if (clean(body.website)) return 'spam'

  const audience: Audience = body.audience === 'creator' ? 'creator' : 'brand'
  const name = clean(body.name, 120)
  const email = clean(body.email, 200).toLowerCase()
  if (name.length < 2) return 'Please enter your name.'
  if (!EMAIL_RE.test(email)) return 'Please enter a valid email address.'

  const goals = clean(body.goals, 300)
    .split(',')
    .map((g) => g.trim())
    .filter((g) => g in GOAL_LABELS)

  if (audience === 'brand' && goals.length === 0) return 'Tell us what you are looking to do.'

  return {
    audience,
    name,
    email,
    goals,
    craft: clean(body.craft, 80) || undefined,
    handle: clean(body.handle, 80) || undefined,
    page: clean(body.page, 300) || undefined,
  }
}

/* ------------------------------------------------------------------ mail */

interface Recipient { email: string; name?: string }

interface Mail {
  to: Recipient[]
  subject: string
  html: string
  text: string
  replyTo?: Recipient
}

async function sendMail(mail: Mail): Promise<void> {
  const token = process.env.ZEPTOMAIL_TOKEN
  const from = process.env.ZEPTOMAIL_FROM
  if (!token || !from) throw new Error('ZEPTOMAIL_TOKEN / ZEPTOMAIL_FROM are not configured')

  const res = await fetch(process.env.ZEPTOMAIL_API_URL ?? 'https://api.zeptomail.com/v1.1/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Zoho-enczapikey ${token}`,
    },
    body: JSON.stringify({
      from: { address: from, name: process.env.ZEPTOMAIL_FROM_NAME ?? 'Zaumu' },
      to: mail.to.map((r) => ({ email_address: { address: r.email, name: r.name } })),
      reply_to: mail.replyTo ? [{ address: mail.replyTo.email, name: mail.replyTo.name }] : undefined,
      subject: mail.subject,
      htmlbody: mail.html,
      textbody: mail.text,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`ZeptoMail ${res.status}: ${detail.slice(0, 500)}`)
  }
}

/* ------------------------------------------------------------- templates */

const BRAND = '#a9e724'
const INK = '#141517'

function shell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f3f1;font-family:Montserrat,Helvetica,Arial,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3f1;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="background:${INK};padding:22px 32px">
          <span style="font-size:22px;font-weight:800;letter-spacing:.12em;color:#ffffff">ZAUMU</span>
          <span style="display:block;font-size:9px;letter-spacing:.2em;color:#ffffff;opacity:.6;margin-top:2px">CREATE · CONNECT · COLLABORATE</span>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;line-height:24px">${inner}</td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid #eeeeee;font-size:12px;color:#777777">The creator-first marketplace connecting Africa's talent with global opportunities.</td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

const button = (href: string, label: string): string =>
  `<a href="${href}" style="display:inline-block;background:${BRAND};color:${INK};text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:8px">${label}</a>`

function salesMail(lead: Lead, salesTo: Recipient[]): Mail {
  const who = lead.audience === 'brand' ? 'Brand demo request' : 'Creator sign-up'
  const rows: [string, string][] = [
    ['Type', who],
    ['Name', lead.name],
    ['Email', lead.email],
  ]
  if (lead.goals.length) rows.push(['Looking to', lead.goals.map((g) => GOAL_LABELS[g]).join(', ')])
  if (lead.craft) rows.push(['Creates', lead.craft])
  if (lead.handle) rows.push(['Handle', lead.handle])
  if (lead.page) rows.push(['Submitted from', lead.page])
  rows.push(['Received', new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' }) + ' EAT'])

  const table = rows
    .map(([k, v]) => `<tr><td style="padding:8px 12px 8px 0;color:#777777;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:8px 0;font-weight:600">${escape(v)}</td></tr>`)
    .join('')

  return {
    to: salesTo,
    replyTo: { email: lead.email, name: lead.name },
    subject: `${who}: ${lead.name}${lead.goals.length ? ' — ' + lead.goals.map((g) => GOAL_LABELS[g]).join(', ') : ''}`,
    html: shell(`<h1 style="margin:0 0 6px;font-size:22px;font-weight:800">New lead from the website</h1>
      <p style="margin:0 0 20px;color:#555555">Reply to this email to answer ${escape(lead.name)} directly.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #eeeeee;border-bottom:1px solid #eeeeee;width:100%">${table}</table>
      <p style="margin:24px 0 0">${button(`mailto:${lead.email}`, 'Reply to ' + escape(lead.name.split(' ')[0]!))}</p>`),
    text: `New lead from the website\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}`,
  }
}

function autoReply(lead: Lead): Mail {
  const first = escape(lead.name.split(' ')[0]!)
  const brand = lead.audience === 'brand'
  const body = brand
    ? `<h1 style="margin:0 0 12px;font-size:24px;font-weight:800">Thanks, ${first} — we got your request.</h1>
       <p style="margin:0 0 16px">Someone from the Zaumu team will email you within one business day to book a 20-minute walkthrough. We'll show you how brands find verified creators, run campaigns and pay on milestones.</p>
       <p style="margin:0 0 24px">In the meantime, here's how the platform works for the creators you'll be hiring.</p>
       <p style="margin:0">${button('https://zaumu.co.ke/#how-it-works', 'See how Zaumu works')}</p>`
    : `<h1 style="margin:0 0 12px;font-size:24px;font-weight:800">Welcome, ${first}. You're on the list.</h1>
       <p style="margin:0 0 16px">We're setting things up for you. Expect an email within one business day with a link to finish your profile and get your accounts verified.</p>
       <p style="margin:0 0 24px">Zaumu is free for creators — we only take a fee when a campaign is completed and you've been paid.</p>
       <p style="margin:0">${button('https://zaumu.co.ke/#how-it-works', 'How Zaumu works for creators')}</p>`

  return {
    to: [{ email: lead.email, name: lead.name }],
    subject: brand ? 'We got your demo request — Zaumu' : "You're on the list — Zaumu",
    html: shell(body),
    text: brand
      ? `Thanks ${lead.name}, we got your request. Someone from the Zaumu team will email you within one business day to book a 20-minute walkthrough.`
      : `Welcome ${lead.name}. Expect an email within one business day with a link to finish your profile. Zaumu is free for creators.`,
  }
}

/* --------------------------------------------------------------- handler */

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json(400, { ok: false, error: 'Invalid request body.' })
  }

  const lead = parseLead(body)
  if (lead === 'spam') return json(200, { ok: true }) // pretend success; don't tip off bots
  if (typeof lead === 'string') return json(422, { ok: false, error: lead })

  const salesTo = (process.env.SALES_TO ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ email }))
  if (salesTo.length === 0) {
    console.error('[demo] SALES_TO is not configured')
    return json(500, { ok: false, error: 'Something went wrong on our side. Please email hello@zaumu.co.ke.' })
  }

  try {
    await sendMail(salesMail(lead, salesTo))
  } catch (err) {
    console.error('[demo] sales notification failed', err)
    return json(502, { ok: false, error: 'We could not send your request just now. Please try again in a minute.' })
  }

  // The auto-reply is best-effort: the lead has already reached sales.
  try {
    await sendMail(autoReply(lead))
  } catch (err) {
    console.error('[demo] auto-reply failed', err)
  }

  return json(200, { ok: true })
}

export function GET(): Response {
  return json(405, { ok: false, error: 'Method not allowed' })
}
