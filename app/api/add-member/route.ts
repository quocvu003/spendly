import { NextResponse } from 'next/server'
import { getAdminClient, requireRoomAccess } from '@/lib/serverAuth'

// This route uses the service role key to look up users by email
// Add SUPABASE_SERVICE_ROLE_KEY to your environment variables
export async function POST(request: Request) {
  const { roomId, username } = await request.json()

  if (!roomId || !username) {
    return NextResponse.json({ error: 'Missing roomId or username' }, { status: 400 })
  }

  const adminClient = getAdminClient()
  if (!adminClient) {
    return NextResponse.json({ error: 'Server config error' }, { status: 500 })
  }

  // Chỉ chủ phòng mới được thêm thành viên (giống RLS policy "room_members: owner can insert").
  const access = await requireRoomAccess(request, adminClient, roomId)
  if (access instanceof NextResponse) return access
  if (!access.isOwner) {
    return NextResponse.json({ error: 'Chỉ chủ phòng mới được thêm thành viên' }, { status: 403 })
  }

  // Look up user by synthetic email
  const syntheticEmail = `${username.toLowerCase().trim().replace(/\s+/g, '')}@spendly.com`
  const { data: { users }, error } = await adminClient.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const user = users.find(u => u.email === syntheticEmail)
  if (!user) {
    return NextResponse.json({ error: 'Không tìm thấy tài khoản với username này' }, { status: 404 })
  }

  // Check already a member
  const { data: existing } = await adminClient
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Người này đã là thành viên' }, { status: 409 })
  }

  // Add member
  const { error: insertError } = await adminClient
    .from('room_members')
    .insert({ room_id: roomId, user_id: user.id })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
