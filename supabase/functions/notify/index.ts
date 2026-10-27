// Supabase Edge Function: all Virtual Mentorship Day emails.
// Called by the database (triggers + a 10-minute reminder job), never by the browser.
// Body: { type: 'mentor_signup' | 'booking' | 'cancel' | 'access_link', id } or { type: 'reminders' }
// Secrets: GMAIL_USER, GMAIL_APP_PASSWORD, SITE_URL (optional), NOTIFY_SECRET (optional, see below)
// Deploy with verify_jwt = false. It only ever emails addresses already in the database,
// and each email is sent at most once (the *_sent_at columns).
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'

// ---- Event settings (keep in sync with src/lib/config.ts) ----
const EVENT_DATE = '2026-11-13' // YYYY-MM-DD
const UTC_OFFSET = '-05:00' // Eastern Standard Time in November
const EVENT_LABEL = 'Friday, November 13, 2026'
const SESSION_MINUTES = 30
const REMINDER_MINUTES = 60
const SITE = (Deno.env.get('SITE_URL') ?? 'https://olearydsatvcu.github.io/robertson-vmd').replace(/\/$/, '')

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const GMAIL_USER = Deno.env.get('GMAIL_USER') ?? ''
// If NOTIFY_SECRET is set, callers must send it in the x-vmd-secret header. The database does.
const NOTIFY_SECRET = Deno.env.get('NOTIFY_SECRET') ?? ''
const mailer = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 465, secure: true,
  auth: { user: GMAIL_USER, pass: (Deno.env.get('GMAIL_APP_PASSWORD') ?? '').replace(/\s/g, '') },
})

type Mentor = { id: string; name: string; email: string; occupation: string | null; organization: string | null; linkedin_url: string | null; available_times: string[] }
type Booking = {
  id: string; mentor_id: string; student_name: string; student_email: string; graduation_date: string | null
  discussion_topics: string[]; portfolio_url: string | null; specific_topics: string | null; selected_time: string
  meeting_url: string | null; cancelled_at: string | null; cancelled_by: string | null; created_at: string
}

// ---- Helpers ----
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function startOf(time: string): Date {
  const m = time.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return new Date(`${EVENT_DATE}T12:00:00${UTC_OFFSET}`)
  let h = parseInt(m[1]) % 12
  if (m[3].toUpperCase() === 'PM') h += 12
  return new Date(`${EVENT_DATE}T${String(h).padStart(2, '0')}:${m[2]}:00${UTC_OFFSET}`)
}
const endOf = (time: string) => new Date(startOf(time).getTime() + SESSION_MINUTES * 60000)
const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

function invite(b: Booking, m: Mentor, method: 'REQUEST' | 'CANCEL') {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//VCU Robertson//VMD//EN', `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${b.id}@robertson-vmd`,
    `SEQUENCE:${method === 'CANCEL' ? 1 : 0}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(startOf(b.selected_time))}`,
    `DTEND:${icsStamp(endOf(b.selected_time))}`,
    `SUMMARY:${icsText(`Mentorship session: ${m.name} + ${b.student_name}`)}`,
    `DESCRIPTION:${icsText(`VCU Robertson Virtual Mentorship Day\nJoin: ${b.meeting_url ?? ''}`)}`,
    `LOCATION:${icsText(b.meeting_url ?? '')}`,
    `ORGANIZER;CN=VCU Robertson VMD:mailto:${GMAIL_USER}`,
    `ATTENDEE;CN=${icsText(m.name)};ROLE=REQ-PARTICIPANT:mailto:${m.email}`,
    `ATTENDEE;CN=${icsText(b.student_name)};ROLE=REQ-PARTICIPANT:mailto:${b.student_email}`,
    `STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:Mentorship session', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

function googleCalLink(b: Booking, m: Mentor) {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Mentorship session: ${m.name} + ${b.student_name}`,
    dates: `${icsStamp(startOf(b.selected_time))}/${icsStamp(endOf(b.selected_time))}`,
    details: `VCU Robertson Virtual Mentorship Day\nJoin: ${b.meeting_url ?? ''}`,
    location: b.meeting_url ?? '',
  })
  return `https://calendar.google.com/calendar/render?${p}`
}

const button = (href: string, label: string, dark = false) =>
  `<a href="${esc(href)}" style="display:inline-block;padding:12px 20px;border-radius:8px;font-weight:600;text-decoration:none;${dark ? 'background:#111;color:#fff' : 'background:#FFB300;color:#111'}">${esc(label)}</a>`

function layout(heading: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#111">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#111;color:#FFB300;padding:18px 24px;font-weight:700;font-size:14px;letter-spacing:.04em">VCU ROBERTSON · VIRTUAL MENTORSHIP DAY</td></tr>
    <tr><td style="padding:28px 24px 8px"><h1 style="margin:0 0 12px;font-size:22px">${heading}</h1>${body}</td></tr>
    <tr><td style="padding:16px 24px 8px;font-size:14px;color:#111;border-top:1px solid #eee">
      <b>Derek O'Leary</b><br>
      <span style="color:#555">Assistant Professor, Advertising and Robertson Virtual Mentorship Day lead<br>
      Robertson School of Communication at VCU<br>
      <a href="mailto:robertsonvmd@gmail.com" style="color:#6b2b5b">robertsonvmd@gmail.com</a></span>
    </td></tr>
    <tr><td style="padding:8px 24px 28px;font-size:12px;color:#666">Questions? Reply to this email. Event day: ${EVENT_LABEL} (Eastern Time).</td></tr>
  </table></td></tr></table></body></html>`
}

function sessionDetails(b: Booking, m: Mentor) {
  const row = (k: string, v: string) => `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:6px 0">${v}</td></tr>`
  const topics = [...(b.discussion_topics ?? []), b.specific_topics].filter(Boolean).join('; ')
  return `<table cellpadding="0" cellspacing="0" style="font-size:15px;margin:12px 0 20px">
    ${row('When', `${esc(EVENT_LABEL)}, <b>${esc(b.selected_time)} ET</b> (${SESSION_MINUTES} min)`)}
    ${row('Mentor', `${esc(m.name)}${m.occupation || m.organization ? ` · ${esc([m.occupation, m.organization].filter(Boolean).join(', '))}` : ''}${m.linkedin_url ? ` · <a href="${esc(m.linkedin_url)}">LinkedIn</a>` : ''}`)}
    ${row('Student', `${esc(b.student_name)} · <a href="mailto:${esc(b.student_email)}">${esc(b.student_email)}</a>${b.graduation_date ? ` · ${esc(b.graduation_date)}` : ''}`)}
    ${row('Meeting link', `<a href="${esc(b.meeting_url)}">${esc(b.meeting_url)}</a>`)}
    ${topics ? row('Topics', esc(topics)) : ''}
    ${b.portfolio_url ? row('Portfolio', `<a href="${esc(b.portfolio_url)}">${esc(b.portfolio_url)}</a>`) : ''}
  </table>`
}

async function send(to: string, subject: string, html: string, ics?: { method: 'REQUEST' | 'CANCEL'; content: string }) {
  await mailer.sendMail({
    from: `"VCU Robertson VMD" <${GMAIL_USER}>`, to, subject, html,
    ...(ics ? { icalEvent: { method: ics.method, filename: 'invite.ics', content: ics.content } } : {}),
  })
}

// Claim a "sent" flag atomically so each email goes out once.
async function claim(table: 'mentors' | 'bookings', col: string, id: string) {
  const { data } = await db.from(table).update({ [col]: new Date().toISOString() }).eq('id', id).is(col, null).select('id')
  return (data ?? []).length > 0
}
const release = (table: 'mentors' | 'bookings', col: string, id: string) => db.from(table).update({ [col]: null }).eq('id', id)

async function loadBooking(id: string) {
  const { data: b } = await db.from('bookings').select('*').eq('id', id).maybeSingle()
  if (!b) return null
  const { data: m } = await db.from('mentors').select('*').eq('id', b.mentor_id).maybeSingle()
  return m ? { b: b as Booking, m: m as Mentor } : null
}

// ---- Email types ----
async function mentorSignup(id: string) {
  const { data: m } = await db.from('mentors').select('*').eq('id', id).maybeSingle()
  if (!m || !(await claim('mentors', 'welcome_sent_at', id))) return 'skipped'
  try {
    const slots = (m.available_times ?? []).join(', ') || 'none yet'
    await send(m.email, "You're registered as a mentor for Virtual Mentorship Day", layout(`Thanks for signing up, ${esc(m.name)}!`, `
      <p>You're registered as a mentor for VCU Robertson's Virtual Mentorship Day on <b>${EVENT_LABEL}</b>.</p>
      <p><b>Your open times (ET):</b> ${esc(slots)}</p>
      <p>Each time a student books you, you'll get an email with their details, the meeting link, and a calendar invite.</p>
      <p>${button(`${SITE}/?login=mentor`, 'Manage my schedule')}</p>`))
    return 'sent'
  } catch (e) { await release('mentors', 'welcome_sent_at', id); throw e }
}

async function bookingConfirmed(id: string) {
  const r = await loadBooking(id)
  if (!r || r.b.cancelled_at || !(await claim('bookings', 'confirmation_sent_at', id))) return 'skipped'
  const { b, m } = r
  try {
    const ics = { method: 'REQUEST' as const, content: invite(b, m, 'REQUEST') }
    const cal = button(googleCalLink(b, m), 'Add to Google Calendar', true)
    await send(b.student_email, `Booked: your mentorship session with ${m.name} at ${b.selected_time} ET`, layout("You're booked!", `
      <p>Hi ${esc(b.student_name)}, your 1-on-1 session is confirmed. This also confirms your sign-up for Virtual Mentorship Day.</p>
      ${sessionDetails(b, m)}
      <p>${button(b.meeting_url ?? SITE, 'Join meeting')} &nbsp; ${cal}</p>
      <p style="font-size:14px;color:#666">Can't make it? <a href="${SITE}/?login=student">Cancel from your schedule</a> so another student can take the slot.</p>`), ics)
    await send(m.email, `New booking: ${b.student_name} at ${b.selected_time} ET`, layout('A student booked a session with you', `
      <p>Hi ${esc(m.name)}, ${esc(b.student_name)} booked time with you.</p>
      ${sessionDetails(b, m)}
      <p>${button(b.meeting_url ?? SITE, 'Join meeting')} &nbsp; ${cal}</p>
      <p style="font-size:14px;color:#666"><a href="${SITE}/?login=mentor">View or manage your schedule</a></p>`), ics)
    return 'sent'
  } catch (e) { await release('bookings', 'confirmation_sent_at', id); throw e }
}

async function bookingCancelled(id: string) {
  const r = await loadBooking(id)
  if (!r || !r.b.cancelled_at || !(await claim('bookings', 'cancellation_sent_at', id))) return 'skipped'
  const { b, m } = r
  try {
    const ics = { method: 'CANCEL' as const, content: invite(b, m, 'CANCEL') }
    const who = b.cancelled_by === 'mentor' ? m.name : b.cancelled_by === 'admin' ? 'the event organizers' : b.student_name
    await send(b.student_email, `Cancelled: your session with ${m.name} at ${b.selected_time} ET`, layout('Your session was cancelled', `
      <p>Hi ${esc(b.student_name)}, your session was cancelled by ${esc(who)}.</p>${sessionDetails(b, m)}
      <p>${button(`${SITE}/student-booking`, 'Book another mentor')}</p>`), ics)
    await send(m.email, `Cancelled: ${b.student_name} at ${b.selected_time} ET`, layout('A session was cancelled', `
      <p>Hi ${esc(m.name)}, this session was cancelled by ${esc(who)}.</p>${sessionDetails(b, m)}
      <p style="font-size:14px;color:#666"><a href="${SITE}/?login=mentor">View your schedule</a></p>`), ics)
    return 'sent'
  } catch (e) { await release('bookings', 'cancellation_sent_at', id); throw e }
}

async function accessLink(id: string) {
  const { data: t } = await db.from('access_tokens').select('*').eq('token', id).maybeSingle()
  if (!t || t.sent_at) return 'skipped'
  await db.from('access_tokens').update({ sent_at: new Date().toISOString() }).eq('token', id)
  const path = t.role === 'admin' ? '/admin' : `/${t.role}-dashboard`
  const link = `${SITE}${path}?token=${t.token}`
  const what = t.role === 'mentor' ? 'view your bookings and manage your time slots' : t.role === 'student' ? 'view or cancel your sessions' : 'open the admin dashboard'
  await send(t.email, 'Your Virtual Mentorship Day sign-in link', layout('Your sign-in link', `
    <p>Click the button to ${what}. This link works for 12 hours and only for you, so please don't forward it.</p>
    <p>${button(link, 'Sign in')}</p>
    <p style="font-size:13px;color:#666">If the button doesn't work, copy this address into your browser:<br><a href="${esc(link)}">${esc(link)}</a></p>
    <p style="font-size:13px;color:#666">Didn't request this? You can ignore this email.</p>`))
  return 'sent'
}

async function reminders() {
  const { data } = await db.from('bookings').select('id, selected_time').is('cancelled_at', null).is('reminder_sent_at', null)
  const now = Date.now()
  let sent = 0
  for (const row of data ?? []) {
    const start = startOf(row.selected_time).getTime()
    if (start <= now || start - now > REMINDER_MINUTES * 60000) continue
    if (!(await claim('bookings', 'reminder_sent_at', row.id))) continue
    const r = await loadBooking(row.id)
    if (!r) continue
    const { b, m } = r
    try {
      const body = (name: string) => layout(`Starting soon: ${esc(b.selected_time)} ET`, `
        <p>Hi ${esc(name)}, your mentorship session starts in about an hour.</p>${sessionDetails(b, m)}
        <p>${button(b.meeting_url ?? SITE, 'Join meeting')}</p>`)
      await send(b.student_email, `Reminder: session with ${m.name} at ${b.selected_time} ET`, body(b.student_name))
      await send(m.email, `Reminder: session with ${b.student_name} at ${b.selected_time} ET`, body(m.name))
      sent++
    } catch (e) { await release('bookings', 'reminder_sent_at', row.id); console.error(e) }
  }
  return `reminders sent: ${sent}`
}

Deno.serve(async (req) => {
  try {
    if (NOTIFY_SECRET && req.headers.get('x-vmd-secret') !== NOTIFY_SECRET) return Response.json({ ok: false, error: 'forbidden' }, { status: 403 })
    const { type, id } = await req.json()
    const result =
      type === 'mentor_signup' ? await mentorSignup(id)
      : type === 'booking' ? await bookingConfirmed(id)
      : type === 'cancel' ? await bookingCancelled(id)
      : type === 'access_link' ? await accessLink(id)
      : type === 'reminders' ? await reminders()
      : 'unknown type'
    return Response.json({ ok: true, result })
  } catch (e) {
    console.error(e)
    return Response.json({ ok: false, error: String(e) }, { status: 500 })
  }
})
