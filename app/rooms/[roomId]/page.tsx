'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Transaction, type RoomMember, type Room } from '@/lib/supabase'
import { format } from 'date-fns'
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Users, BarChart2, Trash2, UserPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'

const PAGE_SIZE = 10

function formatMoney(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ'
}

export default function RoomPage() {
  const router = useRouter()
  const { roomId } = useParams<{ roomId: string }>()

  const [room, setRoom] = useState<Room | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageLoading, setPageLoading] = useState(false)
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
  const [settleLoaded, setSettleLoaded] = useState(false)

  const [addUsername, setAddUsername] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [addError, setAddError] = useState('')

  // ── Filter states ──────────────────────────────────────────────────────────
  const [filterType, setFilterType] = useState<'all' | 'shared' | 'personal'>('all')
  const [filterPaidBy, setFilterPaidBy] = useState<string>('all')
  const [sortField, setSortField] = useState<'date' | 'amount'>('date')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  // ── Initial load: chỉ load tab Hoạt động ──────────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    setCurrentUserId(user.id)

    const [
      { data: roomData },
      { data: memberData },
      userNamesRes,
      txResult,
    ] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', roomId).single(),
      supabase.from('room_members').select('*').eq('room_id', roomId),
      fetch(`/api/room-users?roomId=${roomId}`).then(r => r.ok ? r.json() : { userMap: {} }).catch(() => ({ userMap: {} })),
      supabase
        .from('transactions')
        .select('*, splits:transaction_splits(*)', { count: 'exact' })
        .eq('room_id', roomId)
        .is('settlement_id', null)
        .order('date', { ascending: false })
        .range(0, PAGE_SIZE - 1),
    ])

    if (!roomData) { router.push('/rooms'); return }

    setRoom(roomData)
    setTransactions((txResult.data as Transaction[]) ?? [])
    setTotalCount(txResult.count ?? 0)
    setPage(1)
    setMembers((memberData as RoomMember[]) ?? [])
    setUserNames(userNamesRes?.userMap ?? {})
    setSettleLoaded(false)
    setLoading(false)
  }, [roomId, router])

  useEffect(() => { load() }, [load])

  // ── Core fetch with filters ────────────────────────────────────────────────
  const fetchPage = useCallback(async (
    pageNum: number,
    type: 'all' | 'shared' | 'personal',
    paidBy: string,
    field: 'date' | 'amount',
    sort: 'desc' | 'asc'
  ) => {
    setPageLoading(true)
    const from = (pageNum - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    let q = supabase
      .from('transactions')
      .select('*, splits:transaction_splits(*)', { count: 'exact' })
      .eq('room_id', roomId)
      .is('settlement_id', null)
      .order(field, { ascending: sort === 'asc' })
      .range(from, to)
    if (type !== 'all') q = (q as any).eq('type', type)
    if (paidBy !== 'all') q = (q as any).eq('paid_by', paidBy)
    const { data: txData, count } = await q
    setTransactions((txData as Transaction[]) ?? [])
    setTotalCount(count ?? 0)
    setPage(pageNum)
    setPageLoading(false)
  }, [roomId])

  // ── Paginate (uses current filters) ───────────────────────────────────────
  const loadPage = useCallback(async (pageNum: number) => {
    await fetchPage(pageNum, filterType, filterPaidBy, sortField, sortOrder)
  }, [fetchPage, filterType, filterPaidBy, sortField, sortOrder])

  // ── Filter handlers ────────────────────────────────────────────────────────
  function handleFilterType(newType: 'all' | 'shared' | 'personal') {
    setFilterType(newType)
    fetchPage(1, newType, filterPaidBy, sortField, sortOrder)
  }

  function handleFilterPaidBy(newPaidBy: string) {
    setFilterPaidBy(newPaidBy)
    fetchPage(1, filterType, newPaidBy, sortField, sortOrder)
  }

  function handleSort(field: 'date' | 'amount') {
    if (sortField === field) {
      // same field → toggle direction
      const newOrder = sortOrder === 'desc' ? 'asc' : 'desc'
      setSortOrder(newOrder)
      fetchPage(1, filterType, filterPaidBy, field, newOrder)
    } else {
      // new field → switch field, reset to desc
      setSortField(field)
      setSortOrder('desc')
      fetchPage(1, filterType, filterPaidBy, field, 'desc')
    }
  }

  // ── Lazy load settle tab ───────────────────────────────────────────────────
  const loadSettleData = useCallback(async (currentMembers: RoomMember[], currentUserNames: Record<string, string>, uid: string) => {
    setSettleLoading(true)

    const { data: allPendingTx } = await supabase
      .from('transactions')
      .select('*, splits:transaction_splits(*)')
      .eq('room_id', roomId)
      .is('settlement_id', null)
      .order('date', { ascending: false })

    const pendingTx = (allPendingTx as any[]) ?? []

    const balanceMap: Record<string, { totalPaid: number; totalOwed: number }> = {}
    currentMembers.forEach(m => { balanceMap[m.user_id] = { totalPaid: 0, totalOwed: 0 } })

    pendingTx.forEach((tx: any) => {
      if (balanceMap[tx.paid_by]) balanceMap[tx.paid_by].totalPaid += tx.amount
      tx.splits?.forEach((s: any) => {
        if (balanceMap[s.user_id]) balanceMap[s.user_id].totalOwed += s.amount
      })
    })

    const memberBalances = currentMembers.map((m, i) => ({
      user_id: m.user_id,
      label: m.user_id === uid ? 'Bạn' : (currentUserNames[m.user_id] ?? `Thành viên ${i + 1}`),
      totalPaid: balanceMap[m.user_id]?.totalPaid ?? 0,
      totalOwed: balanceMap[m.user_id]?.totalOwed ?? 0,
      net: (balanceMap[m.user_id]?.totalPaid ?? 0) - (balanceMap[m.user_id]?.totalOwed ?? 0),
    }))
    setBalances(memberBalances)

    const debtors = memberBalances.filter(b => b.net < 0).map(b => ({ ...b, remaining: -b.net }))
    const creditors = memberBalances.filter(b => b.net > 0).map(b => ({ ...b, remaining: b.net }))
    const settleList: any[] = []

    let i = 0, j = 0
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i].remaining, creditors[j].remaining)
      if (amount > 1) settleList.push({ from: debtors[i].label, to: creditors[j].label, amount })
      debtors[i].remaining -= amount
      creditors[j].remaining -= amount
      if (debtors[i].remaining < 1) i++
      if (creditors[j].remaining < 1) j++
    }
    setSettlements(settleList)
    setSettleLoaded(true)
    setSettleLoading(false)
  }, [roomId])

  // ── Tab change ─────────────────────────────────────────────────────────────
  function handleTabChange(newTab: 'transactions' | 'members' | 'settle') {
    setTab(newTab)
    if (newTab === 'settle' && !settleLoaded) {
      loadSettleData(members, userNames, currentUserId)
    }
  }

  // ── Member actions ─────────────────────────────────────────────────────────
  async function addMember() {
    if (!addUsername.trim()) return
    setAddingMember(true); setAddError('')
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

  // ── Delete transaction ─────────────────────────────────────────────────────
  function confirmDelete(id: string) { setDeleteConfirmId(id) }

  async function deleteTransaction() {
    if (!deleteConfirmId) return
    const id = deleteConfirmId
    setDeleteConfirmId(null)
    await supabase.from('transactions').delete().eq('id', id)
    const newTotal = totalCount - 1
    const maxPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE))
    const targetPage = page > maxPage ? maxPage : page
    await fetchPage(targetPage, filterType, filterPaidBy, sortField, sortOrder)
  }

  // ── Settle ─────────────────────────────────────────────────────────────────
  function promptSettle() { setShowSettleConfirm(true) }

  async function handleSettle() {
    setShowSettleConfirm(false)
    setSettleLoading(true)

    const { data: allPendingTx } = await supabase
      .from('transactions')
      .select('id, date, amount')
      .eq('room_id', roomId)
      .is('settlement_id', null)

    const pendingTx = (allPendingTx as any[]) ?? []
    if (pendingTx.length === 0) { setSettleLoading(false); return }

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
      const allDates = pendingTx.map((t: any) => new Date(t.date).getTime())
      minDate = format(new Date(Math.min(...allDates)), 'yyyy-MM-dd')
    }

    const maxDate = format(new Date(), 'yyyy-MM-dd')
    const totalAmount = pendingTx.reduce((sum: number, t: any) => sum + t.amount, 0)

    const { data: newSettlement, error: sErr } = await supabase.from('settlements').insert({
      room_id: roomId,
      start_date: minDate,
      end_date: maxDate,
      total_amount: totalAmount
    }).select().single()

    if (sErr || !newSettlement) {
      setAlertMessage('Lỗi tạo đợt chốt: ' + (sErr?.message || 'Hãy thử load lại trang.'))
      setSettleLoading(false)
      return
    }

    await supabase.from('transactions').update({
      settlement_id: newSettlement.id
    }).in('id', pendingTx.map((t: any) => t.id))

    await load()
    setTab('transactions')
    setSettleLoading(false)
  }

  const isOwner = room?.owner_id === currentUserId
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  if (loading) {
    return <LoadingSpinner message="Đang tải phòng..." fullscreen />
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-indigo-600 px-4 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/rooms?mode=list" className="text-indigo-200 hover:text-white">
            <ArrowLeft size={22} />
          </Link>
          <h1 className="text-white font-bold text-lg flex-1 truncate">{room?.name}</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => handleTabChange('members')}
              className={`p-2 rounded-full transition-colors ${tab === 'members' ? 'bg-white text-indigo-600' : 'bg-white/20 text-white'}`}>
              <Users size={18} />
            </button>
            <Link href={`/rooms/${roomId}/report`}
              className="flex items-center gap-1 bg-white/20 text-white px-3 py-1.5 rounded-full text-xs font-medium">
              <BarChart2 size={14} />
              Report
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/20 rounded-xl p-1">
          {(['transactions', 'settle'] as const).map(t => (
            <button key={t} onClick={() => handleTabChange(t)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-indigo-600' : 'text-white'}`}>
              {t === 'transactions' ? '💸 Hoạt động' : '🤝 Thanh toán'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {/* TRANSACTIONS TAB */}
        {tab === 'transactions' && (
          <>
            {/* Filter bar */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {/* Type pills */}
              {(['all', 'shared', 'personal'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => handleFilterType(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    filterType === t
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {t === 'all' ? 'Tất cả' : t === 'shared' ? '🔵 Chung' : '🟠 Cá nhân'}
                </button>
              ))}

              {/* Paid-by dropdown */}
              <select
                value={filterPaidBy}
                onChange={e => handleFilterPaidBy(e.target.value)}
                className={`ml-auto pl-2.5 pr-6 py-1 rounded-full text-xs border bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors ${
                  filterPaidBy !== 'all' ? 'border-indigo-400 text-indigo-600' : 'border-gray-200 text-gray-500'
                }`}
              >
                <option value="all">👤 Tất cả</option>
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user_id === currentUserId ? 'Bạn' : (userNames[m.user_id] ?? m.user_id.slice(0, 8))}
                  </option>
                ))}
              </select>

              {/* Sort buttons */}
              <div className="flex gap-1">
                {/* Sort by date */}
                <button
                  onClick={() => handleSort('date')}
                  title="Sắp xếp theo ngày"
                  className={`flex items-center gap-0.5 px-2 h-7 rounded-lg border text-xs font-medium transition-colors ${
                    sortField === 'date'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  📅
                  {sortField === 'date'
                    ? (sortOrder === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />)
                    : <ArrowDown size={11} className="opacity-40" />}
                </button>

                {/* Sort by amount */}
                <button
                  onClick={() => handleSort('amount')}
                  title="Sắp xếp theo số tiền"
                  className={`flex items-center gap-0.5 px-2 h-7 rounded-lg border text-xs font-medium transition-colors ${
                    sortField === 'amount'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  💰
                  {sortField === 'amount'
                    ? (sortOrder === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />)
                    : <ArrowDown size={11} className="opacity-40" />}
                </button>
              </div>
            </div>

            {pageLoading ? (
              <LoadingSpinner message="Đang tải giao dịch..." size="sm" />
            ) : transactions.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-sm">Không có giao dịch nào khớp bộ lọc</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => (
                  <div key={tx.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            tx.type === 'shared' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-5 pt-4 border-t border-gray-100">
                {/* Prev */}
                <button
                  onClick={() => loadPage(page - 1)}
                  disabled={page <= 1 || pageLoading}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 bg-white border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 hover:border-indigo-300 transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>

                {/* Page numbers with ellipsis */}
                {(() => {
                  const pages: (number | '...')[] = []
                  if (totalPages <= 7) {
                    for (let p = 1; p <= totalPages; p++) pages.push(p)
                  } else {
                    pages.push(1)
                    if (page > 3) pages.push('...')
                    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) pages.push(p)
                    if (page < totalPages - 2) pages.push('...')
                    pages.push(totalPages)
                  }
                  return pages.map((p, i) =>
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => loadPage(p)}
                        disabled={pageLoading}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                          p === page
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )
                })()}

                {/* Next */}
                <button
                  onClick={() => loadPage(page + 1)}
                  disabled={page >= totalPages || pageLoading}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 bg-white border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 hover:border-indigo-300 transition-colors"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}

        {/* MEMBERS TAB */}
        {tab === 'members' && (
          <>
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
            {settleLoading ? (
            <LoadingSpinner message="Đang tính toán..." size="sm" />
            ) : (
              <>
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
                    ✅ Chốt sổ (Đã thanh toán xong)
                  </button>
                )}
              </>
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

      {/* Modals */}
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
