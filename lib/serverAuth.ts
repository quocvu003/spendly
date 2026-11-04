import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Chỉ dùng trong API route (server). Không import file này từ code chạy trên trình duyệt.

let _adminClient: SupabaseClient | null = null

// Client dùng service role key (bỏ qua RLS). Tái sử dụng giữa các request.
// Trả về null nếu thiếu cấu hình.
export function getAdminClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  if (!_adminClient) {
    _adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _adminClient
}

export type RoomAccess = { userId: string; isOwner: boolean }

// Xác thực người gọi bằng token trong header Authorization và kiểm tra họ
// là thành viên (hoặc chủ) của phòng. Trả về NextResponse lỗi nếu không hợp lệ.
export async function requireRoomAccess(
  request: Request,
  adminClient: SupabaseClient,
  roomId: string,
): Promise<RoomAccess | NextResponse> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  // Ở server phải dùng getUser(token): nó xác minh token với Supabase Auth,
  // không tin dữ liệu do trình duyệt gửi lên.
  const { data: { user }, error } = await adminClient.auth.getUser(token)
  if (error || !user) {
    return NextResponse.json({ error: 'Phiên đăng nhập không hợp lệ' }, { status: 401 })
  }

  const [{ data: room }, { data: membership }] = await Promise.all([
    adminClient.from('rooms').select('owner_id').eq('id', roomId).maybeSingle(),
    adminClient.from('room_members').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle(),
  ])

  const isOwner = (room as { owner_id: string } | null)?.owner_id === user.id
  if (!room || (!membership && !isOwner)) {
    // Không phân biệt "phòng không tồn tại" với "không có quyền" để tránh dò roomId.
    return NextResponse.json({ error: 'Không có quyền truy cập phòng này' }, { status: 403 })
  }

  return { userId: user.id, isOwner }
}
