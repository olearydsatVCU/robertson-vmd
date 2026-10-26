alter function public.vmd_clean_email(text) set search_path = public;
alter function public.vmd_valid_email(text) set search_path = public;
alter function public.vmd_mentor_public(public.mentors) set search_path = public;
alter function public.vmd_booking_json(public.bookings) set search_path = public;
