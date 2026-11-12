'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type PersonalLabel, type PersonalExpense, type PersonalGoal } from '@/lib/supabase'
import { formatMoney, splitTotals, savingLabelIds, goalProgress, isSaving } from '@/lib/goals'
import GoalProgressList from '@/components/GoalProgressList'
import { THEME_DEFAULTS, PERSONAL_THEME_KEY, readCachedTheme, claimThemeCache, syncPersonalTheme } from '@/lib/themeStore'
import { format, subMonths, addMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, Tag, TrendingUp, TrendingDown, PieChart, PiggyBank } from 'lucide-react'
import { getContrastColors } from '@/lib/theme'
import { ThemeCard, Panel, lightInput, TopBar, NavPill, PageTitle, Stat, SectionHeader, themePageStyle } from '@/components/LightUI'


type LabelSummary = {
  label: PersonalLabel | null
  total: number
  count: number
}

export default function PersonalReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    // Nếu hôm nay < ngày 10, chu kỳ hiện tại thuộc tháng trước
    if (now.getDate() < 10) {
      return new Date(now.getFullYear(), now.getMonth() - 1, 1)
    }
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [expenses, setExpenses] = useState<PersonalExpense[]>([])
  const [labels, setLabels] = useState<PersonalLabel[]>([])
  const [goals, setGoals] = useState<PersonalGoal[]>([])
  const [personalName, setPersonalName] = useState('Sổ cá nhân')
  const [themeColor, setThemeColor] = useState('#059669')
  const [avatar, setAvatar] = useState('')
  const [displayName, setDisplayName] = useState('User')

  useEffect(() => {
    const savedColor = readCachedTheme(PERSONAL_THEME_KEY)
    if (savedColor) setThemeColor(savedColor)
    const savedName = localStorage.getItem('spendly_personal_name')
    if (savedName) setPersonalName(savedName)
  }, [])

  const getRange = useCallback(() => {
    if (isCustom && customFrom && customTo) return { from: customFrom, to: customTo }
    // Chu kỳ: ngày 10 tháng currentMonth → ngày 9 tháng sau
    const y = currentMonth.getFullYear()
    const m = currentMonth.getMonth()
    const from = new Date(y, m, 10)
    const to = new Date(y, m + 1, 9)
    return {
      from: format(from, 'yyyy-MM-dd'),
      to: format(to, 'yyyy-MM-dd'),
    }
  }, [isCustom, customFrom, customTo, currentMonth])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { router.push('/'); return }
    if (!claimThemeCache(user.id)) setThemeColor(THEME_DEFAULTS.personal)

    const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url, personal_theme').eq('id', user.id).single()
    if (profile) {
      setDisplayName(profile.display_name || user.email?.split('@')[0] || 'User')
      setAvatar(profile.avatar_url || '')
    }
    syncPersonalTheme(user.id, profile?.personal_theme, setThemeColor)

    const { from, to } = getRange()
    const [{ data }, { data: labelData }, { data: goalData }] = await Promise.all([
      supabase
        .from('personal_expenses')
        .select('*, label:personal_labels(*)')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false }),
      supabase.from('personal_labels').select('*'),
      supabase.from('personal_goals').select('*'),
    ])
    const list = (data as PersonalExpense[]) ?? []
    setExpenses(list)
    setLabels((labelData as PersonalLabel[]) ?? [])
    setGoals((goalData as PersonalGoal[]) ?? [])
    setLoading(false)
  }, [getRange, router])

  useEffect(() => { fetchData() }, [fetchData])

  const { from, to } = getRange()

  // Thu vào / Chi tiêu / Tích luỹ (tích luỹ = khoản của nhãn có mục tiêu tích luỹ)
  const savingIds = savingLabelIds(goals)
  const totals = splitTotals(expenses, savingIds)
  const totalIncome = totals.income
  const totalExpense = totals.spending
  const netTotal = totals.net
  const hasSaving = savingIds.size > 0 || totals.saving > 0

  // Cơ cấu chi tiêu: chỉ các khoản chi tiêu (không gồm tích luỹ), theo nhãn
  const summaryMap = new Map<string, LabelSummary>()
  for (const exp of expenses) {
    if (exp.type === 'income' || isSaving(exp, savingIds)) continue
    const key = exp.label_id ?? '__none__'
    if (!summaryMap.has(key)) summaryMap.set(key, { label: exp.label ?? null, total: 0, count: 0 })
    const sm = summaryMap.get(key)!
    sm.total += exp.amount
    sm.count++
  }
  const labelSummaries = Array.from(summaryMap.values()).sort((a, b) => b.total - a.total)
  const limitByLabel = new Map(goals.filter(g => g.kind === 'limit').map(g => [g.label_id, g.amount]))

  // Mục tiêu so với thực tế trong kỳ đang xem (chỉ ở chế độ theo tháng, vì mục tiêu đặt theo tháng)
  const goalItems = goalProgress(goals, labels, expenses, { from, to })

  function prevMonth() { setCurrentMonth(m => subMonths(m, 1)) }
  function nextMonth() { setCurrentMonth(m => addMonths(m, 1)) }

  const rangeLabel = `${format(new Date(from), 'dd/MM/yyyy')} – ${format(new Date(to), 'dd/MM/yyyy')}`

  return (
    <div className="min-h-screen text-slate-900" style={themePageStyle(themeColor)}>

      <div className="relative z-10 mx-auto max-w-3xl px-5 pb-24 sm:px-8">
        <TopBar backHref="/personal">
          <NavPill href="/personal/labels" label="Nhãn"><Tag size={16} /></NavPill>
        </TopBar>

        <PageTitle
          eyebrow="Báo cáo"
          dotColor={themeColor}
          title={personalName}
          subtitle={rangeLabel}
        />

        {/* ── Chọn kỳ ── */}
        <Panel theme={themeColor} className="p-5 sm:p-6">
          <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1">
            {([false, true] as const).map(custom => (
              <button key={String(custom)} onClick={() => setIsCustom(custom)}
                className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                  isCustom === custom ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
                }`}>
                {custom ? 'Tuỳ chỉnh' : 'Theo tháng'}
              </button>
            ))}
          </div>

          {!isCustom ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <button onClick={prevMonth} aria-label="Tháng trước"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100">
                <ChevronLeft size={18} />
              </button>
              <div className="min-w-0 text-center">
                <p className="text-lg font-bold">Tháng {format(currentMonth, 'MM/yyyy')}</p>
                <p className="text-xs text-slate-500">
                  {format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 10), 'dd/MM')} – {format(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 9), 'dd/MM/yyyy')}
                </p>
              </div>
              <button onClick={nextMonth} aria-label="Tháng sau"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100">
                <ChevronRight size={18} />
              </button>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="min-w-0">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Từ ngày</span>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className={`${lightInput} !py-2.5 !text-sm`} />
              </label>
              <label className="min-w-0">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Đến ngày</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className={`${lightInput} !py-2.5 !text-sm`} />
              </label>
            </div>
          )}
        </Panel>

        {/* ── Tổng kết ── */}
        <ThemeCard theme={themeColor} className="mt-6">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--on-theme-muted)]">Số dư</p>
            {loading ? (
              <div className="mt-3 h-12 w-56 animate-pulse rounded-xl bg-[var(--on-theme-soft)]" />
            ) : (
              <p className={`mt-2 truncate text-4xl font-extrabold tabular-nums tracking-[-0.03em] sm:text-5xl`}>
                {netTotal >= 0 ? '+' : ''}{formatMoney(netTotal)}
              </p>
            )}
            {/* Số dư = Tổng thu − Chi tiêu − Tích luỹ */}
            <div className={`mt-6 grid grid-cols-2 gap-3 ${hasSaving ? 'sm:grid-cols-3' : ''}`}>
              <Stat label="Tổng thu" value={`+${formatMoney(totalIncome)}`} tone="text-emerald-600" loading={loading}>
                <TrendingUp size={15} />
              </Stat>
              <Stat label="Chi tiêu" value={`-${formatMoney(totalExpense)}`} tone="text-rose-600" loading={loading}>
                <TrendingDown size={15} />
              </Stat>
              {hasSaving && (
                <div className="col-span-2 sm:col-span-1">
                  <Stat label="Tích luỹ" value={`-${formatMoney(totals.saving)}`} tone="text-sky-600" loading={loading}>
                    <PiggyBank size={15} />
                  </Stat>
                </div>
              )}
            </div>
            {hasSaving && !loading && totalIncome > 0 && (
              <p className="mt-3 text-xs text-[var(--on-theme-muted)]">
                Tỉ lệ tích luỹ: <b className="font-bold">{Math.round((totals.saving / totalIncome) * 100)}%</b> thu nhập
              </p>
            )}
          </div>
        </ThemeCard>

        {/* ── Mục tiêu so với thực tế (theo tháng) ── */}
        {!isCustom && (
          <GoalProgressList
            theme={themeColor}
            className="mt-6"
            title="Mục tiêu"
            periodLabel={`Tháng ${format(currentMonth, 'MM/yyyy')}`}
            items={goalItems}
            income={totalIncome}
            loading={loading}
          />
        )}

        {!loading && expenses.length === 0 ? (
          <Panel theme={themeColor} className="mt-6 flex flex-col items-center px-6 py-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-slate-200 text-slate-500">
              <PieChart size={24} />
            </span>
            <p className="mt-4 font-semibold">Không có dữ liệu trong kỳ này</p>
            <p className="mt-1 text-sm text-slate-500">Chọn kỳ khác hoặc thêm giao dịch ở Sổ cá nhân.</p>
          </Panel>
        ) : (
          <>
            {/* ── Cơ cấu chi tiêu ── */}
            {(loading || labelSummaries.length > 0) && (
              <Panel theme={themeColor} className="mt-6 overflow-hidden">
                <SectionHeader title="Cơ cấu chi tiêu" right={!loading ? formatMoney(totalExpense) : undefined} />
                <div className="space-y-5 p-5 sm:p-6">
                  {loading
                    ? [0, 1, 2].map(i => (
                        <div key={i} className="space-y-2">
                          <div className="h-3.5 w-1/3 animate-pulse rounded bg-slate-100" />
                          <div className="h-2 w-full animate-pulse rounded-full bg-slate-50" />
                        </div>
                      ))
                    : labelSummaries.map((s, i) => {
                        const pct = totalExpense > 0 ? (s.total / totalExpense) * 100 : 0
                        const color = s.label?.color ?? '#9ca3af'
                        const name = s.label?.name ?? 'Không có nhãn'
                        return (
                          <div key={i}>
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                <span className="truncate text-sm font-semibold">{name}</span>
                                <span className="shrink-0 text-xs text-slate-400">{s.count} khoản</span>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="text-sm font-bold tabular-nums">{formatMoney(s.total)}</span>
                                <span className="ml-2 text-xs tabular-nums text-slate-500">{pct.toFixed(0)}%</span>
                                {/* Nhãn có giới hạn chi (chế độ theo tháng): so với giới hạn */}
                                {!isCustom && s.label && limitByLabel.has(s.label.id) && (() => {
                                  const limit = limitByLabel.get(s.label!.id)!
                                  return (
                                    <span className={`block text-[11px] tabular-nums ${s.total > limit ? 'text-rose-600' : 'text-slate-500'}`}>
                                      giới hạn {formatMoney(limit)}
                                    </span>
                                  )
                                })()}
                              </div>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100">
                              <div className="h-2 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                          </div>
                        )
                      })}
                </div>
              </Panel>
            )}

            {/* ── Chi tiết ── */}
            <Panel theme={themeColor} className="mt-6 overflow-hidden">
              <SectionHeader title="Chi tiết" right={!loading ? `${expenses.length} khoản` : undefined} />
              {loading ? (
                <div className="divide-y divide-slate-100">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="flex items-center gap-3 px-5 py-4">
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-2/5 animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-1/4 animate-pulse rounded bg-slate-50" />
                      </div>
                      <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {expenses.map(exp => {
                    const income = exp.type === 'income'
                    const saving = isSaving(exp, savingIds)
                    return (
                      <li key={exp.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-semibold [overflow-wrap:anywhere]">{exp.description}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{format(new Date(exp.date), 'dd/MM')}</span>
                            {exp.label && (
                              <span className="max-w-[10rem] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                style={{ backgroundColor: exp.label.color, color: getContrastColors(exp.label.color).text }}>
                                {exp.label.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <span title={saving ? 'Tích luỹ' : undefined}
                          className={`shrink-0 text-sm font-bold tabular-nums ${income ? 'text-emerald-600' : saving ? 'text-sky-600' : ''}`}>
                          {income ? '+' : '-'}{formatMoney(exp.amount)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}

