import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Page, Card, CardHeader, CardTitle, CardContent, Button, Badge, InvalidLink, Table, Th, Td, useToast } from '../components/ui'
import { EVENT, TIME_SLOTS, sortTimes } from '../lib/config'
import { supabase } from '../lib/supabase'
import type { Booking, Mentor } from '../lib/types'

/** Serves both /mentor-dashboard?email= and /mentor-schedule?id= */
export default function MentorDashboard() {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const { toast } = useToast()
  const email = sp.get('email')?.toLowerCase()
  const id = sp.get('id')
  const [mentor, setMentor] = useState<Mentor | null | undefined>(undefined)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [toAdd, setToAdd] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const q = supabase.from('mentors').select('*')
    const { data } = id ? await q.eq('id', id).maybeSingle() : await q.eq('email', email!).maybeSingle()
    setMentor(data)
    if (data) {
      const { data: b } = await supabase.from('bookings').select('*').eq('mentor_id', data.id).is('cancelled_at', null)
      setBookings(sortTimes((b || []).map((x) => x.selected_time)).map((t) => (b || []).find((x) => x.selected_time === t)!))
    }
  }
  useEffect(() => { if (email || id) load() }, [email, id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!email && !id) return <InvalidLink />
  if (mentor === null) {
    return (
      <Page>
        <Card className="p-8 text-center space-y-3">
          <h2 className="text-xl font-semibold">No mentor found with that email</h2>
          <p className="text-muted-foreground">Check that you entered the email you registered with.</p>
          <Button onClick={() => nav('/')}>Go to Home</Button>
        </Card>
      </Page>
    )
  }
  if (!mentor) return <Page><p className="text-muted-foreground">Loading…</p></Page>

  const booked = new Set(bookings.map((b) => b.selected_time))
  const available = sortTimes(mentor.available_times || [])
  const addable = TIME_SLOTS.filter((t) => !available.includes(t) && !booked.has(t))

  const cancel = async (b: Booking) => {
    if (!confirm(`Cancel your ${b.selected_time} session with ${b.student_name}? They'll get an email.`)) return
    const reopen = confirm('Reopen this time slot so another student can book it?')
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: b.id, p_cancelled_by: 'mentor', p_reopen_slot: reopen })
    if (error) return toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' })
    toast({ title: 'Session cancelled', description: 'The student has been emailed.' }); load()
  }

  const saveTimes = async (next: string[], msg: string) => {
    setBusy(true)
    const { error } = await supabase.from('mentors').update({ available_times: next }).eq('id', mentor.id)
    setBusy(false)
    if (error) return toast({ title: 'Failed to update time slots', description: error.message, variant: 'destructive' })
    toast({ title: msg }); setToAdd([]); load()
  }

  return (
    <Page maxWidth="max-w-5xl">
      <Button variant="ghost" onClick={() => nav('/')} className="mb-4">← Home</Button>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Mentor Dashboard</CardTitle>
            <p className="text-muted-foreground mt-1">{mentor.name} · {mentor.email}</p>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">Event:</span> {EVENT.dateLong}</p>
            <p><span className="text-muted-foreground">Meeting Link:</span> {mentor.meeting_url ? <a className="text-secondary hover:underline" href={mentor.meeting_url}>{mentor.meeting_url}</a> : 'N/A'}</p>
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
                    <Td><Button variant="outline" className="h-8 px-3" onClick={() => cancel(b)}>Cancel</Button></Td>
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
