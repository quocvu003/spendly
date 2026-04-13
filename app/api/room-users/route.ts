import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get('roomId')

  if (!roomId) {
    return NextResponse.json({ error: 'Missing roomId' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Config error' }, { status: 500 })

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  )

  // Fetch unique user_ids from room_members and transactions in this room
  // Since we don't have direct access via public schema, admin client bypasses RLS
  
  const { data: members } = await adminClient.from('room_members').select('user_id').eq('room_id', roomId)
  const { data: txs } = await adminClient.from('transactions').select('paid_by').eq('room_id', roomId)
  
  const ids = new Set<string>()
  members?.forEach(m => ids.add(m.user_id))
  txs?.forEach(t => ids.add(t.paid_by))

  const userMap: Record<string, string> = {}

  // Fetch their profiles
  // Note: auth.admin.getUserById exists
  await Promise.all(
    Array.from(ids).map(async (uid) => {
      const { data } = await adminClient.auth.admin.getUserById(uid)
      if (data?.user?.email) {
        // email is username@spendly.com
        userMap[uid] = data.user.email.split('@')[0]
      } else {
        userMap[uid] = 'User ' + uid.slice(0, 4)
      }
    })
  )

  return NextResponse.json({ userMap })
}
