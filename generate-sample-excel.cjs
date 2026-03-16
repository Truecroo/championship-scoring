const XLSX = require('xlsx')

// Тестовые данные, приближённые к реальным
const judges = [
  { id: '1', name: 'Лёня' },
  { id: '2', name: 'Маша' },
  { id: '3', name: 'Дима' }
]

const criteria = [
  { key: 'choreography', label: 'ХОРЕОГРАФИЯ И РИСУНКИ' },
  { key: 'technique', label: 'ТЕХНИКА И ИСПОЛНЕНИЕ' },
  { key: 'artistry', label: 'АРТИСТИЗМ, ОБРАЗ И КОСТЮМ' },
  { key: 'overall', label: 'ОБЩЕЕ ВПЕЧАТЛЕНИЕ' }
]

const nominations = {
  'Соло': [
    'Фредди ди', 'Алина Горностаевая', 'Даша Агалакова',
    'Алина Прозорова', 'Екатерина Будина', 'Анастасия Дудина',
    'Марина Иванова', 'Кирилл Кошкарев', 'Александра Легких',
    'Алена Лыскова', 'Коптяева Саша'
  ],
  'Дуэты': [
    'Огонь & Лёд', 'Ритм города', 'Два крыла',
    'Танцуй со мной', 'Вдохновение', 'Энергия'
  ],
  'Группы': [
    'Pulse Crew', 'Стихия', 'Urban Flow',
    'Dance Machine', 'Freedom', 'Движение вверх',
    'Flash Mob', 'Каскад'
  ]
}

function randomScore(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const wb = XLSX.utils.book_new()

Object.entries(nominations).forEach(([nominationName, teams]) => {
  const colsPerJudge = criteria.length

  // Строка 1: имена судей
  const headerRow1 = ['', '']
  const headerRow2 = ['№', 'КОМАНДА']

  judges.forEach(judge => {
    headerRow1.push(judge.name)
    for (let i = 1; i < colsPerJudge; i++) headerRow1.push('')
    criteria.forEach(c => headerRow2.push(c.label))
  })
  headerRow1.push('', '', '')
  headerRow2.push('СРЕДНИЙ БАЛЛ', 'ШТРАФ', 'ИТОГО')

  const rows = [headerRow1, headerRow2]

  // Генерируем оценки
  const teamData = teams.map((team, idx) => {
    const scores = {}
    let total = 0
    let count = 0
    judges.forEach(judge => {
      scores[judge.id] = {}
      criteria.forEach(c => {
        const s = randomScore(4, 10)
        scores[judge.id][c.key] = s
        total += s
        count++
      })
    })
    const avg = total / count
    const penalty = Math.random() < 0.15 ? randomScore(1, 3) : 0
    return { team, scores, avg, penalty, итого: avg - penalty }
  })

  // Сортируем по итого
  teamData.sort((a, b) => b.итого - a.итого)

  teamData.forEach((data, idx) => {
    const row = [idx + 1, data.team]
    judges.forEach(judge => {
      criteria.forEach(c => {
        row.push(data.scores[judge.id][c.key])
      })
    })
    row.push(
      Number(data.avg.toFixed(2)),
      data.penalty,
      Number(data.итого.toFixed(2))
    )
    rows.push(row)
  })

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Мерж ячеек
  const merges = []
  let col = 2
  judges.forEach(() => {
    merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + colsPerJudge - 1 } })
    col += colsPerJudge
  })
  // Мерж итоговых (вертикально строки 0-1)
  const summaryStart = 2 + judges.length * colsPerJudge
  for (let i = 0; i < 3; i++) {
    merges.push({ s: { r: 0, c: summaryStart + i }, e: { r: 1, c: summaryStart + i } })
  }
  merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } })
  merges.push({ s: { r: 0, c: 1 }, e: { r: 1, c: 1 } })
  ws['!merges'] = merges

  // Ширина колонок
  const colWidths = [{ wch: 4 }, { wch: 25 }]
  for (let i = 0; i < judges.length * colsPerJudge; i++) colWidths.push({ wch: 14 })
  colWidths.push({ wch: 14 }, { wch: 10 }, { wch: 10 })
  ws['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, nominationName.substring(0, 31))
})

const outPath = 'sample_results.xlsx'
XLSX.writeFile(wb, outPath)
console.log(`Сгенерирован: ${outPath}`)
console.log('Листы:', wb.SheetNames.join(', '))
