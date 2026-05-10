'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Settlement, type Transaction } from '@/lib/supabase'
import { format } from 'date-fns'
import { ArrowLeft, History, FileText, ChevronRight, Calculator, User, ArrowRight } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { getContrastColors } from '@/lib/theme'

function formatMoney(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'
}

export default function ReportPage() {
  const router = useRouter()
  const { roomId } = useParams<{ roomId: string }>()

  const [settlementsList, setSettlementsList] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [roomName, setRoomName] = useState('')
  const [userNames, setUserNames] = useState<Record<string, string>>({})
  const [themeColor, setThemeColor] = useState('#4f46e5')

  useEffect(() => {
    const saved = localStorage.getItem(`spendly_room_theme_${roomId}`)
    if (saved) setThemeColor(saved)
  }, [roomId])
  
  // Detail view states
  const [selectedSettle, setSelectedSettle] = useState<Settlement | null>(null)
  const [detailTransactions, setDetailTransactions] = useState<Transaction[]>([])
  const [detailBalances, setDetailBalances] = useState<any[]>([])
  const [detailPayments, setDetailPayments] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const [{ data: roomData }, { data: settleData }, { data: membersData }] = await Promise.all([
      supabase.from('rooms').select('name').eq('id', roomId).single(),
      supabase.from('settlements').select('*').eq('room_id', roomId).order('created_at', { ascending: false }),
      supabase.from('room_members').select('user_id').eq('room_id', roomId),
    ])

    if (roomData) setRoomName(roomData.name)
    if (settleData) setSettlementsList(settleData as Settlement[])

    // Fetch user names for mapping
    try {
      const res = await fetch(`/api/room-users?roomId=${roomId}`)
      if (res.ok) {
        const { userMap } = await res.json()
        if (userMap) setUserNames(userMap)
      }
    } catch (e) {
      console.error('Failed to load names', e)
    }

    setLoading(false)
  }, [roomId, router])

  useEffect(() => { load() }, [load])

  const calculateSettleDetails = (txList: Transaction[]) => {
    const balanceMap: Record<string, { totalPaid: number; totalOwed: number }> = {}
    
    // Initialize with all participants found in transactions
    const uniqueUserIds = new Set<string>()
    txList.forEach(tx => {
      uniqueUserIds.add(tx.paid_by)
      tx.splits?.forEach(s => uniqueUserIds.add(s.user_id))
    })

    uniqueUserIds.forEach(uid => {
      balanceMap[uid] = { totalPaid: 0, totalOwed: 0 }
    })

    txList.forEach(tx => {
      if (balanceMap[tx.paid_by]) balanceMap[tx.paid_by].totalPaid += tx.amount
      tx.splits?.forEach(s => {
        if (balanceMap[s.user_id]) balanceMap[s.user_id].totalOwed += s.amount
      })
    })

    const computedBalances = Array.from(uniqueUserIds).map((uid) => ({
      user_id: uid,
      label: userNames[uid] || uid.slice(0, 8),
      totalPaid: balanceMap[uid].totalPaid,
      totalOwed: balanceMap[uid].totalOwed,
      net: balanceMap[uid].totalPaid - balanceMap[uid].totalOwed,
    }))

    const debtors = computedBalances.filter(b => b.net < -1).map(b => ({ ...b, remaining: -b.net }))
    const creditors = computedBalances.filter(b => b.net > 1).map(b => ({ ...b, remaining: b.net }))
    const computePayments = []

    let i = 0, j = 0
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i].remaining, creditors[j].remaining)
      if (amount > 1) {
        computePayments.push({ from: debtors[i].label, to: creditors[j].label, amount })
      }
      debtors[i].remaining -= amount
      creditors[j].remaining -= amount
      if (debtors[i].remaining < 1) i++
      if (creditors[j].remaining < 1) j++
    }

    setDetailBalances(computedBalances)
    setDetailPayments(computePayments)
  }

  const viewDetail = async (settle: Settlement) => {
    setSelectedSettle(settle)
    setDetailLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, splits:transaction_splits(*)')
      .eq('settlement_id', settle.id)
      .order('date', { ascending: false })
    
    const txList = (data as any) || []
    setDetailTransactions(txList)
    calculateSettleDetails(txList)
    setDetailLoading(false)
  }

  const cc = getContrastColors(themeColor)

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="px-4 pt-5 pb-4" style={{ backgroundColor: themeColor }}>
        <div className="flex items-center gap-3 mb-2">
          {selectedSettle ? (
            <button onClick={() => setSelectedSettle(null)} style={{ color: cc.muted }}>
              <ArrowLeft size={22} />
            </button>
          ) : (
            <Link href={`/rooms/${roomId}`} style={{ color: cc.muted }}>
              <ArrowLeft size={22} />
            </Link>
          )}
          <div>
            <h1 className="font-bold text-lg" style={{ color: cc.text }}>
              {selectedSettle ? 'Kết quả kỳ chốt' : 'Lịch sử Báo báo'}
            </h1>
            <p className="text-xs" style={{ color: cc.muted }}>{roomName}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Đang tải báo cáo..." />
      ) : selectedSettle ? (
        // DETAIL VIEW
        <div className="px-4 py-5 animate-in slide-in-from-right duration-300">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
            <div className="flex items-center gap-2 text-indigo-600 mb-1.5">
              <Calculator size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Tổng chi tiêu kỳ này</span>
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1">
              {format(new Date(selectedSettle.start_date), 'dd/MM')} - {format(new Date(selectedSettle.end_date), 'dd/MM/yyyy')}
            </h2>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className="text-gray-500 text-sm">Tổng cộng:</span>
              <span className="text-xl font-black text-indigo-600">{formatMoney(selectedSettle.total_amount)}</span>
            </div>
          </div>

          {detailLoading ? (
            <LoadingSpinner message="Đang tính toán..." />
          ) : (
            <div className="space-y-6">
              {/* Payment Results */}
              <div className="bg-white rounded-3xl p-5 border border-indigo-50 shadow-sm shadow-indigo-100/50">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                   🌟 Kết quả chuyển tiền
                </h3>
                <div className="space-y-2">
                  {detailPayments.length === 0 ? (
                    <p className="text-sm text-center py-4 text-gray-400 font-medium">✅ Không ai nợ ai trong kỳ này!</p>
                  ) : (
                    detailPayments.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 rounded-2xl bg-gray-50 text-sm">
                        <span className="font-bold text-gray-700">{p.from}</span>
                        <ArrowRight size={14} className="text-gray-400" />
                        <span className="font-bold text-gray-700">{p.to}</span>
                        <span className="ml-auto font-black text-gray-900">{formatMoney(p.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Balances */}
              <div className="bg-indigo-900 text-white rounded-3xl p-5 shadow-lg">
                <h3 className="text-xs font-bold text-indigo-300 mb-4 uppercase tracking-widest">Biến động số dư</h3>
                <div className="space-y-3">
                  {detailBalances.map(b => (
                    <div key={b.user_id} className="flex items-center justify-between border-b border-white/10 pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-bold text-white mb-0.5">{b.label}</p>
                        <p className="text-[10px] text-indigo-300">Đã chi: {formatMoney(b.totalPaid)}</p>
                      </div>
                      <div className={`font-black text-sm px-3 py-1 rounded-full ${b.net >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {b.net >= 0 ? '+' : ''}{formatMoney(b.net)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transactions List */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 mb-3 px-1 uppercase tracking-widest">Chi tiết hóa đơn</h3>
                <div className="space-y-2">
                  {detailTransactions.map(tx => (
                    <div key={tx.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 text-sm mb-1">{tx.description}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">
                              {format(new Date(tx.date), 'dd/MM')}
                            </span>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <User size={10} /> {userNames[tx.paid_by] || 'Member'}
                            </span>
                          </div>
                        </div>
                        <span className="font-bold text-indigo-600 ml-3">{formatMoney(tx.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // LIST VIEW
        <div className="px-4 py-5 space-y-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <History size={18} className="text-gray-500" />
            <h2 className="text-gray-700 font-medium text-sm">Các kỳ đã hoàn thành</h2>
          </div>

          {settlementsList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
              <FileText size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Chưa có lịch sử chốt sổ nào.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settlementsList.map(s => (
                <button 
                  key={s.id} 
                  onClick={() => viewDetail(s)}
                  className="w-full text-left bg-white rounded-3xl border border-gray-100 p-5 shadow-sm hover:border-indigo-300 transition-all active:scale-[0.98] group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      Thành công
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">
                      {format(new Date(s.created_at), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-gray-900 text-base">
                        Kỳ {format(new Date(s.start_date), 'dd/MM')} - {format(new Date(s.end_date), 'dd/MM')}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">Bấm để xem ai nợ ai kỳ này</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-indigo-600 text-lg">{formatMoney(s.total_amount)}</span>
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        <ChevronRight size={18} />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
