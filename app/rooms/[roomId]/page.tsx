'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Transaction, type RoomMember, type Room } from '@/lib/supabase'
import { format } from 'date-fns'
import { ArrowLeft, Plus, Users, BarChart2, Trash2, UserPlus } from 'lucide-react'

function formatMoney(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ'
}

export default function RoomPage() {
  const router = useRouter()
  const { roomId } = useParams<{ roomId: string }>()

  const [room, setRoom] = useState<Room | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [members, setMembers] = useState<RoomMember[]>([])
  const [userNames, setUserNames] = useState<Record<string, string>>({})
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'transactions' | 'members' | 'settle'>('transactions')
  
  // Custom Popup states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showSettleConfirm, setShowSettleConfirm] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  // Settlement states
  const [balances, setBalances] = useState<any[]>([])
  const [settlements, setSettlements] = useState<any[]>([])
  const [settleLoading, setSettleLoading] = useState(false)

  const [addUsername, setAddUsername] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [addError, setAddError] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    setCurrentUserId(user.id)

    const [{ data: roomData }, { data: txData }, { data: memberData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', roomId).single(),
      supabase.from('transactions').select('*, splits:transaction_splits(*)').eq('room_id', roomId).order('date', { ascending: false }),
      supabase.from('room_members').select('*').eq('room_id', roomId),
    ])

    if (!roomData) { router.push('/rooms'); return }

    // Fetch emails for members via RPC (or just show user_id shortened)
    // We'll use a helper to get display names
    setRoom(roomData)
    const txList = (txData as Transaction[]) ?? []
    setTransactions(txList)
    const memberList = (memberData as RoomMember[]) ?? []
    setMembers(memberList)

    // Fetch user names
    let localUserNames: Record<string, string> = {}
    try {
      const res = await fetch(`/api/room-users?roomId=${roomId}`)
      if (res.ok) {
        const { userMap } = await res.json()
        if (userMap) {
          localUserNames = userMap
          setUserNames(userMap)
        }
      }
    } catch (e) {
      console.error('Failed to load user names', e)
    }

    // Calculate Settlement for pending transactions
    const pendingTx = txList.filter(t => !t.settlement_id && !(t as any).is_settled)
    const balanceMap: Record<string, { totalPaid: number; totalOwed: number }> = {}
    memberList.forEach(m => { balanceMap[m.user_id] = { totalPaid: 0, totalOwed: 0 } })

    pendingTx.forEach((tx: any) => {
      if (balanceMap[tx.paid_by]) balanceMap[tx.paid_by].totalPaid += tx.amount
      tx.splits?.forEach((s: any) => {
        if (balanceMap[s.user_id]) balanceMap[s.user_id].totalOwed += s.amount
      })
    })

    const memberBalances = memberList.map((m, i) => ({
      user_id: m.user_id,
      label: m.user_id === user.id ? 'Bạn' : (localUserNames[m.user_id] ?? `Thành viên ${i + 1}`),
      totalPaid: balanceMap[m.user_id]?.totalPaid ?? 0,
      totalOwed: balanceMap[m.user_id]?.totalOwed ?? 0,
      net: (balanceMap[m.user_id]?.totalPaid ?? 0) - (balanceMap[m.user_id]?.totalOwed ?? 0),
    }))
    setBalances(memberBalances)

    const debtors = memberBalances.filter(b => b.net < 0).map(b => ({ ...b, remaining: -b.net }))
    const creditors = memberBalances.filter(b => b.net > 0).map(b => ({ ...b, remaining: b.net }))
    const settleList = []

    let i = 0, j = 0
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i].remaining, creditors[j].remaining)
      if (amount > 1) {
        settleList.push({ from: debtors[i].label, to: creditors[j].label, amount })
      }
      debtors[i].remaining -= amount
      creditors[j].remaining -= amount
      if (debtors[i].remaining < 1) i++
      if (creditors[j].remaining < 1) j++
    }
    setSettlements(settleList)

    setLoading(false)
  }, [roomId, router])

  useEffect(() => { load() }, [load])

  async function addMember() {
    if (!addUsername.trim()) return
    setAddingMember(true); setAddError('')

    // Look up user by username using auth admin — we use a workaround:
    // Try to find user in room_members of any room (not ideal but works without admin key)
    // Better: use a Supabase function. For now we use signInWithOtp trick — actually
    // we'll just store email directly and match on login.
    // Simplest approach: call our own API route
    const res = await fetch('/api/add-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, username: addUsername.trim() }),
    })
    const json = await res.json()
    if (!res.ok) { setAddError(json.error ?? 'Không tìm thấy user'); setAddingMember(false); return }

    setAddUsername('')
    await load()
    setAddingMember(false)
  }

  async function removeMember(memberId: string, userId: string) {
    if (userId === currentUserId) return
    await supabase.from('room_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  function confirmDelete(id: string) {
    setDeleteConfirmId(id)
  }

  async function deleteTransaction() {
    if (!deleteConfirmId) return
    const id = deleteConfirmId
    setDeleteConfirmId(null)
    await supabase.from('transactions').delete().eq('id', id)
    setTransactions(prev => prev.filter(t => t.id !== id))
    load()
  }

  function promptSettle() {
    setShowSettleConfirm(true)
  }

  async function handleSettle() {
    setShowSettleConfirm(false)
    setSettleLoading(true)
    
    // 1. Find min and max date of pending
    const pendingTx = transactions.filter(t => !t.settlement_id && !(t as any).is_settled)
    if (pendingTx.length === 0) { setSettleLoading(false); return }
    
    // 1. Calculate actual Billing Cycle period
    const { data: lastSettlement } = await supabase
      .from('settlements')
      .select('end_date')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1)

    let minDate = ''
    if (lastSettlement && lastSettlement.length > 0) {
      minDate = lastSettlement[0].end_date
    } else {
      const allDates = transactions.map(t => new Date(t.date).getTime())
      minDate = format(new Date(Math.min(...allDates)), 'yyyy-MM-dd')
    }

    const maxDate = format(new Date(), 'yyyy-MM-dd')
    const totalAmount = pendingTx.reduce((sum, t) => sum + t.amount, 0)
    
    // 2. Create settlement record
    const { data: newSettlement, error: sErr } = await supabase.from('settlements').insert({
      room_id: roomId,
      start_date: minDate,
      end_date: maxDate,
      total_amount: totalAmount
    }).select().single()
    
    if (sErr || !newSettlement) {
      setAlertMessage('Lỗi tạo đợt chốt: ' + (sErr?.message || 'Có thể do Supabase Cache chưa kịp reset. Hãy thử load lại trang.'))
      setSettleLoading(false)
      return
    }

    // 3. Update transactions
    await supabase.from('transactions').update({ 
      settlement_id: newSettlement.id
    }).in('id', pendingTx.map(t => t.id))

    await load()
    setTab('transactions')
    setSettleLoading(false)
  }

  const isOwner = room?.owner_id === currentUserId

  if (loading) {
    return <div className="max-w-md mx-auto pt-20 text-center text-gray-400">Đang tải...</div>
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-indigo-600 px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/rooms" className="text-indigo-200 hover:text-white">
            <ArrowLeft size={22} />
          </Link>
          <h1 className="text-white font-bold text-lg flex-1">{room?.name}</h1>
          <Link href={`/rooms/${roomId}/report`}
            className="flex items-center gap-1 bg-white/20 text-white px-3 py-1.5 rounded-full text-xs font-medium">
            <BarChart2 size={14} />
            Report
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/20 rounded-xl p-1">
          {(['transactions', 'members', 'settle'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-indigo-600' : 'text-white'}`}>
              {t === 'transactions' ? '💸 Hoạt động' : t === 'members' ? '👥 Nhóm' : '🤝 Thanh toán'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {/* TRANSACTIONS TAB */}
        {tab === 'transactions' && (
          <>
            {transactions.filter(tx => !tx.settlement_id && !(tx as any).is_settled).length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-sm">Chưa có giao dịch nào chưa chốt</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions
                  .filter(tx => !tx.settlement_id && !(tx as any).is_settled)
                  .map(tx => (
                  <div key={tx.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            tx.type === 'shared'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {tx.type === 'shared' ? 'Chung' : 'Cá nhân'}
                          </span>
                          <span className="text-xs text-gray-400">{format(new Date(tx.date), 'dd/MM/yyyy')}</span>
                        </div>
                        <p className="font-medium text-sm text-gray-900">{tx.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Người trả: {tx.paid_by === currentUserId ? 'Bạn' : (userNames[tx.paid_by] ?? tx.paid_by.slice(0, 8) + '...')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <span className="font-bold text-sm text-gray-900">{formatMoney(tx.amount)}</span>
                        {tx.paid_by === currentUserId && (
                          <button onClick={() => confirmDelete(tx.id)} className="text-gray-300 hover:text-red-400">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* MEMBERS TAB */}
        {tab === 'members' && (
          <>
            {/* Add member (owner only) */}
            {isOwner && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
                <p className="font-medium text-sm text-gray-900 mb-3 flex items-center gap-2">
                  <UserPlus size={16} /> Thêm thành viên
                </p>
                <input
                  value={addUsername}
                  onChange={e => setAddUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addMember()}
                  placeholder="Username thành viên..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                />
                {addError && <p className="text-red-500 text-xs mb-2">{addError}</p>}
                <button onClick={addMember} disabled={addingMember}
                  className="w-full bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                  {addingMember ? 'Đang thêm...' : 'Thêm'}
                </button>
              </div>
            )}

            {/* Member list */}
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center">
                      <Users size={16} className="text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {m.user_id === currentUserId ? 'Bạn' : (userNames[m.user_id] ?? m.user_id.slice(0, 12) + '...')}
                      </p>
                      {room?.owner_id === m.user_id && (
                        <p className="text-xs text-indigo-500">Chủ phòng</p>
                      )}
                    </div>
                  </div>
                  {isOwner && m.user_id !== currentUserId && (
                    <button onClick={() => removeMember(m.id, m.user_id)} className="text-gray-300 hover:text-red-400">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* SETTLE TAB */}
        {tab === 'settle' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="font-semibold text-sm text-gray-900 mb-3">Tình trạng nợ nần</h3>
              <div className="space-y-3">
                {balances.map(b => (
                  <div key={b.user_id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{b.label}</p>
                      <p className="text-xs text-gray-400">Đã trả: {formatMoney(b.totalPaid)}</p>
                    </div>
                    <div className={`font-bold text-sm ${b.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {b.net >= 0 ? '+' : ''}{formatMoney(b.net)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="font-semibold text-sm text-gray-900 mb-3">Chuyển khoản (Ai trả ai?)</h3>
              {settlements.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">✅ Đang không ai nợ ai!</p>
              ) : (
                <div className="space-y-2">
                  {settlements.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 text-sm">
                      <span className="font-medium text-gray-700">{s.from}</span>
                      <span className="text-gray-400">trả</span>
                      <span className="font-medium text-gray-700">{s.to}</span>
                      <span className="ml-auto font-bold text-gray-900">{formatMoney(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {settlements.length > 0 && (
              <button onClick={promptSettle} disabled={settleLoading}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition-colors mt-6 disabled:opacity-50">
                {settleLoading ? 'Đang xử lý...' : '✅ Chốt sổ (Đã thanh toán xong)'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* FAB */}
      <Link href={`/rooms/${roomId}/transactions/new`}
        className="fixed bottom-6 right-4 bg-indigo-600 text-white rounded-full px-5 py-3 flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-colors">
        <Plus size={20} />
        <span className="font-medium text-sm">Thêm</span>
      </Link>

      {/* Modals & Popups */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Xoá giao dịch?</h3>
            <p className="text-gray-500 text-sm mb-6">Bạn có chắc chắn muốn xoá giao dịch này không? Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-4 py-3 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Hủy bỏ</button>
              <button onClick={deleteTransaction} className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">Đồng ý xoá</button>
            </div>
          </div>
        </div>
      )}

      {showSettleConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
              <span className="text-2xl">✨</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Chốt sổ kỳ này?</h3>
            <p className="text-gray-500 text-sm mb-6">Mọi người trong phòng đã thanh toán đủ tiền kỳ này chưa? Nếu xác nhận, hệ thống sẽ gom các khoản nợ vào một đợt và làm mới sổ nợ về 0đ.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSettleConfirm(false)} className="flex-1 px-4 py-3 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Khoan đã</button>
              <button onClick={handleSettle} className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-green-500 hover:bg-green-600 transition-colors">Chắc chắn</button>
            </div>
          </div>
        </div>
      )}

      {alertMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Thông báo</h3>
            <p className="text-gray-600 text-sm mb-6">{alertMessage}</p>
            <button onClick={() => setAlertMessage(null)} className="w-full px-4 py-3 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">Đã hiểu</button>
          </div>
        </div>
      )}
    </main>
  )
}
