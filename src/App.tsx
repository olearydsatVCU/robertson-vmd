import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/ui'
import Home from './pages/Home'
import MentorRegistration from './pages/MentorRegistration'
import StudentBooking from './pages/StudentBooking'
import { MentorConfirmation, StudentConfirmation } from './pages/Confirmations'
import MentorDashboard from './pages/MentorDashboard'
import StudentDashboard from './pages/StudentDashboard'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mentor-registration" element={<MentorRegistration />} />
          <Route path="/mentor-confirmation" element={<MentorConfirmation />} />
          <Route path="/mentor-dashboard" element={<MentorDashboard />} />
          <Route path="/mentor-schedule" element={<MentorDashboard />} />
          <Route path="/student-booking" element={<StudentBooking />} />
          <Route path="/student-confirmation" element={<StudentConfirmation />} />
          <Route path="/student-dashboard" element={<StudentDashboard />} />
          <Route path="/student-schedule" element={<StudentDashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin-bookings" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
