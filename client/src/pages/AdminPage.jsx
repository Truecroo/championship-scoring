import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Trophy, Users,
  Eye, BarChart3, Settings, ChevronUp, ChevronDown, Download, QrCode, LogOut, RefreshCw, AlertCircle, CheckCircle, Pencil, ChevronRight, ShieldAlert
} from 'lucide-react'
import {
  getNominations, createNomination, deleteNomination, reorderNominations,
  getTeams, createTeam, deleteTeam, reorderTeams, updateTeamPenalty, updateTeamName,
  getResults, setCurrentTeam, getCurrentTeam, getScores, getJudges
} from '../utils/api'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import { QRCodeCanvas } from 'qrcode.react'

// Smart score formatting: 2 decimals by default, 3 if there are duplicates at 2
function formatScore(value, allValues = []) {
  if (value == null) return '—'
  const s2 = value.toFixed(2)
  // Check if any other value in the group looks the same at 2 decimals
  const hasDuplicate = allValues.some(v => v !== value && v != null && v.toFixed(2) === s2)
  return hasDuplicate ? value.toFixed(3) : s2
}

export default function AdminPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('nominations')
  const [nominations, setNominations] = useState([])
  const [teams, setTeams] = useState([])
  const [results, setResults] = useState([])
  const [currentTeam, setCurrentTeamState] = useState(null)

  const [allScores, setAllScores] = useState([])
  const [judges, setJudges] = useState([])
  const [expandedTeam, setExpandedTeam] = useState(null)
  const [collapsedNominations, setCollapsedNominations] = useState(new Set())

  const [newNominationName, setNewNominationName] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamPenalty, setNewTeamPenalty] = useState('')
  const [selectedNominationForTeam, setSelectedNominationForTeam] = useState('')
  const [selectedNominationForCurrent, setSelectedNominationForCurrent] = useState('')
  const [selectedTeamForCurrent, setSelectedTeamForCurrent] = useState('')
  const [pageLoading, setPageLoading] = useState(true)
  const [connectionError, setConnectionError] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Check admin session expiry on load and periodically
  useEffect(() => {
    const checkSession = () => {
      try {
        const auth = JSON.parse(localStorage.getItem('admin_auth') || '{}')
        if (!auth.token || !auth.timestamp || Date.now() - auth.timestamp > 24 * 60 * 60 * 1000) {
          localStorage.removeItem('admin_auth')
          navigate('/admin-login')
        }
      } catch {
        localStorage.removeItem('admin_auth')
        navigate('/admin-login')
      }
    }
    checkSession()
    const interval = setInterval(checkSession, 60000) // check every minute
    return () => clearInterval(interval)
  }, [navigate])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (activeTab === 'results') {
      loadResults()
    }
  }, [activeTab])

  // Auto-refresh results every 5 seconds when on results tab
  useEffect(() => {
    if (activeTab === 'results') {
      const interval = setInterval(() => {
        loadResults()
      }, 5000) // Refresh every 5 seconds

      return () => clearInterval(interval)
    }
  }, [activeTab])

  const loadData = async () => {
    try {
      const [nomsData, teamsData, currentData] = await Promise.all([
        getNominations(),
        getTeams(),
        getCurrentTeam()
      ])
      setNominations(nomsData)
      setTeams(teamsData)
      setCurrentTeamState(currentData)
      setVotingMode(currentData?.voting_mode || 'live')
      setConnectionError(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setConnectionError(true)
    } finally {
      setPageLoading(false)
    }
  }

  const loadResults = async () => {
    const [data, scoresData, judgesData] = await Promise.allSettled([
      getResults(),
      getScores(),
      getJudges()
    ])
    if (data.status === 'fulfilled') setResults(data.value)
    if (scoresData.status === 'fulfilled') setAllScores(scoresData.value)
    if (judgesData.status === 'fulfilled') setJudges(judgesData.value)
  }

  const handleCreateNomination = async (e) => {
    e.preventDefault()
    if (!newNominationName.trim()) return

    try {
      await createNomination(newNominationName)
      setNewNominationName('')
      loadData()
    } catch (error) {
      showToast('Ошибка создания номинации', 'error')
    }
  }

  const handleDeleteNomination = async (id) => {
    // Check if nomination has scores
    try {
      const allScores = await getScores()
      const nominationScores = allScores.filter(s => s.nomination_id === id)
      const nominationTeams = teams.filter(t => t.nomination_id === id)

      let message = 'Удалить эту номинацию?'
      if (nominationTeams.length > 0 || nominationScores.length > 0) {
        const parts = [`${nominationTeams.length} команд`]
        if (nominationScores.length > 0) {
          parts.push(`${nominationScores.length} оценок судей`)
        }
        parts.push('все голоса зрителей')
        message = `Удалить эту номинацию? Будут удалены: ${parts.join(', ')}. Это действие необратимо!`
      }

      if (!confirm(message)) return
    } catch {
      if (!confirm('Удалить эту номинацию? Все связанные данные тоже будут удалены.')) return
    }

    try {
      await deleteNomination(id)
      loadData()
    } catch (error) {
      showToast('Ошибка удаления номинации', 'error')
    }
  }

  const handleReorderNomination = async (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= nominations.length) return
    const reordered = [...nominations]
    ;[reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]]
    setNominations(reordered)
    try {
      await reorderNominations(reordered.map(n => n.id))
    } catch {
      showToast('Ошибка сортировки', 'error')
      loadData()
    }
  }

  const handleCreateTeam = async (e) => {
    e.preventDefault()
    if (!newTeamName.trim() || !selectedNominationForTeam) return

    try {
      await createTeam(newTeamName, selectedNominationForTeam, parseFloat(newTeamPenalty) || 0)
      setNewTeamName('')
      setNewTeamPenalty('')
      loadData()
    } catch (error) {
      showToast('Ошибка создания команды', 'error')
    }
  }

  const handleEditPenalty = async (teamId, currentPenalty) => {
    const input = prompt('Введите штраф (например -0.5, 0 для отмены):', String(currentPenalty || 0))
    if (input === null) return
    const penalty = parseFloat(input)
    if (isNaN(penalty)) {
      showToast('Некорректное значение штрафа', 'error')
      return
    }
    try {
      await updateTeamPenalty(teamId, penalty)
      showToast(penalty === 0 ? 'Штраф убран' : `Штраф установлен: ${penalty}`)
      loadData()
    } catch (error) {
      showToast('Ошибка сохранения штрафа', 'error')
    }
  }

  const handleEditName = async (teamId, currentName) => {
    const newName = prompt('Новое название команды:', currentName)
    if (newName === null || newName.trim() === '' || newName.trim() === currentName) return
    try {
      await updateTeamName(teamId, newName.trim())
      showToast('Название обновлено')
      loadData()
    } catch (error) {
      showToast('Ошибка переименования', 'error')
    }
  }

  const handleDeleteTeam = async (id) => {
    // Подсчитываем связанные данные для предупреждения
    let message = 'Удалить эту команду?'
    try {
      const allScores = await getScores()
      const teamScores = allScores.filter(s => s.team_id === id)
      const isCurrentTeam = currentTeam?.team_id === id
      const parts = []
      if (teamScores.length > 0) parts.push(`${teamScores.length} оценок судей`)
      if (parts.length > 0 || isCurrentTeam) {
        message = `Удалить эту команду? Будут удалены: ${parts.join(' и ')}.`
        if (isCurrentTeam) message += ' Эта команда сейчас активна для голосования!'
        message += ' Голоса зрителей тоже будут удалены. Это действие необратимо!'
      }
    } catch {
      message = 'Удалить эту команду? Все оценки судей и голоса зрителей тоже будут удалены.'
    }

    if (!confirm(message)) return
    try {
      await deleteTeam(id)
      loadData()
    } catch (error) {
      showToast('Ошибка удаления команды', 'error')
    }
  }

  const handleSetCurrentTeam = async (teamId, nominationId) => {
    const tId = teamId || selectedTeamForCurrent
    const nId = nominationId || selectedNominationForCurrent
    if (!tId || !nId) return

    try {
      await setCurrentTeam(tId, nId, votingMode)
      await loadData()
      showToast('Текущая команда переключена')
    } catch (error) {
      if (error.message?.includes('401') || error.message?.includes('авторизац')) {
        showToast('Сессия истекла. Войдите заново', 'error')
        localStorage.removeItem('admin_auth')
        setTimeout(() => navigate('/admin-login'), 1500)
      } else {
        showToast('Ошибка переключения команды', 'error')
      }
    }
  }

  const handleMoveTeamUp = async (teamId, nominationId) => {
    const nominationTeams = teams.filter(t => t.nomination_id === nominationId)
    const localIndex = nominationTeams.findIndex(t => t.id === teamId)
    if (localIndex <= 0) return

    const prevTeams = teams
    const newTeams = [...teams]
    const globalA = newTeams.findIndex(t => t.id === nominationTeams[localIndex].id)
    const globalB = newTeams.findIndex(t => t.id === nominationTeams[localIndex - 1].id)
    const temp = newTeams[globalA]
    newTeams[globalA] = newTeams[globalB]
    newTeams[globalB] = temp
    setTeams(newTeams)

    // Persist new order to DB, rollback on error
    const reordered = newTeams.filter(t => t.nomination_id === nominationId).map(t => t.id)
    try {
      await reorderTeams(reordered)
    } catch (e) {
      console.error('Reorder failed:', e)
      setTeams(prevTeams)
      showToast('Ошибка сохранения порядка команд', 'error')
    }
  }

  const handleMoveTeamDown = async (teamId, nominationId) => {
    const nominationTeams = teams.filter(t => t.nomination_id === nominationId)
    const localIndex = nominationTeams.findIndex(t => t.id === teamId)
    if (localIndex >= nominationTeams.length - 1) return

    const prevTeams = teams
    const newTeams = [...teams]
    const globalA = newTeams.findIndex(t => t.id === nominationTeams[localIndex].id)
    const globalB = newTeams.findIndex(t => t.id === nominationTeams[localIndex + 1].id)
    const temp = newTeams[globalA]
    newTeams[globalA] = newTeams[globalB]
    newTeams[globalB] = temp
    setTeams(newTeams)

    // Persist new order to DB, rollback on error
    const reordered = newTeams.filter(t => t.nomination_id === nominationId).map(t => t.id)
    try {
      await reorderTeams(reordered)
    } catch (e) {
      console.error('Reorder failed:', e)
      setTeams(prevTeams)
      showToast('Ошибка сохранения порядка команд', 'error')
    }
  }

  const handleExportExcel = () => {
    if (results.length === 0) {
      alert('Нет данных для экспорта')
      return
    }

    const criteria = [
      { key: 'choreography', label: 'ХОРЕОГРАФИЯ И РИСУНКИ' },
      { key: 'technique', label: 'ТЕХНИКА И ИСПОЛНЕНИЕ' },
      { key: 'artistry', label: 'АРТИСТИЗМ, ОБРАЗ И КОСТЮМ' },
      { key: 'overall', label: 'ОБЩЕЕ ВПЕЧАТЛЕНИЕ' }
    ]

    // Группируем по номинациям
    const resultsByNomination = results.reduce((acc, result) => {
      if (!acc[result.nomination_name]) {
        acc[result.nomination_name] = []
      }
      acc[result.nomination_name].push(result)
      return acc
    }, {})

    const wb = XLSX.utils.book_new()

    // Для каждой номинации — отдельный лист в формате шаблона
    Object.entries(resultsByNomination).forEach(([nominationName, nominationResults]) => {
      const sortedResults = [...nominationResults].sort((a, b) => b.judges_score - a.judges_score)

      // Собираем уникальных судей, оценивших эту номинацию
      const nominationScores = allScores.filter(s => s.nomination_id === sortedResults[0]?.nomination_id)
      const judgeIds = [...new Set(nominationScores.map(s => String(s.judge_id)))]
      const judgeList = judgeIds.map(id => {
        const j = judges.find(j => String(j.id) === id)
        return { id, name: j?.name || `Судья ${id}` }
      })

      // Строка 1: пустые + имена судей (мерж по 4 столбца) + ИТОГО
      // Строка 2: №, КОМАНДА, [критерии x N судей], СРЕДНИЙ БАЛЛ, ШТРАФ, ИТОГО
      const colsPerJudge = criteria.length
      const headerRow1 = ['', '']
      const headerRow2 = ['№', 'КОМАНДА']

      judgeList.forEach(judge => {
        headerRow1.push(judge.name)
        for (let i = 1; i < colsPerJudge; i++) headerRow1.push('')
        criteria.forEach(c => headerRow2.push(c.label))
      })
      headerRow1.push('', '', '')
      headerRow2.push('СРЕДНИЙ БАЛЛ', 'ШТРАФ', 'ИТОГО')

      const rows = [headerRow1, headerRow2]

      // Данные команд
      sortedResults.forEach((r, idx) => {
        const row = [idx + 1, r.team_name]
        judgeList.forEach(judge => {
          const score = nominationScores.find(
            s => String(s.judge_id) === judge.id && s.team_id === r.team_id
          )
          criteria.forEach(c => {
            row.push(score?.scores?.[c.key]?.score ?? '')
          })
        })
        row.push(
          r.judges_score != null ? r.judges_score - (r.penalty || 0) : '',
          r.penalty || 0,
          r.judges_score ?? ''
        )
        rows.push(row)
      })

      const ws = XLSX.utils.aoa_to_sheet(rows)

      // Мерж ячеек для имён судей (строка 0)
      const merges = []
      let col = 2 // начинаем после № и КОМАНДА
      judgeList.forEach(() => {
        merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + colsPerJudge - 1 } })
        col += colsPerJudge
      })
      // Мерж для СРЕДНИЙ БАЛЛ, ШТРАФ, ИТОГО (строки 0-1 вертикально)
      const summaryStart = 2 + judgeList.length * colsPerJudge
      for (let i = 0; i < 3; i++) {
        merges.push({ s: { r: 0, c: summaryStart + i }, e: { r: 1, c: summaryStart + i } })
      }
      // Мерж № и КОМАНДА (строки 0-1 вертикально)
      merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } })
      merges.push({ s: { r: 0, c: 1 }, e: { r: 1, c: 1 } })
      ws['!merges'] = merges

      // Ширина колонок
      const colWidths = [{ wch: 4 }, { wch: 25 }]
      for (let i = 0; i < judgeList.length * colsPerJudge; i++) colWidths.push({ wch: 14 })
      colWidths.push({ wch: 14 }, { wch: 10 }, { wch: 10 })
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, nominationName.substring(0, 31))
    })

    const timestamp = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `Результаты_чемпионата_${timestamp}.xlsx`)
  }

  const handleExportPDF = () => {
    if (results.length === 0 || allScores.length === 0) {
      alert('Нет данных для экспорта PDF (нужны оценки судей)')
      return
    }

    const CRITERIA = [
      { key: 'choreography', label: '\u266B Хореография и рисунки', weight: '45%' },
      { key: 'technique', label: '\u2726 Техника и исполнение', weight: '35%' },
      { key: 'artistry', label: '\u263A Артистизм, образ и костюм', weight: '15%' },
      { key: 'overall', label: '\u2605 Общее впечатление', weight: '5%' },
    ]

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    // Load Roboto fonts from pdfmake's vfs
    const vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts
    doc.addFileToVFS('Roboto-Regular.ttf', vfs['Roboto-Regular.ttf'])
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    doc.addFileToVFS('Roboto-Medium.ttf', vfs['Roboto-Medium.ttf'])
    doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold')
    doc.setFont('Roboto')

    // Group results by nomination
    const resultsByNomination = results.reduce((acc, r) => {
      if (!acc[r.nomination_name]) acc[r.nomination_name] = []
      acc[r.nomination_name].push(r)
      return acc
    }, {})

    let isFirstPage = true

    Object.entries(resultsByNomination).forEach(([nominationName, nominationResults]) => {
      // Порядок по выступлению (display_order из API), не по баллам
      const sorted = [...nominationResults]

      sorted.forEach(result => {
        // Get scores for this team from all judges
        const teamScores = allScores.filter(
          s => s.team_id === result.team_id && s.nomination_id === result.nomination_id
        )
        if (teamScores.length === 0) return

        if (!isFirstPage) doc.addPage()
        isFirstPage = false

        const teamJudges = teamScores
          .sort((a, b) => String(a.judge_id).localeCompare(String(b.judge_id)))
          .map(s => {
            const judgeName = judges.find(j => String(j.id) === String(s.judge_id))?.name || `Судья ${s.judge_id}`
            return { name: judgeName, scores: s.scores }
          })

        const judgeCount = teamJudges.length
        const teamPenalty = result.penalty || 0
        const finalScore = result.judges_score

        // --- Header ---
        doc.setFont('Roboto', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(150, 150, 150)
        doc.text('БЛЭСТ ЧЕМП 2026', 148.5, 12, { align: 'center' })

        doc.setTextColor(0, 0, 0)
        doc.setFontSize(22)
        doc.text('СУДЕЙСКИЙ ЛИСТ', 148.5, 22, { align: 'center' })

        doc.setFont('Roboto', 'normal')
        doc.setFontSize(14)
        doc.text(`Команда: ${result.team_name}`, 14, 33)
        doc.text(`Номинация: ${nominationName}`, 283, 33, { align: 'right' })

        // --- Build table ---
        const head = [['Критерий', 'Вес', ...teamJudges.map(j => j.name)]]
        const body = []

        CRITERIA.forEach(({ key, label, weight }) => {
          const row = [
            { content: label, styles: { fontStyle: 'bold' } },
            { content: weight, styles: { halign: 'center' } },
          ]
          teamJudges.forEach(j => {
            const val = j.scores[key]
            const scoreStr = val?.score != null ? Number(val.score).toFixed(1) : '—'
            const comment = val?.comment || ''
            row.push({ content: comment ? scoreStr + '\n' + comment : scoreStr, styles: { halign: 'center' } })
          })
          body.push(row)
        })

        const criteriaRowCount = CRITERIA.length
        const hasPenalty = teamPenalty !== 0

        if (hasPenalty) {
          body.push([
            'Штраф',
            '',
            { content: String(teamPenalty), colSpan: judgeCount, styles: { halign: 'center' } }
          ])
        }

        body.push([
          'ИТОГО',
          '',
          { content: formatScore(finalScore), colSpan: judgeCount, styles: { halign: 'center' } }
        ])

        const totalRows = body.length

        autoTable(doc, {
          startY: 39,
          head,
          body,
          theme: 'grid',
          styles: { font: 'Roboto', fontSize: 11, cellPadding: 4, valign: 'top', minCellHeight: 18 },
          headStyles: { fillColor: [29, 29, 29], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 12, halign: 'center' },
          columnStyles: {
            0: { cellWidth: 58, fontStyle: 'bold' },
            1: { cellWidth: 16, halign: 'center' },
          },
          didParseCell: function(data) {
            if (data.section !== 'body') return
            const ri = data.row.index

            if (hasPenalty && ri === totalRows - 2) {
              data.cell.styles.fillColor = [254, 242, 242]
              data.cell.styles.fontStyle = 'bold'
              data.cell.styles.textColor = [220, 38, 38]
              data.cell.styles.fontSize = 13
            }

            if (ri === totalRows - 1) {
              data.cell.styles.fillColor = [239, 246, 255]
              data.cell.styles.fontStyle = 'bold'
              data.cell.styles.fontSize = 16
              if (data.column.index >= 2) data.cell.styles.textColor = [30, 64, 175]
            }

            if (ri < criteriaRowCount && ri % 2 === 1) {
              data.cell.styles.fillColor = [245, 247, 250]
            }

            if (ri < criteriaRowCount && data.column.index >= 2) {
              data.cell.text = []
            }
          },
          didDrawCell: function(data) {
            if (data.section !== 'body') return
            const ri = data.row.index
            if (ri >= criteriaRowCount || data.column.index < 2) return

            const criterionKey = CRITERIA[ri].key
            const judgeIdx = data.column.index - 2
            const val = teamJudges[judgeIdx]?.scores[criterionKey]
            if (!val) return

            const x = data.cell.x + data.cell.width / 2

            doc.setFont('Roboto', 'bold')
            doc.setFontSize(14)
            doc.setTextColor(0, 0, 0)
            const scoreY = data.cell.y + 7
            doc.text(val.score != null ? Number(val.score).toFixed(1) : '—', x, scoreY, { align: 'center' })

            doc.setFont('Roboto', 'normal')
            doc.setFontSize(7)
            doc.setTextColor(120, 120, 120)
            if (val.comment) {
              const maxWidth = data.cell.width - 4
              const lines = doc.splitTextToSize(val.comment, maxWidth)
              doc.text(lines, x, scoreY + 5, { align: 'center' })
            } else {
              doc.setTextColor(200, 200, 200)
              doc.text('—', x, scoreY + 5, { align: 'center' })
            }
          },
        })

        // Footer
        const pageHeight = doc.internal.pageSize.getHeight()
        doc.setFont('Roboto', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(180, 180, 180)
        doc.text('БЛЭСТ ЧЕМП 2026 — Судейский протокол', 148.5, pageHeight - 8, { align: 'center' })
      })
    })

    const timestamp = new Date().toISOString().split('T')[0]
    doc.save(`Судейские_листы_${timestamp}.pdf`)
  }


  const handleLogout = () => {
    if (confirm('Вы уверены что хотите выйти?')) {
      localStorage.removeItem('admin_auth')
      navigate('/admin-login')
    }
  }

  const [votingMode, setVotingMode] = useState('live')
  const [showQR, setShowQR] = useState(false)
  // Формируем правильный URL для голосования
  const basePath = import.meta.env.BASE_URL || '/'
  const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
  const voteUrl = `${window.location.origin}${cleanBasePath}/vote`

  const tabs = [
    { id: 'nominations', label: 'Номинации', icon: Trophy },
    { id: 'teams', label: 'Команды', icon: Users },
    { id: 'current', label: 'Текущая команда', icon: Eye },
    { id: 'results', label: 'Результаты', icon: BarChart3 }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="shadow-lg" style={{ backgroundColor: '#1d1d1d' }}>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link to="/" className="inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Назад
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
              <Settings className="w-10 h-10" style={{ color: '#FF6E00' }} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Панель администратора</h1>
              <p className="text-white/80 flex items-center gap-2">
                Управление чемпионатом
                <span className={`inline-block w-2 h-2 rounded-full ${connectionError ? 'bg-red-500' : 'bg-green-400'}`} title={connectionError ? 'Нет связи с сервером' : 'Подключено'}></span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {pageLoading ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent mx-auto mb-4" style={{ borderColor: '#FF6E00', borderTopColor: 'transparent' }}></div>
            <p className="text-gray-600 font-medium">Загрузка данных...</p>
          </div>
        ) : connectionError ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Нет связи с сервером</h2>
            <p className="text-gray-500 mb-6">Сервер не отвечает. Возможно, он запускается — подождите немного.</p>
            <button
              onClick={() => { setPageLoading(true); loadData() }}
              className="px-6 py-3 text-white rounded-lg font-semibold"
              style={{ backgroundColor: '#FF6E00' }}
            >
              Попробовать снова
            </button>
          </div>
        ) : (
        <>
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md mb-6">
          <div className="flex border-b">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition-colors"
                  style={{
                    color: isActive ? '#FF6E00' : '#666',
                    borderBottom: isActive ? '2px solid #FF6E00' : '2px solid transparent'
                  }}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-md p-6">
          {/* Nominations Tab */}
          {activeTab === 'nominations' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Управление номинациями</h2>

              <form onSubmit={handleCreateNomination} className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={newNominationName}
                  onChange={(e) => setNewNominationName(e.target.value)}
                  placeholder="Название номинации"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2"
                  style={{ focusRingColor: '#FF6E00' }}
                />
                <button
                  type="submit"
                  className="px-6 py-3 text-white rounded-lg font-semibold flex items-center gap-2 transition-all hover:opacity-90"
                  style={{ backgroundColor: '#FF6E00' }}
                >
                  <Plus className="w-5 h-5" />
                  Добавить
                </button>
              </form>

              <div className="space-y-3">
                {nominations.map((nom, idx) => (
                  <div
                    key={nom.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Trophy className="w-5 h-5" style={{ color: '#FF6E00' }} />
                      <span className="font-medium">{nom.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleReorderNomination(idx, -1)}
                        disabled={idx === 0}
                        className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30"
                      >
                        <ChevronUp className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleReorderNomination(idx, 1)}
                        disabled={idx === nominations.length - 1}
                        className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30"
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteNomination(nom.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
                {nominations.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Нет номинаций</p>
                )}
              </div>
            </div>
          )}

          {/* Teams Tab */}
          {activeTab === 'teams' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Управление командами</h2>

              <form onSubmit={handleCreateTeam} className="bg-orange-50 border-2 rounded-xl p-6 mb-6" style={{ borderColor: '#FF6E00' }}>
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Добавить новую команду</h3>
                <div className="flex gap-3">
                  <select
                    value={selectedNominationForTeam}
                    onChange={(e) => setSelectedNominationForTeam(e.target.value)}
                    className="w-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2"
                    style={{ focusRingColor: '#FF6E00' }}
                    required
                  >
                    <option value="">Выберите номинацию</option>
                    {nominations.map((nom) => (
                      <option key={nom.id} value={nom.id}>{nom.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Название команды"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2"
                    style={{ focusRingColor: '#FF6E00' }}
                    required
                  />
                  <input
                    type="number"
                    value={newTeamPenalty}
                    onChange={(e) => setNewTeamPenalty(e.target.value)}
                    placeholder="Штраф, напр. -0.5"
                    step="0.1"
                    className="w-40 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2"
                    style={{ focusRingColor: '#FF6E00' }}
                  />
                  <button
                    type="submit"
                    disabled={!selectedNominationForTeam || !newTeamName.trim()}
                    className="px-6 py-3 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
                    style={{ backgroundColor: '#FF6E00' }}
                  >
                    <Plus className="w-5 h-5" />
                    Добавить
                  </button>
                </div>
              </form>

              {/* Группировка команд по номинациям */}
              {nominations.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Сначала создайте номинации</p>
              ) : (
                <div className="space-y-6">
                  {nominations.map((nomination) => {
                    const nominationTeams = teams.filter(t => t.nomination_id === nomination.id)

                    return (
                      <div key={nomination.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 bg-gray-800">
                          <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Trophy className="w-6 h-6" />
                            {nomination.name}
                          </h3>
                          <p className="text-white/70 text-sm mt-1">
                            Команд: {nominationTeams.length}
                          </p>
                        </div>

                        <div className="p-6">
                          {nominationTeams.length === 0 ? (
                            <p className="text-center text-gray-400 py-6">Нет команд в этой номинации</p>
                          ) : (
                            <div className="space-y-2">
                              {nominationTeams.map((team, index) => (
                                  <div
                                    key={team.id}
                                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                  >
                                    <div className="flex-shrink-0 w-10 h-10 text-white rounded-full flex items-center justify-center font-bold text-lg bg-gray-700">
                                      {index + 1}
                                    </div>
                                    <div className="flex-1">
                                      <p className="font-semibold text-gray-800">
                                        {team.name}
                                        {team.penalty != null && team.penalty !== 0 && (
                                          <span className="ml-2 text-sm font-normal text-red-600">({team.penalty > 0 ? '+' : ''}{team.penalty})</span>
                                        )}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleEditName(team.id, team.name)}
                                        className="p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                                        title="Переименовать"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleEditPenalty(team.id, team.penalty)}
                                        className="p-2 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                                        title="Изменить штраф"
                                      >
                                        <ShieldAlert className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleMoveTeamUp(team.id, nomination.id)}
                                        disabled={index === 0}
                                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title="Переместить вверх"
                                      >
                                        <ChevronUp className="w-5 h-5" />
                                      </button>
                                      <button
                                        onClick={() => handleMoveTeamDown(team.id, nomination.id)}
                                        disabled={index === nominationTeams.length - 1}
                                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title="Переместить вниз"
                                      >
                                        <ChevronDown className="w-5 h-5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTeam(team.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Удалить команду"
                                      >
                                        <Trash2 className="w-5 h-5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Current Team Tab */}
          {activeTab === 'current' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Голосование зрителей</h2>

              {/* Voting mode switcher */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-3">Режим голосования:</p>
                <div className="flex gap-2">
                  {[
                    { mode: 'live', label: 'Live-оценки', desc: 'Оценка по ходу выступлений' },
                    { mode: 'top3', label: 'Топ-3 финал', desc: 'Выбор 3 лучших команд' },
                    { mode: 'closed', label: 'Закрыто', desc: 'Голосование отключено' },
                  ].map(({ mode, label, desc }) => (
                    <button
                      key={mode}
                      onClick={async () => {
                        if (mode === votingMode) return
                        if (!confirm(`Переключить режим голосования на "${label}"?`)) return
                        try {
                          await setCurrentTeam(currentTeam?.team_id || null, currentTeam?.nomination_id || null, mode)
                          setVotingMode(mode)
                          showToast(`Режим: ${label}`)
                        } catch (err) {
                          showToast('Ошибка переключения режима', 'error')
                        }
                      }}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 text-center transition-all ${
                        votingMode === mode
                          ? 'font-bold'
                          : 'bg-white border-gray-200 hover:border-gray-400'
                      }`}
                      style={votingMode === mode ? { backgroundColor: '#FFF3E6', borderColor: '#FF6E00', color: '#FF6E00' } : {}}
                    >
                      <div className="font-semibold">{label}</div>
                      <div className="text-xs text-gray-500 mt-1">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {votingMode === 'live' && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-blue-800">
                      Выберите команду, за которую сейчас могут голосовать зрители. Зрители голосуют по ссылке: <code className="bg-blue-100 px-2 py-1 rounded">/vote</code>
                    </p>
                  </div>

                  {currentTeam?.team_name && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                      <p className="text-sm text-green-800 mb-1">Сейчас голосуют за:</p>
                      <p className="font-bold text-lg text-green-900">{currentTeam.team_name}</p>
                      <p className="text-sm text-green-700">{currentTeam.nomination_name}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {nominations.map((nomination) => {
                      const nominationTeams = teams.filter(t => t.nomination_id === nomination.id)
                      if (nominationTeams.length === 0) return null

                      return (
                        <div key={nomination.id} className="border border-gray-200 rounded-lg p-4">
                          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <Trophy className="w-5 h-5" style={{ color: '#FF6E00' }} />
                            {nomination.name}
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {nominationTeams.map((team) => (
                              <button
                                key={team.id}
                                onClick={() => handleSetCurrentTeam(team.id, nomination.id)}
                                className={`px-4 py-3 text-left rounded-lg border-2 transition-all ${
                                  currentTeam?.team_id === team.id
                                    ? 'border-green-500 text-green-900 font-semibold'
                                    : 'bg-white border-gray-200 hover:border-orange-400 hover:bg-orange-50'
                                }`}
                                style={currentTeam?.team_id === team.id ? { backgroundColor: '#FFF3E6', borderColor: '#FF6E00' } : {}}
                              >
                                {team.name}
                                {currentTeam?.team_id === team.id && (
                                  <span className="ml-2" style={{ color: '#FF6E00' }}>●</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}

                    {nominations.length === 0 && (
                      <p className="text-center text-gray-500 py-8">Сначала добавьте номинации и команды</p>
                    )}
                  </div>
                </>
              )}

              {votingMode === 'top3' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-amber-800 font-semibold mb-1">Режим «Топ-3» активен</p>
                  <p className="text-sm text-amber-700">
                    Зрители видят все команды и выбирают 3 лучшие (1-е место = 3 очка, 2-е = 2, 3-е = 1).
                    Ссылка для голосования: <code className="bg-amber-100 px-2 py-1 rounded">/vote</code>
                  </p>
                </div>
              )}

              {votingMode === 'closed' && (
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
                  <p className="text-gray-700 font-semibold">Голосование закрыто</p>
                  <p className="text-sm text-gray-500">Зрители видят сообщение «Голосование закрыто».</p>
                </div>
              )}
            </div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Результаты чемпионата</h2>
                <div className="flex gap-3">
                  <button
                    onClick={loadResults}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2 transition-colors"
                    title="Обновить результаты"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Обновить
                  </button>
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 transition-colors"
                  >
                    <QrCode className="w-5 h-5" />
                    QR-код для зрителей
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={results.length === 0}
                    className="px-4 py-2 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold hover:opacity-90"
                    style={{ backgroundColor: '#FF6E00' }}
                  >
                    <Download className="w-5 h-5" />
                    Экспорт в Excel
                  </button>
                  <button
                    onClick={handleExportPDF}
                    disabled={results.length === 0 || allScores.length === 0}
                    className="px-4 py-2 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold hover:opacity-90"
                    style={{ backgroundColor: '#DC2626' }}
                  >
                    <Download className="w-5 h-5" />
                    Судейские листы PDF
                  </button>
                </div>
              </div>

              {/* QR Code Modal */}
              {showQR && (
                <div className="mb-6 bg-white border-2 border-blue-200 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">QR-код для голосования зрителей</h3>
                      <p className="text-sm text-gray-600">Покажите этот QR-код зрителям или поделитесь ссылкой</p>
                    </div>
                    <button
                      onClick={() => setShowQR(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                      <QRCodeCanvas value={voteUrl} size={200} level="H" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 mb-2">Ссылка для голосования:</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={voteUrl}
                          readOnly
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(voteUrl)
                            alert('Ссылка скопирована!')
                          }}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
                        >
                          Копировать
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-3">
                        💡 Зрители могут сканировать QR-код камерой телефона или перейти по ссылке
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {results.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Пока нет результатов</p>
              ) : (
                <div className="space-y-6">
                  {(() => {
                    const nominationNames = Object.keys(results.reduce((acc, r) => { acc[r.nomination_name] = true; return acc }, {}))
                    const allCollapsed = nominationNames.length > 0 && nominationNames.every(n => collapsedNominations.has(n))
                    return nominationNames.length > 1 && (
                      <button
                        onClick={() => {
                          if (allCollapsed) {
                            setCollapsedNominations(new Set())
                          } else {
                            setCollapsedNominations(new Set(nominationNames))
                          }
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {allCollapsed ? 'Развернуть все' : 'Свернуть все'}
                      </button>
                    )
                  })()}
                  {Object.entries(
                    results.reduce((acc, result) => {
                      if (!acc[result.nomination_name]) {
                        acc[result.nomination_name] = []
                      }
                      acc[result.nomination_name].push(result)
                      return acc
                    }, {})
                  ).map(([nominationName, nominationResults]) => {
                    // Сортируем по баллам судей
                    const sortedByJudges = [...nominationResults].sort((a, b) => b.judges_score - a.judges_score)
                    // Находим топ команду по зрительским голосам
                    const topBySpectators = [...nominationResults].sort((a, b) => b.spectators_avg - a.spectators_avg)[0]

                    return (
                      <div key={nominationName}>
                        <h3
                          className="text-xl font-bold mb-4 flex items-center gap-2 cursor-pointer select-none hover:opacity-70 transition-opacity"
                          onClick={() => setCollapsedNominations(prev => {
                            const next = new Set(prev)
                            next.has(nominationName) ? next.delete(nominationName) : next.add(nominationName)
                            return next
                          })}
                        >
                          <ChevronRight className={`w-5 h-5 transition-transform ${collapsedNominations.has(nominationName) ? '' : 'rotate-90'}`} />
                          <Trophy className="w-6 h-6" style={{ color: '#FF6E00' }} />
                          {nominationName}
                          <span className="text-sm font-normal text-gray-400 ml-2">{sortedByJudges.length} команд</span>
                        </h3>

                        {!collapsedNominations.has(nominationName) && (
                        <>
                        {/* Судейские результаты */}
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Оценки судей</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-3 text-left text-sm font-semibold">Место</th>
                                  <th className="px-4 py-3 text-left text-sm font-semibold">Команда</th>
                                  <th className="px-4 py-3 text-right text-sm font-semibold">Балл</th>
                                  {sortedByJudges.some(r => r.penalty !== 0) && (
                                    <th className="px-4 py-3 text-right text-sm font-semibold text-red-600">Штраф</th>
                                  )}
                                  <th className="px-4 py-3 text-right text-sm font-semibold">Судей</th>
                                  <th className="px-4 py-3 w-10"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedByJudges.map((result, index) => {
                                  const teamScores = allScores.filter(s => s.team_id === result.team_id && s.nomination_id === result.nomination_id)
                                  const isExpanded = expandedTeam === `${result.team_id}|${result.nomination_id}`
                                  const hasPenaltyColumn = sortedByJudges.some(r => r.penalty !== 0)

                                  return (
                                    <React.Fragment key={result.team_id}>
                                      <tr className="border-b cursor-pointer hover:bg-gray-50" onClick={() => setExpandedTeam(isExpanded ? null : `${result.team_id}|${result.nomination_id}`)}>
                                        <td className="px-4 py-3">
                                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                            index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                            index === 1 ? 'bg-gray-300 text-gray-900' :
                                            index === 2 ? 'bg-orange-400 text-orange-900' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                            {index + 1}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium">{result.team_name}</td>
                                        <td className="px-4 py-3 text-right">
                                          <span className="font-bold text-lg" style={{ color: '#FF6E00' }}>
                                            {formatScore(result.judges_score, sortedByJudges.map(r => r.judges_score))}
                                          </span>
                                        </td>
                                        {hasPenaltyColumn && (
                                          <td className="px-4 py-3 text-right text-red-600 font-medium">
                                            {result.penalty !== 0 ? result.penalty : ''}
                                          </td>
                                        )}
                                        <td className="px-4 py-3 text-right text-gray-600">
                                          {result.judges_count || 0}
                                        </td>
                                        <td className="px-4 py-3">
                                          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                        </td>
                                      </tr>
                                      {isExpanded && teamScores.length > 0 && (
                                        <tr>
                                          <td colSpan={hasPenaltyColumn ? 6 : 5} className="px-4 py-3 bg-gray-50">
                                            <table className="w-full text-sm">
                                              <thead>
                                                <tr className="text-gray-500">
                                                  <th className="px-3 py-2 text-left font-medium">Судья</th>
                                                  <th className="px-3 py-2 text-center font-medium">Хорео (45%)</th>
                                                  <th className="px-3 py-2 text-center font-medium">Техника (35%)</th>
                                                  <th className="px-3 py-2 text-center font-medium">Артистизм (15%)</th>
                                                  <th className="px-3 py-2 text-center font-medium">Общее (5%)</th>
                                                  <th className="px-3 py-2 text-center font-medium">Средневз.</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {[...teamScores].sort((a, b) => String(a.judge_id).localeCompare(String(b.judge_id))).map(score => {
                                                  const judgeName = judges.find(j => String(j.id) === String(score.judge_id))?.name || `Судья ${score.judge_id}`
                                                  return (
                                                    <tr key={score.judge_id} className="border-t border-gray-200">
                                                      <td className="px-3 py-2 font-medium text-gray-800">{judgeName}</td>
                                                      <td className="px-3 py-2 text-center">
                                                        {score.scores.choreography.score?.toFixed(1) || '—'}
                                                        {score.scores.choreography.comment && (
                                                          <p className="text-xs text-gray-400 mt-0.5">{score.scores.choreography.comment}</p>
                                                        )}
                                                      </td>
                                                      <td className="px-3 py-2 text-center">
                                                        {score.scores.technique.score?.toFixed(1) || '—'}
                                                        {score.scores.technique.comment && (
                                                          <p className="text-xs text-gray-400 mt-0.5">{score.scores.technique.comment}</p>
                                                        )}
                                                      </td>
                                                      <td className="px-3 py-2 text-center">
                                                        {score.scores.artistry.score?.toFixed(1) || '—'}
                                                        {score.scores.artistry.comment && (
                                                          <p className="text-xs text-gray-400 mt-0.5">{score.scores.artistry.comment}</p>
                                                        )}
                                                      </td>
                                                      <td className="px-3 py-2 text-center">
                                                        {score.scores.overall.score?.toFixed(1) || '—'}
                                                        {score.scores.overall.comment && (
                                                          <p className="text-xs text-gray-400 mt-0.5">{score.scores.overall.comment}</p>
                                                        )}
                                                      </td>
                                                      <td className="px-3 py-2 text-center font-bold" style={{ color: '#FF6E00' }}>
                                                        {score.average != null ? score.average.toFixed(2) : '—'}
                                                      </td>
                                                    </tr>
                                                  )
                                                })}
                                              </tbody>
                                            </table>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        </>
                        )}

                      </div>
                    )
                  })}

                  {/* Зрительские голоса (live) - общая таблица */}
                  {(() => {
                    const allSpectatorResults = results
                      .filter(r => r.spectator_votes > 0)
                      .sort((a, b) => b.spectators_avg - a.spectators_avg)
                      .slice(0, 5)

                    if (allSpectatorResults.length === 0) return null

                    return (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <h4 className="text-lg font-bold text-amber-800 mb-3">ТОП-5 по live-оценкам зрителей</h4>
                        <div className="space-y-2">
                          {allSpectatorResults.map((result, index) => (
                            <div key={result.team_id} className={`flex items-center justify-between p-3 rounded-lg ${
                              index === 0 ? 'bg-amber-100 border border-amber-300' : 'bg-white border border-amber-200'
                            }`}>
                              <div className="flex items-center gap-3">
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                  index === 0 ? 'bg-amber-500 text-white' :
                                  index === 1 ? 'bg-amber-400 text-white' :
                                  'bg-amber-300 text-amber-900'
                                }`}>
                                  {index + 1}
                                </span>
                                <div>
                                  <p className={`font-bold ${index === 0 ? 'text-amber-900' : 'text-gray-900'}`}>
                                    {result.team_name}
                                  </p>
                                  <p className="text-sm text-amber-700">
                                    {result.nomination_name} — {formatScore(result.spectators_avg)}
                                    <span className="text-amber-600"> ({result.spectator_votes} голосов)</span>
                                  </p>
                                </div>
                              </div>
                              {index === 0 && <Trophy className="w-8 h-8 text-amber-600" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Топ-3 зрительские симпатии */}
                  {(() => {
                    const top3Results = results
                      .filter(r => r.top3_points > 0)
                      .sort((a, b) => b.top3_points - a.top3_points)

                    if (top3Results.length === 0) return null

                    const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32']

                    return (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h4 className="text-lg font-bold text-purple-800 mb-3">Приз зрительских симпатий (Топ-3)</h4>
                        <div className="space-y-2">
                          {top3Results.map((result, index) => (
                            <div key={result.team_id} className={`flex items-center justify-between p-3 rounded-lg ${
                              index === 0 ? 'bg-purple-100 border border-purple-300' : 'bg-white border border-purple-200'
                            }`}>
                              <div className="flex items-center gap-3">
                                <span
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white"
                                  style={{ backgroundColor: index < 3 ? medalColors[index] : '#9CA3AF', color: index < 3 ? '#000' : '#fff' }}
                                >
                                  {index + 1}
                                </span>
                                <div>
                                  <p className={`font-bold ${index === 0 ? 'text-purple-900' : 'text-gray-900'}`}>
                                    {result.team_name}
                                  </p>
                                  <p className="text-sm text-purple-700">
                                    {result.nomination_name} — <span className="font-semibold">{result.top3_points} очков</span>
                                  </p>
                                </div>
                              </div>
                              {index === 0 && <Trophy className="w-8 h-8 text-purple-600" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}
