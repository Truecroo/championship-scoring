import { Link } from 'react-router-dom'
import { Trophy, Users, Eye, Settings } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
            <Trophy className="w-12 h-12 text-primary-600" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-2">
            Championship Scoring
          </h1>
          <p className="text-xl text-white/90">
            Система подсчета баллов для танцевальных чемпионатов
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Judge Cards */}
          <Link
            to="/judge/1"
            className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300 group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Судья 1</h2>
            </div>
            <p className="text-gray-600">
              Оценка команд по 5 критериям с комментариями
            </p>
          </Link>

          <Link
            to="/judge/2"
            className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300 group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Судья 2</h2>
            </div>
            <p className="text-gray-600">
              Оценка команд по 5 критериям с комментариями
            </p>
          </Link>

          <Link
            to="/judge/3"
            className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300 group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Судья 3</h2>
            </div>
            <p className="text-gray-600">
              Оценка команд по 5 критериям с комментариями
            </p>
          </Link>

          {/* Spectator */}
          <Link
            to="/spectator"
            className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300 group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <Eye className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Зритель</h2>
            </div>
            <p className="text-gray-600">
              Голосование за текущую команду
            </p>
          </Link>

          {/* Admin - Full Width */}
          <Link
            to="/admin"
            className="md:col-span-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300 group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Администратор</h2>
            </div>
            <p className="text-white/90">
              Управление командами, номинациями и просмотр результатов
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
