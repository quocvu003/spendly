'use client'

import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { Minus, Plus, X } from 'lucide-react'
import { supabase, type RoomMember, type Transaction } from '@/lib/supabase'
import { getContrastColors } from '@/lib/theme'

type Props = {
  roomId: string
  themeColor: string
  members: RoomMember[]
  userNames: Record<string, string>
  currentUserId: string
  /** null = thêm mới (nhiều dòng), có giá trị = sửa giao dịch này (cần kèm splits) */
  transaction: Transaction | null
  onClose: () => void
  onSaved: () => void
}

type Row = { key: string; description: string; amount: string }

// Lưới cố định để mọi dòng thẳng hàng với nhau và với các ô phía trên.
// Thêm mới: Mô tả | Số tiền | [+][−]. Điện thoại chia 50/50 để ô tiền đủ chỗ cho số 8 chữ số.
const ROW_GRID_ADD = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3.25rem] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_3.25rem] gap-1.5 items-center'
// Sửa: chỉ 1 dòng, không có nút +/−
const ROW_GRID_EDIT = 'grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-1.5 items-center'

export default function RoomTransactionModal({
  roomId, themeColor, members, userNames, currentUserId, transaction, onClose, onSaved,
}: Props) {
  const isEdit = !!transaction
  const allIds = members.map(m => m.user_id)
  const othersIds = allIds.filter(id => id !== currentUserId)

  // Cài đặt chung cho cả đợt
  const [type, setType] = useState<'shared' | 'personal'>(transaction?.type ?? 'shared')
  const [date, setDate] = useState(transaction?.date ?? format(new Date(), 'yyyy-MM-dd'))
  const [selectedMembers, setSelectedMembers] = useState<string[]>(() => {
    if (transaction?.type === 'personal') return transaction.splits?.map(s => s.user_id) ?? []
    return allIds
  })

  // Các dòng giao dịch (khi sửa: đúng 1 dòng)
  const [rows, setRows] = useState<Row[]>(() => [
    transaction
      ? { key: newId(), description: transaction.description, amount: transaction.amount.toLocaleString('vi-VN') }
      : emptyRow(),
  ])
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const cc = getContrastColors(themeColor)
  const rowGrid = isEdit ? ROW_GRID_EDIT : ROW_GRID_ADD

  // ── Cài đặt chung ─────────────────────────────────────────────────────────
  function changeType(t: 'shared' | 'personal') {
    setType(t)
    // Cá nhân: mặc định chia cho mọi người trừ bạn. Chung: chia cho tất cả.
    setSelectedMembers(t === 'personal' ? othersIds : allIds)
  }

  function toggleMember(userId: string) {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  // ── Các dòng ──────────────────────────────────────────────────────────────
  function updateRow(key: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))
    if (rowErrors[key]) setRowErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  function handleAmountChange(key: string, val: string) {
    const digits = val.replace(/\D/g, '')
    updateRow(key, { amount: digits ? parseInt(digits).toLocaleString('vi-VN') : '' })
  }

  function focusRow(key: string) {
    // Chờ React vẽ dòng mới rồi mới focus
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLInputElement>(`[data-desc="${key}"]`)?.focus()
    })
  }

  // Chèn dòng trống ngay sau dòng thứ `index`
  function addRowAfter(index: number) {
    const row = emptyRow()
    setRows(prev => [...prev.slice(0, index + 1), row, ...prev.slice(index + 1)])
    focusRow(row.key)
  }

  function removeRow(key: string) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.key !== key) : prev)
  }

  // Enter ở ô số tiền: sang dòng tiếp theo, hoặc thêm dòng mới nếu đang ở dòng cuối
  function handleAmountEnter(index: number) {
    if (isEdit) { handleSave(); return }
    const next = rows[index + 1]
    if (next) focusRow(next.key)
    else addRowAfter(index)
  }

  // ── Tính toán ─────────────────────────────────────────────────────────────
  const splitUserIds = type === 'shared' ? allIds : selectedMembers
  const filledRows = rows.filter(r => r.description.trim() || r.amount)
  const total = filledRows.reduce((s, r) => s + (parseAmount(r.amount) || 0), 0)

  // ── Lưu ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setError('')
    if (type === 'personal' && selectedMembers.length === 0) { setError('Chọn ít nhất 1 thành viên'); return }
    if (splitUserIds.length === 0) { setError('Phòng chưa có thành viên để chia'); return }
    if (filledRows.length === 0) { setError('Nhập ít nhất 1 giao dịch'); return }

    // Bỏ qua dòng trống hoàn toàn; dòng nhập dở thì báo lỗi tại dòng đó
    const errs: Record<string, string> = {}
    for (const r of filledRows) {
      const num = parseAmount(r.amount)
      if (!r.description.trim()) errs[r.key] = 'Thiếu mô tả'
      else if (!num || num <= 0) errs[r.key] = 'Số tiền không hợp lệ'
    }
    setRowErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    const err = isEdit ? await saveEdit(filledRows[0]) : await saveNew(filledRows)
    setSaving(false)
    if (err) { setError(err); return }
    onSaved()
  }

  async function saveEdit(row: Row): Promise<string | null> {
    const txId = transaction!.id
    const num = parseAmount(row.amount)
    const { error: txErr } = await supabase
      .from('transactions')
      .update({ type, amount: num, description: row.description.trim(), date })
      .eq('id', txId)
    if (txErr) return txErr.message

    const { error: delErr } = await supabase.from('transaction_splits').delete().eq('transaction_id', txId)
    if (delErr) return delErr.message

    const { error: splitErr } = await supabase.from('transaction_splits').insert(
      splitUserIds.map(userId => ({ transaction_id: txId, user_id: userId, amount: num / splitUserIds.length }))
    )
    return splitErr ? 'Đã lưu giao dịch nhưng lỗi khi chia tiền: ' + splitErr.message : null
  }

  async function saveNew(items: Row[]): Promise<string | null> {
    // Tự tạo id để gắn phần chia đúng với từng giao dịch, không phụ thuộc thứ tự trả về.
    const txs = items.map(r => ({
      id: newId(),
      room_id: roomId,
      paid_by: currentUserId,
      type,
      amount: parseAmount(r.amount),
      description: r.description.trim(),
      date,
    }))

    const { error: txErr } = await supabase.from('transactions').insert(txs)
    if (txErr) return txErr.message

    const splits = txs.flatMap(tx =>
      splitUserIds.map(userId => ({ transaction_id: tx.id, user_id: userId, amount: tx.amount / splitUserIds.length }))
    )
    const { error: splitErr } = await supabase.from('transaction_splits').insert(splits)
    if (splitErr) {
      // Hoàn tác để không để lại giao dịch thiếu phần chia
      await supabase.from('transactions').delete().in('id', txs.map(t => t.id))
      return 'Lỗi khi chia tiền, chưa lưu giao dịch nào: ' + splitErr.message
    }
    return null
  }

  const saveLabel = saving
    ? 'Đang lưu...'
    : isEdit ? 'Lưu' : `Lưu ${filledRows.length || ''} giao dịch`.replace('  ', ' ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">{isEdit ? 'Sửa giao dịch' : 'Thêm giao dịch'}</h3>
          <button onClick={onClose} disabled={saving} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>

        <div className="space-y-4">
          {/* ── Cài đặt chung ── */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            {(['shared', 'personal'] as const).map(t => (
              <button key={t} onClick={() => changeType(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${type === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                style={type === t ? { color: themeColor } : {}}>
                {t === 'shared' ? '🏠 Chung' : '👤 Cá nhân'}
              </button>
            ))}
          </div>

          <div className={`rounded-xl p-3 text-xs ${type === 'shared' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
            {type === 'shared'
              ? '🏠 Chi phí chung: chia đều cho tất cả thành viên trong phòng'
              : '👤 Cá nhân: bạn trả trước, chọn ai liên quan để chia'}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {type === 'personal' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chia cho ai?</label>
              <div className="flex flex-wrap gap-2">
                {members.filter(m => m.user_id !== currentUserId).map(m => {
                  const on = selectedMembers.includes(m.user_id)
                  return (
                    <button key={m.user_id} type="button" onClick={() => toggleMember(m.user_id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        on ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500'
                      }`}>
                      {on ? '✓ ' : ''}{userNames[m.user_id] ?? m.user_id.slice(0, 8) + '...'}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Các dòng giao dịch ── */}
          {/* Lưới 2 cột cố định để mọi dòng thẳng hàng với nhau và với các ô phía trên */}
          <div>
            <div className={`${rowGrid} mb-1`}>
              <label className="text-sm font-medium text-gray-700">Mô tả</label>
              <label className="text-sm font-medium text-gray-700 text-right pr-1">Số tiền</label>
            </div>
            <div ref={listRef} className="space-y-2">
              {rows.map((r, i) => {
                const border = rowErrors[r.key] ? 'border-red-300' : 'border-gray-200'
                return (
                  <div key={r.key}>
                    <div className={rowGrid}>
                      <input type="text" data-desc={r.key} value={r.description}
                        onChange={e => updateRow(r.key, { description: e.target.value })}
                        placeholder={i === 0 ? 'vd: Tiền điện' : 'Mô tả'}
                        autoFocus={i === 0 && !isEdit}
                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${border}`} />
                      <div className="relative">
                        <input type="text" inputMode="numeric" value={r.amount}
                          onChange={e => handleAmountChange(r.key, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAmountEnter(i) } }}
                          placeholder="0"
                          className={`w-full pl-2 pr-6 py-2.5 border rounded-xl text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 ${border}`} />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">đ</span>
                      </div>
                      {!isEdit && (
                        <div className="flex gap-1">
                          <button type="button" onClick={() => addRowAfter(i)} title="Thêm dòng bên dưới"
                            className="w-6 h-8 flex items-center justify-center rounded-lg transition-opacity hover:opacity-80"
                            style={{ backgroundColor: themeColor + '1a', color: themeColor }}>
                            <Plus size={16} />
                          </button>
                          <button type="button" onClick={() => removeRow(r.key)} disabled={rows.length === 1}
                            title="Xoá dòng này"
                            className="w-6 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40 disabled:hover:bg-gray-100 disabled:hover:text-gray-500">
                            <Minus size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    {rowErrors[r.key] && <p className="text-red-500 text-xs mt-1">{rowErrors[r.key]}</p>}
                  </div>
                )
              })}
            </div>
            {!isEdit && <p className="mt-2 text-xs text-gray-400">Enter ở ô tiền để thêm dòng</p>}
          </div>

          {/* ── Tổng kết ── */}
          {total > 0 && (
            <div className="bg-gray-100 rounded-xl p-3 text-sm text-gray-600 space-y-1">
              {!isEdit && (
                <div className="flex justify-between">
                  <span>Tổng {filledRows.length} giao dịch</span>
                  <span className="font-bold text-gray-900">{formatMoney(total)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Mỗi người ({splitUserIds.length} người)</span>
                <span className="font-bold text-gray-900">
                  {splitUserIds.length ? formatMoney(Math.round(total / splitUserIds.length)) : '0đ'}
                </span>
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3.5 rounded-xl font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: themeColor, color: cc.text }}>
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function emptyRow(): Row {
  return { key: newId(), description: '', amount: '' }
}

function parseAmount(s: string) {
  return parseFloat(s.replace(/\./g, '').replace(/,/g, ''))
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ'
}

// UUID v4. crypto.randomUUID chỉ có trên HTTPS/localhost, nên có dự phòng
// bằng getRandomValues để vẫn chạy khi mở app qua IP mạng LAN (http).
function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
