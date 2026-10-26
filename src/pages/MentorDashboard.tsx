import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page, Card, CardHeader, CardTitle, CardContent, Button, Badge, Input, Table, Th, Td, useToast } from '../components/ui'
import { SignInPage } from '../components/SignIn'
import { EVENT, TIME_SLOTS, sortTimes } from '../lib/config'
import { getMentorSchedule, mentorUpdate, mentorCancel, takeTokenFromUrl, setToken } from '../lib/api'
import type { Booking, Mentor } from '../lib/types'

/** Serves /mentor-dashboard and /mentor-schedule. Needs a sign-in link (token) from email. */
export default function MentorDashboard() {
  const nav = useNavigate()
  const { toast } = useToast()
  const [token, setTok] = useState<string | null>(() => takeTokenFromUrl('mentor'))
  const [mentor, setMentor] = useState<Mentor | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [error, setError] = useState<string | undefined>()
  const [toAdd, setToAdd] = useState<string[]>([])
  const [meeting, setMeeting] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    if (!token) return
    try {
      const d = await getMentorSchedule(token)
      setMentor(d.mentor); setMeeting(d.mentor.meeting_url || '')
      setBookings(sortTimes(d.bookings.map((x) => x.selected_time)).map((t) => d.bookings.find((x) => x.selected_time === t)!))
    } catch (err) {
      setToken('mentor', null); setTok(null); setError((err as Error).message)
    }
  }
  useEffect(() => { load() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) return <SignInPage role="mentor" reason={error} />
  if (!mentor) return <Page><p className="text-muted-foreground">Loading…</p></Page>

  const booked = new Set(bookings.map((b) => b.selected_time))
  const available = sortTimes(mentor.available_times || [])
  const addable = TIME_SLOTS.filter((t) => !available.includes(t) && !booked.has(t))

  const run = async (fn: () => Promise<void>, msg: string) => {
    setBusy(true)
    try { await fn(); toast({ title: msg }); setToAdd([]); await load() }
    catch (err) { toast({ title: 'Something went wrong', description: (err as Error).message, variant: 'destructive' }) }
    setBusy(false)
  }
  const saveTimes = (next: string[], msg: string) => run(() => mentorUpdate(token, { available_times: next }), msg)
  const cancel = (b: Booking) => {
    if (!confirm(`Cancel your ${b.selected_time} session with ${b.student_name}? They'll get an email.`)) return
    const reopen = confirm('Reopen this time slot so another student can book it?')
    run(() => mentorCancel(token, b.id, reopen), 'Session cancelled. The student has been emailed.')
  }

  return (
    <Page maxWidth="max-w-5xl">
      <div className="flex justify-between mb-4">
        <Button variant="ghost" onClick={() => nav('/')}>← Home</Button>
        <Button variant="ghost" onClick={() => { setToken('mentor', null); nav('/') }}>Sign out</Button>
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Mentor Dashboard</CardTitle>
            <p className="text-muted-foreground mt-1">{mentor.name} · {mentor.email}</p>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">Event:</span> {EVENT.dateLong} (Eastern Time)</p>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => mentorUpdate(token, { meeting_url: meeting }), 'Meeting link saved') }}>
              <Input placeholder="Your Zoom / Google Meet link" value={meeting} onChange={(e) => setMeeting(e.target.value)} />
              <Button type="submit" variant="outline" disabled={busy || meeting === (mentor.meeting_url || '')}>Save</Button>
            </form>
            <p className="sm:col-span-2 text-xs text-muted-foreground">Leave the meeting link blank and each booking gets its own free video link automatically. Links in confirmation emails already sent won't change.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Booked Sessions</CardTitle><p className="text-sm text-muted-foreground">All your scheduled mentorship sessions</p></CardHeader>
          <CardContent>
            {bookings.length === 0 ? <p className="text-muted-foreground">No sessions booked yet</p> : (
              <Table>
                <thead><tr><Th>Time Slot</Th><Th>Student</Th><Th>Email</Th><Th>Class</Th><Th>Discussion Topics</Th><Th>Meeting</Th><Th></Th></tr></thead>
                <tbody>{bookings.map((b) => (
                  <tr key={b.id}>
                    <Td className="font-medium whitespace-nowrap">{b.selected_time}</Td>
                    <Td>{b.student_name}{b.portfolio_url && <> · <a className="text-secondary hover:underline" href={b.portfolio_url} target="_blank" rel="noreferrer">Portfolio</a></>}</Td>
                    <Td><a className="text-secondary hover:underline" href={`mailto:${b.student_email}`}>{b.student_email}</a></Td>
                    <Td>{b.graduation_date || 'N/A'}</Td>
                    <Td>{[...(b.discussion_topics || []), b.specific_topics].filter(Boolean).join('; ') || 'N/A'}</Td>
                    <Td>{b.meeting_url ? <a className="text-secondary hover:underline font-medium" href={b.meeting_url} target="_blank" rel="noreferrer">Join</a> : 'N/A'}</Td>
                    <Td><Button variant="outline" className="h-8 px-3" disabled={busy} onClick={() => cancel(b)}>Cancel</Button></Td>
                  </tr>
                ))}</tbody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Available Time Slots</CardTitle><p className="text-sm text-muted-foreground">Open slots students can still book. Click one to remove it.</p></CardHeader>
          <CardContent className="space-y-6">
            {available.length === 0 ? <p className="text-muted-foreground">No available time slots</p> : (
              <div className="flex flex-wrap gap-2">
                {available.map((t) => (
                  <button key={t} disabled={busy} onClick={() => confirm(`Remove ${t} from your availability?`) && saveTimes(available.filter((x) => x !== t), 'Time slot removed')}
                    className="rounded-full border border-secondary bg-secondary/10 px-3 py-1 text-sm hover:bg-destructive hover:text-white hover:border-destructive" title="Remove">
                    {t} ×
                  </button>
                ))}
              </div>
            )}
            {addable.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Select time slots to add:</p>
                <div className="flex flex-wrap gap-2">
                  {addable.map((t) => {
                    const on = toAdd.includes(t)
                    return <button key={t} type="button" onClick={() => setToAdd(on ? toAdd.filter((x) => x !== t) : [...toAdd, t])} className={`rounded-full border px-3 py-1 text-sm ${on ? 'bg-primary border-primary' : 'bg-white border-border hover:bg-muted'}`}>{t}</button>
                  })}
                </div>
                <Button disabled={toAdd.length === 0 || busy} onClick={() => saveTimes([...available, ...toAdd], `Added ${toAdd.length} time slot${toAdd.length === 1 ? '' : 's'}`)}>Add Selected Slots</Button>
              </div>
            )}
            <div className="flex flex-wrap gap-1 text-xs text-muted-foreground items-center">Booked: {[...booked].length === 0 ? 'none' : sortTimes([...booked]).map((t) => <Badge key={t} tone="primary">{t}</Badge>)}</div>
          </CardContent>
        </Card>
      </div>
    </Page>
  )
}
