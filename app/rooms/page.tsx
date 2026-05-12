'use client'

import { useEffect, useState, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Room } from '@/lib/supabase'
import { Plus, LogOut, Home, BookOpen, ChevronRight, Settings, X, Check, Camera, Pencil } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { getContrastColors } from '@/lib/theme'
import GlobalProfileHeader from '@/components/GlobalProfileHeader'
import ProfileSettingsModal from '@/components/ProfileSettingsModal'

function RoomsList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [dashboardTheme, setDashboardTheme] = useState('#6c7ee1')
  const [personalTheme, setPersonalTheme] = useState('#059669')
  const [roomThemes, setRoomThemes] = useState<Record<string, string>>({})
  const [showSettings, setShowSettings] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [editRoomName, setEditRoomName] = useState('')
  const [savingRoom, setSavingRoom] = useState(false)
  const [personalName, setPersonalName] = useState('Sổ cá nhân')
  const [showEditPersonalName, setShowEditPersonalName] = useState(false)
  const [editPersonalNameValue, setEditPersonalNameValue] = useState('')

  useEffect(() => {
    const savedDash = localStorage.getItem('spendly_dashboard_theme')
    if (savedDash) setDashboardTheme(savedDash)
    const savedTheme = localStorage.getItem('spendly_personal_theme')
    if (savedTheme) setPersonalTheme(savedTheme)
    const savedName = localStorage.getItem('spendly_personal_name')
    if (savedName) setPersonalName(savedName)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setCurrentUserId(user.id)

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

  function openEditRoom(e: React.MouseEvent, room: Room) {
    e.preventDefault()
    e.stopPropagation()
    setEditingRoomId(room.id)
    setEditRoomName(room.name)
  }

  async function saveRoomName() {
    if (!editRoomName.trim() || !editingRoomId) return
    setSavingRoom(true)
    const { error } = await supabase
      .from('rooms')
      .update({ name: editRoomName.trim() })
      .eq('id', editingRoomId)
    
    if (!error) {
      setRooms(prev => prev.map(r => r.id === editingRoomId ? { ...r, name: editRoomName.trim() } : r))
      setEditingRoomId(null)
      setEditRoomName('')
    }
    setSavingRoom(false)
  }

  function savePersonalName() {
    const trimmed = editPersonalNameValue.trim() || 'Sổ cá nhân'
    setPersonalName(trimmed)
    localStorage.setItem('spendly_personal_name', trimmed)
    setShowEditPersonalName(false)
  }

  function handleThemeChange(color: string) {
    setDashboardTheme(color)
    localStorage.setItem('spendly_dashboard_theme', color)
  }

  async function logout() {
    localStorage.removeItem('spendly_saved_credentials')
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="px-4 pt-6 pb-4" style={{ backgroundColor: dashboardTheme, transition: 'background-color 0.3s' }}>
        <GlobalProfileHeader textColor="#ffffff" />
        <div className="flex items-center justify-between">
          <Image
            src="/spendly_logo.svg"
            alt="Spendly"
            width={200}
            height={42}
            priority
          />
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSettings(true)} className="text-indigo-200 hover:text-white transition-colors">
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
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 mb-3" style={{ outlineColor: dashboardTheme }}
            />
            <div className="flex gap-2">
              <button onClick={createRoom} disabled={creating}
                className="flex-1 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50" style={{ backgroundColor: dashboardTheme }}>
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
            className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-2xl font-medium text-sm mb-4 transition-colors" style={{ backgroundColor: dashboardTheme }}>
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
                <p className="font-semibold text-sm" style={{ color: cc.text }}>{personalName}</p>
                <p className="text-xs" style={{ color: cc.muted }}>Ghi chép chi tiêu của bạn</p>
              </div>
              <div className="flex items-center">
                <button onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setEditPersonalNameValue(personalName)
                  setShowEditPersonalName(true)
                }} className="pr-2 opacity-60 hover:opacity-100 transition-opacity" style={{ color: cc.text }}>
                  <Pencil size={16} />
                </button>
              </div>
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
                  <div className="flex items-center justify-between">
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
                    {room.owner_id === currentUserId && (
                      <button onClick={(e) => openEditRoom(e, room)} className="p-2 text-gray-300 hover:text-indigo-500 transition-colors" title="Đổi tên phòng">
                        <Pencil size={16} />
                      </button>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <ProfileSettingsModal 
          onClose={() => setShowSettings(false)} 
          themeColor={dashboardTheme} 
          currentTheme={dashboardTheme}
          onChangeTheme={handleThemeChange}
        />
      )}

      {/* Edit Room Modal */}
      {editingRoomId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setEditingRoomId(null) }}>
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Sửa tên phòng</h3>
              <button onClick={() => setEditingRoomId(null)} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên phòng mới</label>
                <input type="text" value={editRoomName} onChange={e => setEditRoomName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveRoomName()}
                  autoFocus
                  placeholder="Ví dụ: Phòng 101..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <button onClick={saveRoomName} disabled={savingRoom}
                className="w-full py-3.5 rounded-xl font-semibold transition-colors disabled:opacity-50 text-white"
                style={{ backgroundColor: dashboardTheme }}>
                {savingRoom ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Personal Name Modal */}
      {showEditPersonalName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowEditPersonalName(false) }}>
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Đổi tên Sổ cá nhân</h3>
              <button onClick={() => setShowEditPersonalName(false)} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên sổ mới</label>
                <input type="text" value={editPersonalNameValue} onChange={e => setEditPersonalNameValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && savePersonalName()}
                  autoFocus
                  placeholder="Ví dụ: Ví của tôi, Quỹ đen..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <button onClick={savePersonalName}
                className="w-full py-3.5 rounded-xl font-semibold transition-colors text-white"
                style={{ backgroundColor: dashboardTheme }}>
                Lưu
              </button>
            </div>
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
