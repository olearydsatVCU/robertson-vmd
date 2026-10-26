import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Page, Card, CardHeader, CardTitle, CardContent, Button, InvalidLink, Table, Th, Td, useToast } from '../components/ui'
import { EVENT, sortTimes } from '../lib/config'
import { supabase } from '../lib/supabase'
import type { Booking, Mentor } from '../lib/types'

/** Serves both /student-dashboard?email= and /student-schedule?email= */
export default function StudentDashboard() {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const email = sp.get('email')?.toLowerCase()
  const { toast } = useToast()
  const [rows, setRows] = useState<(Booking & { mentor?: Mentor })[] | undefined>()

  const load = useCallback(() => {
    if (!email) return
    ;(async () => {
      const { data: b } = await supabase.from('bookings').select('*').eq('student_email', email).is('cancelled_at', null)
      const ids = [...new Set((b || []).map((x) => x.mentor_id))]
      const { data: ms } = ids.length ? await supabase.from('mentors').select('*').in('id', ids) : { data: [] }
      const byId = new Map((ms || []).map((m) => [m.id, m]))
      const times = sortTimes((b || []).map((x) => x.selected_time))
      setRows(times.map((t) => (b || []).find((x) => x.selected_time === t)!).map((x) => ({ ...x, mentor: byId.get(x.mentor_id) })))
    })()
  }, [email])
  useEffect(load, [load])

  const cancel = async (b: Booking & { mentor?: Mentor }) => {
    if (!confirm(`Cancel your ${b.selected_time} session with ${b.mentor?.name ?? 'your mentor'}? You'll both get an email.`)) return
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: b.id, p_cancelled_by: 'student', p_reopen_slot: true })
    if (error) return toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' })
    toast({ title: 'Session cancelled', description: 'A cancellation email is on its way.' }); load()
  }

  if (!email) return <InvalidLink />
  if (!rows) return <Page><p className="text-muted-foreground">Loading…</p></Page>

  return (
    <Page maxWidth="max-w-5xl">
      <Button variant="ghost" onClick={() => nav('/')} className="mb-4">← Home</Button>
      <Card>
        <CardHeader>
          <CardTitle>Student Schedule</CardTitle>
          <p className="text-muted-foreground mt-1">{email} · {EVENT.dateLong}</p>
          <p className="text-sm text-muted-foreground">All your scheduled mentorship sessions</p>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="space-y-3"><p className="text-muted-foreground">No sessions found</p>{EVENT.studentBookingOpen && <Button variant="secondary" onClick={() => nav('/student-booking')}>Find a Mentor</Button>}</div>
          ) : (
            <Table>
              <thead><tr><Th>Time Slot</Th><Th>Mentor</Th><Th>Occupation</Th><Th>Organization</Th><Th>Discussion Topics</Th><Th>Meeting Link</Th><Th></Th></tr></thead>
              <tbody>{rows.map((b) => (
                <tr key={b.id}>
                  <Td className="font-medium whitespace-nowrap">{b.selected_time}</Td>
                  <Td>{b.mentor?.name || 'Unknown'}{b.mentor?.linkedin_url && <> · <a className="text-secondary hover:underline" href={b.mentor.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a></>}</Td>
                  <Td>{b.mentor?.occupation || 'N/A'}</Td>
                  <Td>{b.mentor?.organization || 'N/A'}</Td>
                  <Td>{[...(b.discussion_topics || []), b.specific_topics].filter(Boolean).join('; ') || 'N/A'}</Td>
                  <Td>{b.meeting_url ? <a className="text-secondary hover:underline font-medium" href={b.meeting_url} target="_blank" rel="noreferrer">Join Meeting</a> : 'N/A'}</Td>
                  <Td><Button variant="outline" className="h-8 px-3" onClick={() => cancel(b)}>Cancel</Button></Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Page>
  )
}
