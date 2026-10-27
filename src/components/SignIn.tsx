import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Field, Input, Page, useToast } from './ui'
import { requestAccessLink, type Role } from '../lib/api'

const COPY: Record<Role, { title: string; body: string }> = {
  mentor: { title: 'Mentor sign-in', body: "Enter the email you registered with. We'll email you a link to view your bookings and manage your time slots." },
  student: { title: 'Student sign-in', body: "Enter the email you booked with. We'll email you a link to view or cancel your sessions." },
  admin: { title: 'Admin sign-in', body: "Enter your organizer email. We'll email you a link to the admin dashboard." },
}

/** Email form that sends a one-time sign-in link. Used inline or as a full page. */
export function SignInForm({ role, initialEmail = '' }: { role: Role; initialEmail?: string }) {
  const { toast } = useToast()
  const [email, setEmail] = useState(initialEmail)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try { await requestAccessLink(email, role); setSent(true) }
    catch (err) { toast({ title: 'Could not send link', description: (err as Error).message, variant: 'destructive' }) }
    setBusy(false)
  }
  if (sent) {
    return (
      <div className="space-y-3 text-center py-2">
        <MailCheck className="mx-auto h-10 w-10 text-secondary" />
        <p className="font-semibold">Check your email</p>
        <p className="text-sm text-muted-foreground">If <b>{email.trim().toLowerCase()}</b> is on our list, a link is on its way. It works for 12 hours. Check your spam folder if you don't see it in a minute.</p>
      </div>
    )
  }
  return (
    <form className="space-y-4" onSubmit={submit}>
      <p className="text-sm text-muted-foreground">{COPY[role].body}</p>
      <Field label="Email"><Input type="email" required autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Sending…' : role === 'admin' ? 'Email me the admin link' : 'Email me my schedule link'}</Button>
    </form>
  )
}

export function SignInPage({ role, reason }: { role: Role; reason?: string }) {
  const nav = useNavigate()
  return (
    <Page>
      <Card className="max-w-md mx-auto">
        <CardHeader><CardTitle>{COPY[role].title}</CardTitle>{reason && <p className="text-sm text-destructive mt-1">{reason}</p>}</CardHeader>
        <CardContent>
          <SignInForm role={role} />
          <Button variant="ghost" className="w-full mt-3" onClick={() => nav('/')}>Back to home</Button>
        </CardContent>
      </Card>
    </Page>
  )
}
