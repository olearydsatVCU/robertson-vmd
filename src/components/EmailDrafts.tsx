import { useMemo, useState } from 'react'
import { Copy, Mail, Check } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Badge, useToast } from './ui'
import { sortTimes } from '../lib/config'
import type { Booking, Mentor } from '../lib/types'
import bannerImg from '../assets/mentorship-header.png'

/**
 * Ready-to-send "your schedule so far" emails, one per mentor and one per student, built from live bookings.
 * Derek copies each into his own VCU email (personal emails are far less likely to land in spam).
 * Written to match his past Virtual Mentorship Day emails.
 */

const SITE = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '')
const SENT_KEY = 'vmd-email-drafts-sent'
const FINAL_KEY = 'vmd-final-schedule-sent'
const BANNER = `<img src="${new URL(bannerImg, window.location.href).href}" alt="Virtual Mentorship Day 11.13.26" width="600" style="max-width:100%;height:auto;display:block;margin:0 0 12px">`

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const first = (name: string) => name.trim().split(/\s+/)[0] || name
const roleOrg = (m?: Mentor) => [m?.occupation, m?.organization].filter(Boolean).join(' at ')

const byTime = (list: Booking[]) => sortTimes(list.map((b) => b.selected_time)).map((t) => list.find((b) => b.selected_time === t)!)

type Draft = { key: string; to: string; name: string; subject: string; html: string; text: string; summary: string; final?: boolean }

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

function mentorDraft(m: Mentor, booked: Booking[], deadline: string, eventDay: string): Draft {
  const open = sortTimes((m.available_times || []).filter((t) => !booked.some((b) => b.selected_time === t)))
  const rows = booked.map((b) => [
    esc(b.selected_time), `<b>${esc(b.student_name)}</b>`, link(`mailto:${b.student_email}`, b.student_email),
    esc(b.graduation_date || ''), esc([...(b.discussion_topics || []), b.specific_topics].filter(Boolean).join('; ')),
  ])
  if (booked.length && !open.length) return mentorFinalDraft(m, booked, rows, eventDay)
  const intro = booked.length
    ? `Students have started booking time with you for Virtual Mentorship Day on <b>${esc(eventDay)}</b>. Thank you again for volunteering!`
    : `Thank you for volunteering for Virtual Mentorship Day on <b>${esc(eventDay)}</b>! No students have booked with you yet, but there's still time.`
  const meeting = m.meeting_url
    ? `Your meeting link: ${link(m.meeting_url)}`
    : `You didn't add a meeting link, so each session gets its own free video link. It's in each booking email you receive.`
  const html = [
    BANNER,
    p(`Hello ${esc(first(m.name))}!`),
    p(intro),
    booked.length ? `${p('<b>Students who have booked with you so far:</b>')}${table(['Time (ET)', 'Student', 'Email', 'Class', 'Topics'], rows)}` : '',
    p(`<b>Your remaining open times (ET):</b> ${open.length ? esc(open.join(', ')) : 'none. Your schedule is full!'}`),
    p(meeting),
    p(`Student sign-ups close <b>${esc(deadline)}</b>. Your final schedule will go out after that.`),
    p(`Need to change your availability? Reply to this email, or update your times on your ${link(`${SITE}/mentor-schedule/`, 'mentor schedule page')}.`),
    p('Thanks, and let me know if you have any questions,<br>Derek'),
  ].join('\n')
  const text = [
    `Hello ${first(m.name)}!`, '',
    intro.replace(/<[^>]+>/g, ''), '',
    ...(booked.length ? ['Students who have booked with you so far:', textTable(booked.map((b) => [b.selected_time, b.student_name, b.student_email, b.graduation_date || '', [...(b.discussion_topics || []), b.specific_topics].filter(Boolean).join('; ')])), ''] : []),
    `Your remaining open times (ET): ${open.length ? open.join(', ') : 'none. Your schedule is full!'}`, '',
    m.meeting_url ? `Your meeting link: ${m.meeting_url}` : meeting, '',
    `Student sign-ups close ${deadline}. Your final schedule will go out after that.`, '',
    `Need to change your availability? Reply to this email, or update your times here: ${SITE}/mentor-schedule/`, '',
    'Thanks, and let me know if you have any questions,', 'Derek',
  ].join('\n')
  return {
    key: `m:${m.email}`, to: m.email, name: m.name,
    subject: `VCU Robertson School's Virtual Mentorship Day | Your Schedule So Far`,
    html, text, summary: `${booked.length} booked · ${open.length} open`,
  }
}

/** Mentor whose times are all booked: send the final schedule now instead of a "so far" update. */
function mentorFinalDraft(m: Mentor, booked: Booking[], rows: string[][], eventDay: string): Draft {
  const meeting = m.meeting_url
    ? `Your meeting link for all sessions: ${link(m.meeting_url)}`
    : `Each session has its own free video link, listed in the booking email you received for that student.`
  const notes = [
    'Students have been asked to come prepared with their portfolio, resume, or specific questions.',
    "If a student can't make it, they've been asked to email you and cancel, so you may get a cancellation email.",
    'If something comes up on your end, please reply to this email or email the student directly so we can help them reschedule.',
  ]
  const html = [
    BANNER,
    p(`Hello ${esc(first(m.name))}!`),
    p(`Great news: your schedule for Virtual Mentorship Day on <b>${esc(eventDay)}</b> is full. Here is your <b>final schedule</b>:`),
    table(['Time (ET)', 'Student', 'Email', 'Class', 'Topics'], rows),
    p(meeting),
    p('Please save these details and test your meeting link a few minutes before your first session.'),
    p('<b>A few quick notes:</b>'),
    `<ul style="font-family:Arial,sans-serif;font-size:14px;margin:0 0 12px;padding-left:20px;list-style-type:disc">${notes.map((n) => `<li style="margin:0 0 6px">${esc(n)}</li>`).join('')}</ul>`,
    p('Thank you so much for volunteering your time. Our students really appreciate it!'),
    p('Thanks, and let me know if you have any questions,<br>Derek'),
  ].join('\n')
  const text = [
    `Hello ${first(m.name)}!`, '',
    `Great news: your schedule for Virtual Mentorship Day on ${eventDay} is full. Here is your final schedule:`,
    textTable(booked.map((b) => [b.selected_time, b.student_name, b.student_email, b.graduation_date || '', [...(b.discussion_topics || []), b.specific_topics].filter(Boolean).join('; ')])), '',
    m.meeting_url ? `Your meeting link for all sessions: ${m.meeting_url}` : meeting, '',
    'Please save these details and test your meeting link a few minutes before your first session.', '',
    'A few quick notes:', ...notes.map((n) => `  • ${n}`), '',
    'Thank you so much for volunteering your time. Our students really appreciate it!', '',
    'Thanks, and let me know if you have any questions,', 'Derek',
  ].join('\n')
  return {
    key: `m:${m.email}`, to: m.email, name: m.name, final: true,
    subject: `VCU Robertson School's Virtual Mentorship Day | Your Final Schedule`,
    html, text, summary: `${booked.length} booked · full`,
  }
}

function studentDraft(name: string, email: string, booked: Booking[], mentorById: Map<string, Mentor>, deadline: string, eventDay: string): Draft {
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
    key: `s:${email}`, to: email, name,
    subject: `VCU Robertson School's Virtual Mentorship Day | Your Schedule So Far`,
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
  const [sent, setSent] = useState<Record<string, string>>(() => loadMap(SENT_KEY))
  const [finalSent, setFinalSent] = useState<Record<string, string>>(() => loadMap(FINAL_KEY))
  const [openKey, setOpenKey] = useState<string | null>(null)

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
  const markSent = (key: string, on: boolean) => toggle(sent, setSent, SENT_KEY, key, on)
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
  const finalCount = drafts.filter((d) => finalSent[d.key]).length
  const fullCount = drafts.filter((d) => d.final).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email drafts</CardTitle>
        <p className="text-sm text-muted-foreground">
          One ready-to-send "schedule so far" email per person, built from the current bookings. For each one: copy the address, subject and email, paste them into a new email from your own account, send, then tick "Sent".
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
          <Field label="Sign-up deadline (shown in the emails)"><Input value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
          <Field label="Event day (shown in the emails)"><Input value={eventDay} onChange={(e) => setEventDay(e.target.value)} /></Field>
        </div>
        <p className="text-sm">
          <b>{doneCount} of {drafts.length}</b> marked sent
          {who === 'mentors' && <> · <b>{finalCount}</b> received their final schedule{fullCount > 0 && <> · {fullCount} fully booked {fullCount === 1 ? 'mentor gets' : 'mentors get'} their final schedule in this round</>}</>}
        </p>

        {drafts.length === 0 && <p className="text-muted-foreground">No {who} yet.</p>}
        <div className="space-y-3">
          {drafts.map((d) => {
            const isSent = !!sent[d.key]
            const isOpen = openKey === d.key
            return (
              <div key={d.key} className={`rounded-xl border p-4 ${isSent ? 'border-border bg-muted/50' : 'border-border bg-white'}`}>
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold">{d.name} {d.final && <Badge tone="primary">Full: final schedule</Badge>} {finalSent[d.key] ? <Badge tone="secondary">Final schedule sent</Badge> : isSent && <Badge tone="secondary">Sent</Badge>}</p>
                    <p className="text-sm text-muted-foreground break-all">{d.to} · {d.summary}</p>
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
                    <label className="inline-flex items-center gap-2 text-sm font-medium px-2 cursor-pointer">
                      <input type="checkbox" checked={isSent} onChange={(e) => markSent(d.key, e.target.checked)} /> {isSent ? <><Check className="h-4 w-4" /> Sent</> : 'Sent'}
                    </label>
                    {who === 'mentors' && (
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
