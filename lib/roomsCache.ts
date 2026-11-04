import type { Room } from '@/lib/supabase'

// Bản sao dữ liệu trong localStorage để hiển thị ngay, sau đó cập nhật ngầm.
// Mọi key đều gắn với userId và bị xóa khi đăng xuất (clearUserCaches).

const roomsKey = (userId: string) => `spendly_rooms_cache_${userId}`
const roomUsersPrefix = (userId: string) => `spendly_room_users_${userId}_`

export type RoomUsers = {
  userMap: Record<string, string>
  avatarMap: Record<string, string>
}

function read<T>(key: string, isValid: (v: unknown) => boolean): T | null {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : null
    return isValid(parsed) ? (parsed as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// ── Danh sách phòng ─────────────────────────────────────────────────────────
export function readRoomsCache(userId: string): Room[] | null {
  return read<Room[]>(roomsKey(userId), Array.isArray)
}

export function writeRoomsCache(userId: string, rooms: Room[]) {
  write(roomsKey(userId), rooms)
}

// ── Tên + avatar thành viên của một phòng ──────────────────────────────────
export function readRoomUsersCache(userId: string, roomId: string): RoomUsers | null {
  return read<RoomUsers>(
    roomUsersPrefix(userId) + roomId,
    v => !!v && typeof v === 'object' && 'userMap' in v && 'avatarMap' in v,
  )
}

export function writeRoomUsersCache(userId: string, roomId: string, users: RoomUsers) {
  write(roomUsersPrefix(userId) + roomId, users)
}

// ── Đăng xuất ───────────────────────────────────────────────────────────────
export function clearUserCaches(userId: string) {
  try {
    localStorage.removeItem(roomsKey(userId))
    const prefix = roomUsersPrefix(userId)
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k))
  } catch {}
}
