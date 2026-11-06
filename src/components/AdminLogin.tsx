import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, CardHeader, CardTitle, CardContent, Field, Input, Page, useToast } from './ui'
import { adminLogin } from '../lib/api'

/** Admin page sign-in: username + password, checked by the database. */
export function AdminLogin({ onLogin, reason }: { onLogin: (token: string) => void; reason?: string }) {
  const nav = useNavigate()
  const { toast } = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const token = await adminLogin(username, password)
      if (token) onLogin(token)
      else { toast({ title: 'Wrong username or password', variant: 'destructive' }); setPassword('') }
    } catch (err) {
      toast({ title: 'Could not sign in', description: (err as Error).message, variant: 'destructive' })
    }
    setBusy(false)
  }
  return (
    <Page>
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Admin sign-in</CardTitle>
          {reason && <p className="text-sm text-destructive mt-1">{reason}</p>}
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <Field label="Username"><Input required autoFocus autoComplete="username" autoCapitalize="off" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
            <Field label="Password"><Input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
            <p className="text-xs text-muted-foreground">You'll stay signed in for 12 hours in this browser tab.</p>
          </form>
          <Button variant="ghost" className="w-full mt-3" onClick={() => nav('/')}>Back to home</Button>
        </CardContent>
      </Card>
    </Page>
  )
}
