'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Room } from '@/lib/supabase'
import { readRoomsCache, writeRoomsCache, clearUserCaches } from '@/lib/roomsCache'
import {
  THEME_DEFAULTS, DASHBOARD_THEME_KEY, PERSONAL_THEME_KEY, roomThemeKey,
  readCachedTheme, claimThemeCache, resolveTheme,
  saveDashboardTheme, syncPersonalTheme, uploadRoomThemes,
} from '@/lib/themeStore'
import { Plus, Home, BookOpen, X, Pencil, Menu, ArrowDown } from 'lucide-react'
import { getContrastColors } from '@/lib/theme'
import { Wordmark, Panel, IconTile, ArrowCircle, Modal, lightInput, themePageStyle } from '@/components/LightUI'
import ProfileSettingsModal from '@/components/ProfileSettingsModal'
import { motion, AnimatePresence } from 'framer-motion'

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
  const roomsLoadedRef = useRef(false)

  useEffect(() => {
    // Tô màu ngay từ bản sao; màu trên Supabase sẽ ghi đè khi tải xong
    const savedDash = readCachedTheme(DASHBOARD_THEME_KEY)
    if (savedDash) setDashboardTheme(savedDash)
    const savedTheme = readCachedTheme(PERSONAL_THEME_KEY)
    if (savedTheme) setPersonalTheme(savedTheme)
    const savedName = localStorage.getItem('spendly_personal_name')
    if (savedName) setPersonalName(savedName)
  }, [])

  useEffect(() => {
    let cancelled = false

    function showRooms(roomsData: Room[]) {
      roomsLoadedRef.current = true
      setRooms(roomsData)
      const themes: Record<string, string> = {}
      roomsData.forEach(r => {
        const saved = readCachedTheme(roomThemeKey(r.id))
        if (saved) themes[r.id] = saved
      })
      setRoomThemes(themes)
      setLoading(false)
    }

    async function load() {
      // Bước 1: đọc phiên đăng nhập có sẵn trong trình duyệt (không cần gọi mạng).
      // An toàn ở phía client vì quyền truy cập dữ liệu do RLS của Supabase kiểm soát.
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/'); return }
      if (cancelled) return
      setCurrentUserId(user.id)

      // Bản sao màu của tài khoản khác trên cùng trình duyệt → bỏ, dùng màu mặc định chờ Supabase
      if (!claimThemeCache(user.id)) {
        setDashboardTheme(THEME_DEFAULTS.dashboard)
        setPersonalTheme(THEME_DEFAULTS.personal)
      }

      // Bước 4: hiện ngay danh sách phòng đã lưu từ lần trước (nếu có).
      // Bỏ qua khi chỉ có 1 phòng và không ở mode=list, vì khi đó trang sẽ chuyển thẳng vào phòng.
      const cached = readRoomsCache(user.id)
      if (cached && (cached.length !== 1 || mode === 'list')) showRooms(cached)

      // Bước 3: tải tên hiển thị song song, không chặn danh sách phòng.
      // Cùng truy vấn này lấy luôn màu dashboard và màu Sổ cá nhân.
      supabase.from('profiles').select('display_name, dashboard_theme, personal_theme').eq('id', user.id).single()
        .then(({ data: profile }) => {
          if (cancelled) return
          setDisplayName(profile?.display_name || user.email?.split('@')[0] || 'bạn')

          const dash = resolveTheme(DASHBOARD_THEME_KEY, profile?.dashboard_theme)
          if (dash.color) setDashboardTheme(dash.color)
          if (dash.needsUpload && dash.color) saveDashboardTheme(user.id, dash.color, true)

          syncPersonalTheme(user.id, profile?.personal_theme, setPersonalTheme)
        })

      // Bước 2: lấy phòng qua quan hệ room_members.room_id → rooms.id trong 1 query,
      // kèm màu phòng của chính mình (RLS chỉ trả về dòng của người đang đăng nhập).
      const { data, error } = await supabase
        .from('room_members').select('rooms(*, user_room_themes(color))').eq('user_id', user.id)
      if (cancelled) return
      if (error) {
        if (!cached) setLoading(false)
        return
      }

      type RoomWithTheme = Room & { user_room_themes?: { color: string }[] }
      const toUpload: { roomId: string; color: string }[] = []
      const roomsData = ((data ?? []) as unknown as { rooms: RoomWithTheme | null }[])
        .map(m => m.rooms)
        .filter((r): r is RoomWithTheme => r !== null)
        .map(({ user_room_themes, ...room }) => {
          const t = resolveTheme(roomThemeKey(room.id), user_room_themes?.[0]?.color)
          if (t.needsUpload && t.color) toUpload.push({ roomId: room.id, color: t.color })
          return room as Room
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
      uploadRoomThemes(user.id, toUpload)

      writeRoomsCache(user.id, roomsData)
      if (roomsData.length === 1 && mode !== 'list') {
        router.replace(`/rooms/${roomsData[0].id}`); return
      }
      showRooms(roomsData)
    }
    load()
    return () => { cancelled = true }
  }, [router, mode])

  // Giữ bản sao luôn khớp sau khi tạo phòng hoặc đổi tên phòng.
  useEffect(() => {
    if (roomsLoadedRef.current && currentUserId) writeRoomsCache(currentUserId, rooms)
  }, [rooms, currentUserId])

  async function createRoom() {
    if (!roomName.trim()) return
    setCreating(true)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
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
    if (currentUserId) saveDashboardTheme(currentUserId, color)
  }

  async function logout() {
    localStorage.removeItem('spendly_saved_credentials')
    if (currentUserId) clearUserCaches(currentUserId)
    await supabase.auth.signOut()
    router.push('/')
  }

  const cc = getContrastColors(dashboardTheme)
  const scrollToList = () => listRef.current?.scrollIntoView({ behavior: 'smooth' })

  return (
    // Nền trắng, dải màu chủ đề (Cài đặt → màu giao diện) nhạt dần ở phía trên — giống Sổ cá nhân
    <div className="min-h-screen overflow-x-clip text-slate-900" style={themePageStyle(dashboardTheme)}>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative z-10 flex min-h-[100svh] flex-col">
        <header className="flex items-center justify-between px-5 pt-5 sm:px-10 sm:pt-7">
          <Wordmark />

          <div className="hidden items-center gap-6 md:flex">
            <button
              onClick={() => setShowSettings(true)}
              className="text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-700 transition-opacity hover:opacity-60"
            >
              Cài đặt
            </button>
            <button
              onClick={logout}
              className="inline-flex h-11 items-center rounded-full bg-slate-900 px-6 text-sm font-semibold text-white transition-transform hover:-translate-y-px"
            >
              Đăng xuất
            </button>
          </div>

          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Mở menu"
            className="rounded-xl p-2 text-slate-900 md:hidden"
          >
            <Menu size={24} />
          </button>
        </header>

        <div className="relative flex flex-1 flex-col items-center justify-center px-5 pb-28 text-center">
          <motion.p
            variants={fadeUp(0)} initial="hidden" animate="visible"
            className="mb-5 flex max-w-full items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 sm:text-sm"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dashboardTheme }} />
            {/* Tên dài: cắt bằng dấu … thay vì tràn ra ngoài màn hình */}
            <span className="min-w-0 truncate">
              {displayName ? `Chào mừng trở lại, ${displayName}` : 'Chào mừng trở lại'}
            </span>
          </motion.p>

          <motion.h1
            variants={fadeUp(0.1)} initial="hidden" animate="visible"
            className="max-w-5xl font-extrabold leading-[0.98] tracking-[-0.035em]"
            style={{ fontSize: 'clamp(2.75rem, 8vw, 6.5rem)' }}
          >
            Tiết kiệm hôm nay,
            <br />
            <span className="text-slate-900/55">tích luỹ tương lai.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp(0.2)} initial="hidden" animate="visible"
            className="mt-8 max-w-md break-words text-base leading-relaxed text-slate-600 [overflow-wrap:anywhere] sm:text-lg"
          >
            {loading
              ? 'Đang chuẩn bị không gian của bạn…'
              : `${rooms.length} phòng chi tiêu chung · ${personalName}`}
          </motion.p>

          <motion.button
            variants={fadeUp(0.3)} initial="hidden" animate="visible"
            onClick={scrollToList}
            aria-label="Xem danh sách"
            className="mt-9 grid h-14 w-14 place-items-center rounded-full border-[1.5px] border-slate-900 text-slate-900 transition-colors duration-300 hover:bg-slate-900 hover:text-white"
          >
            <ArrowDown size={22} strokeWidth={1.6} />
          </motion.button>
        </div>

        <div className="absolute bottom-8 left-5 right-5 flex items-center justify-center gap-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:left-auto sm:right-10 sm:justify-end">
          <span>Cuộn để khám phá</span>
          <i className="h-6 w-px bg-slate-300" />
          <span>{rooms.length.toString().padStart(2, '0')} phòng</span>
        </div>
      </section>

      {/* ── KHÔNG GIAN CỦA BẠN ───────────────────────────────── */}
      <section ref={listRef} className="relative z-10 mx-auto max-w-5xl scroll-mt-8 px-5 pb-28 pt-10 sm:px-8">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Không gian của bạn</p>
            <h2 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-5xl">Sổ &amp; phòng chi tiêu</h2>
          </div>
          <p className="hidden pb-2 text-sm text-slate-500 sm:block">
            {loading ? '…' : `${rooms.length} phòng`}
          </p>
        </div>

        {/* grid-cols-1 + min-w-0 ở từng card: không để tên dài kéo giãn card rộng hơn màn hình */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Sổ cá nhân: thẻ nổi bật, chiếm hết bề ngang */}
          <Panel theme={personalTheme} className="group transition-transform duration-300 hover:-translate-y-1 md:col-span-2">
            {/* Cùng bố cục với thẻ phòng: biểu tượng ở trên; tên bên trái, nút mũi tên bên phải */}
            <Link href="/personal" className="relative z-10 flex min-h-[200px] flex-col justify-between gap-8 p-7 sm:p-9">
              <IconTile theme={personalTheme}><BookOpen size={22} /></IconTile>
              <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Cá nhân</p>
                <div className="mt-1 flex items-start gap-2">
                  {/* Tên dài: xuống dòng, tối đa 2 dòng rồi cắt bằng … */}
                  <h3 className="line-clamp-2 min-w-0 text-3xl font-extrabold tracking-[-0.03em] [overflow-wrap:anywhere] sm:text-4xl">{personalName}</h3>
                  <button
                    onClick={e => {
                      e.preventDefault(); e.stopPropagation()
                      setEditPersonalNameValue(personalName); setShowEditPersonalName(true)
                    }}
                    aria-label="Đổi tên Sổ cá nhân"
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-700"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                <p className="mt-2 max-w-sm text-sm text-slate-600">Ghi chép thu chi của riêng bạn, theo nhãn và theo tháng.</p>
              </div>
              {/* Điện thoại: nút nhỏ như thẻ phòng; màn hình lớn: nút lớn */}
              <span className="sm:hidden"><ArrowCircle small /></span>
              <span className="hidden sm:block"><ArrowCircle /></span>
              </div>
            </Link>
          </Panel>

          {/* Các phòng */}
          {loading
            ? [0, 1].map(i => (
                <div key={i} className="h-[190px] animate-pulse rounded-3xl border border-slate-200 bg-white/70" />
              ))
            : rooms.map(room => {
                const theme = roomThemes[room.id] || THEME_DEFAULTS.room
                const isOwner = room.owner_id === currentUserId
                return (
                  <Panel key={room.id} theme={theme} className="group transition-transform duration-300 hover:-translate-y-1">
                    <Link href={`/rooms/${room.id}`} className="relative z-10 flex min-h-[190px] flex-col justify-between p-7">
                      <div className="flex items-start justify-between">
                        <IconTile theme={theme}><Home size={20} /></IconTile>
                        {isOwner && (
                          <button
                            onClick={e => openEditRoom(e, room)}
                            aria-label="Sửa tên phòng"
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-700"
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                      </div>
                      <div className="mt-8 flex items-end justify-between gap-4">
                        <div className="min-w-0">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            {isOwner ? 'Chủ phòng' : 'Thành viên'}
                          </p>
                          <h3 className="line-clamp-2 text-2xl font-extrabold tracking-[-0.03em] [overflow-wrap:anywhere]">{room.name}</h3>
                        </div>
                        <ArrowCircle small />
                      </div>
                    </Link>
                  </Panel>
                )
              })}

          {/* Tạo phòng mới */}
          <div className={`flex min-h-[190px] flex-col rounded-3xl border border-dashed p-7 transition-colors ${
            showCreate ? 'border-slate-400 bg-white' : 'border-slate-300 bg-white/70 hover:border-slate-400'
          }`}>
            {showCreate ? (
              <div className="flex flex-1 flex-col">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Phòng mới</p>
                <input
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createRoom(); if (e.key === 'Escape') setShowCreate(false) }}
                  placeholder="Ví dụ: Phòng 101"
                  autoFocus
                  className={lightInput}
                />
                <div className="mt-auto flex gap-2 pt-4">
                  <button
                    onClick={createRoom}
                    disabled={creating || !roomName.trim()}
                    className="flex-1 rounded-full py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40"
                    style={{ backgroundColor: dashboardTheme, color: cc.text }}
                  >
                    {creating ? 'Đang tạo…' : 'Tạo phòng'}
                  </button>
                  <button
                    onClick={() => { setShowCreate(false); setRoomName('') }}
                    className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Huỷ
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowCreate(true)} className="flex flex-1 flex-col items-start justify-between text-left">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-300 text-slate-600">
                  <Plus size={22} />
                </span>
                <span>
                  <span className="block text-2xl font-extrabold tracking-[-0.03em]">Tạo phòng mới</span>
                  <span className="mt-1 block text-sm text-slate-500">
                    {!loading && rooms.length === 0
                      ? 'Bạn chưa có phòng nào. Tạo phòng đầu tiên để chia sẻ chi tiêu.'
                      : 'Chia sẻ chi tiêu với bạn cùng phòng.'}
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── MENU ĐIỆN THOẠI ──────────────────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/40"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.45 }}
              className="fixed right-0 top-0 z-50 flex h-dvh flex-col border-l border-slate-200 bg-white"
              style={{ width: 'min(88vw, 360px)' }}
            >
              <div className="flex items-center justify-between px-6 py-5">
                <Wordmark />
                <button onClick={() => setMobileMenuOpen(false)} aria-label="Đóng menu" className="p-2 text-slate-900">
                  <X size={22} />
                </button>
              </div>
              <div className="mx-6 h-px bg-slate-200" />
              <div className="flex-1" />
              <div className="flex flex-col gap-3 px-6 pb-8">
                <button
                  onClick={() => { setMobileMenuOpen(false); setShowSettings(true) }}
                  className="w-full rounded-full border border-slate-200 py-3 text-sm font-semibold text-slate-700"
                >
                  Cài đặt
                </button>
                <button onClick={logout} className="w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white">
                  Đăng xuất
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── POPUP ────────────────────────────────────────────── */}
      {showSettings && (
        <ProfileSettingsModal
          onClose={() => setShowSettings(false)}
          themeColor={dashboardTheme}
          currentTheme={dashboardTheme}
          onChangeTheme={handleThemeChange}
        />
      )}

      {editingRoomId && (
        <Modal title="Sửa tên phòng" onClose={() => setEditingRoomId(null)}>
          <input
            type="text" value={editRoomName} onChange={e => setEditRoomName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveRoomName()} autoFocus
            placeholder="Ví dụ: Phòng 101"
            className={`mb-4 ${lightInput}`}
          />
          <button
            onClick={saveRoomName} disabled={savingRoom}
            className="w-full rounded-full py-3.5 font-semibold disabled:opacity-50"
            style={{ backgroundColor: dashboardTheme, color: cc.text }}
          >
            {savingRoom ? 'Đang lưu…' : 'Lưu'}
          </button>
        </Modal>
      )}

      {showEditPersonalName && (
        <Modal title="Đổi tên Sổ cá nhân" onClose={() => setShowEditPersonalName(false)}>
          <input
            type="text" value={editPersonalNameValue} onChange={e => setEditPersonalNameValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && savePersonalName()} autoFocus
            placeholder="Ví dụ: Ví của tôi, Quỹ đen…"
            className={`mb-4 ${lightInput}`}
          />
          <button
            onClick={savePersonalName}
            className="w-full rounded-full py-3.5 font-semibold"
            style={{ backgroundColor: dashboardTheme, color: cc.text }}
          >
            Lưu
          </button>
        </Modal>
      )}
    </div>
  )
}

export default function RoomsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <RoomsList />
    </Suspense>
  )
}
