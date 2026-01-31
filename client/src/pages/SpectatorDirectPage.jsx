import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SpectatorDirectPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // Просто перенаправляем на страницу зрителей
    navigate('/spectator', { replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
    </div>
  )
}
