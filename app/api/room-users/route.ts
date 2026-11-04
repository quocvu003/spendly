import { type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAdminClient, requireRoomAccess } from '@/lib/serverAuth'

type ProfileRow = { id: string; username: string | null; display_name: string | null; avatar_url: string | null }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get('roomId')

  if (!roomId) {
    return NextResponse.json({ error: 'Missing roomId' }, { status: 400 })
  }

  const adminClient = getAdminClient()
  if (!adminClient) {
    return NextResponse.json({ error: 'Config error' }, { status: 500 })
  }

  // Kiểm tra quyền và lấy dữ liệu chạy song song để không cộng thêm độ trễ.
  // Dữ liệu chỉ được trả về sau khi kiểm tra quyền thành công.
  // 1 query RPC duy nhất: UNION user_id từ room_members + paid_by từ transactions, JOIN profiles.
  const [access, rpcResult] = await Promise.all([
    requireRoomAccess(request, adminClient, roomId),
    adminClient.rpc('get_room_user_map', { p_room_id: roomId }) as unknown as Promise<{ data: ProfileRow[] | null; error: unknown }>,
  ])

  if (access instanceof NextResponse) return access

  const profiles = rpcResult.error ? await fallback(adminClient, roomId) : rpcResult.data
  return NextResponse.json(toMaps(profiles))
}

function toMaps(profiles: ProfileRow[] | null) {
  const userMap: Record<string, string> = {}
  const avatarMap: Record<string, string> = {}
  profiles?.forEach(p => {
    userMap[p.id] = p.display_name || p.username || 'User ' + p.id.slice(0, 6)
    if (p.avatar_url) avatarMap[p.id] = p.avatar_url
  })
  return { userMap, avatarMap }
}

// ─── Fallback (dùng khi RPC chưa deploy) ───────────────────────────────────
async function fallback(adminClient: SupabaseClient, roomId: string): Promise<ProfileRow[] | null> {
  const [membersRes, txsRes] = await Promise.all([
    adminClient.from('room_members').select('user_id').eq('room_id', roomId),
    adminClient.from('transactions').select('paid_by').eq('room_id', roomId),
  ])

  const ids = new Set<string>()
  ;(membersRes.data as { user_id: string }[] | null)?.forEach(m => ids.add(m.user_id))
  ;(txsRes.data as { paid_by: string }[] | null)?.forEach(t => ids.add(t.paid_by))

  if (ids.size === 0) return []

  const profilesRes = await adminClient
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', Array.from(ids))

  return profilesRes.data as ProfileRow[] | null
}
