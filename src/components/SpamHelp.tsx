import { MailWarning } from 'lucide-react'
import { EVENT } from '../lib/config'

const STEPS: { app: string; steps: string[] }[] = [
  { app: 'Gmail', steps: ['Open the Spam folder (on a phone: tap the menu, then Spam).', 'Open our email and click "Report not spam" (or "Not spam").', 'Optional: add the sender to your Contacts so future emails go straight to your inbox.'] },
  { app: 'Outlook / Microsoft 365', steps: ['Open the Junk Email folder.', 'Select our email and choose "Not junk" (in some versions: Report, then Not junk).', 'When asked, choose "Always trust email from" this sender. You can also add it under Settings, Mail, Junk email, Safe senders.'] },
  { app: 'Apple Mail / iCloud', steps: ['Open the Junk folder.', 'Select our email and tap "Move to Inbox" (or the "Not Junk" banner).', 'Optional: add the sender to your Contacts.'] },
  { app: 'Yahoo', steps: ['Open the Spam folder.', 'Select our email and click "Not spam".'] },
]

const SUBJECT = {
  student: 'Booked: your mentorship session with …',
  mentor: "You're registered as a mentor for Virtual Mentorship Day",
}

/** Shown first on confirmation pages: go find the confirmation email now, it's probably in spam. */
export function SpamHelp({ role, email }: { role: 'mentor' | 'student'; email: string }) {
  const upcoming = role === 'student'
    ? 'your calendar invite, reminder, any cancellation notice, and sign-in links for your schedule'
    : 'an email for every student who books you, reminders, cancellations, and sign-in links for your schedule'
  return (
    <section className="rounded-xl border-2 border-secondary bg-secondary/5 p-5 space-y-4" aria-labelledby="find-email">
      <div className="flex items-start gap-3">
        <MailWarning className="h-7 w-7 shrink-0 text-secondary" aria-hidden />
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-secondary">Do this now</p>
          <h3 id="find-email" className="text-xl font-bold leading-snug">Find your confirmation email. It's probably in your spam folder.</h3>
          <p>We just emailed <b className="break-all">{email}</b>. Because we're a new sender, most email services put our first email in <b>Spam</b> or <b>Junk</b>.</p>
          <p><b>Open it and mark it "Not spam."</b> If you skip this, {upcoming} may land in spam too, and you could miss them.</p>
        </div>
      </div>

      <dl className="grid gap-1 rounded-lg bg-white border border-border p-3 text-sm sm:grid-cols-[90px_1fr]">
        <dt className="text-muted-foreground">From</dt><dd className="font-medium break-all">{EVENT.senderName}{EVENT.senderEmail && <> ({EVENT.senderEmail})</>}</dd>
        <dt className="text-muted-foreground">Subject</dt><dd className="font-medium">{SUBJECT[role]}</dd>
      </dl>

      <div className="space-y-2">
        <p className="text-sm font-semibold">How to mark it "Not spam":</p>
        <div className="grid gap-2 sm:grid-cols-2 items-start text-sm">
          {STEPS.map((s) => (
            <details key={s.app} className="rounded-lg bg-white border border-border px-3 py-2">
              <summary className="cursor-pointer font-medium">{s.app}</summary>
              <ol className="list-decimal pl-5 mt-2 space-y-1 text-muted-foreground">{s.steps.map((x) => <li key={x}>{x}</li>)}</ol>
            </details>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {role === 'student'
          ? 'Using your VCU email? Follow the steps for the app you read it in. '
          : `Using a work email? If it's not in Junk either, your company may be holding it. Ask your IT team to allow ${EVENT.senderEmail || EVENT.senderName}. `}
        Still nothing after 10 minutes? Email {EVENT.senderEmail ? <a className="text-secondary underline" href={`mailto:${EVENT.senderEmail}`}>{EVENT.senderEmail}</a> : 'the organizers'}.
      </p>
    </section>
  )
}
