import { MailWarning } from 'lucide-react'
import { EVENT } from '../lib/config'

const STEPS: { app: string; steps: string[] }[] = [
  { app: 'Gmail', steps: ['Open the Spam folder (on a phone: tap the menu, then Spam).', 'Open our email and click "Report not spam" (or "Not spam").', 'Optional: add the sender to your Contacts so future emails go straight to your inbox.'] },
  { app: 'Outlook / Microsoft 365', steps: ['Open the Junk Email folder.', 'Select our email and choose "Not junk" (in some versions: Report, then Not junk).', 'When asked, choose "Always trust email from" this sender. You can also add it under Settings, Mail, Junk email, Safe senders.'] },
  { app: 'Apple Mail / iCloud', steps: ['Open the Junk folder.', 'Select our email and tap "Move to Inbox" (or the "Not Junk" banner).', 'Optional: add the sender to your Contacts.'] },
  { app: 'Yahoo', steps: ['Open the Spam folder.', 'Select our email and click "Not spam".'] },
]

/** Shown on confirmation pages: tells people where our emails might land and how to fix it. */
export function SpamHelp({ role }: { role: 'mentor' | 'student' }) {
  const from = EVENT.senderEmail ? `"${EVENT.senderName}" (${EVENT.senderEmail})` : `"${EVENT.senderName}"`
  const upcoming = role === 'student'
    ? 'your booking confirmation, calendar invite, reminders, cancellations, and sign-in links for your schedule'
    : 'your sign-up confirmation, an email for every student who books you, reminders, cancellations, and sign-in links for your schedule'
  return (
    <div className="rounded-xl border border-primary/60 bg-primary/10 p-4 space-y-3 text-sm">
      <div className="flex items-start gap-3">
        <MailWarning className="h-5 w-5 shrink-0 text-foreground mt-0.5" aria-hidden />
        <div className="space-y-1">
          <p className="font-semibold">Don't see our email? Check your spam or junk folder.</p>
          <p>We'll send {upcoming} from {from}. Because we're a new sender, some email services put us in spam at first. Find our email and mark it as safe so the rest reach your inbox.</p>
          {role === 'student'
            ? <p className="text-muted-foreground">Using your VCU email? Follow the steps for the app you read it in.</p>
            : <p className="text-muted-foreground">Using a work email? If it's not in Junk either, your company may be holding it. Ask your IT team to allow emails from {from}.</p>}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 items-start">
        {STEPS.map((s) => (
          <details key={s.app} className="rounded-lg bg-white border border-border px-3 py-2">
            <summary className="cursor-pointer font-medium">{s.app}</summary>
            <ol className="list-decimal pl-5 mt-2 space-y-1 text-muted-foreground">{s.steps.map((x) => <li key={x}>{x}</li>)}</ol>
          </details>
        ))}
      </div>
    </div>
  )
}
