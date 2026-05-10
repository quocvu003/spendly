'use client'

import { useEffect, useState, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Room } from '@/lib/supabase'
import { Plus, LogOut, Home, BookOpen, ChevronRight, Settings, X, Check, Camera } from 'lucide-react'
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
  const [showSettings, setShowSettings] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

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

  async function openSettings() {
    const savedAvatar = localStorage.getItem('spendly_avatar') || ''
    setEditAvatar(savedAvatar)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).single()
      setEditDisplayName((data as any)?.display_name || '')
      if ((data as any)?.avatar_url) {
        setEditAvatar((data as any).avatar_url)
      }
    }
    setShowSettings(true)
  }

  async function saveProfile() {
    setSavingProfile(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase.from('profiles').update({ 
        display_name: editDisplayName.trim() || null,
        avatar_url: editAvatar || null
      }).eq('id', user.id)
      if (error) console.error('Save profile error:', error)
      if (editAvatar) {
        localStorage.setItem('spendly_avatar', editAvatar)
      } else {
        localStorage.removeItem('spendly_avatar')
      }
    }
    setSavingProfile(false)
    setShowSettings(false)
  }

  async function logout() {
    localStorage.removeItem('spendly_saved_credentials')
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="px-4 pt-4 pb-4" style={{ backgroundColor: '#6c7ee1' }}>
        <div className="flex items-center justify-between">
          <Image
            src="/spendly_logo.svg"
            alt="Spendly"
            width={200}
            height={42}
            priority
          />
          <div className="flex items-center gap-3">
            <button onClick={openSettings} className="text-indigo-200 hover:text-white transition-colors">
              <Settings size={20} />
            </button>
            <button onClick={logout} className="text-indigo-200 hover:text-white transition-colors">
              <LogOut size={20} />
            </button>
          </div>
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
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 mb-3" style={{ outlineColor: '#6c7ee1' }}
            />
            <div className="flex gap-2">
              <button onClick={createRoom} disabled={creating}
                className="flex-1 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50" style={{ backgroundColor: '#6c7ee1' }}>
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
            className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-2xl font-medium text-sm mb-4 transition-colors" style={{ backgroundColor: '#6c7ee1' }}>
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
              )
            })}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-md bg-white rounded-3xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-gray-900">Hồ sơ của bạn</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Avatar */}
            <div className="flex flex-col items-center mb-6">
              <label className="relative cursor-pointer group">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-200" style={{ transition: 'border-color 0.2s' }}>
                  {editAvatar ? (
                    <img src={editAvatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={24} className="text-gray-300" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#6c7ee1' }}>
                  <Camera size={12} className="text-white" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = ev => setEditAvatar(ev.target?.result as string)
                      reader.readAsDataURL(file)
                    }
                  }}
                />
              </label>
              {editAvatar && (
                <button onClick={() => setEditAvatar('')} className="text-xs text-red-400 mt-2 hover:text-red-600">
                  Xóa ảnh
                </button>
              )}
            </div>

            {/* Display Name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tên hiển thị</label>
              <input
                value={editDisplayName}
                onChange={e => setEditDisplayName(e.target.value)}
                placeholder="Tên của bạn..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2"
                style={{ outlineColor: '#6c7ee1' }}
                onKeyDown={e => e.key === 'Enter' && saveProfile()}
              />
              <p className="text-xs text-gray-400 mt-1">Tên này sẽ hiển thị trong báo cáo các phòng</p>
            </div>

            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="w-full text-white py-3 rounded-2xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#6c7ee1' }}
            >
              <Check size={16} />
              {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      )}
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
