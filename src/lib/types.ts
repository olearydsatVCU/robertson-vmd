export interface Mentor {
  id: string
  name: string
  email: string
  occupation: string | null
  organization: string | null
  linkedin_url: string | null
  image_url: string | null
  meeting_url: string | null
  tracks: string[]
  open_to: string[]
  topics: string[]
  available_times: string[]
  created_at?: string
}

export interface Booking {
  id: string
  mentor_id: string
  student_name: string
  student_email: string
  specializations: string[]
  graduation_date: string | null
  discussion_topics: string[]
  portfolio_url: string | null
  specific_topics: string | null
  selected_time: string
  created_at: string
}

export interface StudentRequest {
  id: string
  name: string
  email: string
  class_level: string | null
  goals: string | null
  status: 'unmatched' | 'matched'
  created_at: string
}
