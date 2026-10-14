import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, GraduationCap, CalendarCheck } from 'lucide-react'
import { Button, Card, CardContent, HeaderBanner, EventTitle, Input, Modal, useToast } from '../components/ui'
import { EVENT } from '../lib/config'

const steps = [
  { n: 1, title: 'Mentors Sign-Up', body: 'Mentors register with their expertise and availability' },
  { n: 2, title: 'Students Browse', body: 'Students explore mentor profiles and find the perfect match' },
  { n: 3, title: 'Schedule Session', body: `Students book a time slot and connect via Zoom or Google Meet on ${EVENT.dateShort}` },
]

export default function Home() {
  const nav = useNavigate()
  const { toast } = useToast()
  const [mentorOpen, setMentorOpen] = useState(false)
  const [studentOpen, setStudentOpen] = useState(false)
  const [mentorEmail, setMentorEmail] = useState('')
  const [studentEmail, setStudentEmail] = useState('')

  const go = (path: string, email: string) => {
    if (!email.trim()) return toast({ title: 'Please enter your email', variant: 'destructive' })
    nav(`${path}?email=${encodeURIComponent(email.trim().toLowerCase())}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <HeaderBanner />
      <EventTitle />
      <div className="container max-w-6xl mx-auto px-4 pb-16 space-y-12">
        <p className="text-center text-lg text-muted-foreground max-w-2xl mx-auto">
          Our yearly event where experienced professionals share their expertise with aspiring Robertson students.
          Book meaningful mentorship sessions that shape careers.
        </p>

        <section>
          <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary font-bold">{s.n}</div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <Card onClick={() => nav('/mentor-registration')}>
            <CardContent className="p-8 text-center space-y-4">
              <Users className="mx-auto h-10 w-10 text-secondary" />
              <h3 className="text-xl font-semibold">Become a Mentor</h3>
              <p className="text-muted-foreground">Share your knowledge and experience with Robertson students. Help guide the next generation of professionals in your field.</p>
              <Button>Share Your Availability</Button>
            </CardContent>
          </Card>
          <Card onClick={() => nav('/student-booking')}>
            <CardContent className="p-8 text-center space-y-4">
              <GraduationCap className="mx-auto h-10 w-10 text-secondary" />
              <h3 className="text-xl font-semibold">Student Booking</h3>
              <p className="text-muted-foreground">Find and connect with mentors who can guide your career path. Schedule one-on-one sessions on {EVENT.dateLong} that fit your schedule.</p>
              <Button variant="secondary">Find a Mentor</Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card onClick={() => setMentorOpen(true)}>
            <CardContent className="p-6 flex items-center gap-4">
              <CalendarCheck className="h-8 w-8 text-secondary shrink-0" />
              <div>
                <h3 className="text-lg font-semibold">Check Mentor Schedule</h3>
                <p className="text-sm text-muted-foreground">View your bookings and manage time slots</p>
              </div>
            </CardContent>
          </Card>
          <Card onClick={() => setStudentOpen(true)}>
            <CardContent className="p-6 flex items-center gap-4">
              <GraduationCap className="h-8 w-8 text-secondary shrink-0" />
              <div>
                <h3 className="text-lg font-semibold">Check Student Schedule</h3>
                <p className="text-sm text-muted-foreground">View your booked mentorship sessions</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Need Help?</h2>
          <p className="text-muted-foreground">
            If you need help or have questions about the event reach out to{' '}
            {EVENT.contacts.map((c, i) => (
              <span key={c.email}>
                <a href={`mailto:${c.email}`} className="text-secondary hover:underline">{c.name}, {c.title}</a> ({c.email}){i < EVENT.contacts.length - 1 ? ' or ' : ''}
              </span>
            ))}
          </p>
        </section>

        <div className="text-center">
          <Button variant="ghost" className="text-muted-foreground" onClick={() => nav('/admin')}>Admin: Login</Button>
        </div>
      </div>

      <Modal open={mentorOpen} onClose={() => setMentorOpen(false)} title="Mentor Schedule" description="Enter your email to view your bookings and manage time slots.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); go('/mentor-dashboard', mentorEmail) }}>
          <Input type="email" placeholder="Enter your mentor email" value={mentorEmail} onChange={(e) => setMentorEmail(e.target.value)} />
          <Button type="submit" className="w-full">View My Schedule</Button>
        </form>
      </Modal>
      <Modal open={studentOpen} onClose={() => setStudentOpen(false)} title="Student Schedule" description="Enter your email to view your booked sessions.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); go('/student-dashboard', studentEmail) }}>
          <Input type="email" placeholder="Enter your email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} />
          <Button type="submit" className="w-full">View My Schedule</Button>
        </form>
      </Modal>
    </div>
  )
}
