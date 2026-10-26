import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Page, BackButton, Card, CardHeader, CardTitle, CardContent, Field, Input, Textarea, Select, Button, Badge, ClosedNotice, useToast } from '../components/ui'
import { EVENT, CLASS_LEVELS, OPEN_TO, sortTimes } from '../lib/config'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Mentor } from '../lib/types'

export default function StudentBooking() {
  const nav = useNavigate()
  const { toast } = useToast()
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [mentorId, setMentorId] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({ name: '', email: '', classLevel: '', topics: [] as string[], portfolioUrl: '', specificTopics: '' })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))

  const load = async () => {
    if (!supabaseConfigured) { setLoading(false); return }
    const { data, error } = await supabase.from('mentors').select('*').order('name')
    if (error) toast({ title: 'Error loading mentors', description: error.message, variant: 'destructive' })
    setMentors((data || []).filter((m) => (m.available_times || []).length > 0).map((m) => ({ ...m, available_times: sortTimes(m.available_times || []) })))
    setLoading(false)
  }

  useEffect(() => {
    if (!EVENT.studentBookingOpen) return
    load()
    const ch = supabase.channel('booking-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mentors' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return mentors.filter((m) => !q || [m.name, m.occupation, m.organization, ...(m.tracks || []), ...(m.topics || [])].join(' ').toLowerCase().includes(q))
  }, [mentors, search])
  const selected = mentors.find((m) => m.id === mentorId)

  if (!EVENT.studentBookingOpen) {
    return (
      <Page maxWidth="max-w-6xl">
        <BackButton />
        <ClosedNotice title="Booking is Closed" body={`Thank you for your interest! Student booking for the ${EVENT.term} Virtual Mentorship Day is now closed.`} />
      </Page>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !time) return toast({ title: 'Pick a mentor and time', description: 'Choose an available mentor + time slot before booking.', variant: 'destructive' })
    setSaving(true)
    // Re-check availability right before booking.
    const { data: fresh } = await supabase.from('mentors').select('available_times').eq('id', selected.id).single()
    if (!fresh || !(fresh.available_times || []).includes(time)) {
      setSaving(false); setTime(''); await load()
      return toast({ title: 'Time slot no longer available', description: 'Please pick another time slot.', variant: 'destructive' })
    }
    const email = f.email.trim().toLowerCase()
    const { data: booking, error } = await supabase.from('bookings').insert({
      mentor_id: selected.id, student_name: f.name.trim(), student_email: email, specializations: [],
      graduation_date: f.classLevel || null, discussion_topics: f.topics, portfolio_url: f.portfolioUrl.trim() || null,
      specific_topics: f.specificTopics.trim() || null, selected_time: time,
    }).select('id').single()
    if (error) { setSaving(false); return toast({ title: 'Booking failed', description: error.message, variant: 'destructive' }) }
    // Confirmation emails + calendar invites are sent automatically by the database.
    setSaving(false)
    nav(`/student-confirmation?id=${booking.id}`)
  }

  return (
    <Page maxWidth="max-w-6xl">
      <BackButton />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-2xl font-bold">Available Mentors</h2>
            <Input placeholder="Search by name, track, or topic…" className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {loading && <p className="text-muted-foreground">Loading mentors…</p>}
          {!loading && !supabaseConfigured && <p className="text-destructive text-sm">Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.</p>}
          {!loading && supabaseConfigured && filtered.length === 0 && <p className="text-muted-foreground">No mentors with open time slots right now. Check back soon.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((m) => {
              const on = m.id === mentorId
              return (
                <Card key={m.id} onClick={() => { setMentorId(m.id); setTime('') }} className={on ? 'ring-2 ring-secondary' : ''}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex gap-3">
                      {m.image_url ? <img src={m.image_url} alt="" className="h-14 w-14 rounded-full object-cover" /> : <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center font-bold text-lg">{m.name.charAt(0)}</div>}
                      <div className="min-w-0">
                        <h3 className="font-semibold">{m.name}</h3>
                        <p className="text-sm text-muted-foreground">{[m.occupation, m.organization].filter(Boolean).join(' · ')}</p>
                        {m.linkedin_url && <a href={m.linkedin_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-secondary hover:underline inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" /> LinkedIn</a>}
                      </div>
                    </div>
                    {m.tracks?.length > 0 && <div className="flex flex-wrap gap-1">{m.tracks.map((t) => <Badge key={t} tone="secondary">{t}</Badge>)}</div>}
                    {m.open_to?.length > 0 && <div className="flex flex-wrap gap-1">{m.open_to.map((t) => <Badge key={t}>{t}</Badge>)}</div>}
                    {m.topics?.length > 0 && <p className="text-xs text-muted-foreground">Topics: {m.topics.join(', ')}</p>}
                    <p className="text-xs"><span className="font-medium">{m.available_times.length}</span> open slot{m.available_times.length === 1 ? '' : 's'}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <aside className="lg:sticky lg:top-4 self-start">
          <Card>
            <CardHeader><CardTitle>Book a Session</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <Field label="Mentor">
                  <Select value={mentorId} onChange={(e) => { setMentorId(e.target.value); setTime('') }}>
                    <option value="">Choose a mentor</option>
                    {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                </Field>
                <Field label="Time">
                  <Select value={time} onChange={(e) => setTime(e.target.value)} disabled={!selected}>
                    <option value="">Choose a time</option>
                    {selected?.available_times.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Your Name *"><Input required value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
                <Field label="Your Email *"><Input required type="email" placeholder="your@email.com" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
                <Field label="Class Level">
                  <Select value={f.classLevel} onChange={(e) => set('classLevel', e.target.value)}>
                    <option value="">Select…</option>
                    {CLASS_LEVELS.map((c) => <option key={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="What would you like to discuss?">
                  <div className="grid gap-1">
                    {OPEN_TO.map((o) => (
                      <label key={o} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="h-4 w-4 accent-secondary" checked={f.topics.includes(o)} onChange={(e) => set('topics', e.target.checked ? [...f.topics, o] : f.topics.filter((x) => x !== o))} />{o}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Portfolio / LinkedIn URL"><Input type="url" value={f.portfolioUrl} onChange={(e) => set('portfolioUrl', e.target.value)} /></Field>
                <Field label="Anything specific you'd like to cover?"><Textarea value={f.specificTopics} onChange={(e) => set('specificTopics', e.target.value)} /></Field>
                <Button type="submit" variant="secondary" className="w-full" disabled={saving}>{saving ? 'Booking…' : 'Book Session'}</Button>
              </form>
            </CardContent>
          </Card>
        </aside>
      </div>
    </Page>
  )
}
