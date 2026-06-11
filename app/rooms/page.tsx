'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Room } from '@/lib/supabase'
import {
  Plus, LogOut, Home, BookOpen, ChevronRight, Settings, X, Pencil,
  Menu, ArrowRightCircle, BarChart2, Wallet, Users,
} from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { getContrastColors } from '@/lib/theme'
import GlobalProfileHeader from '@/components/GlobalProfileHeader'
import ProfileSettingsModal from '@/components/ProfileSettingsModal'
import { motion, AnimatePresence } from 'framer-motion'

const NAV_LINKS = ['Tổng quan', 'Phòng chi tiêu', 'Cá nhân', 'Báo cáo', 'Trợ giúp']

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] as any } },
})

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

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

      const { data: profile } = await supabase
        .from('profiles').select('display_name').eq('id', user.id).single()
      setDisplayName(profile?.display_name || user.email?.split('@')[0] || 'bạn')

      const { data: memberOf } = await supabase
        .from('room_members').select('room_id').eq('user_id', user.id)
      const roomIds = (memberOf ?? []).map(m => m.room_id)

      const { data } = roomIds.length > 0
        ? await supabase.from('rooms').select('*').in('id', roomIds).order('created_at', { ascending: false })
        : { data: [] }

      const roomsData = (data as Room[]) ?? []
      if (roomsData.length === 1 && mode !== 'list') {
        router.replace(`/rooms/${roomsData[0].id}`); return
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
      .from('rooms').insert({ name: roomName.trim(), owner_id: user!.id }).select().single()
    if (!error && data) { setRooms(prev => [data, ...prev]); setRoomName(''); setShowCreate(false) }
    setCreating(false)
  }

  function openEditRoom(e: React.MouseEvent, room: Room) {
    e.preventDefault(); e.stopPropagation()
    setEditingRoomId(room.id); setEditRoomName(room.name)
  }

  async function saveRoomName() {
    if (!editRoomName.trim() || !editingRoomId) return
    setSavingRoom(true)
    const { error } = await supabase.from('rooms').update({ name: editRoomName.trim() }).eq('id', editingRoomId)
    if (!error) {
      setRooms(prev => prev.map(r => r.id === editingRoomId ? { ...r, name: editRoomName.trim() } : r))
      setEditingRoomId(null); setEditRoomName('')
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

  const cc = getContrastColors(dashboardTheme)

  return (
    <div className="min-h-screen bg-[#F2F2EE]" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── HERO SECTION ─────────────────────────────────────── */}
      <div className="relative w-full min-h-screen overflow-hidden">
        {/* Video background */}
        <video
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260518_003132_8b7edcb6-c64d-4a52-a9ca-879942e122ad.mp4"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-[#F2F2EE]" />

        {/* ── NAVBAR ───────────────────────────────────────────── */}
        <nav className="relative z-10 w-full">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 sm:py-5 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <Image src="/spendly_logo.svg" alt="Spendly" width={130} height={28} priority />
            </div>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-7">
              {NAV_LINKS.map(link => (
                <button key={link} className="text-sm font-medium text-white/90 hover:text-white transition-opacity">
                  {link}
                </button>
              ))}
            </div>

            {/* Desktop right buttons */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#7342E2] text-white hover:brightness-110 transition-all"
              >
                Cài đặt
              </button>
              <button
                onClick={logout}
                className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#F2F2EE] text-[#192837] hover:bg-white transition-all"
              >
                Đăng xuất
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-white"
            >
              <Menu size={24} />
            </button>
          </div>
        </nav>

        {/* ── HERO CONTENT ─────────────────────────────────────── */}
        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8" style={{ paddingTop: 'clamp(40px, 8vw, 72px)' }}>
          <div style={{ maxWidth: 620 }}>
            <motion.p
              variants={fadeUp(0)} initial="hidden" animate="visible"
              className="text-white/70 text-sm font-medium mb-2 tracking-wide uppercase"
            >
              Chào mừng trở lại
            </motion.p>

            <motion.h1
              variants={fadeUp(0.1)} initial="hidden" animate="visible"
              className="font-black text-white leading-[1.05] tracking-tight"
              style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontFamily: 'Inter, sans-serif', fontWeight: 900, marginBottom: '6px' }}
            >
              {displayName ? <>{displayName} <span className="text-white/40">👋</span></> : 'Bảng điều khiển'}
            </motion.h1>

            <motion.p
              variants={fadeUp(0.18)} initial="hidden" animate="visible"
              className="text-white/60 mb-6"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontStyle: 'normal',
                fontWeight: 300,
                fontSize: 'clamp(0.85rem, 2.2vw, 1.15rem)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                lineHeight: 1.5,
              }}
            >
              Tiết kiệm hôm nay, tích lũy tương lai
            </motion.p>

            <motion.div
              variants={fadeUp(0.2)} initial="hidden" animate="visible"
              className="flex flex-wrap gap-3 mb-8"
            >
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-2.5">
                <Home size={16} className="text-white/80" />
                <span className="text-white text-sm font-medium">{rooms.length} phòng</span>
              </div>
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-2.5">
                <Wallet size={16} className="text-white/80" />
                <span className="text-white text-sm font-medium">{personalName}</span>
              </div>
            </motion.div>

            <motion.div variants={fadeUp(0.30)} initial="hidden" animate="visible">
              <button
                onClick={() => listRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center justify-between gap-8 rounded-full text-white font-semibold transition-all hover:scale-[1.04] hover:brightness-110 active:scale-[0.96]"
                style={{
                  background: '#7342E2',
                  padding: '17px 24px',
                  fontSize: 'clamp(0.9rem, 2vw, 1rem)',
                  boxShadow: '0 4px 24px rgba(115,66,226,0.28)',
                  minWidth: 210,
                }}
              >
                Xem danh sách
                <ArrowRightCircle size={20} />
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── ROOM LIST SECTION ────────────────────────────────── */}
      <div ref={listRef} className="max-w-2xl mx-auto px-4 pb-16 -mt-10 relative z-10">

        {/* ── Featured: Personal Notebook ─────────────────────── */}
        {(() => {
          const pcc = getContrastColors(personalTheme)
          return (
            <Link href="/personal"
              className="group relative flex items-center overflow-hidden rounded-3xl p-6 mb-4 shadow-xl transition-all hover:scale-[1.01] hover:shadow-2xl"
              style={{ backgroundColor: personalTheme }}>
              {/* decorative blobs */}
              <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full opacity-20" style={{ backgroundColor: pcc.text }} />
              <div className="absolute -right-2 -bottom-6 w-24 h-24 rounded-full opacity-10" style={{ backgroundColor: pcc.text }} />
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 mr-5"
                style={{ backgroundColor: pcc.iconBg }}>
                <BookOpen size={24} style={{ color: personalTheme }} />
              </div>
              <div className="flex-1 relative z-10">
                <p className="font-bold text-lg leading-tight" style={{ color: pcc.text }}>{personalName}</p>
                <p className="text-sm mt-0.5" style={{ color: pcc.muted }}>Ghi chép chi tiêu cá nhân</p>
              </div>
              <div className="relative z-10 flex items-center gap-2">
                <button onClick={e => {
                  e.preventDefault(); e.stopPropagation()
                  setEditPersonalNameValue(personalName); setShowEditPersonalName(true)
                }} className="p-2 rounded-xl opacity-60 hover:opacity-100 transition-opacity" style={{ color: pcc.text }}>
                  <Pencil size={16} />
                </button>
                <div className="p-2 rounded-xl" style={{ backgroundColor: pcc.iconBg, color: personalTheme }}>
                  <ChevronRight size={18} />
                </div>
              </div>
            </Link>
          )
        })()}

        {/* ── Rooms section header ────────────────────────────── */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Phòng của bạn
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{rooms.length} phòng</span>
            {!showCreate && (
              <button
                onClick={() => setShowCreate(true)}
                title="Tạo phòng mới"
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-indigo-100 hover:text-indigo-600 text-gray-400 transition-all"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Create room inline form */}
        {showCreate && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm mb-3">
            <p className="font-semibold text-sm text-gray-800 mb-3">Đặt tên phòng mới</p>
            <input
              value={roomName} onChange={e => setRoomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createRoom()}
              placeholder="Ví dụ: Phòng 101..."
              autoFocus
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 mb-3"
              style={{ outlineColor: dashboardTheme }}
            />
            <div className="flex gap-2">
              <button onClick={createRoom} disabled={creating}
                className="flex-1 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: dashboardTheme }}>
                {creating ? 'Đang tạo...' : 'Tạo phòng'}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm font-medium">
                Huỷ
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingSpinner message="Đang tải phòng..." />
        ) : rooms.length === 0 ? (
          <div className="text-center py-12 text-gray-300">
            <Home size={36} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Chưa có phòng nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map(room => {
              const theme = roomThemes[room.id] || '#4f46e5'
              const rcc = getContrastColors(theme)
              return (
                <Link key={room.id} href={`/rooms/${room.id}`}
                  className="group relative flex items-center overflow-hidden rounded-2xl shadow-sm hover:shadow-lg transition-all hover:scale-[1.01]"
                  style={{ backgroundColor: theme }}>
                  {/* blob */}
                  <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full opacity-15" style={{ backgroundColor: rcc.text }} />
                  <div className="absolute -right-2 -top-4 w-20 h-20 rounded-full opacity-10" style={{ backgroundColor: rcc.text }} />

                  {/* Icon */}
                  <div className="flex-shrink-0 m-5 w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: rcc.iconBg }}>
                    <Home size={22} style={{ color: theme }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 py-5 relative z-10">
                    <p className="font-bold text-base leading-tight" style={{ color: rcc.text }}>{room.name}</p>
                    <p className="text-xs mt-1 opacity-60" style={{ color: rcc.text }}>Nhấn để xem chi tiết</p>
                  </div>

                  {/* Actions */}
                  <div className="relative z-10 flex items-center gap-1 mr-4">
                    {room.owner_id === currentUserId && (
                      <button onClick={e => openEditRoom(e, room)}
                        className="p-2 rounded-xl opacity-50 hover:opacity-100 transition-opacity"
                        style={{ color: rcc.text }}>
                        <Pencil size={15} />
                      </button>
                    )}
                    <div className="p-1.5 opacity-60" style={{ color: rcc.text }}>
                      <ChevronRight size={18} />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>


      {/* ── MOBILE MENU ─────────────────────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(25,40,55,0.35)', backdropFilter: 'blur(4px)' }}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.45 }}
              className="fixed right-0 top-0 h-dvh z-50 flex flex-col"
              style={{ width: 'min(88vw, 360px)', background: '#CFC8C5', boxShadow: '-12px 0 48px rgba(25,40,55,0.18)' }}
            >
              <div className="flex items-center justify-between px-6 py-5">
                <Image src="/spendly_logo.svg" alt="Spendly" width={110} height={24} />
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-[#192837]">
                  <X size={22} />
                </button>
              </div>
              <div className="h-px bg-[#192837]/10 mx-6" />
              <nav className="flex flex-col px-6 py-6 gap-1 flex-1">
                {NAV_LINKS.map((link, i) => (
                  <motion.button
                    key={link}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + i * 0.07, duration: 0.35 }}
                    className="text-left text-[#192837] font-medium py-3 text-base hover:opacity-70 transition-opacity"
                  >
                    {link}
                  </motion.button>
                ))}
              </nav>
              <div className="px-6 pb-8 flex flex-col gap-3">
                <button onClick={() => { setMobileMenuOpen(false); setShowSettings(true) }}
                  className="w-full py-3 rounded-full text-sm font-semibold text-white"
                  style={{ background: '#7342E2' }}>
                  Cài đặt
                </button>
                <button onClick={logout}
                  className="w-full py-3 rounded-full text-sm font-semibold text-[#192837] bg-[#F2F2EE]">
                  Đăng xuất
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── MODALS ──────────────────────────────────────────── */}
      {showSettings && (
        <ProfileSettingsModal
          onClose={() => setShowSettings(false)}
          themeColor={dashboardTheme}
          currentTheme={dashboardTheme}
          onChangeTheme={handleThemeChange}
        />
      )}

      {editingRoomId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setEditingRoomId(null) }}>
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Sửa tên phòng</h3>
              <button onClick={() => setEditingRoomId(null)} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
            </div>
            <input type="text" value={editRoomName} onChange={e => setEditRoomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveRoomName()} autoFocus
              placeholder="Ví dụ: Phòng 101..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4" />
            <button onClick={saveRoomName} disabled={savingRoom}
              className="w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: dashboardTheme }}>
              {savingRoom ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </div>
      )}

      {showEditPersonalName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowEditPersonalName(false) }}>
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Đổi tên Sổ cá nhân</h3>
              <button onClick={() => setShowEditPersonalName(false)} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
            </div>
            <input type="text" value={editPersonalNameValue} onChange={e => setEditPersonalNameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && savePersonalName()} autoFocus
              placeholder="Ví dụ: Ví của tôi, Quỹ đen..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4" />
            <button onClick={savePersonalName}
              className="w-full py-3.5 rounded-xl font-semibold text-white"
              style={{ backgroundColor: dashboardTheme }}>
              Lưu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RoomsPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Đang tải Spendly..." fullscreen />}>
      <RoomsList />
    </Suspense>
  )
}
