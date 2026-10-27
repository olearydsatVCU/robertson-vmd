import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MailWarning } from 'lucide-react'
import { Page, BackButton, Card, CardHeader, CardTitle, CardContent, Field, Input, UrlInput, Button, CheckboxGroup, ClosedNotice, useToast } from '../components/ui'
import { EVENT, TRACKS, OPEN_TO, TOPICS, TIME_SLOTS } from '../lib/config'
import { registerMentor } from '../lib/api'
import { PhotoPicker } from '../components/PhotoPicker'

export default function MentorRegistration() {
  const nav = useNavigate()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    name: '', email: '', occupation: '', organization: '', linkedIn: '', meetingUrl: '', imageUrl: '',
    tracks: [] as string[], openTo: [] as string[], topics: [] as string[], availableTimes: [] as string[],
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))

  if (!EVENT.mentorRegistrationOpen) {
    return (
      <Page>
        <BackButton />
        <ClosedNotice title="Registration is Closed" body={`Thank you for your interest! Mentor registration for the ${EVENT.term} Virtual Mentorship Day is now closed.`} />
      </Page>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (f.availableTimes.length === 0) return toast({ title: 'Pick at least one time slot', variant: 'destructive' })
    setSaving(true)
    try {
      const mentor = await registerMentor({
        name: f.name, email: f.email, occupation: f.occupation, organization: f.organization, linkedin_url: f.linkedIn,
        meeting_url: f.meetingUrl, image_url: f.imageUrl, tracks: f.tracks, open_to: f.openTo, topics: f.topics, available_times: f.availableTimes,
      })
      nav('/mentor-confirmation', { state: { mentor } })
    } catch (err) {
      toast({ title: 'Registration failed', description: (err as Error).message, variant: 'destructive' })
    }
    setSaving(false)
  }

  return (
    <Page>
      <BackButton />
      <Card>
        <CardHeader>
          <CardTitle>Mentor Registration</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Tell students a bit about yourself and pick the times you're free on {EVENT.dateLong}.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name *"><Input required value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Email *"><Input required type="email" placeholder="your@email.com" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Occupation / Title"><Input value={f.occupation} onChange={(e) => set('occupation', e.target.value)} /></Field>
              <Field label="Organization"><Input value={f.organization} onChange={(e) => set('organization', e.target.value)} /></Field>
              <Field label="LinkedIn URL"><UrlInput placeholder="linkedin.com/in/yourname" value={f.linkedIn} onChange={(v) => set('linkedIn', v)} /></Field>
              <Field label="Meeting Link (Zoom / Google Meet)" hint="Students will use this link to join your session."><UrlInput placeholder="zoom.us/j/123456789" value={f.meetingUrl} onChange={(v) => set('meetingUrl', v)} /></Field>
            </div>
            <Field label="Headshot (optional)"><PhotoPicker value={f.imageUrl} onChange={(v) => set('imageUrl', v)} name={f.name} /></Field>

            <Field label="Tracks"><CheckboxGroup options={TRACKS} value={f.tracks} onChange={(v) => set('tracks', v)} /></Field>
            <Field label="Open to"><CheckboxGroup options={OPEN_TO} value={f.openTo} onChange={(v) => set('openTo', v)} /></Field>
            <Field label="Topics you can speak to"><CheckboxGroup options={TOPICS} value={f.topics} onChange={(v) => set('topics', v)} /></Field>

            <Field label={`Available times on ${EVENT.dateShort} (Eastern Time) *`} hint="Each slot is a 30-minute 1-on-1 session. Times are Eastern Time (ET), so convert if you're in another time zone.">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TIME_SLOTS.map((t) => {
                  const on = f.availableTimes.includes(t)
                  return (
                    <button type="button" key={t} onClick={() => set('availableTimes', on ? f.availableTimes.filter((x) => x !== t) : [...f.availableTimes, t])}
                      className={`rounded-md border px-2 py-1.5 text-sm ${on ? 'bg-secondary text-white border-secondary' : 'bg-white hover:bg-muted border-border'}`}>
                      {t}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Submitting…' : 'Submit Registration'}</Button>
            <div className="flex items-start gap-2 rounded-lg border-2 border-secondary bg-secondary/5 p-3 text-sm" role="note">
              <MailWarning className="h-5 w-5 shrink-0 text-secondary" aria-hidden />
              <p>We'll email your confirmation right away. <b>Check your spam / junk folder</b>. That's where it usually lands.</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </Page>
  )
}
