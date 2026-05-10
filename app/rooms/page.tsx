'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Room } from '@/lib/supabase'
import { Plus, LogOut, Home, BookOpen, ChevronRight } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { getContrastColors } from '@/lib/theme'

function RoomsList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [personalTheme, setPersonalTheme] = useState('#059669')
  const [roomThemes, setRoomThemes] = useState<Record<string, string>>({})

  useEffect(() => {
    const saved = localStorage.getItem('spendly_personal_theme')
    if (saved) setPersonalTheme(saved)
  }, [])

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

      const themes: Record<string, string> = {}
      roomsData.forEach(r => {
        const saved = localStorage.getItem(`spendly_room_theme_${r.id}`)
        if (saved) themes[r.id] = saved
      })
      setRoomThemes(themes)

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
      <div className="bg-indigo-600 px-4 pt-6 pb-6">
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

        {/* Personal expense entry */}
        {(() => {
          const cc = getContrastColors(personalTheme)
          return (
            <Link href="/personal"
              className="flex items-center gap-3 rounded-2xl p-4 mb-4 transition-colors shadow-sm"
              style={{ backgroundColor: personalTheme }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cc.iconBg, color: cc.text }}>
                <BookOpen size={18} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: cc.text }}>Sổ cá nhân</p>
                <p className="text-xs" style={{ color: cc.muted }}>Ghi chép chi tiêu của bạn</p>
              </div>
              <ChevronRight size={18} style={{ color: cc.muted }} />
            </Link>
          )
        })()}

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
            {rooms.map(room => {
              const theme = roomThemes[room.id] || '#4f46e5'
              const cc = getContrastColors(theme)
              return (
              <Link key={room.id} href={`/rooms/${room.id}`}
                className="block bg-white rounded-2xl border border-gray-100 p-4 transition-colors"
                style={{ borderLeftColor: theme, borderLeftWidth: 4 }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: theme, color: cc.text }}>
                    <Home size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{room.name}</p>
                    <p className="text-xs text-gray-400">Nhấn để xem chi tiết</p>
                  </div>
                </div>
              </Link>
            )})}
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
