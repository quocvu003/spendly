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

  // Chạy song song: lấy members + transactions cùng lúc
  const [membersRes, txsRes] = await Promise.all([
    adminClient.from('room_members').select('user_id').eq('room_id', roomId),
    adminClient.from('transactions').select('paid_by').eq('room_id', roomId),
  ])

  const members = membersRes.data as { user_id: string }[] | null
  const txs = txsRes.data as { paid_by: string }[] | null

  const ids = new Set<string>()
  members?.forEach(m => ids.add(m.user_id))
  txs?.forEach(t => ids.add(t.paid_by))

  if (ids.size === 0) {
    return NextResponse.json({ userMap: {} })
  }

  // Query thẳng bảng profiles — nhanh hơn auth.admin.listUsers rất nhiều
  const profilesRes = await adminClient
    .from('profiles')
    .select('id, username')
    .in('id', Array.from(ids))

  const profilesList = profilesRes.data as { id: string; username: string | null }[] | null

  const userMap: Record<string, string> = {}
  profilesList?.forEach(p => {
    if (p.username) userMap[p.id] = p.username
  })

  // Fallback cho user chưa có profile (đăng ký trước khi có tính năng này)
  Array.from(ids).forEach(uid => {
    if (!userMap[uid]) userMap[uid] = 'User ' + uid.slice(0, 6)
  })

  return NextResponse.json({ userMap })
}

