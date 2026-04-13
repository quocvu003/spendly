'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Settlement } from '@/lib/supabase'
import { format } from 'date-fns'
import { ArrowLeft, History, FileText } from 'lucide-react'

function formatMoney(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'
}

export default function ReportPage() {
  const router = useRouter()
  const { roomId } = useParams<{ roomId: string }>()

  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [roomName, setRoomName] = useState('')

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

    setLoading(false)
  }, [roomId, router])

  useEffect(() => { load() }, [load])

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-indigo-600 px-4 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <Link href={`/rooms/${roomId}`} className="text-indigo-200 hover:text-white">
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg">Lịch sử Chốt sổ (Report)</h1>
            <p className="text-indigo-200 text-xs">{roomName}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-8 space-y-3">
          {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />)}
        </div>
      ) : (
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
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                      Đã hoàn tất
                    </span>
                    <span className="text-xs text-gray-400">
                      Chốt ngày: {format(new Date(s.created_at), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  
                  <h3 className="font-medium text-gray-900 text-sm mb-1 mt-3">
                    Kỳ từ {format(new Date(s.start_date), 'dd/MM')} đến {format(new Date(s.end_date), 'dd/MM')}
                  </h3>
                  
                  <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-50">
                    <span className="text-sm text-gray-500">Tổng chi:</span>
                    <span className="font-bold text-lg text-indigo-600">{formatMoney(s.total_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
