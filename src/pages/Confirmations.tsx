import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Page, Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../components/ui'
import { EVENT, sortTimes } from '../lib/config'
import type { PublicMentor } from '../lib/api'
import { SpamHelp } from '../components/SpamHelp'
import type { Booking, Mentor } from '../lib/types'

// These pages show what was just submitted (passed from the form). If someone
// opens the URL later, we point them to their emailed sign-in link instead.
function Expired({ role }: { role: 'mentor' | 'student' }) {
  const nav = useNavigate()
  return (
    <Page>
      <Card className="max-w-md mx-auto">
        <CardHeader><CardTitle>Nothing to show here</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Your details were emailed to you. To see your schedule, request a sign-in link from the home page.</p>
          <Button onClick={() => nav(`/${role}-schedule`)}>Get my sign-in link</Button>
        </CardContent>
      </Card>
    </Page>
  )
}

export function MentorConfirmation() {
  const nav = useNavigate()
  const m = (useLocation().state as { mentor?: Mentor } | null)?.mentor
  if (!m) return <Expired role="mentor" />
  return (
    <Page>
      <Card>
        <CardHeader>
          <CheckCircle2 className="h-12 w-12 text-secondary mb-2" />
          <CardTitle>Thanks for signing up, {m.name}!</CardTitle>
          <p className="text-muted-foreground mt-1">You're registered as a mentor for {EVENT.term} Virtual Mentorship Day on {EVENT.dateLong}.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <SpamHelp role="mentor" email={m.email} />
          <h3 className="font-semibold pt-2">Your details</h3>
          <div><div className="text-sm font-medium mb-1">Your available times</div><div className="flex flex-wrap gap-1">{sortTimes(m.available_times || []).map((t) => <Badge key={t}>{t}</Badge>)}</div></div>
          {m.meeting_url && <p className="text-sm"><span className="font-medium">Meeting link:</span> <a className="text-secondary hover:underline" href={m.meeting_url}>{m.meeting_url}</a></p>}
          <p className="text-sm text-muted-foreground">Students will book into your open slots. You'll get an email for each booking. To view bookings or change your times, use the "Check Mentor Schedule" link on the home page and we'll email you a sign-in link.</p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => nav('/mentor-schedule')}>View My Schedule</Button>
            <Button variant="outline" onClick={() => nav('/')}>Return to Home</Button>
          </div>
        </CardContent>
      </Card>
    </Page>
  )
}

export function StudentConfirmation() {
  const nav = useNavigate()
  const b = (useLocation().state as { booking?: Booking & { mentor: PublicMentor } } | null)?.booking
  if (!b) return <Expired role="student" />
  return (
    <Page>
      <Card>
        <CardHeader>
          <CheckCircle2 className="h-12 w-12 text-secondary mb-2" />
          <CardTitle>You're booked, {b.student_name}!</CardTitle>
          <p className="text-muted-foreground mt-1">Your session is reserved. Your confirmation email has your calendar invite and meeting link.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <SpamHelp role="student" email={b.student_email} />
          <h3 className="font-semibold pt-2">Session Details</h3>
          <dl className="grid gap-2 text-sm sm:grid-cols-[160px_1fr]">
            <dt className="text-muted-foreground">Mentor</dt><dd>{b.mentor?.name} {b.mentor?.occupation && <span className="text-muted-foreground">· {b.mentor.occupation}{b.mentor.organization ? `, ${b.mentor.organization}` : ''}</span>}</dd>
            <dt className="text-muted-foreground">Session Time</dt><dd>{EVENT.dateLong}, {b.selected_time} (Eastern)</dd>
            <dt className="text-muted-foreground">Meeting Link</dt><dd>{b.meeting_url ? <a className="text-secondary hover:underline" href={b.meeting_url} target="_blank" rel="noreferrer">{b.meeting_url}</a> : 'Check your email for the link.'}</dd>
            {b.discussion_topics?.length > 0 && <><dt className="text-muted-foreground">Discussion Topics</dt><dd>{b.discussion_topics.join(', ')}</dd></>}
            {b.specific_topics && <><dt className="text-muted-foreground">Specific Topics</dt><dd>{b.specific_topics}</dd></>}
          </dl>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" onClick={() => nav('/student-booking')}>Book Another Mentor</Button>
            <Button variant="outline" onClick={() => nav('/')}>Return to Home</Button>
          </div>
        </CardContent>
      </Card>
    </Page>
  )
}
