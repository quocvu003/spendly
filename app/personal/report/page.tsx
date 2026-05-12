'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, type PersonalLabel, type PersonalExpense } from '@/lib/supabase'
import { format, subMonths, addMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { getContrastColors } from '@/lib/theme'

function formatMoney(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'
}

type LabelSummary = {
  label: PersonalLabel | null
  total: number
  count: number
}

export default function PersonalReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [expenses, setExpenses] = useState<PersonalExpense[]>([])
  const [labelSummaries, setLabelSummaries] = useState<LabelSummary[]>([])
  const [themeColor, setThemeColor] = useState('#059669')

  useEffect(() => {
    const saved = localStorage.getItem('spendly_personal_theme')
    if (saved) setThemeColor(saved)
  }, [])

  const getRange = useCallback(() => {
    if (isCustom && customFrom && customTo) return { from: customFrom, to: customTo }
    return {
      from: format(startOfMonth(currentMonth), 'yyyy-MM-dd'),
      to: format(endOfMonth(currentMonth), 'yyyy-MM-dd'),
    }
  }, [isCustom, customFrom, customTo, currentMonth])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { from, to } = getRange()
    const { data } = await supabase
      .from('personal_expenses')
      .select('*, label:personal_labels(*)')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
    const list = (data as PersonalExpense[]) ?? []
    setExpenses(list)

    // Build label summaries (expenses only)
    const map = new Map<string, LabelSummary>()
    list.filter(e => e.type !== 'income').forEach(exp => {
      const key = exp.label_id ?? '__none__'
      if (!map.has(key)) map.set(key, { label: exp.label ?? null, total: 0, count: 0 })
      const s = map.get(key)!
      s.total += exp.amount
      s.count++
    })
    setLabelSummaries(Array.from(map.values()).sort((a, b) => b.total - a.total))
    setLoading(false)
  }, [getRange, router])

  useEffect(() => { fetchData() }, [fetchData])

  const totalExpense = expenses.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0)
  const totalIncome = expenses.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const netTotal = totalIncome - totalExpense
  const { from, to } = getRange()
  const cc = getContrastColors(themeColor)

  function prevMonth() { setCurrentMonth(m => subMonths(m, 1)) }
  function nextMonth() { setCurrentMonth(m => addMonths(m, 1)) }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="px-4 pt-6 pb-4" style={{ backgroundColor: themeColor }}>
        <div className="flex items-center gap-3 mb-4">
          <Link href="/personal" style={{ color: cc.muted }}>
            <ArrowLeft size={22} />
          </Link>
          <h1 className="font-bold text-lg flex-1" style={{ color: cc.text }}>Báo cáo chi tiêu</h1>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-xl p-1 mb-3" style={{ backgroundColor: cc.iconBg }}>
          <button onClick={() => setIsCustom(false)}
            className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={!isCustom ? { backgroundColor: '#fff', color: themeColor } : { color: cc.text }}>
            Theo tháng
          </button>
          <button onClick={() => setIsCustom(true)}
            className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={isCustom ? { backgroundColor: '#fff', color: themeColor } : { color: cc.text }}>
            Tùy chỉnh
          </button>
        </div>

        {!isCustom ? (
          <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: cc.iconBg }}>
            <button onClick={prevMonth} style={{ color: cc.text }} className="p-1"><ChevronLeft size={20} /></button>
            <span className="font-semibold text-sm" style={{ color: cc.text }}>
              Tháng {format(currentMonth, 'MM/yyyy')}
            </span>
            <button onClick={nextMonth} style={{ color: cc.text }} className="p-1"><ChevronRight size={20} /></button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[10px] font-medium mb-0.5" style={{ color: cc.muted }}>Từ ngày</p>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-lg outline-none [color-scheme:dark]"
                style={{ backgroundColor: cc.iconBg, color: cc.text }} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-medium mb-0.5" style={{ color: cc.muted }}>Đến ngày</p>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-lg outline-none [color-scheme:dark]"
                style={{ backgroundColor: cc.iconBg, color: cc.text }} />
            </div>
          </div>
        )}
      </div>

      {loading ? <LoadingSpinner message="Đang tải báo cáo..." /> : (
        <div className="px-4 py-5 space-y-5">
          {/* Summary card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs text-gray-400 mb-4 text-center">
              {format(new Date(from), 'dd/MM/yyyy')} → {format(new Date(to), 'dd/MM/yyyy')}
            </p>
            <div className="grid grid-cols-2 gap-4 text-center mb-4">
              <div>
                <p className="text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wider">Tổng thu</p>
                <p className="text-xl font-black text-emerald-600">+{formatMoney(totalIncome)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wider">Tổng chi</p>
                <p className="text-xl font-black text-red-500">-{formatMoney(totalExpense)}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Số dư</p>
              <p className={`text-2xl font-black ${netTotal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {netTotal >= 0 ? '+' : ''}{formatMoney(netTotal)}
              </p>
            </div>
          </div>

          {/* Label breakdown */}
          {labelSummaries.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Cơ cấu chi tiêu</h2>
              <div className="space-y-3">
                {labelSummaries.map((s, i) => {
                  const pct = totalExpense > 0 ? (s.total / totalExpense) * 100 : 0
                  const color = s.label?.color ?? '#9ca3af'
                  const name = s.label?.name ?? 'Không có label'
                  return (
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                          <span className="text-sm text-gray-700">{name}</span>
                          <span className="text-xs text-gray-400">({s.count})</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{formatMoney(s.total)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top expenses */}
          {expenses.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-gray-400 mb-3 px-1 uppercase tracking-widest">Chi tiết</h2>
              <div className="space-y-2">
                {expenses.map(exp => (
                  <div key={exp.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 shadow-sm">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {exp.label && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
                            style={{ backgroundColor: exp.label.color }}>
                            {exp.label.name}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">{format(new Date(exp.date), 'dd/MM')}</span>
                      </div>
                      <p className="text-sm text-gray-800">{exp.description}</p>
                    </div>
                    <span className={`font-bold text-sm ${exp.type === 'income' ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {exp.type === 'income' ? '+' : '-'}{formatMoney(exp.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expenses.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-sm">Không có dữ liệu trong kỳ này</p>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
