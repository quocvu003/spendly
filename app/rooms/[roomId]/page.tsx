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
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'transactions' | 'members'>('transactions')
  const [addEmail, setAddEmail] = useState('')
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
    setTransactions((txData as Transaction[]) ?? [])
    setMembers((memberData as RoomMember[]) ?? [])
    setLoading(false)
  }, [roomId, router])

  useEffect(() => { load() }, [load])

  async function addMember() {
    if (!addEmail.trim()) return
    setAddingMember(true); setAddError('')

    // Look up user by email using auth admin — we use a workaround:
    // Try to find user in room_members of any room (not ideal but works without admin key)
    // Better: use a Supabase function. For now we use signInWithOtp trick — actually
    // we'll just store email directly and match on login.
    // Simplest approach: call our own API route
    const res = await fetch('/api/add-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, email: addEmail.trim() }),
    })
    const json = await res.json()
    if (!res.ok) { setAddError(json.error ?? 'Không tìm thấy user'); setAddingMember(false); return }

    setAddEmail('')
    await load()
    setAddingMember(false)
  }

  async function removeMember(memberId: string, userId: string) {
    if (userId === currentUserId) return
    await supabase.from('room_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  async function deleteTransaction(id: string) {
    if (!confirm('Xoá giao dịch này?')) return
    await supabase.from('transactions').delete().eq('id', id)
    setTransactions(prev => prev.filter(t => t.id !== id))
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
          {(['transactions', 'members'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-indigo-600' : 'text-white'}`}>
              {t === 'transactions' ? '💸 Giao dịch' : '👥 Thành viên'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {/* TRANSACTIONS TAB */}
        {tab === 'transactions' && (
          <>
            {transactions.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-sm">Chưa có giao dịch nào</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => (
                  <div key={tx.id} className="bg-white rounded-2xl border border-gray-100 p-4">
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
                        <p className="font-medium text-gray-900 text-sm">{tx.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Người trả: {tx.paid_by === currentUserId ? 'Bạn' : tx.paid_by.slice(0, 8) + '...'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <span className="font-bold text-gray-900 text-sm">{formatMoney(tx.amount)}</span>
                        {tx.paid_by === currentUserId && (
                          <button onClick={() => deleteTransaction(tx.id)} className="text-gray-300 hover:text-red-400">
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
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addMember()}
                  placeholder="Email thành viên..."
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
                        {m.user_id === currentUserId ? 'Bạn' : m.user_id.slice(0, 12) + '...'}
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
      </div>

      {/* FAB */}
      <Link href={`/rooms/${roomId}/transactions/new`}
        className="fixed bottom-6 right-4 bg-indigo-600 text-white rounded-full px-5 py-3 flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-colors">
        <Plus size={20} />
        <span className="font-medium text-sm">Thêm</span>
      </Link>
    </main>
  )
}
