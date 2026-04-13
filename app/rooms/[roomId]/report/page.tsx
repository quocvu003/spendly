'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Settlement, type Transaction } from '@/lib/supabase'
import { format } from 'date-fns'
import { ArrowLeft, History, FileText, ChevronRight, Calculator, User } from 'lucide-react'

function formatMoney(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'
}

export default function ReportPage() {
  const router = useRouter()
  const { roomId } = useParams<{ roomId: string }>()

  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [roomName, setRoomName] = useState('')
  const [userNames, setUserNames] = useState<Record<string, string>>({})
  
  // Detail view states
  const [selectedSettle, setSelectedSettle] = useState<Settlement | null>(null)
  const [detailTransactions, setDetailTransactions] = useState<Transaction[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const [{ data: roomData }, { data: settleData }] = await Promise.all([
      supabase.from('rooms').select('name').eq('id', roomId).single(),
      supabase.from('settlements').select('*').eq('room_id', roomId).order('created_at', { ascending: false }),
    ])

    if (roomData) setRoomName(roomData.name)
    if (settleData) setSettlements(settleData as Settlement[])

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

  const viewDetail = async (settle: Settlement) => {
    setSelectedSettle(settle)
    setDetailLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, splits:transaction_splits(*)')
      .eq('settlement_id', settle.id)
      .order('date', { ascending: false })
    
    setDetailTransactions((data as any) || [])
    setDetailLoading(false)
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-indigo-600 px-4 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-2">
          {selectedSettle ? (
            <button onClick={() => setSelectedSettle(null)} className="text-indigo-200 hover:text-white">
              <ArrowLeft size={22} />
            </button>
          ) : (
            <Link href={`/rooms/${roomId}`} className="text-indigo-200 hover:text-white">
              <ArrowLeft size={22} />
            </Link>
          )}
          <div>
            <h1 className="text-white font-bold text-lg">
              {selectedSettle ? 'Chi tiết đợt chốt' : 'Lịch sử Báo cáo'}
            </h1>
            <p className="text-indigo-200 text-xs">{roomName}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-8 space-y-3">
          {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />)}
        </div>
      ) : selectedSettle ? (
        // DETAIL VIEW
        <div className="px-4 py-5 animate-in slide-in-from-right duration-300">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <Calculator size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Tổng kết kỳ này</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {format(new Date(selectedSettle.start_date), 'dd/MM')} - {format(new Date(selectedSettle.end_date), 'dd/MM/yyyy')}
            </h2>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
              <span className="text-gray-500 text-sm">Tổng chi tiêu:</span>
              <span className="text-2xl font-black text-indigo-600">{formatMoney(selectedSettle.total_amount)}</span>
            </div>
          </div>

          <h3 className="text-sm font-bold text-gray-400 mb-3 px-1 uppercase tracking-widest">Danh sách hóa đơn</h3>
          
          {detailLoading ? (
             <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {detailTransactions.map(tx => (
                <div key={tx.id} className="bg-white rounded-2xl p-4 border border-gray-50 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{tx.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                         <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">
                          {format(new Date(tx.date), 'dd/MM')}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <User size={10} /> {userNames[tx.paid_by] || 'Member'}
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-indigo-600 italic">{formatMoney(tx.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // LIST VIEW
        <div className="px-4 py-5 space-y-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <History size={18} className="text-gray-500" />
            <h2 className="text-gray-700 font-medium text-sm">Các đợt đã thanh toán</h2>
          </div>

          {settlements.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
              <FileText size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Chưa có lịch sử chốt sổ nào.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map(s => (
                <button 
                  key={s.id} 
                  onClick={() => viewDetail(s)}
                  className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:border-indigo-200 transition-all active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      Đã hoàn tất
                    </span>
                    <span className="text-xs text-gray-400">
                      {format(new Date(s.created_at), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">
                        Kỳ {format(new Date(s.start_date), 'dd/MM')} - {format(new Date(s.end_date), 'dd/MM')}
                      </h3>
                      <p className="text-xs text-gray-400">Xem chi tiết các hóa đơn</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-600">{formatMoney(s.total_amount)}</span>
                      <ChevronRight size={16} className="text-gray-300" />
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
