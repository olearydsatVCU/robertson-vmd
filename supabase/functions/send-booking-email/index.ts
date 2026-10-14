// Supabase Edge Function: sends booking confirmation emails via Resend.
// Deploy: supabase functions deploy send-booking-email
// Secrets: supabase secrets set RESEND_API_KEY=re_xxx FROM_EMAIL="VMD <noreply@yourdomain.edu>"
Deno.serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const b = await req.json()
  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev'
  if (!key) return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 500, headers: cors })

  const details = `
    <p><b>Mentor:</b> ${b.mentorName}${b.mentorLinkedIn ? ` (<a href="${b.mentorLinkedIn}">LinkedIn</a>)` : ''}</p>
    <p><b>Time:</b> ${b.sessionTime} on Wednesday, April 15th</p>
    <p><b>Meeting link:</b> ${b.mentorMeetingLink ? `<a href="${b.mentorMeetingLink}">${b.mentorMeetingLink}</a>` : 'Your mentor will share a link.'}</p>
    ${b.discussionTopics?.length ? `<p><b>Discussion topics:</b> ${b.discussionTopics.join(', ')}</p>` : ''}
    ${b.specificTopics ? `<p><b>Specific topics:</b> ${b.specificTopics}</p>` : ''}
    ${b.portfolioUrl ? `<p><b>Portfolio:</b> <a href="${b.portfolioUrl}">${b.portfolioUrl}</a></p>` : ''}`

  const send = (to: string, subject: string, html: string) =>
    fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, subject, html }) })

  const r1 = await send(b.studentEmail, `Your VMD session with ${b.mentorName} is booked`, `<p>Hi ${b.studentName},</p><p>You're confirmed for a Virtual Mentorship Day session.</p>${details}`)
  if (b.mentorEmail) await send(b.mentorEmail, `New VMD booking: ${b.studentName} at ${b.sessionTime}`, `<p>Hi ${b.mentorName},</p><p>${b.studentName} (${b.studentEmail}${b.graduationDate ? `, ${b.graduationDate}` : ''}) booked a session with you.</p>${details}`)
  return new Response(JSON.stringify({ ok: r1.ok }), { headers: { ...cors, 'Content-Type': 'application/json' } })
})
