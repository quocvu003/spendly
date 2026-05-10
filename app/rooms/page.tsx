'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Room } from '@/lib/supabase'
import { Plus, LogOut, Home } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'

function RoomsList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      // fetch rooms where user is a member
      const { data: memberOf } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('user_id', user.id)

      const roomIds = (memberOf ?? []).map(m => m.room_id)

      const { data } = roomIds.length > 0
        ? await supabase
          .from('rooms')
          .select('*')
          .in('id', roomIds)
          .order('created_at', { ascending: false })
        : { data: [] }

      const roomsData = (data as Room[]) ?? []
      
      // If there's only one room and we are not in 'list' mode, redirect to it automatically
      if (roomsData.length === 1 && mode !== 'list') {
        router.replace(`/rooms/${roomsData[0].id}`)
        return
      }

      setRooms(roomsData)
      setLoading(false)
    }
    load()
  }, [router, mode])

  async function createRoom() {
    if (!roomName.trim()) return
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('rooms')
      .insert({ name: roomName.trim(), owner_id: user!.id })
      .select()
      .single()

    if (!error && data) {
      setRooms(prev => [data, ...prev])
      setRoomName('')
      setShowCreate(false)
    }
    setCreating(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-indigo-600 px-4 pt-12 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-xl font-bold">Spendly</h1>
            <p className="text-indigo-200 text-sm">Các phòng của bạn</p>
          </div>
          <button onClick={logout} className="text-indigo-200 hover:text-white">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="px-4 py-5">
        {/* Create room */}
        {showCreate ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <p className="font-medium text-sm text-gray-900 mb-3">Tên phòng mới</p>
            <input
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createRoom()}
              placeholder="Ví dụ: Phòng 101..."
              autoFocus
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
            />
            <div className="flex gap-2">
              <button onClick={createRoom} disabled={creating}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                {creating ? 'Đang tạo...' : 'Tạo phòng'}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm font-medium">
                Huỷ
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-2xl font-medium text-sm mb-4 hover:bg-indigo-700 transition-colors">
            <Plus size={18} />
            Tạo phòng mới
          </button>
        )}

        {/* Room list */}
        {loading ? (
          <LoadingSpinner message="Đang tải phòng..." />
        ) : rooms.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Home size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Chưa có phòng nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map(room => (
              <Link key={room.id} href={`/rooms/${room.id}`}
                className="block bg-white rounded-2xl border border-gray-100 p-4 hover:border-indigo-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Home size={20} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{room.name}</p>
                    <p className="text-xs text-gray-400">Nhấn để xem chi tiết</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

export default function RoomsPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Đang tải Spendly..." fullscreen />}>
      <RoomsList />
    </Suspense>
  )
}
