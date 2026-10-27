// Event-wide settings. Edit these to open/close registration and booking.
export const EVENT = {
  title: 'VCU Robertson School Virtual Mentorship Day',
  term: 'Fall 2026',
  dateLong: 'Friday, November 13th',
  dateShort: 'November 13th',
  time: 'All Day (Eastern Time)',
  // Also update EVENT_DATE in supabase/functions/notify/index.ts when this changes.
  dateISO: '2026-11-13',
  // Name (and optional address) our emails come from. Shown in the spam-folder help.
  senderName: 'VCU Robertson VMD',
  senderEmail: '', // e.g. 'robertsonvmd@gmail.com'
  contacts: [
    { name: 'Jay Adams', title: 'Associate Professor at Robertson', email: 'jwadams@vcu.edu' },
    { name: "Derek O'Leary", title: 'Assistant Professor at Robertson', email: 'olearyds@vcu.edu' },
  ],
  mentorRegistrationOpen: true,
  studentBookingOpen: true,
}

export const TRACKS = [
  'Advertising',
  'Journalism',
  'Public Relations',
  'Media Production',
  'Digital & Social Media',
  'Strategic Communication',
]

export const OPEN_TO = [
  'Career advice',
  'Resume review',
  'Portfolio review',
  'Mock interview',
  'Informational interview',
  'Internship guidance',
  'Grad school advice',
]

export const TOPICS = [
  'Breaking into the industry',
  'Networking',
  'Freelancing',
  'Agency life',
  'Newsroom life',
  'Content creation',
  'Personal branding',
  'Work/life balance',
  'Leadership',
  'Entrepreneurship',
]

export const CLASS_LEVELS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate Student', 'Recent Graduate']

// 8:00 AM through 6:30 PM, every 30 minutes.
export const TIME_SLOTS: string[] = (() => {
  const out: string[] = []
  for (let h = 8; h < 19; h++) {
    for (const m of [0, 30]) {
      const ampm = h >= 12 ? 'PM' : 'AM'
      const hh = h > 12 ? h - 12 : h
      out.push(`${hh}:${m.toString().padStart(2, '0')} ${ampm}`)
    }
  }
  return out
})()

export function sortTimes(times: string[]): string[] {
  const mins = (s: string) => {
    const m = s.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (!m) return 0
    let h = parseInt(m[1])
    const mm = parseInt(m[2])
    const p = m[3].toUpperCase()
    if (p === 'PM' && h !== 12) h += 12
    if (p === 'AM' && h === 12) h = 0
    return h * 60 + mm
  }
  return [...times].sort((a, b) => mins(a) - mins(b))
}
