// All data access goes through checked database functions. The browser never
// reads or writes tables directly. Mentors, students and admins prove who they
// are with a one-time sign-in link (a token) sent to their email.
import { supabase } from './supabase'
import type { Booking, Mentor, StudentRequest } from './types'

export type Role = 'mentor' | 'student' | 'admin'
export type PublicMentor = Omit<Mentor, 'email' | 'meeting_url' | 'created_at'>

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(friendly(error.message))
  return data as T
}
function friendly(msg: string) {
  // Postgres wraps our messages; keep just the human part.
  return msg.replace(/^.*?(?=[A-Z])/, '').split('\n')[0] || 'Something went wrong. Please try again.'
}

/* ---- sign-in tokens ---- */
const key = (role: Role) => `vmd-token-${role}`
export function getToken(role: Role): string | null {
  try { return sessionStorage.getItem(key(role)) } catch { return null }
}
export function setToken(role: Role, token: string | null) {
  try { token ? sessionStorage.setItem(key(role), token) : sessionStorage.removeItem(key(role)) } catch { /* ignore */ }
}
/** Pick up the sign-in key from an emailed link (#k=..., or older ?token=...), remember it, and clean the URL. */
export function takeTokenFromUrl(role: Role): string | null {
  const url = new URL(window.location.href)
  const fromHash = new URLSearchParams(url.hash.replace(/^#/, '')).get('k')
  const t = fromHash || url.searchParams.get('token')
  if (t) {
    setToken(role, t)
    url.searchParams.delete('token')
    window.history.replaceState({}, '', url.pathname + url.search)
    return t
  }
  return getToken(role)
}

/* ---- public ---- */
export const listMentors = () => rpc<PublicMentor[]>('list_mentors')
export const registerMentor = (p: Record<string, unknown>) => rpc<Mentor>('register_mentor', { p })
export const bookSession = (p: Record<string, unknown>) => rpc<Booking & { mentor: PublicMentor }>('book_session', { p })
export const requestAccessLink = (email: string, role: Role) => rpc<void>('request_access_link', { p_email: email, p_role: role })

/* ---- mentor ---- */
export const getMentorSchedule = (token: string) => rpc<{ mentor: Mentor; bookings: Booking[] }>('get_mentor_schedule', { p_token: token })
export const mentorUpdate = (token: string, p: Record<string, unknown>) => rpc<void>('mentor_update', { p_token: token, p })
export const mentorCancel = (token: string, bookingId: string, reopen: boolean) => rpc<void>('mentor_cancel', { p_token: token, p_booking_id: bookingId, p_reopen: reopen })

/* ---- student ---- */
export const getStudentSchedule = (token: string) => rpc<{ email: string; bookings: (Booking & { mentor: PublicMentor })[] }>('get_student_schedule', { p_token: token })
export const studentCancel = (token: string, bookingId: string) => rpc<void>('student_cancel', { p_token: token, p_booking_id: bookingId })

/* ---- admin ---- */
export type AdminData = { mentors: Mentor[]; bookings: Booking[]; requests: StudentRequest[]; admins: string[] }
export const adminGetAll = (token: string) => rpc<AdminData>('admin_get_all', { p_token: token })
export const adminCancelBooking = (token: string, bookingId: string) => rpc<void>('admin_cancel_booking', { p_token: token, p_booking_id: bookingId })
export const adminDeleteMentor = (token: string, mentorId: string) => rpc<void>('admin_delete_mentor', { p_token: token, p_mentor_id: mentorId })
export const adminUpdateMentor = (token: string, mentorId: string, p: Record<string, unknown>) => rpc<void>('admin_update_mentor', { p_token: token, p_mentor_id: mentorId, p })
export const adminMatch = (token: string, requestId: string, mentorId: string, time: string) => rpc<void>('admin_match', { p_token: token, p_request_id: requestId, p_mentor_id: mentorId, p_time: time })
export const adminDeleteStudent = (token: string, email: string) => rpc<void>('admin_delete_student', { p_token: token, p_email: email })
export const adminSetAdmins = (token: string, emails: string[]) => rpc<void>('admin_set_admins', { p_token: token, p_emails: emails })
