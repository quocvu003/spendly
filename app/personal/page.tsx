'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type PersonalLabel, type PersonalExpense, type PersonalGoal } from '@/lib/supabase'
import { currentPeriod, formatMoney, splitTotals, savingLabelIds, goalProgress, isSaving } from '@/lib/goals'
import GoalProgressList from '@/components/GoalProgressList'
import PersonalTransactionModal from '@/components/PersonalTransactionModal'
import { THEME_DEFAULTS, PERSONAL_THEME_KEY, readCachedTheme, claimThemeCache, syncPersonalTheme, savePersonalTheme } from '@/lib/themeStore'
import { format } from 'date-fns'
import {
  Plus, Tag, BarChart2, ArrowUp, ArrowDown, Trash2, Pencil, Settings,
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Receipt, PiggyBank,
} from 'lucide-react'
import { getContrastColors } from '@/lib/theme'
import ProfileSettingsModal from '@/components/ProfileSettingsModal'
import NightFlowerField from '@/components/NightFlowerField'
import { GlowCard, DarkPanel, DarkModal, darkInput, NightTopBar, NavPill, PageTitle, Stat } from '@/components/NightUI'

// Kỳ hiện tại: từ ngày 10 tháng này đến ngày 9 tháng sau
const getMonthRange = () => currentPeriod()

export default function PersonalPage() {
  const router = useRouter()
  const [expenses, setExpenses] = useState<PersonalExpense[]>([])
  const [labels, setLabels] = useState<PersonalLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')

  const defaultRange = getMonthRange()
  const [filterLabel, setFilterLabel] = useState('all')
  const [filterFrom, setFilterFrom] = useState(defaultRange.from)
  const [filterTo, setFilterTo] = useState(defaultRange.to)
  const [sortField, setSortField] = useState<'date' | 'amount'>('date')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10

  // Popup thêm/sửa giao dịch: exp = null là thêm mới (nhiều dòng)
  const [txModal, setTxModal] = useState<{ exp: PersonalExpense | null } | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [themeColor, setThemeColor] = useState('#059669')
  const [personalName, setPersonalName] = useState('Sổ cá nhân')
  const [showSettings, setShowSettings] = useState(false)
  const [avatar, setAvatar] = useState('')
  const [displayName, setDisplayName] = useState('User')

  // Mục tiêu: luôn tính trên toàn bộ kỳ hiện tại, không phụ thuộc bộ lọc nhãn/ngày của danh sách
  const [goals, setGoals] = useState<PersonalGoal[]>([])
  const [periodExpenses, setPeriodExpenses] = useState<PersonalExpense[]>([])

  function handleThemeChange(color: string) {
    setThemeColor(color)
    if (userId) savePersonalTheme(userId, color)
  }

  const fetchExpenses = useCallback(async (
    labelId: string, from: string, to: string,
    field: 'date' | 'amount', order: 'desc' | 'asc'
  ) => {
    let q = supabase
      .from('personal_expenses')
      .select('*, label:personal_labels(*)')
      .gte('date', from)
      .lte('date', to)
      .order(field, { ascending: order === 'asc' })
    if (labelId !== 'all') q = (q as any).eq('label_id', labelId)
    const { data } = await q
    setExpenses((data as PersonalExpense[]) ?? [])
  }, [])

  const fetchPeriod = useCallback(async () => {
    const p = currentPeriod()
    const { data } = await supabase
      .from('personal_expenses')
      .select('*, label:personal_labels(*)')
      .gte('date', p.from)
      .lte('date', p.to)
    setPeriodExpenses((data as PersonalExpense[]) ?? [])
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      // Tô màu ngay từ bản sao; màu trên Supabase sẽ ghi đè khi tải xong
      const savedTheme = claimThemeCache(user.id) ? readCachedTheme(PERSONAL_THEME_KEY) : null
      setThemeColor(savedTheme ?? THEME_DEFAULTS.personal)
      const savedName = localStorage.getItem('spendly_personal_name')
      if (savedName) setPersonalName(savedName)

      const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url, personal_theme').eq('id', user.id).single()
      if (profile) {
        setDisplayName(profile.display_name || user.email?.split('@')[0] || 'User')
        setAvatar(profile.avatar_url || '')
      }
      syncPersonalTheme(user.id, profile?.personal_theme, setThemeColor)

      const [{ data }, { data: goalData }] = await Promise.all([
        supabase.from('personal_labels').select('*').order('created_at'),
        // Chưa chạy migration mục tiêu thì truy vấn lỗi → coi như chưa có mục tiêu
        supabase.from('personal_goals').select('*'),
      ])
      setLabels((data as PersonalLabel[]) ?? [])
      setGoals((goalData as PersonalGoal[]) ?? [])
      await Promise.all([
        fetchExpenses('all', defaultRange.from, defaultRange.to, 'date', 'desc'),
        fetchPeriod(),
      ])
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line

  function handleSort(field: 'date' | 'amount') {
    const newOrder = sortField === field ? (sortOrder === 'desc' ? 'asc' : 'desc') : 'desc'
    setSortField(field); setSortOrder(newOrder)
    setCurrentPage(1)
    fetchExpenses(filterLabel, filterFrom, filterTo, field, newOrder)
  }

  function handleFilterLabel(id: string) {
    setFilterLabel(id)
    setCurrentPage(1)
    fetchExpenses(id, filterFrom, filterTo, sortField, sortOrder)
  }

  function handleDateChange(from: string, to: string) {
    setFilterFrom(from); setFilterTo(to)
    setCurrentPage(1)
    fetchExpenses(filterLabel, from, to, sortField, sortOrder)
  }

  function openAdd() { setTxModal({ exp: null }) }
  function openEdit(exp: PersonalExpense) { setTxModal({ exp }) }

  function handleTxSaved() {
    setTxModal(null)
    fetchExpenses(filterLabel, filterFrom, filterTo, sortField, sortOrder)
    fetchPeriod()
  }

  async function handleDelete() {
    if (!deleteId) return
    await supabase.from('personal_expenses').delete().eq('id', deleteId)
    setDeleteId(null)
    fetchExpenses(filterLabel, filterFrom, filterTo, sortField, sortOrder)
    fetchPeriod()
  }

  // Tích luỹ = khoản của nhãn có mục tiêu tích luỹ (tiền chuyển sang thẻ tiết kiệm/đầu tư)
  const savingIds = savingLabelIds(goals)
  const totals = splitTotals(expenses, savingIds)
  const totalIncome = totals.income
  const netTotal = totals.net
  const hasSaving = savingIds.size > 0 || totals.saving > 0

  // Tiến độ mục tiêu trong kỳ hiện tại
  const period = currentPeriod()
  const goalItems = goalProgress(goals, labels, periodExpenses, period)
  const periodTotals = splitTotals(periodExpenses, savingIds)


  const cc = getContrastColors(themeColor)

  const totalPages = Math.max(1, Math.ceil(expenses.length / PAGE_SIZE))
  const pagedExpenses = expenses.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const periodLabel = `${format(new Date(filterFrom), 'dd/MM')} – ${format(new Date(filterTo), 'dd/MM/yyyy')}`

  return (
    // overflow-x-clip: quầng sáng của card tràn ra ngoài, không để nó tạo thanh cuộn ngang
    <div className="min-h-screen bg-[#04050b] text-[#f5efe2] overflow-x-clip">
      {/* Nền thung lũng hoa đêm, chế độ êm cho trang làm việc */}
      <NightFlowerField calm />

      <div className="relative z-10 mx-auto max-w-3xl px-5 pb-32 sm:px-8">
        <NightTopBar backHref="/rooms?mode=list">
          <NavPill href="/personal/labels" label="Nhãn"><Tag size={16} /></NavPill>
          <NavPill href="/personal/report" label="Báo cáo"><BarChart2 size={16} /></NavPill>
          <button onClick={() => setShowSettings(true)} aria-label="Cài đặt"
            className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-white/15 text-[#f5efe2]/80 transition-colors hover:bg-white/10">
            {avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={avatar} alt="" className="h-full w-full object-cover" />
              : <Settings size={17} />}
          </button>
        </NightTopBar>

        <PageTitle
          eyebrow="Cá nhân"
          dotColor={themeColor}
          title={personalName}
          subtitle={<>Kỳ {periodLabel} · {loading ? '…' : `${expenses.length} giao dịch`}</>}
        />

        {/* ── Tổng kết kỳ ── */}
        <GlowCard theme={themeColor} lift={false}>
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f5efe2]/50">Còn lại trong kỳ</p>
            {loading ? (
              <div className="mt-3 h-12 w-56 animate-pulse rounded-xl bg-white/10" />
            ) : (
              <p className={`mt-2 truncate text-4xl font-extrabold tabular-nums tracking-[-0.03em] sm:text-5xl ${netTotal < 0 ? 'text-rose-300' : ''}`}>
                {netTotal >= 0 ? '+' : ''}{formatMoney(netTotal)}
              </p>
            )}
            {/* Còn lại = Thu vào − Chi tiêu − Tích luỹ */}
            <div className={`mt-6 grid grid-cols-2 gap-3 ${hasSaving ? 'sm:grid-cols-3' : ''}`}>
              <Stat label="Thu vào" value={`+${formatMoney(totalIncome)}`} tone="text-emerald-300" loading={loading}>
                <TrendingUp size={15} />
              </Stat>
              <Stat label="Chi tiêu" value={`-${formatMoney(totals.spending)}`} tone="text-rose-300" loading={loading}>
                <TrendingDown size={15} />
              </Stat>
              {hasSaving && (
                <div className="col-span-2 sm:col-span-1">
                  <Stat label="Tích luỹ" value={`-${formatMoney(totals.saving)}`} tone="text-sky-300" loading={loading}>
                    <PiggyBank size={15} />
                  </Stat>
                </div>
              )}
            </div>
            {hasSaving && !loading && totalIncome > 0 && (
              <p className="mt-3 text-xs text-[#f5efe2]/50">
                Tỉ lệ tích luỹ: <b className="font-semibold text-sky-300">{Math.round((totals.saving / totalIncome) * 100)}%</b> thu nhập
              </p>
            )}
          </div>
        </GlowCard>

        {/* ── Mục tiêu kỳ này (luôn tính trên cả kỳ hiện tại) ── */}
        <GoalProgressList
          className="mt-6"
          title="Mục tiêu kỳ này"
          periodLabel={`${format(new Date(period.from), 'dd/MM')} – ${format(new Date(period.to), 'dd/MM')}`}
          items={goalItems}
          income={periodTotals.income}
          loading={loading}
        />

        {/* ── Bộ lọc ── */}
        <DarkPanel className="mt-6 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-[#f5efe2]/50">Từ ngày</span>
              <input type="date" value={filterFrom} onChange={e => handleDateChange(e.target.value, filterTo)}
                className={`${darkInput} !py-2.5 !text-sm`} />
            </label>
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-[#f5efe2]/50">Đến ngày</span>
              <input type="date" value={filterTo} onChange={e => handleDateChange(filterFrom, e.target.value)}
                className={`${darkInput} !py-2.5 !text-sm`} />
            </label>
          </div>

          {/* Nhãn: cuộn ngang trên điện thoại */}
          <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6">
            <Chip active={filterLabel === 'all'} onClick={() => handleFilterLabel('all')} activeBg={themeColor} activeText={cc.text}>
              Tất cả
            </Chip>
            {labels.map(l => (
              <Chip key={l.id} active={filterLabel === l.id} onClick={() => handleFilterLabel(l.id)} activeBg={l.color} activeText="#fff" dot={l.color}>
                {l.name}
              </Chip>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f5efe2]/50">Sắp xếp</span>
            <div className="flex rounded-full border border-white/10 bg-white/5 p-1">
              {(['date', 'amount'] as const).map(f => (
                <button key={f} onClick={() => handleSort(f)}
                  className={`flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    sortField === f ? 'bg-[#f5efe2] text-[#151510]' : 'text-[#f5efe2]/60 hover:text-[#f5efe2]'
                  }`}>
                  {f === 'date' ? 'Ngày' : 'Số tiền'}
                  {sortField === f && (sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                </button>
              ))}
            </div>
          </div>
        </DarkPanel>

        {/* ── Danh sách giao dịch (tiêu đề nằm trong khung để luôn đọc được trên nền hoa) ── */}
        <DarkPanel className="mt-6 overflow-hidden">
          <div className="flex items-end justify-between border-b border-white/10 px-5 pb-4 pt-5 sm:px-6">
            <h2 className="text-xl font-extrabold tracking-[-0.03em] sm:text-2xl">Giao dịch</h2>
            {!loading && expenses.length > 0 && (
              <span className="text-sm text-[#f5efe2]/50">{expenses.length} khoản</span>
            )}
          </div>
          {loading ? (
            <div className="divide-y divide-white/5">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 px-5 py-4">
                  <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/5 animate-pulse rounded bg-white/10" />
                    <div className="h-3 w-1/4 animate-pulse rounded bg-white/5" />
                  </div>
                  <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
                </div>
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/15 text-[#f5efe2]/60">
                <Receipt size={24} />
              </span>
              <p className="mt-4 font-semibold">Chưa có giao dịch nào trong kỳ này</p>
              <p className="mt-1 text-sm text-[#f5efe2]/50">Ghi lại khoản thu chi đầu tiên để theo dõi.</p>
              <button onClick={openAdd}
                className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold"
                style={{ backgroundColor: themeColor, color: cc.text }}>
                Thêm giao dịch
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {pagedExpenses.map(exp => {
                const income = exp.type === 'income'
                const saving = isSaving(exp, savingIds)
                return (
                  <li key={exp.id} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03]">
                    <span title={income ? 'Khoản thu' : saving ? 'Tích luỹ' : 'Chi tiêu'}
                      className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                      income ? 'bg-emerald-400/15 text-emerald-300' : saving ? 'bg-sky-400/15 text-sky-300' : 'bg-rose-400/15 text-rose-300'
                    }`}>
                      {income ? <TrendingUp size={15} /> : saving ? <PiggyBank size={15} /> : <TrendingDown size={15} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-semibold [overflow-wrap:anywhere]">{exp.description}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#f5efe2]/50">
                        <span>{format(new Date(exp.date), 'dd/MM/yyyy')}</span>
                        {exp.label && (
                          <span className="max-w-[10rem] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                            style={{ backgroundColor: exp.label.color }}>
                            {exp.label.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`font-bold tabular-nums ${income ? 'text-emerald-300' : saving ? 'text-sky-300' : ''}`}>
                        {income ? '+' : '-'}{formatMoney(exp.amount)}
                      </span>
                      <div className="flex gap-0.5">
                        <button onClick={() => openEdit(exp)} aria-label="Sửa"
                          className="rounded-lg p-1.5 text-[#f5efe2]/35 transition-colors hover:bg-white/10 hover:text-[#f5efe2]">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteId(exp.id)} aria-label="Xoá"
                          className="rounded-lg p-1.5 text-[#f5efe2]/35 transition-colors hover:bg-rose-400/15 hover:text-rose-300">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </DarkPanel>

        {/* ── Phân trang ── */}
        {!loading && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-1.5">
            <PageButton onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} label="Trang trước">
              <ChevronLeft size={15} />
            </PageButton>
            {(() => {
              const pages: (number | '...')[] = []
              if (totalPages <= 7) {
                for (let p = 1; p <= totalPages; p++) pages.push(p)
              } else {
                pages.push(1)
                if (currentPage > 3) pages.push('...')
                for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) pages.push(p)
                if (currentPage < totalPages - 2) pages.push('...')
                pages.push(totalPages)
              }
              return pages.map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="grid h-9 w-9 place-items-center text-sm text-[#f5efe2]/40">…</span>
                ) : (
                  <button key={p} onClick={() => setCurrentPage(p)}
                    className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold transition-colors ${
                      p === currentPage ? 'bg-[#f5efe2] text-[#151510]' : 'border border-white/10 text-[#f5efe2]/70 hover:bg-white/10'
                    }`}>
                    {p}
                  </button>
                )
              )
            })()}
            <PageButton onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} label="Trang sau">
              <ChevronRight size={15} />
            </PageButton>
          </div>
        )}
      </div>

      {/* ── Nút thêm ── */}
      <button onClick={openAdd}
        className="fixed bottom-6 right-5 z-20 flex h-14 items-center gap-2 rounded-full px-6 font-semibold transition-transform hover:-translate-y-0.5 sm:right-8"
        style={{ backgroundColor: themeColor, color: cc.text, boxShadow: `0 12px 32px ${themeColor}66` }}>
        <Plus size={20} /> Thêm
      </button>

      {/* ── Popup thêm / sửa (thêm được nhiều giao dịch một lúc) ── */}
      {txModal && (
        <PersonalTransactionModal
          userId={userId}
          labels={labels}
          goals={goals}
          periodExpenses={periodExpenses}
          period={period}
          themeColor={themeColor}
          transaction={txModal.exp}
          onClose={() => setTxModal(null)}
          onSaved={handleTxSaved}
        />
      )}

      {/* ── Xác nhận xoá ── */}
      {deleteId && (
        <DarkModal title="Xoá giao dịch?" onClose={() => setDeleteId(null)} size="sm">
          <p className="mb-6 text-sm text-[#f5efe2]/60">Hành động này không thể hoàn tác.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)}
              className="flex-1 rounded-full border border-white/20 py-3 font-semibold text-[#f5efe2]/80 hover:bg-white/10">
              Huỷ
            </button>
            <button onClick={handleDelete} className="flex-1 rounded-full bg-rose-500 py-3 font-semibold text-white hover:bg-rose-600">
              Xoá
            </button>
          </div>
        </DarkModal>
      )}

      {showSettings && (
        <ProfileSettingsModal
          onClose={() => setShowSettings(false)}
          themeColor={themeColor}
          currentTheme={themeColor}
          onChangeTheme={handleThemeChange}
        />
      )}
    </div>
  )
}

// ── Thành phần nhỏ của trang ──────────────────────────────────────────────

function Chip({ active, onClick, activeBg, activeText, dot, children }: {
  active: boolean; onClick: () => void; activeBg: string; activeText: string; dot?: string; children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'border-transparent' : 'border-white/15 bg-white/5 text-[#f5efe2]/70 hover:text-[#f5efe2]'
      }`}
      style={active ? { backgroundColor: activeBg, color: activeText } : undefined}>
      {dot && !active && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />}
      {children}
    </button>
  )
}

function PageButton({ onClick, disabled, label, children }: {
  onClick: () => void; disabled: boolean; label: string; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-[#f5efe2]/70 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">
      {children}
    </button>
  )
}
