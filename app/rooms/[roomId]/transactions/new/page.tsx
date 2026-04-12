'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, type RoomMember } from '@/lib/supabase'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'

export default function NewTransactionPage() {
  const router = useRouter()
  const { roomId } = useParams<{ roomId: string }>()

  const [type, setType] = useState<'shared' | 'personal'>('shared')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [members, setMembers] = useState<RoomMember[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setCurrentUserId(user.id)

      const { data } = await supabase.from('room_members').select('*').eq('room_id', roomId)
      const memberList = (data as RoomMember[]) ?? []
      setMembers(memberList)
      // default: all members selected
      setSelectedMembers(memberList.map(m => m.user_id))
    }
    load()
  }, [roomId, router])

  function toggleMember(userId: string) {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  function handleAmountChange(val: string) {
    const digits = val.replace(/\D/g, '')
    setAmount(digits ? parseInt(digits).toLocaleString('vi-VN') : '')
  }

  async function handleSave() {
    if (!amount || !description.trim()) { setError('Vui lòng điền đủ thông tin'); return }
    if (type === 'personal' && selectedMembers.length === 0) { setError('Chọn ít nhất 1 thành viên'); return }
    const num = parseFloat(amount.replace(/\./g, '').replace(/,/g, ''))
    if (isNaN(num) || num <= 0) { setError('Số tiền không hợp lệ'); return }

    setSaving(true)

    // Determine who splits
    const splitUserIds = type === 'shared'
      ? members.map(m => m.user_id)
      : selectedMembers

    const splitAmount = num / splitUserIds.length

    // Insert transaction
    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .insert({ room_id: roomId, paid_by: currentUserId, type, amount: num, description: description.trim(), date })
      .select()
      .single()

    if (txErr || !tx) { setError(txErr?.message ?? 'Lỗi'); setSaving(false); return }

    // Insert splits
    const splits = splitUserIds.map(userId => ({
      transaction_id: tx.id,
      user_id: userId,
      amount: splitAmount,
    }))
    await supabase.from('transaction_splits').insert(splits)

    router.push(`/rooms/${roomId}`)
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <div className={`px-4 pt-12 pb-6 transition-colors ${type === 'shared' ? 'bg-blue-600' : 'bg-orange-500'}`}>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-white/80 hover:text-white">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-white font-semibold text-lg">Thêm giao dịch</h1>
        </div>

        {/* Type toggle */}
        <div className="flex bg-white/20 rounded-xl p-1">
          {(['shared', 'personal'] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${type === t ? 'bg-white text-gray-900' : 'text-white'}`}>
              {t === 'shared' ? '🏠 Chung' : '👤 Cá nhân'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-6 space-y-5">
        {/* Helper text */}
        <div className={`rounded-xl p-3 text-xs ${type === 'shared' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
          {type === 'shared'
            ? '🏠 Chi phí chung: chia đều cho tất cả thành viên trong phòng'
            : '👤 Cá nhân: bạn trả trước, chọn ai liên quan để chia'}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền (VND)</label>
          <input type="text" inputMode="numeric" value={amount} onChange={e => handleAmountChange(e.target.value)}
            placeholder="0"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Ví dụ: Tiền điện tháng 4, Bún bò..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        {/* Member selection (personal only) */}
        {type === 'personal' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Chia cho ai?</label>
            <div className="space-y-2">
              {members.map(m => (
                <label key={m.user_id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selectedMembers.includes(m.user_id) ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'
                }`}>
                  <input type="checkbox" checked={selectedMembers.includes(m.user_id)}
                    onChange={() => toggleMember(m.user_id)} className="rounded" />
                  <span className="text-sm font-medium text-gray-900">
                    {m.user_id === currentUserId ? 'Bạn' : m.user_id.slice(0, 12) + '...'}
                  </span>
                  {selectedMembers.length > 0 && (
                    <span className="ml-auto text-xs text-gray-400">
                      {selectedMembers.includes(m.user_id) && amount
                        ? formatSplit(amount, selectedMembers.length)
                        : ''}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Split preview */}
        {amount && (
          <div className="bg-gray-100 rounded-xl p-3 text-sm text-gray-600">
            Mỗi người: <span className="font-bold text-gray-900">
              {formatSplit(amount, type === 'shared' ? members.length : selectedMembers.length)}
            </span>
            {' '}({type === 'shared' ? members.length : selectedMembers.length} người)
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50">
          {saving ? 'Đang lưu...' : 'Lưu giao dịch'}
        </button>
      </div>
    </main>
  )
}

function formatSplit(amountStr: string, count: number) {
  if (count === 0) return '0đ'
  const num = parseFloat(amountStr.replace(/\./g, '').replace(/,/g, ''))
  if (isNaN(num)) return '0đ'
  return new Intl.NumberFormat('vi-VN').format(Math.round(num / count)) + 'đ'
}
