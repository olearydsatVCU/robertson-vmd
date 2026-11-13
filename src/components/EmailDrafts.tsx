import { useMemo, useState } from 'react'
import { Copy, Mail, Check } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Badge, useToast } from './ui'
import { EVENT, sortTimes } from '../lib/config'
import type { Booking, Mentor } from '../lib/types'
import bannerImg from '../assets/mentorship-header.png'

/**
 * Ready-to-send "your schedule so far" emails, one per mentor and one per student, built from live bookings.
 * Derek copies each into his own VCU email (personal emails are far less likely to land in spam).
 * Written to match his past Virtual Mentorship Day emails.
 */

const SITE = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '')
const SENT_KEY = 'vmd-email-drafts-sent'
const SNAP_KEY = 'vmd-email-drafts-snapshot' // booking ids each email covered when it was sent
const FINAL_KEY = 'vmd-final-schedule-sent'
// The final round (after sign-ups close) gets its own fresh "sent" tracking.
const ROUND_SENT = EVENT.studentBookingOpen ? SENT_KEY : 'vmd-final-round-sent'
const ROUND_SNAP = EVENT.studentBookingOpen ? SNAP_KEY : 'vmd-final-round-snapshot'
// Once sign-ups close, every email is the final schedule.
const CLOSED = !EVENT.studentBookingOpen
const CONTACT = 'If you have any issues with your meetings tomorrow, just reply to this email or reach out to me at <a href="mailto:olearyds@vcu.edu">olearyds@vcu.edu</a>.'
const CONTACT_TEXT = 'If you have any issues with your meetings tomorrow, just reply to this email or reach out to me at olearyds@vcu.edu.'
const ul = (items: string[]) => `<ul style="font-family:Arial,sans-serif;font-size:14px;margin:0 0 12px;padding-left:20px;list-style-type:disc">${items.map((n) => `<li style="margin:0 0 6px">${n}</li>`).join('')}</ul>`
const BANNER = `<img src="${new URL(bannerImg, window.location.href).href}" alt="Virtual Mentorship Day 11.13.26" width="600" style="max-width:100%;height:auto;display:block;margin:0 0 12px">`

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const first = (name: string) => name.trim().split(/\s+/)[0] || name
const roleOrg = (m?: Mentor) => [m?.occupation, m?.organization].filter(Boolean).join(' at ')

const byTime = (list: Booking[]) => sortTimes(list.map((b) => b.selected_time)).map((t) => list.find((b) => b.selected_time === t)!)

type Draft = { key: string; to: string; name: string; subject: string; html: string; text: string; summary: string; final?: boolean; bookings: Booking[] }

// Simple inline-styled table that survives pasting into Gmail / Outlook.
function table(headers: string[], rows: string[][]) {
  const cell = 'border:1px solid #999;padding:6px 8px;text-align:left;vertical-align:top'
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;margin:8px 0 16px">
<tr>${headers.map((h) => `<th style="${cell};background:#f2f2f2">${esc(h)}</th>`).join('')}</tr>
${rows.map((r) => `<tr>${r.map((c) => `<td style="${cell}">${c}</td>`).join('')}</tr>`).join('\n')}
</table>`
}
const textTable = (rows: string[][]) => rows.map((r) => '  • ' + r.filter(Boolean).join(' | ')).join('\n')
const link = (url?: string | null, label?: string) => (url ? `<a href="${esc(url)}">${esc(label ?? url)}</a>` : '')
const p = (s: string) => `<p style="font-family:Arial,sans-serif;font-size:14px;margin:0 0 12px">${s}</p>`

// Mentors without their own Zoom/Meet link get a free video link per session: show it in the table.
const mentorHeaders = (m: Mentor) => ['Time (ET)', 'Student', 'Email', 'Class', 'Topics', ...(m.meeting_url ? [] : ['Meeting Link'])]
const mentorTextRows = (m: Mentor, booked: Booking[]) => booked.map((b) => [
  b.selected_time, b.student_name, b.student_email, b.graduation_date || '',
  [...(b.discussion_topics || []), b.specific_topics].filter(Boolean).join('; '), ...(m.meeting_url ? [] : [b.meeting_url ?? '']),
])

function mentorDraft(m: Mentor, booked: Booking[], deadline: string, eventDay: string): Draft {
  const open = sortTimes((m.available_times || []).filter((t) => !booked.some((b) => b.selected_time === t)))
  const rows = booked.map((b) => [
    esc(b.selected_time), `<b>${esc(b.student_name)}</b>`, link(`mailto:${b.student_email}`, b.student_email),
    esc(b.graduation_date || ''), esc([...(b.discussion_topics || []), b.specific_topics].filter(Boolean).join('; ')),
    ...(m.meeting_url ? [] : [link(b.meeting_url) || 'Check your booking email']),
  ])
  if (booked.length && (CLOSED || !open.length)) return mentorFinalDraft(m, booked, rows, eventDay, open.length === 0)
  if (CLOSED) return mentorNoBookingsDraft(m, eventDay)
  const intro = booked.length
    ? `Students have started booking time with you for Virtual Mentorship Day on <b>${esc(eventDay)}</b>. Thank you again for volunteering!`
    : `Thank you for volunteering for Virtual Mentorship Day on <b>${esc(eventDay)}</b>! No students have booked with you yet, but there's still time.`
  const meeting = m.meeting_url
    ? `Your meeting link: ${link(m.meeting_url)}`
    : (booked.length ? `You didn't add a meeting link, so each session has its own free video link, shown in the table above.` : `You didn't add a meeting link, so each session will get its own free video link, included in each booking email.`)
  const html = [
    BANNER,
    p(`Hello ${esc(first(m.name))}!`),
    p(intro),
    booked.length ? `${p('<b>Students who have booked with you so far:</b>')}${table(mentorHeaders(m), rows)}` : '',
    p(`<b>Your remaining open times (ET):</b> ${open.length ? esc(open.join(', ')) : 'none. Your schedule is full!'}`),
    p(meeting),
    p(`Student sign-ups close <b>${esc(deadline)}</b>. Your final schedule will go out after that.`),
    p(`Need to change your availability? Reply to this email, or update your times on your ${link(`${SITE}/mentor-schedule/`, 'mentor schedule page')}.`),
    p('Thanks, and let me know if you have any questions,<br>Derek'),
  ].join('\n')
  const text = [
    `Hello ${first(m.name)}!`, '',
    intro.replace(/<[^>]+>/g, ''), '',
    ...(booked.length ? ['Students who have booked with you so far:', textTable(mentorTextRows(m, booked)), ''] : []),
    `Your remaining open times (ET): ${open.length ? open.join(', ') : 'none. Your schedule is full!'}`, '',
    m.meeting_url ? `Your meeting link: ${m.meeting_url}` : meeting, '',
    `Student sign-ups close ${deadline}. Your final schedule will go out after that.`, '',
    `Need to change your availability? Reply to this email, or update your times here: ${SITE}/mentor-schedule/`, '',
    'Thanks, and let me know if you have any questions,', 'Derek',
  ].join('\n')
  return {
    key: `m:${m.email}`, to: m.email, name: m.name, bookings: booked,
    subject: `VCU Robertson School's Virtual Mentorship Day | Your Schedule So Far`,
    html, text, summary: `${booked.length} booked · ${open.length} open`,
  }
}

/** Sign-ups closed and nobody booked this mentor: a thank-you note. */
function mentorNoBookingsDraft(m: Mentor, eventDay: string): Draft {
  const html = [
    BANNER,
    p(`Hello ${esc(first(m.name))}!`),
    p(`Sign-ups for Virtual Mentorship Day on <b>${esc(eventDay)}</b> are now closed, and unfortunately no students booked time with you this round. That means you have no meetings tomorrow.`),
    p("Thank you so much for volunteering your time and supporting our students. We'd love to have you back for a future Virtual Mentorship Day."),
    p(CONTACT),
    p('Thanks again,<br>Derek'),
  ].join('\n')
  const text = [
    `Hello ${first(m.name)}!`, '',
    `Sign-ups for Virtual Mentorship Day on ${eventDay} are now closed, and unfortunately no students booked time with you this round. That means you have no meetings tomorrow.`, '',
    "Thank you so much for volunteering your time and supporting our students. We'd love to have you back for a future Virtual Mentorship Day.", '',
    CONTACT_TEXT, '', 'Thanks again,', 'Derek',
  ].join('\n')
  return {
    key: `m:${m.email}`, to: m.email, name: m.name, final: true, bookings: [],
    subject: `VCU Robertson School's Virtual Mentorship Day | Thank You`,
    html, text, summary: 'no bookings',
  }
}

/** The mentor's final schedule: sent once sign-ups close, or earlier if all their times are booked. */
function mentorFinalDraft(m: Mentor, booked: Booking[], rows: string[][], eventDay: string, full: boolean): Draft {
  const meeting = m.meeting_url
    ? `Your meeting link for all sessions: ${link(m.meeting_url)}`
    : `Each session has its own free video link, shown in the Meeting Link column above.`
  const notes = [
    'Students have been asked to come prepared with their portfolio, resume, or specific questions.',
    "If a student can't make it, they've been asked to email you, so you may get a cancellation email.",
    'If something comes up on your end, please email the student directly and let us know.',
  ]
  const html = [
    BANNER,
    p(`Hello ${esc(first(m.name))}!`),
    p(full
      ? `Great news: your schedule for Virtual Mentorship Day on <b>${esc(eventDay)}</b> is full. <b>This is your final schedule</b>:`
      : `Sign-ups for Virtual Mentorship Day on <b>${esc(eventDay)}</b> are now closed. <b>This is your final schedule</b>:`),
    table(mentorHeaders(m), rows),
    p(meeting),
    p('Please save these details and test your meeting link a few minutes before your first session.'),
    p('<b>A few quick notes:</b>'),
    `<ul style="font-family:Arial,sans-serif;font-size:14px;margin:0 0 12px;padding-left:20px;list-style-type:disc">${notes.map((n) => `<li style="margin:0 0 6px">${esc(n)}</li>`).join('')}</ul>`,
    p(CONTACT),
    p('Thank you so much for volunteering your time. Our students really appreciate it!'),
    p('Thanks,<br>Derek'),
  ].join('\n')
  const text = [
    `Hello ${first(m.name)}!`, '',
    full ? `Great news: your schedule for Virtual Mentorship Day on ${eventDay} is full. This is your final schedule:` : `Sign-ups for Virtual Mentorship Day on ${eventDay} are now closed. This is your final schedule:`,
    textTable(mentorTextRows(m, booked)), '',
    m.meeting_url ? `Your meeting link for all sessions: ${m.meeting_url}` : meeting, '',
    'Please save these details and test your meeting link a few minutes before your first session.', '',
    'A few quick notes:', ...notes.map((n) => `  • ${n}`), '',
    CONTACT_TEXT, '',
    'Thank you so much for volunteering your time. Our students really appreciate it!', '',
    'Thanks,', 'Derek',
  ].join('\n')
  return {
    key: `m:${m.email}`, to: m.email, name: m.name, final: true, bookings: booked,
    subject: `VCU Robertson School's Virtual Mentorship Day | Your Final Schedule`,
    html, text, summary: `${booked.length} booked${full ? ' · full' : ''}`,
  }
}

function studentDraft(name: string, email: string, booked: Booking[], mentorById: Map<string, Mentor>, deadline: string, eventDay: string): Draft {
  if (CLOSED) return studentFinalDraft(name, email, booked, mentorById, eventDay)
  const sorted = byTime(booked)
  const rows = sorted.map((b) => {
    const m = mentorById.get(b.mentor_id)
    return [esc(b.selected_time), `<b>${esc(m?.name ?? 'Mentor')}</b>`, esc(roleOrg(m)), b.meeting_url ? link(b.meeting_url) : 'Check your booking email']
  })
  const html = [
    BANNER,
    p(`Hello ${esc(first(name))}!`),
    p(`Thank you for signing up for the Robertson School's Virtual Mentorship Day on <b>${esc(eventDay)}</b>. Here is your schedule so far:`),
    table(['Time (ET)', 'Mentor', 'Role / Organization', 'Meeting Link'], rows),
    p(`<b>Want to meet more mentors?</b> You have until <b>${esc(deadline)}</b> to book additional sessions: ${link(`${SITE}/student-booking`, 'find a mentor and book')}. Each conversation is a chance to get feedback and grow your network.`),
    p(`Can't make one of your sessions? Please cancel it from your ${link(`${SITE}/student-schedule/`, 'schedule page')} so another student can take the spot, and send your mentor a quick courtesy email.`),
    p('Thanks, and let me know if you have any questions,<br>Derek'),
  ].join('\n')
  const text = [
    `Hello ${first(name)}!`, '',
    `Thank you for signing up for the Robertson School's Virtual Mentorship Day on ${eventDay}. Here is your schedule so far:`,
    textTable(sorted.map((b) => { const m = mentorById.get(b.mentor_id); return [b.selected_time, m?.name ?? 'Mentor', roleOrg(m), b.meeting_url ?? 'Check your booking email'] })), '',
    `Want to meet more mentors? You have until ${deadline} to book additional sessions: ${SITE}/student-booking`, '',
    `Can't make one of your sessions? Please cancel it from your schedule page so another student can take the spot: ${SITE}/student-schedule/ and send your mentor a quick courtesy email.`, '',
    'Thanks, and let me know if you have any questions,', 'Derek',
  ].join('\n')
  return {
    key: `s:${email}`, to: email, name, bookings: booked,
    subject: `VCU Robertson School's Virtual Mentorship Day | Your Schedule So Far`,
    html, text, summary: `${booked.length} session${booked.length === 1 ? '' : 's'}`,
  }
}

/** Student's final schedule (sign-ups closed). */
function studentFinalDraft(name: string, email: string, booked: Booking[], mentorById: Map<string, Mentor>, eventDay: string): Draft {
  const sorted = byTime(booked)
  const rows = sorted.map((b) => {
    const m = mentorById.get(b.mentor_id)
    return [esc(b.selected_time), `<b>${esc(m?.name ?? 'Mentor')}</b>`, esc(roleOrg(m)), b.meeting_url ? link(b.meeting_url) : 'Check your booking email']
  })
  const tips = [
    '<b>Be prepared:</b> have your portfolio, resume, or specific questions ready.',
    '<b>Be professional:</b> find a quiet spot, and have your camera on.',
    '<b>Be on time:</b> test your meeting link a few minutes early. Sessions are 30 minutes.',
    "<b>Can't make it?</b> Email your mentor right away as a courtesy, and cancel from your " + link(`${SITE}/student-schedule/`, 'schedule page') + '.',
  ]
  const tipsText = [
    'Be prepared: have your portfolio, resume, or specific questions ready.',
    'Be professional: find a quiet spot, and have your camera on.',
    'Be on time: test your meeting link a few minutes early. Sessions are 30 minutes.',
    `Can't make it? Email your mentor right away as a courtesy, and cancel from your schedule page: ${SITE}/student-schedule/`,
  ]
  const html = [
    BANNER,
    p(`Hello ${esc(first(name))}!`),
    p(`Sign-ups for the Robertson School's Virtual Mentorship Day on <b>${esc(eventDay)}</b> are now closed. <b>This is your final schedule</b>:`),
    table(['Time (ET)', 'Mentor', 'Role / Organization', 'Meeting Link'], rows),
    p('<b>A few quick tips:</b>'),
    ul(tips),
    p(CONTACT),
    p('Good luck tomorrow, and enjoy your conversations!<br>Derek'),
  ].join('\n')
  const text = [
    `Hello ${first(name)}!`, '',
    `Sign-ups for the Robertson School's Virtual Mentorship Day on ${eventDay} are now closed. This is your final schedule:`,
    textTable(sorted.map((b) => { const m = mentorById.get(b.mentor_id); return [b.selected_time, m?.name ?? 'Mentor', roleOrg(m), b.meeting_url ?? 'Check your booking email'] })), '',
    'A few quick tips:', ...tipsText.map((t) => `  • ${t}`), '',
    CONTACT_TEXT, '',
    'Good luck tomorrow, and enjoy your conversations!', 'Derek',
  ].join('\n')
  return {
    key: `s:${email}`, to: email, name, bookings: booked, final: true,
    subject: `VCU Robertson School's Virtual Mentorship Day | Your Final Schedule`,
    html, text, summary: `${booked.length} session${booked.length === 1 ? '' : 's'}`,
  }
}

function loadMap(key: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}

export function EmailDrafts({ mentors, bookings }: { mentors: Mentor[]; bookings: Booking[] }) {
  const { toast } = useToast()
  const [who, setWho] = useState<'mentors' | 'students'>('mentors')
  const [deadline, setDeadline] = useState('Thursday, November 12 at 8 PM ET')
  const [eventDay, setEventDay] = useState('Friday, November 13')
  const [sent, setSent] = useState<Record<string, string>>(() => loadMap(ROUND_SENT))
  const [finalSent, setFinalSent] = useState<Record<string, string>>(() => loadMap(FINAL_KEY))
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [snaps, setSnaps] = useState<Record<string, string[]>>(() => { try { return JSON.parse(localStorage.getItem(ROUND_SNAP) || '{}') } catch { return {} } })
  const [onlyChanged, setOnlyChanged] = useState(false)

  const drafts = useMemo(() => {
    const mentorById = new Map(mentors.map((m) => [m.id, m]))
    if (who === 'mentors') {
      return [...mentors].sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => mentorDraft(m, byTime(bookings.filter((b) => b.mentor_id === m.id)), deadline, eventDay))
    }
    const byStudent = new Map<string, { name: string; email: string; list: Booking[] }>()
    for (const b of bookings) {
      const s = byStudent.get(b.student_email) || { name: b.student_name, email: b.student_email, list: [] }
      s.list.push(b); byStudent.set(b.student_email, s)
    }
    return [...byStudent.values()].sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => studentDraft(s.name, s.email, s.list, mentorById, deadline, eventDay))
  }, [who, mentors, bookings, deadline, eventDay])

  const toggle = (map: Record<string, string>, set: (m: Record<string, string>) => void, storeKey: string, key: string, on: boolean) => {
    const next = { ...map }
    if (on) next[key] = new Date().toISOString(); else delete next[key]
    set(next)
    try { localStorage.setItem(storeKey, JSON.stringify(next)) } catch { /* ignore */ }
  }
  const markSent = (key: string, on: boolean) => {
    toggle(sent, setSent, ROUND_SENT, key, on)
    const next = { ...snaps }
    if (on) next[key] = (drafts.find((d) => d.key === key)?.bookings || []).map((b) => b.id); else delete next[key]
    setSnaps(next)
    try { localStorage.setItem(ROUND_SNAP, JSON.stringify(next)) } catch { /* ignore */ }
  }
  /** What changed since this email was marked sent: new bookings and cancellations. */
  const changesFor = (d: Draft) => {
    const at = sent[d.key]
    if (!at) return null
    const snap = snaps[d.key]
    const added = d.bookings.filter((b) => (snap ? !snap.includes(b.id) : new Date(b.created_at) > new Date(at)))
    const removed = snap ? snap.filter((id) => !d.bookings.some((b) => b.id === id)).length : 0
    return added.length || removed ? { added, removed } : null
  }
  const mentorName = (id: string) => mentors.find((m) => m.id === id)?.name ?? 'a mentor'
  // Ticking "Final schedule sent" also ticks "Sent".
  const markFinal = (key: string, on: boolean) => { toggle(finalSent, setFinalSent, FINAL_KEY, key, on); if (on && !sent[key]) markSent(key, true) }

  const copyEmail = async (d: Draft) => {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([d.html], { type: 'text/html' }),
        'text/plain': new Blob([d.text], { type: 'text/plain' }),
      })])
      toast({ title: `Copied the email for ${d.name}`, description: 'Paste it into a new email. The table keeps its formatting.' })
    } catch {
      await navigator.clipboard.writeText(d.text)
      toast({ title: `Copied the email for ${d.name} (plain text)` })
    }
  }
  const copy = async (value: string, what: string) => { await navigator.clipboard.writeText(value); toast({ title: `Copied ${what}` }) }
  const doneCount = drafts.filter((d) => sent[d.key]).length
  const changedCount = drafts.filter((d) => changesFor(d)).length
  const shown = onlyChanged ? drafts.filter((d) => changesFor(d)) : drafts
  const finalCount = drafts.filter((d) => finalSent[d.key]).length
  const fullCount = drafts.filter((d) => d.final).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email drafts</CardTitle>
        <p className="text-sm text-muted-foreground">
          {CLOSED
            ? 'Sign-ups are closed, so every email is the final schedule. For each person: copy the address, subject and email, paste them into a new email from your own account, send, then tick "Final schedule sent".'
            : 'One ready-to-send "schedule so far" email per person, built from the current bookings. For each one: copy the address, subject and email, paste them into a new email from your own account, send, then tick "Sent".'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(['mentors', 'students'] as const).map((w) => (
            <Button key={w} variant={who === w ? 'primary' : 'outline'} onClick={() => { setWho(w); setOpenKey(null) }}>
              {w === 'mentors' ? `Mentors (${mentors.length})` : `Students (${new Set(bookings.map((b) => b.student_email)).size})`}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {!CLOSED && <Field label="Sign-up deadline (shown in the emails)"><Input value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>}
          <Field label="Event day (shown in the emails)"><Input value={eventDay} onChange={(e) => setEventDay(e.target.value)} /></Field>
        </div>
        <p className="text-sm">
          <b>{doneCount} of {drafts.length}</b> marked sent
          {changedCount > 0 && <> · <b className="text-secondary">{changedCount} changed since you emailed them</b></>}
          {who === 'mentors' && !CLOSED && <> · <b>{finalCount}</b> received their final schedule{fullCount > 0 && <> · {fullCount} fully booked {fullCount === 1 ? 'mentor gets' : 'mentors get'} their final schedule in this round</>}</>}
          {who === 'mentors' && CLOSED && finalCount > 0 && <> · {finalCount} already got their final schedule in the earlier round (tagged below)</>}
        </p>

        {changedCount > 0 && (
          <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} /> Only show people whose schedule changed after I emailed them
          </label>
        )}
        {drafts.length === 0 && <p className="text-muted-foreground">No {who} yet.</p>}
        <div className="space-y-3">
          {shown.map((d) => {
            const isSent = !!sent[d.key]
            const ch = changesFor(d)
            const isOpen = openKey === d.key
            return (
              <div key={d.key} className={`rounded-xl border p-4 ${isSent ? 'border-border bg-muted/50' : 'border-border bg-white'}`}>
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold">{d.name} {!CLOSED && d.final && <Badge tone="primary">Full: final schedule</Badge>} {CLOSED && finalSent[d.key] && <Badge tone="primary">Got final schedule earlier</Badge>} {isSent ? <Badge tone="secondary">{CLOSED ? 'Final schedule sent' : 'Sent'}</Badge> : !CLOSED && finalSent[d.key] && <Badge tone="secondary">Final schedule sent</Badge>}</p>
                    <p className="text-sm text-muted-foreground break-all">{d.to} · {d.summary}</p>
                    {ch && (
                      <div className="mt-2 rounded-lg border border-primary bg-primary/15 px-3 py-2 text-sm">
                        <p className="font-semibold">
                          {ch.added.length > 0 && <>{who === 'students' ? 'Booked' : 'Got'} {ch.added.length} new session{ch.added.length === 1 ? '' : 's'} after your email</>}
                          {ch.added.length > 0 && ch.removed > 0 && ' · '}
                          {ch.removed > 0 && <>{ch.removed} cancelled after your email</>}
                        </p>
                        {ch.added.length > 0 && (
                          <p className="text-muted-foreground">
                            New: {ch.added.map((b) => `${b.selected_time} with ${who === 'students' ? mentorName(b.mentor_id) : b.student_name}`).join(', ')}
                          </p>
                        )}
                        <p className="text-muted-foreground">The draft below is up to date. Send it again if you want them to have the latest schedule, then click "Sent again."</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="h-9" onClick={() => copy(d.to, 'email address')}><Copy className="h-4 w-4" /> Address</Button>
                    <Button variant="outline" className="h-9" onClick={() => copy(d.subject, 'subject')}><Copy className="h-4 w-4" /> Subject</Button>
                    <Button className="h-9" onClick={() => copyEmail(d)}><Copy className="h-4 w-4" /> Copy email</Button>
                    <a className="inline-flex items-center gap-2 rounded-lg border border-border px-3 h-9 text-sm font-semibold hover:bg-muted"
                      href={`mailto:${encodeURIComponent(d.to)}?subject=${encodeURIComponent(d.subject)}`} title="Opens a new email with the address and subject filled in. Then paste the email.">
                      <Mail className="h-4 w-4" /> New email
                    </a>
                    <Button variant="ghost" className="h-9" onClick={() => setOpenKey(isOpen ? null : d.key)}>{isOpen ? 'Hide preview' : 'Preview'}</Button>
                    {ch ? (
                      <Button variant="outline" className="h-9" onClick={() => markSent(d.key, true)}><Check className="h-4 w-4" /> Sent again</Button>
                    ) : (
                      <label className="inline-flex items-center gap-2 text-sm font-medium px-2 cursor-pointer">
                        <input type="checkbox" checked={isSent} onChange={(e) => markSent(d.key, e.target.checked)} /> {isSent ? <><Check className="h-4 w-4" /> {CLOSED ? 'Final schedule sent' : 'Sent'}</> : CLOSED ? 'Final schedule sent' : 'Sent'}
                      </label>
                    )}
                    {who === 'mentors' && !CLOSED && (
                      <label className="inline-flex items-center gap-2 text-sm font-medium px-2 cursor-pointer">
                        <input type="checkbox" checked={!!finalSent[d.key]} onChange={(e) => markFinal(d.key, e.target.checked)} /> Final schedule sent
                      </label>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-3 rounded-lg border border-border bg-white p-4 overflow-x-auto">
                    <p className="text-xs text-muted-foreground mb-2">Subject: {d.subject}</p>
                    <div className="[&_a]:text-blue-700 [&_a]:underline" dangerouslySetInnerHTML={{ __html: d.html }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">"Sent" and "Final schedule sent" ticks are saved in this browser only. Drafts update automatically as new bookings come in.</p>
      </CardContent>
    </Card>
  )
}
