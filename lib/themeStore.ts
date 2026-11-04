import { supabase } from '@/lib/supabase'

// Màu giao diện: lưu trên Supabase (đồng bộ giữa các thiết bị) và giữ bản sao
// trong localStorage để tô màu ngay khi mở trang, không bị nháy màu mặc định.
//
// - Màu dashboard (/rooms) và Sổ cá nhân: cột profiles.dashboard_theme / personal_theme
// - Màu từng phòng (riêng mỗi người): bảng user_room_themes

export const THEME_DEFAULTS = {
  dashboard: '#6c7ee1',
  personal: '#059669',
  room: '#4f46e5',
} as const

export const DASHBOARD_THEME_KEY = 'spendly_dashboard_theme'
export const PERSONAL_THEME_KEY = 'spendly_personal_theme'
export const roomThemeKey = (roomId: string) => `spendly_room_theme_${roomId}`
const ROOM_THEME_PREFIX = 'spendly_room_theme_'
const OWNER_KEY = 'spendly_theme_owner'

const HEX = /^#[0-9a-fA-F]{6}$/
const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v)

// ── Bản sao trong localStorage ─────────────────────────────────────────────
export function readCachedTheme(key: string): string | null {
  try {
    const v = localStorage.getItem(key)
    return isHex(v) ? v : null
  } catch {
    return null
  }
}

function writeCachedTheme(key: string, color: string) {
  try { localStorage.setItem(key, color) } catch {}
}

/**
 * Gọi ngay khi biết người đang đăng nhập. Nếu bản sao màu thuộc về người khác
 * (đăng nhập tài khoản khác trên cùng trình duyệt) thì xoá đi.
 * Trả về false khi bản sao vừa bị xoá — trang nên quay về màu mặc định.
 */
export function claimThemeCache(userId: string): boolean {
  try {
    const owner = localStorage.getItem(OWNER_KEY)
    if (owner && owner !== userId) {
      Object.keys(localStorage)
        .filter(k => k === DASHBOARD_THEME_KEY || k === PERSONAL_THEME_KEY || k.startsWith(ROOM_THEME_PREFIX))
        .forEach(k => localStorage.removeItem(k))
      localStorage.setItem(OWNER_KEY, userId)
      return false
    }
    localStorage.setItem(OWNER_KEY, userId)
  } catch {}
  return true
}

/**
 * Chọn màu cuối cùng sau khi có dữ liệu từ Supabase:
 * - Supabase có màu → dùng màu đó và cập nhật bản sao.
 * - Supabase chưa có nhưng máy có bản sao (màu chọn trước khi có tính năng đồng bộ)
 *   → giữ bản sao và trả về needsUpload để đẩy lên Supabase.
 */
export function resolveTheme(key: string, dbColor: unknown): { color: string | null; needsUpload: boolean } {
  if (isHex(dbColor)) {
    writeCachedTheme(key, dbColor)
    return { color: dbColor, needsUpload: false }
  }
  const cached = readCachedTheme(key)
  return { color: cached, needsUpload: !!cached }
}

// ── Ghi lên Supabase ───────────────────────────────────────────────────────
// Ô chọn màu tự do bắn sự kiện liên tục khi kéo, nên gom lại: chỉ ghi sau khi
// ngừng đổi màu 500ms. Bản sao localStorage được ghi ngay để giao diện không trễ.
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function debounce(key: string, fn: () => void, ms = 500) {
  const t = timers.get(key)
  if (t) clearTimeout(t)
  timers.set(key, setTimeout(() => { timers.delete(key); fn() }, ms))
}

type ProfileThemeField = 'dashboard_theme' | 'personal_theme'

function saveProfileTheme(key: string, field: ProfileThemeField, userId: string, color: string, immediate: boolean) {
  if (!isHex(color)) return
  writeCachedTheme(key, color)
  // Dùng update, không dùng upsert: profiles.username là NOT NULL nên upsert thiếu
  // username bị Postgres từ chối ngay cả khi hàng đã tồn tại. Hàng profiles luôn
  // có sẵn vì được tạo lúc đăng ký.
  const write = () => {
    supabase.from('profiles').update({ [field]: color }).eq('id', userId)
      .then(({ error }) => { if (error) console.error(`Lưu ${field} thất bại:`, error.message) })
  }
  immediate ? write() : debounce(key, write)
}

export function saveDashboardTheme(userId: string, color: string, immediate = false) {
  saveProfileTheme(DASHBOARD_THEME_KEY, 'dashboard_theme', userId, color, immediate)
}

export function savePersonalTheme(userId: string, color: string, immediate = false) {
  saveProfileTheme(PERSONAL_THEME_KEY, 'personal_theme', userId, color, immediate)
}

export function saveRoomTheme(userId: string, roomId: string, color: string, immediate = false) {
  if (!isHex(color)) return
  const key = roomThemeKey(roomId)
  writeCachedTheme(key, color)
  const write = () => {
    supabase.from('user_room_themes').upsert({ user_id: userId, room_id: roomId, color })
      .then(({ error }) => { if (error) console.error('Lưu màu phòng thất bại:', error.message) })
  }
  immediate ? write() : debounce(key, write)
}

// ── Áp màu từ dữ liệu Supabase vào trang ──────────────────────────────────
/** Màu Sổ cá nhân lấy từ profiles.personal_theme */
export function syncPersonalTheme(userId: string, dbColor: unknown, setColor: (c: string) => void) {
  const t = resolveTheme(PERSONAL_THEME_KEY, dbColor)
  if (t.color) setColor(t.color)
  if (t.needsUpload && t.color) savePersonalTheme(userId, t.color, true)
}

/** Màu phòng lấy từ rooms → user_room_themes(color) */
export function syncRoomTheme(userId: string, roomId: string, dbColor: unknown, setColor: (c: string) => void) {
  const t = resolveTheme(roomThemeKey(roomId), dbColor)
  if (t.color) setColor(t.color)
  if (t.needsUpload && t.color) saveRoomTheme(userId, roomId, t.color, true)
}

/** Đẩy nhiều màu phòng lên cùng lúc (dùng khi chuyển màu cũ từ máy lên Supabase). */
export function uploadRoomThemes(userId: string, items: { roomId: string; color: string }[]) {
  const rows = items.filter(i => isHex(i.color)).map(i => ({ user_id: userId, room_id: i.roomId, color: i.color }))
  if (rows.length === 0) return
  supabase.from('user_room_themes').upsert(rows)
    .then(({ error }) => { if (error) console.error('Đồng bộ màu phòng thất bại:', error.message) })
}
