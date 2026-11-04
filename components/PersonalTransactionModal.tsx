'use client'

// Popup thêm / sửa giao dịch của Sổ cá nhân (tông tối).
// - Thêm: nhiều dòng một lúc; Khoản chi/thu, Ngày, Nhãn dùng chung cho cả đợt; mỗi dòng có Mô tả + Số tiền + nút +/−
// - Sửa: đúng 1 dòng
// - Nhãn chọn bằng nút (không dùng dropdown gốc của trình duyệt — rất khó đọc trên nền tối)
// - Nhãn có mục tiêu: cho biết đã dùng bao nhiêu trong kỳ và sau đợt này còn bao nhiêu

import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { Check, Minus, Plus } from 'lucide-react'
import { supabase, type PersonalExpense, type PersonalGoal, type PersonalLabel } from '@/lib/supabase'
import { getContrastColors } from '@/lib/theme'
import { formatMoney, type Period } from '@/lib/goals'
import { DarkModal, darkInput } from '@/components/NightUI'

type Row = { key: string; description: string; amount: string }

// Lưới cố định để các dòng thẳng hàng. Thêm: Mô tả | Số tiền | [+][−]. Sửa: Mô tả | Số tiền.
const ROW_GRID_ADD = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3.25rem] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_3.25rem] gap-1.5 items-center'
const ROW_GRID_EDIT = 'grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-1.5 items-center'

let keySeq = 0
const newKey = () => `r${++keySeq}`
const emptyRow = (): Row => ({ key: newKey(), description: '', amount: '' })
const parseAmount = (s: string) => parseFloat(s.replace(/\./g, '').replace(/,/g, ''))

export default function PersonalTransactionModal({
  userId, labels, goals, periodExpenses, period, themeColor, transaction, onClose, onSaved,
}: {
  userId: string
  labels: PersonalLabel[]
  goals: PersonalGoal[]
  periodExpenses: PersonalExpense[]
  period: Period
  themeColor: string
  /** null = thêm mới (nhiều dòng); có giá trị = sửa giao dịch này */
  transaction: PersonalExpense | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!transaction
  const cc = getContrastColors(themeColor)

  const [type, setType] = useState<'expense' | 'income'>(transaction?.type ?? 'expense')
  const [date, setDate] = useState(transaction?.date ?? format(new Date(), 'yyyy-MM-dd'))
  const [labelId, setLabelId] = useState(transaction?.label_id ?? '')
  const [rows, setRows] = useState<Row[]>(() => [
    transaction
      ? { key: newKey(), description: transaction.description, amount: Math.round(transaction.amount).toLocaleString('vi-VN') }
      : emptyRow(),
  ])
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const rowGrid = isEdit ? ROW_GRID_EDIT : ROW_GRID_ADD

  // ── Các dòng ──
  function updateRow(key: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)))
    if (rowErrors[key]) setRowErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }
  function handleAmountChange(key: string, val: string) {
    const d = val.replace(/\D/g, '')
    updateRow(key, { amount: d ? parseInt(d).toLocaleString('vi-VN') : '' })
  }
  function focusRow(key: string) {
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLInputElement>(`[data-desc="${key}"]`)?.focus())
  }
  function addRowAfter(index: number) {
    const row = emptyRow()
    setRows(prev => [...prev.slice(0, index + 1), row, ...prev.slice(index + 1)])
    focusRow(row.key)
  }
  function removeRow(key: string) {
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.key !== key) : prev))
  }
  function handleAmountEnter(index: number) {
    if (isEdit) { handleSave(); return }
    const next = rows[index + 1]
    if (next) focusRow(next.key)
    else addRowAfter(index)
  }

  const filledRows = rows.filter(r => r.description.trim() || r.amount)
  const total = filledRows.reduce((s, r) => s + (parseAmount(r.amount) || 0), 0)

  // ── Lưu ──
  async function handleSave() {
    setError('')
    if (filledRows.length === 0) { setError('Nhập ít nhất 1 giao dịch'); return }
    const errs: Record<string, string> = {}
    for (const r of filledRows) {
      const n = parseAmount(r.amount)
      if (!r.description.trim()) errs[r.key] = 'Thiếu mô tả'
      else if (!n || n <= 0) errs[r.key] = 'Số tiền không hợp lệ'
    }
    setRowErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    const items = filledRows.map(r => ({
      amount: parseAmount(r.amount),
      description: r.description.trim(),
      date,
      label_id: labelId || null,
      type,
    }))
    const { error: err } = isEdit
      ? await supabase.from('personal_expenses').update(items[0]).eq('id', transaction!.id)
      : await supabase.from('personal_expenses').insert(items.map(i => ({ ...i, user_id: userId })))
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  // ── Gợi ý mục tiêu của nhãn đang chọn ──
  const goal = type === 'expense' ? goals.find(g => g.label_id === labelId) : undefined
  const inPeriod = date >= period.from && date <= period.to
  const used = goal
    ? periodExpenses.filter(e => e.label_id === labelId && e.type !== 'income' && e.id !== transaction?.id).reduce((s, e) => s + e.amount, 0)
    : 0

  const saveLabel = saving ? 'Đang lưu…' : isEdit ? 'Lưu' : filledRows.length > 1 ? `Lưu ${filledRows.length} giao dịch` : 'Lưu'

  return (
    <DarkModal title={isEdit ? 'Sửa giao dịch' : 'Thêm giao dịch'} onClose={() => { if (!saving) onClose() }}>
      <div className="space-y-5">
        {/* Khoản chi / thu */}
        <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
          {(['expense', 'income'] as const).map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                type === t
                  ? `bg-white/10 ${t === 'expense' ? 'text-rose-300' : 'text-emerald-300'}`
                  : 'text-[#f5efe2]/50 hover:text-[#f5efe2]'
              }`}>
              {t === 'expense' ? 'Khoản chi' : 'Khoản thu'}
            </button>
          ))}
        </div>

        {/* Ngày */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#f5efe2]/70">Ngày</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${darkInput} !text-sm`} />
        </label>

        {/* Nhãn: chọn bằng nút */}
        <div>
          <span className="mb-2 block text-sm font-medium text-[#f5efe2]/70">Nhãn</span>
          <div className="flex flex-wrap gap-2">
            <LabelChip active={labelId === ''} onClick={() => setLabelId('')}>Không nhãn</LabelChip>
            {labels.map(l => (
              <LabelChip key={l.id} active={labelId === l.id} color={l.color} onClick={() => setLabelId(l.id)}>
                {l.name}
              </LabelChip>
            ))}
          </div>
        </div>

        {/* Các dòng */}
        <div>
          <div className={`${rowGrid} mb-1`}>
            <span className="text-sm font-medium text-[#f5efe2]/70">Mô tả</span>
            <span className="pr-1 text-right text-sm font-medium text-[#f5efe2]/70">Số tiền</span>
          </div>
          <div ref={listRef} className="space-y-2">
            {rows.map((r, i) => {
              const border = rowErrors[r.key] ? '!border-rose-400/60' : ''
              return (
                <div key={r.key}>
                  <div className={rowGrid}>
                    <input type="text" data-desc={r.key} value={r.description}
                      onChange={e => updateRow(r.key, { description: e.target.value })}
                      placeholder={i === 0 ? 'vd: Cà phê' : 'Mô tả'}
                      autoFocus={i === 0 && !isEdit}
                      className={`${darkInput} !px-3 !py-2.5 !text-sm ${border}`} />
                    <div className="relative">
                      <input type="text" inputMode="numeric" value={r.amount}
                        onChange={e => handleAmountChange(r.key, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAmountEnter(i) } }}
                        placeholder="0"
                        className={`${darkInput} !py-2.5 !pl-2 !pr-6 !text-sm text-right font-bold tabular-nums ${border}`} />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-[#f5efe2]/40">đ</span>
                    </div>
                    {!isEdit && (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => addRowAfter(i)} title="Thêm dòng bên dưới"
                          className="flex h-8 w-6 items-center justify-center rounded-lg transition-opacity hover:opacity-80"
                          style={{ backgroundColor: themeColor + '33', color: '#f5efe2' }}>
                          <Plus size={16} />
                        </button>
                        <button type="button" onClick={() => removeRow(r.key)} disabled={rows.length === 1} title="Xoá dòng này"
                          className="flex h-8 w-6 items-center justify-center rounded-lg bg-white/10 text-[#f5efe2]/60 transition-colors hover:bg-rose-400/20 hover:text-rose-300 disabled:opacity-30 disabled:hover:bg-white/10 disabled:hover:text-[#f5efe2]/60">
                          <Minus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  {rowErrors[r.key] && <p className="mt-1 text-xs text-rose-300">{rowErrors[r.key]}</p>}
                </div>
              )
            })}
          </div>
          {!isEdit && <p className="mt-2 text-xs text-[#f5efe2]/40">Enter ở ô tiền để thêm dòng</p>}
        </div>

        {/* Tổng đợt */}
        {!isEdit && filledRows.length > 1 && total > 0 && (
          <div className="flex justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <span className="text-[#f5efe2]/60">Tổng {filledRows.length} giao dịch</span>
            <b className="tabular-nums">{formatMoney(total)}</b>
          </div>
        )}

        {/* Mục tiêu của nhãn đang chọn */}
        {goal && inPeriod && (() => {
          const left = goal.amount - (used + total)
          const isLimit = goal.kind === 'limit'
          return (
            <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${
              isLimit && left < 0 ? 'border-rose-400/30 bg-rose-400/10' : 'border-white/10 bg-white/5'
            }`}>
              <p className="text-[#f5efe2]/70">
                {isLimit ? 'Đã chi trong kỳ' : 'Đã tích luỹ trong kỳ'}:{' '}
                <b className="font-semibold tabular-nums text-[#f5efe2]">{formatMoney(used)}</b>
                <span className="text-[#f5efe2]/45"> / {formatMoney(goal.amount)}</span>
              </p>
              <p className={`mt-0.5 font-semibold ${
                isLimit ? (left < 0 ? 'text-rose-300' : left < goal.amount * 0.2 ? 'text-amber-300' : 'text-emerald-300')
                  : (left <= 0 ? 'text-emerald-300' : 'text-sky-300')
              }`}>
                {isLimit
                  ? (left < 0 ? `Sau ${isEdit ? 'khoản' : 'đợt'} này sẽ vượt ${formatMoney(-left)}` : `Sau ${isEdit ? 'khoản' : 'đợt'} này còn ${formatMoney(left)}`)
                  : (left <= 0 ? `Sau ${isEdit ? 'khoản' : 'đợt'} này đạt mục tiêu tích luỹ ✓` : `Sau ${isEdit ? 'khoản' : 'đợt'} này còn thiếu ${formatMoney(left)}`)}
              </p>
              {!isLimit && <p className="mt-0.5 text-[#f5efe2]/45">Các khoản này được tính là Tích luỹ, không tính vào Chi tiêu.</p>}
            </div>
          )
        })()}

        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button onClick={handleSave} disabled={saving}
          className="w-full rounded-full py-3.5 font-semibold transition-opacity disabled:opacity-50"
          style={{ backgroundColor: themeColor, color: cc.text }}>
          {saveLabel}
        </button>
      </div>
    </DarkModal>
  )
}

function LabelChip({ active, color, onClick, children }: {
  active: boolean; color?: string; onClick: () => void; children: React.ReactNode
}) {
  const activeStyle = active
    ? color
      ? { backgroundColor: color, color: getContrastColors(color).text, borderColor: color }
      : { backgroundColor: '#f5efe2', color: '#151510', borderColor: '#f5efe2' }
    : undefined
  return (
    <button type="button" onClick={onClick}
      className={`flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
        active ? '' : 'border-white/15 bg-white/5 text-[#f5efe2]/75 hover:border-white/30 hover:text-[#f5efe2]'
      }`}
      style={activeStyle}>
      {active
        ? <Check size={14} className="shrink-0" />
        : color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      <span className="truncate">{children}</span>
    </button>
  )
}
