'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ArrowLeft, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'

type MemberBalance = {
  user_id: string
  label: string
  totalPaid: number   // total they paid out
  totalOwed: number   // total they should have paid (sum of their splits)
  net: number         // totalPaid - totalOwed: positive = others owe them
}

type Settlement = {
  from: string
  to: string
  amount: number
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'
}

export default function ReportPage() {
  const router = useRouter()
  const { roomId } = useParams<{ roomId: string }>()

  const [balances, setBalances] = useState<MemberBalance[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [totalExpense, setTotalExpense] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(0)
  const [currentUserId, setCurrentUserId] = useState('')
  const [roomName, setRoomName] = useState('')

  const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), i))

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    setCurrentUserId(user.id)

    const target = months[selectedMonth]
    const start = format(startOfMonth(target), 'yyyy-MM-dd')
    const end = format(endOfMonth(target), 'yyyy-MM-dd')

    const [{ data: roomData }, { data: txData }, { data: memberData }] = await Promise.all([
      supabase.from('rooms').select('name').eq('id', roomId).single(),
      supabase.from('transactions')
        .select('*, splits:transaction_splits(*)')
        .eq('room_id', roomId)
        .gte('date', start)
        .lte('date', end),
      supabase.from('room_members').select('*').eq('room_id', roomId),
    ])

    if (roomData) setRoomName(roomData.name)

    const members = memberData ?? []
    const txList = txData ?? []

    // Calculate balances
    const balanceMap: Record<string, { totalPaid: number; totalOwed: number }> = {}
    members.forEach(m => { balanceMap[m.user_id] = { totalPaid: 0, totalOwed: 0 } })

    let total = 0
    txList.forEach((tx: any) => {
      total += tx.amount
      // person who paid
      if (balanceMap[tx.paid_by]) balanceMap[tx.paid_by].totalPaid += tx.amount
      // splits
      tx.splits?.forEach((s: any) => {
        if (balanceMap[s.user_id]) balanceMap[s.user_id].totalOwed += s.amount
      })
    })

    setTotalExpense(total)

    const memberBalances: MemberBalance[] = members.map((m, i) => ({
      user_id: m.user_id,
      label: m.user_id === user.id ? 'Bạn' : `Thành viên ${i + 1}`,
      totalPaid: balanceMap[m.user_id]?.totalPaid ?? 0,
      totalOwed: balanceMap[m.user_id]?.totalOwed ?? 0,
      net: (balanceMap[m.user_id]?.totalPaid ?? 0) - (balanceMap[m.user_id]?.totalOwed ?? 0),
    }))

    setBalances(memberBalances)

    // Calculate settlements (who pays whom)
    const debtors = memberBalances.filter(b => b.net < 0).map(b => ({ ...b, remaining: -b.net }))
    const creditors = memberBalances.filter(b => b.net > 0).map(b => ({ ...b, remaining: b.net }))
    const settleList: Settlement[] = []

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
  }, [roomId, selectedMonth, router])

  useEffect(() => { load() }, [load])

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-indigo-600 px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <Link href={`/rooms/${roomId}`} className="text-indigo-200 hover:text-white">
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg">Report</h1>
            <p className="text-indigo-200 text-xs">{roomName}</p>
          </div>
        </div>

        {/* Month selector */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {months.map((m, i) => (
            <button key={i} onClick={() => setSelectedMonth(i)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedMonth === i ? 'bg-white text-indigo-600' : 'bg-white/20 text-white'
              }`}>
              {format(m, 'MM/yyyy')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-8 space-y-3">
          {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />)}
        </div>
      ) : (
        <div className="px-4 py-5 space-y-4">
          {/* Total */}
          <div className="bg-indigo-600 rounded-2xl p-4 text-white">
            <p className="text-indigo-200 text-xs mb-1">Tổng chi tháng này</p>
            <p className="text-2xl font-bold">{formatMoney(totalExpense)}</p>
          </div>

          {/* Per person balance */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Chi tiết từng người</h3>
            <div className="space-y-3">
              {balances.map(b => (
                <div key={b.user_id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{b.label}</p>
                    <p className="text-xs text-gray-400">
                      Đã trả: {formatMoney(b.totalPaid)} · Phần phải trả: {formatMoney(b.totalOwed)}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 font-bold text-sm ${b.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {b.net >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {b.net >= 0 ? '+' : ''}{formatMoney(b.net)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Settlements */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Cần thanh toán</h3>
            {settlements.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                {totalExpense === 0 ? 'Chưa có giao dịch nào' : '✅ Mọi người đã cân bằng!'}
              </p>
            ) : (
              <div className="space-y-2">
                {settlements.map((s, i) => (
                  <div key={i} className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
                    s.from === 'Bạn' ? 'bg-red-50 border border-red-100' : 'bg-gray-50'
                  }`}>
                    <span className={`font-medium ${s.from === 'Bạn' ? 'text-red-700' : 'text-gray-700'}`}>
                      {s.from}
                    </span>
                    <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                    <span className={`font-medium ${s.to === 'Bạn' ? 'text-green-700' : 'text-gray-700'}`}>
                      {s.to}
                    </span>
                    <span className="ml-auto font-bold text-gray-900">{formatMoney(s.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
