import { useState, useEffect } from 'react'
import { MessageSquare } from 'lucide-react'

export default function ScoreInput({
  label,
  description,
  value,
  comment,
  onScoreChange,
  onCommentChange
}) {
  const [inputValue, setInputValue] = useState(value?.toString() || '')

  useEffect(() => {
    setInputValue(value?.toString() || '')
  }, [value])

  const handleInputChange = (e) => {
    const val = e.target.value
    setInputValue(val)

    if (val === '') {
      onScoreChange(null)
      return
    }

    const num = parseFloat(val)
    if (!isNaN(num)) {
      onScoreChange(num)
    }
  }

  const handleBlur = () => {
    if (inputValue === '') {
      onScoreChange(null)
      return
    }

    let num = parseFloat(inputValue)
    if (!isNaN(num)) {
      num = Math.max(0.1, Math.min(10.0, num))
      num = Math.round(num * 10) / 10
      onScoreChange(num)
      setInputValue(num.toString())
    }
  }

  const handleSliderChange = (e) => {
    const num = parseFloat(e.target.value)
    onScoreChange(num)
    setInputValue(num.toString())
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
          <div
            className="text-3xl font-bold px-4 py-2 rounded-lg"
            style={{
              backgroundColor: value ? '#e5e7eb' : '#f3f4f6',
              color: value ? '#1f2937' : '#9ca3af'
            }}
          >
            {value ? value.toFixed(1) : '—'}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <input
            type="number"
            min="0.1"
            max="10.0"
            step="0.1"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            placeholder="0.0"
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-xl font-semibold"
          />

          <div className="col-span-2 flex items-center gap-4">
            <input
              type="range"
              min="0.1"
              max="10.0"
              step="0.1"
              value={value || 0.1}
              onChange={handleSliderChange}
              className="flex-1 h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-black-thumb"
              style={{
                background: value
                  ? `linear-gradient(to right, #FF6E00 0%, #FF6E00 ${((value - 0.1) / 9.9) * 100}%, #e5e7eb ${((value - 0.1) / 9.9) * 100}%, #e5e7eb 100%)`
                  : '#e5e7eb'
              }}
            />
            <div className="text-sm text-gray-500 w-12 text-right">10.0</div>
          </div>
        </div>

        <div className="relative">
          <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <textarea
            value={comment || ''}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Добавить комментарий (опционально)..."
            rows="2"
            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
        </div>
      </div>
    </div>
  )
}
