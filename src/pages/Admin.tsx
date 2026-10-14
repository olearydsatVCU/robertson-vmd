import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Trash2, Pencil, Download } from 'lucide-react'
import { Page, Card, CardHeader, CardTitle, CardContent, Button, Input, Select, Field, Modal, Table, Th, Td, Badge, CheckboxGroup, useToast } from '../components/ui'
import { TRACKS, OPEN_TO, TOPICS, TIME_SLOTS, sortTimes } from '../lib/config'
import { supabase } from '../lib/supabase'
import type { Booking, Mentor, StudentRequest } from '../lib/types'

const ADMIN_PW = (import.meta.env.VITE_ADMIN_PASSWORD as string) || ''
const SESSION_KEY = 'vmd-admin'

type Tab = 'bookings' | 'mentors' | 'students' | 'matching'

export default function Admin() {
  const nav = useNavigate()
  const { toast } = useToast()
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')
  const [pw, setPw] = useState('')
  const [tab, setTab] = useState<Tab>('bookings')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [requests, setRequests] = useState<StudentRequest[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Mentor | null>(null)
  const [match, setMatch] = useState<Record<string, { mentorId?: string; time?: string }>>({})

  const load = async () => {
    const [b, m, r] = await Promise.all([
      supabase.from('bookings').select('*').order('created_at', { ascending: false }),
      supabase.from('mentors').select('*').order('name'),
      supabase.from('student_requests').select('*').order('created_at', { ascending: false }),
    ])
    setBookings(b.data || []); setMentors(m.data || []); setRequests(r.data || [])
  }
  useEffect(() => { if (!authed) return; load(); const i = setInterval(load, 5000); return () => clearInterval(i) }, [authed])

  if (!authed) {
    return (
      <Page>
        <Card className="max-w-md mx-auto">
          <CardHeader><CardTitle>Admin Login</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (ADMIN_PW && pw === ADMIN_PW) { sessionStorage.setItem(SESSION_KEY, '1'); setAuthed(true) } else toast({ title: 'Incorrect password', variant: 'destructive' }) }}>
              <Field label="Password"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></Field>
              {!ADMIN_PW && <p className="text-xs text-destructive">VITE_ADMIN_PASSWORD is not set in .env.</p>}
              <div className="flex gap-2"><Button type="submit">Login</Button><Button type="button" variant="ghost" onClick={() => nav('/')}>Cancel</Button></div>
            </form>
          </CardContent>
        </Card>
      </Page>
    )
  }

  const mentorById = new Map(mentors.map((m) => [m.id, m]))
  const copy = (text: string, msg: string) => { navigator.clipboard.writeText(text); toast({ title: 'Link Copied!', description: msg }) }
  const q = search.toLowerCase()

  /* ---- actions ---- */
  const deleteBooking = async (b: Booking) => {
    if (!confirm(`Delete ${b.student_name}'s booking with ${mentorById.get(b.mentor_id)?.name} at ${b.selected_time}? The slot will reopen.`)) return
    const { error } = await supabase.from('bookings').delete().eq('id', b.id)
    if (error) return toast({ title: 'Error', description: 'Failed to delete booking.', variant: 'destructive' })
    const m = mentorById.get(b.mentor_id)
    if (m && !m.available_times.includes(b.selected_time)) await supabase.from('mentors').update({ available_times: [...m.available_times, b.selected_time] }).eq('id', m.id)
    toast({ title: 'Booking Deleted', description: 'The booking has been removed and the time slot is now available.' }); load()
  }
  const deleteMentor = async (m: Mentor) => {
    if (!confirm(`Delete mentor ${m.name} and ALL of their bookings? This cannot be undone.`)) return
    const { error: e1 } = await supabase.from('bookings').delete().eq('mentor_id', m.id)
    if (e1) return toast({ title: 'Error', description: 'Failed to delete mentor bookings.', variant: 'destructive' })
    const { error } = await supabase.from('mentors').delete().eq('id', m.id)
    if (error) return toast({ title: 'Error', description: 'Failed to delete mentor.', variant: 'destructive' })
    toast({ title: 'Mentor Deleted', description: 'The mentor and their bookings have been removed successfully.' }); load()
  }
  const deleteStudent = async (email: string, name: string) => {
    const mine = bookings.filter((b) => b.student_email === email)
    if (!confirm(`Delete ${name} (${email}) and their ${mine.length} booking(s)? Time slots will reopen.`)) return
    for (const b of mine) {
      const m = mentorById.get(b.mentor_id)
      if (m && !m.available_times.includes(b.selected_time)) await supabase.from('mentors').update({ available_times: [...m.available_times, b.selected_time] }).eq('id', m.id)
    }
    const { error } = await supabase.from('bookings').delete().eq('student_email', email)
    if (error) return toast({ title: 'Error', description: 'Failed to delete student bookings.', variant: 'destructive' })
    await supabase.from('student_requests').delete().eq('email', email)
    toast({ title: 'Student Deleted', description: 'The student and all their bookings have been removed. Time slots are now available.' }); load()
  }
  const saveMentor = async () => {
    if (!editing) return
    const { id, created_at: _c, ...rest } = editing // eslint-disable-line @typescript-eslint/no-unused-vars
    const { error } = await supabase.from('mentors').update(rest).eq('id', id)
    if (error) return toast({ title: 'Error', description: 'Failed to update mentor.', variant: 'destructive' })
    toast({ title: 'Mentor Updated', description: 'The mentor information has been updated successfully.' }); setEditing(null); load()
  }
  const matchStudent = async (r: StudentRequest) => {
    const pick = match[r.id]
    const m = pick?.mentorId ? mentorById.get(pick.mentorId) : undefined
    if (!m || !pick?.time) return toast({ title: 'Pick a mentor and time', description: 'Choose an available mentor + time slot before booking.', variant: 'destructive' })
    if (!m.available_times.includes(pick.time)) { load(); return toast({ title: 'Time slot no longer available', description: 'Please pick another time slot.', variant: 'destructive' }) }
    const { error } = await supabase.from('bookings').insert({ mentor_id: m.id, student_name: r.name, student_email: r.email, specializations: [], graduation_date: r.class_level, discussion_topics: [], portfolio_url: null, specific_topics: r.goals, selected_time: pick.time })
    if (error) return toast({ title: 'Booking failed', description: error.message, variant: 'destructive' })
    await supabase.from('mentors').update({ available_times: m.available_times.filter((t) => t !== pick.time) }).eq('id', m.id)
    await supabase.from('student_requests').update({ status: 'matched' }).eq('id', r.id)
    toast({ title: 'Student Matched!', description: `${r.name} booked with ${m.name} at ${pick.time}.` })
    setMatch((s) => { const n = { ...s }; delete n[r.id]; return n }); load()
  }
  const exportCsv = () => {
    const rows = [['Time', 'Student', 'Student Email', 'Class', 'Mentor', 'Mentor Email', 'Meeting Link', 'Topics', 'Specific Topics', 'Portfolio', 'Booked At']]
    for (const b of bookings) { const m = mentorById.get(b.mentor_id); rows.push([b.selected_time, b.student_name, b.student_email, b.graduation_date || '', m?.name || '', m?.email || '', m?.meeting_url || '', (b.discussion_topics || []).join('; '), b.specific_topics || '', b.portfolio_url || '', b.created_at]) }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'vmd-bookings.csv'; a.click()
  }

  /* ---- derived ---- */
  const students = useMemo(() => {
    const map = new Map<string, { name: string; email: string; bookings: Booking[] }>()
    for (const b of bookings) { const s = map.get(b.student_email) || { name: b.student_name, email: b.student_email, bookings: [] }; s.bookings.push(b); map.set(b.student_email, s) }
    return [...map.values()].filter((s) => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
  }, [bookings, q])
  const filteredMentors = mentors.filter((m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
  const filteredBookings = bookings.filter((b) => !q || [b.student_name, b.student_email, mentorById.get(b.mentor_id)?.name].join(' ').toLowerCase().includes(q))
  const unmatched = requests.filter((r) => r.status === 'unmatched')

  return (
    <Page maxWidth="max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export Bookings CSV</Button>
          <Button variant="ghost" onClick={() => { sessionStorage.removeItem(SESSION_KEY); nav('/') }}>Log out</Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        {[['Mentors', mentors.length], ['Bookings', bookings.length], ['Students', students.length], ['Open Slots', mentors.reduce((n, m) => n + (m.available_times || []).length, 0)]].map(([l, v]) => (
          <Card key={l as string}><CardContent className="p-4"><div className="text-sm text-muted-foreground">{l}</div><div className="text-2xl font-bold">{v}</div></CardContent></Card>
        ))}
      </div>
      <div className="inline-flex h-10 items-center rounded-md bg-muted p-1 mb-4">
        {(['bookings', 'mentors', 'students', 'matching'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-sm px-3 py-1.5 text-sm font-medium capitalize ${tab === t ? 'bg-white shadow-sm' : 'text-muted-foreground'}`}>
            {t === 'matching' ? `Student Matching${unmatched.length ? ` (${unmatched.length})` : ''}` : t}
          </button>
        ))}
      </div>
      {tab !== 'matching' && <Input placeholder={`Search ${tab} by name or email...`} className="max-w-sm mb-4" value={search} onChange={(e) => setSearch(e.target.value)} />}

      {tab === 'bookings' && (
        <Card><CardHeader><CardTitle>Booking Management</CardTitle></CardHeader><CardContent>
          {filteredBookings.length === 0 ? <p className="text-muted-foreground">No bookings yet</p> : (
            <Table>
              <thead><tr><Th>Time</Th><Th>Student</Th><Th>Mentor</Th><Th>Topics</Th><Th>Booked At</Th><Th>Actions</Th></tr></thead>
              <tbody>{filteredBookings.map((b) => { const m = mentorById.get(b.mentor_id); return (
                <tr key={b.id}>
                  <Td className="whitespace-nowrap font-medium">{b.selected_time}</Td>
                  <Td>{b.student_name}<div className="text-xs text-muted-foreground">{b.student_email}{b.graduation_date ? ` · ${b.graduation_date}` : ''}</div></Td>
                  <Td>{m?.name || 'Unknown'}<div className="text-xs text-muted-foreground">{m?.email}</div></Td>
                  <Td className="max-w-xs">{[...(b.discussion_topics || []), b.specific_topics].filter(Boolean).join('; ') || '—'}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{new Date(b.created_at).toLocaleString()}</Td>
                  <Td><Button variant="ghost" onClick={() => deleteBooking(b)} aria-label="Delete booking"><Trash2 className="h-4 w-4 text-destructive" /></Button></Td>
                </tr>) })}</tbody>
            </Table>
          )}
        </CardContent></Card>
      )}

      {tab === 'mentors' && (
        <Card><CardHeader><CardTitle>Mentor Management</CardTitle></CardHeader><CardContent>
          <Table>
            <thead><tr><Th>Mentor</Th><Th>Tracks</Th><Th>Open Slots</Th><Th>Booked</Th><Th>Actions</Th></tr></thead>
            <tbody>{filteredMentors.map((m) => { const n = bookings.filter((b) => b.mentor_id === m.id).length; return (
              <tr key={m.id}>
                <Td>{m.name}<div className="text-xs text-muted-foreground">{m.email}{m.occupation ? ` · ${m.occupation}` : ''}{m.organization ? `, ${m.organization}` : ''}</div></Td>
                <Td><div className="flex flex-wrap gap-1">{(m.tracks || []).map((t) => <Badge key={t} tone="secondary">{t}</Badge>)}</div></Td>
                <Td><div className="flex flex-wrap gap-1 max-w-xs">{sortTimes(m.available_times || []).map((t) => <button key={t} title="Remove slot" onClick={async () => { if (!confirm(`Remove ${t} from ${m.name}?`)) return; const { error } = await supabase.from('mentors').update({ available_times: m.available_times.filter((x) => x !== t) }).eq('id', m.id); if (error) toast({ title: 'Error', description: 'Failed to delete time slot.', variant: 'destructive' }); else { toast({ title: 'Time Slot Deleted', description: "The time slot has been removed from the mentor's availability." }); load() } }} className="rounded-full bg-muted px-2 py-0.5 text-xs hover:bg-destructive hover:text-white">{t}</button>)}{(m.available_times || []).length === 0 && <span className="text-xs text-muted-foreground">none</span>}</div></Td>
                <Td>{n}</Td>
                <Td><div className="flex gap-1">
                  <Button variant="ghost" title="Copy schedule link" onClick={() => copy(`${location.origin}/mentor-schedule?id=${m.id}`, 'Share this link with the mentor to view their schedule.')}><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" title="Edit" onClick={() => setEditing({ ...m, tracks: m.tracks || [], open_to: m.open_to || [], topics: m.topics || [], available_times: m.available_times || [] })}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" title="Delete" onClick={() => deleteMentor(m)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div></Td>
              </tr>) })}</tbody>
          </Table>
        </CardContent></Card>
      )}

      {tab === 'students' && (
        <Card><CardHeader><CardTitle>Students</CardTitle></CardHeader><CardContent>
          {students.length === 0 ? <p className="text-muted-foreground">No bookings yet</p> : (
            <Table>
              <thead><tr><Th>Student</Th><Th>Sessions</Th><Th>Actions</Th></tr></thead>
              <tbody>{students.map((s) => (
                <tr key={s.email}>
                  <Td>{s.name}<div className="text-xs text-muted-foreground">{s.email}</div></Td>
                  <Td>{sortTimes(s.bookings.map((b) => b.selected_time)).map((t) => { const b = s.bookings.find((x) => x.selected_time === t)!; return <div key={b.id} className="text-sm">{t} · {mentorById.get(b.mentor_id)?.name || 'Unknown'}</div> })}</Td>
                  <Td><div className="flex gap-1">
                    <Button variant="ghost" title="Copy schedule link" onClick={() => copy(`${location.origin}/student-schedule?email=${encodeURIComponent(s.email)}`, 'Share this link with the student to view their schedule.')}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" title="Delete" onClick={() => deleteStudent(s.email, s.name)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div></Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </CardContent></Card>
      )}

      {tab === 'matching' && (
        <Card><CardHeader><CardTitle>Student Matching</CardTitle><p className="text-sm text-muted-foreground">Students on the waitlist who haven't been matched with a mentor yet.</p></CardHeader><CardContent>
          {unmatched.length === 0 ? <p className="text-muted-foreground">No unmatched students.</p> : (
            <div className="space-y-4">{unmatched.map((r) => { const pick = match[r.id] || {}; const m = pick.mentorId ? mentorById.get(pick.mentorId) : undefined; return (
              <div key={r.id} className="rounded-md border p-4 grid gap-3 md:grid-cols-[1fr_220px_160px_auto] items-end">
                <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.email}{r.class_level ? ` · ${r.class_level}` : ''}</div>{r.goals && <div className="text-sm mt-1">{r.goals}</div>}</div>
                <Select value={pick.mentorId || ''} onChange={(e) => setMatch((s) => ({ ...s, [r.id]: { mentorId: e.target.value } }))}><option value="">Choose a mentor</option>{mentors.filter((x) => (x.available_times || []).length > 0).map((x) => <option key={x.id} value={x.id}>{x.name} ({x.available_times.length})</option>)}</Select>
                <Select value={pick.time || ''} disabled={!m} onChange={(e) => setMatch((s) => ({ ...s, [r.id]: { ...s[r.id], time: e.target.value } }))}><option value="">Choose a time</option>{sortTimes(m?.available_times || []).map((t) => <option key={t}>{t}</option>)}</Select>
                <Button onClick={() => matchStudent(r)}>Confirm Booking</Button>
              </div>) })}</div>
          )}
        </CardContent></Card>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Mentor">
        {editing && (
          <form className="space-y-3 max-h-[70vh] overflow-y-auto pr-1" onSubmit={(e) => { e.preventDefault(); saveMentor() }}>
            <Field label="Name"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
            <Field label="Occupation"><Input value={editing.occupation || ''} onChange={(e) => setEditing({ ...editing, occupation: e.target.value })} /></Field>
            <Field label="Organization"><Input value={editing.organization || ''} onChange={(e) => setEditing({ ...editing, organization: e.target.value })} /></Field>
            <Field label="LinkedIn URL"><Input value={editing.linkedin_url || ''} onChange={(e) => setEditing({ ...editing, linkedin_url: e.target.value })} /></Field>
            <Field label="Meeting URL"><Input value={editing.meeting_url || ''} onChange={(e) => setEditing({ ...editing, meeting_url: e.target.value })} /></Field>
            <Field label="Tracks"><CheckboxGroup options={TRACKS} value={editing.tracks} onChange={(v) => setEditing({ ...editing, tracks: v })} /></Field>
            <Field label="Open to"><CheckboxGroup options={OPEN_TO} value={editing.open_to} onChange={(v) => setEditing({ ...editing, open_to: v })} /></Field>
            <Field label="Topics"><CheckboxGroup options={TOPICS} value={editing.topics} onChange={(v) => setEditing({ ...editing, topics: v })} /></Field>
            <Field label="Available times"><CheckboxGroup options={TIME_SLOTS} value={editing.available_times} onChange={(v) => setEditing({ ...editing, available_times: sortTimes(v) })} /></Field>
            <div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit">Save</Button></div>
          </form>
        )}
      </Modal>
    </Page>
  )
}
