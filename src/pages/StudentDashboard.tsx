import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page, Card, CardHeader, CardTitle, CardContent, Button, Table, Th, Td, useToast } from '../components/ui'
import { SignInPage } from '../components/SignIn'
import { EVENT, sortTimes } from '../lib/config'
import { getStudentSchedule, studentCancel, takeTokenFromUrl, setToken, type PublicMentor } from '../lib/api'
import type { Booking } from '../lib/types'

type Row = Booking & { mentor: PublicMentor }

/** Serves /student-dashboard and /student-schedule. Needs a sign-in link (token) from email. */
export default function StudentDashboard() {
  const nav = useNavigate()
  const { toast } = useToast()
  const [token, setTok] = useState<string | null>(() => takeTokenFromUrl('student'))
  const [email, setEmail] = useState('')
  const [rows, setRows] = useState<Row[] | undefined>()
  const [error, setError] = useState<string | undefined>()

  const load = async () => {
    if (!token) return
    try {
      const d = await getStudentSchedule(token)
      setEmail(d.email)
      const times = sortTimes(d.bookings.map((x) => x.selected_time))
      setRows(times.map((t) => d.bookings.find((x) => x.selected_time === t)!))
    } catch (err) {
      setToken('student', null); setTok(null); setError((err as Error).message)
    }
  }
  useEffect(() => { load() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) return <SignInPage role="student" reason={error} />
  if (!rows) return <Page><p className="text-muted-foreground">Loading…</p></Page>

  const cancel = async (b: Row) => {
    if (!confirm(`Cancel your ${b.selected_time} session with ${b.mentor?.name ?? 'your mentor'}? You'll both get an email.`)) return
    try { await studentCancel(token, b.id); toast({ title: 'Session cancelled', description: 'A cancellation email is on its way.' }); load() }
    catch (err) { toast({ title: 'Could not cancel', description: (err as Error).message, variant: 'destructive' }) }
  }

  return (
    <Page maxWidth="max-w-5xl">
      <div className="flex justify-between mb-4">
        <Button variant="ghost" onClick={() => nav('/')}>← Home</Button>
        <Button variant="ghost" onClick={() => { setToken('student', null); nav('/') }}>Sign out</Button>
      </div>
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
