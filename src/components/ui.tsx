import { createContext, useCallback, useContext, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import { EVENT } from '../lib/config'
import headerImg from '../assets/mentorship-header.jpg'

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

/* ---------- Buttons / inputs ---------- */
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
export function Button({ variant = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
  const v: Record<Variant, string> = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
    outline: 'border border-border bg-white hover:bg-muted',
    ghost: 'hover:bg-muted',
    destructive: 'bg-destructive text-white hover:bg-destructive/90',
  }
  return <button className={cn(base, v[variant], className)} {...p} />
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', className)} {...p} />
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('flex min-h-[90px] w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', className)} {...p} />
}
export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', className)} {...p} />
}
export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="text-sm font-medium leading-none">{children}</label>
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function CheckboxGroup({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <label key={o} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-secondary"
            checked={value.includes(o)}
            onChange={(e) => onChange(e.target.checked ? [...value, o] : value.filter((x) => x !== o))}
          />
          {o}
        </label>
      ))}
    </div>
  )
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'primary' | 'secondary' }) {
  const t = { muted: 'bg-muted text-foreground', primary: 'bg-primary text-primary-foreground', secondary: 'bg-secondary text-secondary-foreground' }[tone]
  return <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', t)}>{children}</span>
}

/* ---------- Cards ---------- */
export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn('rounded-xl border border-border bg-white shadow-[0_4px_16px_-4px_rgb(0_0_0/0.08)]', onClick && 'cursor-pointer transition-shadow hover:shadow-[0_8px_24px_-8px_hsl(45_100%_51%/0.4)]', className)}>
      {children}
    </div>
  )
}
export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-6 pb-2', className)}>{children}</div>
}
export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-xl font-semibold', className)}>{children}</h3>
}
export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-6 pt-2', className)}>{children}</div>
}

/* ---------- Page chrome ---------- */
export function HeaderBanner() {
  return (
    <div className="w-full mb-8">
      <img src={headerImg} alt={`${EVENT.term} Virtual Mentorship Day`} className="w-full h-auto object-cover" />
    </div>
  )
}
export function EventTitle() {
  return (
    <div className="text-center mb-8">
      <h1 className="text-3xl font-bold mb-2">{EVENT.title}</h1>
      <p className="text-muted-foreground">
        {EVENT.term} | {EVENT.dateLong} | {EVENT.time}
      </p>
    </div>
  )
}
export function Page({ children, maxWidth = 'max-w-4xl', banner = true }: { children: ReactNode; maxWidth?: string; banner?: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      {banner && <HeaderBanner />}
      {banner && <EventTitle />}
      <div className={cn('container mx-auto px-4 py-8', maxWidth)}>{children}</div>
    </div>
  )
}
export function BackButton({ to = '/' }: { to?: string }) {
  const nav = useNavigate()
  return (
    <Button variant="ghost" onClick={() => nav(to)} className="mb-6">
      <ArrowLeft className="h-4 w-4" /> Back
    </Button>
  )
}
export function ContactLine() {
  return (
    <p className="text-muted-foreground">
      If you have questions, please contact{' '}
      {EVENT.contacts.map((c, i) => (
        <span key={c.email}>
          <a href={`mailto:${c.email}`} className="text-secondary hover:underline">{c.email}</a>
          {i < EVENT.contacts.length - 1 ? ' or ' : ''}
        </span>
      ))}
    </p>
  )
}
export function ClosedNotice({ title, body }: { title: string; body: string }) {
  const nav = useNavigate()
  return (
    <Card className="p-8 text-center">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-secondary">{title}</h2>
        <p className="text-muted-foreground text-lg">{body}</p>
        <ContactLine />
        <Button onClick={() => nav('/')} className="mt-4">Return Home</Button>
      </div>
    </Card>
  )
}
export function InvalidLink() {
  const nav = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader><CardTitle>Invalid Link</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">This schedule link is not valid.</p>
          <Button onClick={() => nav('/')}>Go to Home</Button>
        </CardContent>
      </Card>
    </div>
  )
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------- Toasts ---------- */
interface Toast { id: number; title: string; description?: string; variant?: 'default' | 'destructive' }
const ToastCtx = createContext<{ toast: (t: Omit<Toast, 'id'>) => void }>({ toast: () => {} })
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s, { ...t, id }])
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4500)
  }, [])
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={cn('rounded-md border p-4 shadow-lg bg-white', t.variant === 'destructive' && 'border-destructive bg-destructive text-white')}>
            <div className="font-semibold text-sm">{t.title}</div>
            {t.description && <div className="text-sm opacity-90 mt-1">{t.description}</div>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- Table ---------- */
export function Table({ children }: { children: ReactNode }) {
  return <div className="relative w-full overflow-auto"><table className="w-full text-sm">{children}</table></div>
}
export function Th({ children }: { children?: ReactNode }) {
  return <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b">{children}</th>
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('p-4 align-middle border-b', className)}>{children}</td>
}
