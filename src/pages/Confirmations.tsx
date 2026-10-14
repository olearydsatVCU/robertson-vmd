import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Page, Card, CardHeader, CardTitle, CardContent, Button, InvalidLink, Badge } from '../components/ui'
import { EVENT, sortTimes } from '../lib/config'
import { supabase } from '../lib/supabase'
import type { Booking, Mentor } from '../lib/types'

export function MentorConfirmation() {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const id = sp.get('id')
  const [m, setM] = useState<Mentor | null | undefined>(undefined)
  useEffect(() => { if (id) supabase.from('mentors').select('*').eq('id', id).single().then(({ data }) => setM(data)) }, [id])
  if (!id || m === null) return <InvalidLink />
  if (!m) return <Page><p className="text-muted-foreground">Loading…</p></Page>
  return (
    <Page>
      <Card>
        <CardHeader>
          <CheckCircle2 className="h-12 w-12 text-secondary mb-2" />
          <CardTitle>Thanks for signing up, {m.name}!</CardTitle>
          <p className="text-muted-foreground mt-1">You're registered as a mentor for {EVENT.term} Virtual Mentorship Day on {EVENT.dateLong}.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><div className="text-sm font-medium mb-1">Your available times</div><div className="flex flex-wrap gap-1">{sortTimes(m.available_times || []).map((t) => <Badge key={t}>{t}</Badge>)}</div></div>
          {m.meeting_url && <p className="text-sm"><span className="font-medium">Meeting link:</span> <a className="text-secondary hover:underline" href={m.meeting_url}>{m.meeting_url}</a></p>}
          <p className="text-sm text-muted-foreground">Students will book into your open slots. You can view bookings and adjust your availability any time from your schedule page.</p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => nav(`/mentor-schedule?id=${m.id}`)}>View My Schedule</Button>
            <Button variant="outline" onClick={() => nav('/')}>Return to Home</Button>
          </div>
        </CardContent>
      </Card>
    </Page>
  )
}

export function StudentConfirmation() {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const id = sp.get('id')
  const [b, setB] = useState<(Booking & { mentor: Mentor | null }) | null | undefined>(undefined)
  useEffect(() => {
    if (!id) return
    supabase.from('bookings').select('*').eq('id', id).single().then(async ({ data }) => {
      if (!data) return setB(null)
      const { data: mentor } = await supabase.from('mentors').select('*').eq('id', data.mentor_id).single()
      setB({ ...data, mentor })
    })
  }, [id])
  if (!id || b === null) return <InvalidLink />
  if (!b) return <Page><p className="text-muted-foreground">Loading…</p></Page>
  return (
    <Page>
      <Card>
        <CardHeader>
          <CheckCircle2 className="h-12 w-12 text-secondary mb-2" />
          <CardTitle>You're booked, {b.student_name}!</CardTitle>
          <p className="text-muted-foreground mt-1">A confirmation has been sent to {b.student_email}.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="font-semibold">Session Details</h3>
          <dl className="grid gap-2 text-sm sm:grid-cols-[160px_1fr]">
            <dt className="text-muted-foreground">Mentor</dt><dd>{b.mentor?.name} {b.mentor?.occupation && <span className="text-muted-foreground">· {b.mentor.occupation}{b.mentor.organization ? `, ${b.mentor.organization}` : ''}</span>}</dd>
            <dt className="text-muted-foreground">Session Time</dt><dd>{EVENT.dateLong}, {b.selected_time}</dd>
            <dt className="text-muted-foreground">Meeting Link</dt><dd>{b.mentor?.meeting_url ? <a className="text-secondary hover:underline" href={b.mentor.meeting_url}>{b.mentor.meeting_url}</a> : 'Your mentor will share a link.'}</dd>
            {b.discussion_topics?.length > 0 && <><dt className="text-muted-foreground">Discussion Topics</dt><dd>{b.discussion_topics.join(', ')}</dd></>}
            {b.specific_topics && <><dt className="text-muted-foreground">Specific Topics</dt><dd>{b.specific_topics}</dd></>}
          </dl>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => nav(`/student-schedule?email=${encodeURIComponent(b.student_email)}`)}>View My Schedule</Button>
            <Button variant="outline" onClick={() => nav('/')}>Return to Home</Button>
          </div>
        </CardContent>
      </Card>
    </Page>
  )
}
