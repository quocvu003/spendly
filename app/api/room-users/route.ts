import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Singleton admin client — reused across requests to avoid cold-start on every call
let _adminClient: ReturnType<typeof createClient> | null = null
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get('roomId')

  if (!roomId) {
    return NextResponse.json({ error: 'Missing roomId' }, { status: 400 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Config error' }, { status: 500 })
  }

  const adminClient = getAdminClient()

  // 1 query duy nhất thay vì 3 round-trips riêng biệt:
  // UNION lấy tất cả user_id từ room_members + paid_by từ transactions,
  // sau đó JOIN thẳng với profiles — chỉ tốn 1 network round-trip đến Supabase.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminClient as any).rpc('get_room_user_map', {
    p_room_id: roomId,
  }) as { data: { id: string; username: string | null; display_name: string | null; avatar_url: string | null }[] | null; error: unknown }

  if (error) {
    return fallback(adminClient, roomId)
  }

  const userMap: Record<string, string> = {}
  const avatarMap: Record<string, string> = {}
  data?.forEach(p => {
    userMap[p.id] = p.display_name || p.username || 'User ' + p.id.slice(0, 6)
    if (p.avatar_url) avatarMap[p.id] = p.avatar_url
  })

  return NextResponse.json({ userMap, avatarMap })
}

// ─── Fallback (dùng khi RPC chưa deploy) ───────────────────────────────────
async function fallback(adminClient: ReturnType<typeof createClient>, roomId: string) {
  const [membersRes, txsRes] = await Promise.all([
    adminClient.from('room_members').select('user_id').eq('room_id', roomId),
    adminClient.from('transactions').select('paid_by').eq('room_id', roomId),
  ])

  const ids = new Set<string>()
  ;(membersRes.data as { user_id: string }[] | null)?.forEach(m => ids.add(m.user_id))
  ;(txsRes.data as { paid_by: string }[] | null)?.forEach(t => ids.add(t.paid_by))

  if (ids.size === 0) return NextResponse.json({ userMap: {} })

  const profilesRes = await adminClient
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', Array.from(ids))

  const userMap: Record<string, string> = {}
  const avatarMap: Record<string, string> = {}
  ;(profilesRes.data as { id: string; username: string | null; display_name: string | null; avatar_url: string | null }[] | null)?.forEach(p => {
    userMap[p.id] = p.display_name || p.username || 'User ' + p.id.slice(0, 6)
    if (p.avatar_url) avatarMap[p.id] = p.avatar_url
  })

  return NextResponse.json({ userMap, avatarMap })
}

