import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
export default function NotFound() {
  const nav = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center text-center p-4">
      <div className="space-y-4">
        <h1 className="text-5xl font-bold">404</h1>
        <p className="text-muted-foreground">Oops! Page not found</p>
        <Button onClick={() => nav('/')}>Return to Home</Button>
      </div>
    </div>
  )
}
