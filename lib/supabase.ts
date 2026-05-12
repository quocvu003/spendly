import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type Room = {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export type RoomMember = {
  id: string
  room_id: string
  user_id: string
  joined_at: string
  // joined from auth.users via RPC
  email?: string
}

export type Settlement = {
  id: string
  room_id: string
  start_date: string
  end_date: string
  total_amount: number
  created_at: string
}

export type Transaction = {
  id: string
  room_id: string
  paid_by: string
  type: 'shared' | 'personal'
  amount: number
  description: string
  date: string
  settlement_id: string | null
  created_at: string
  // joined
  paid_by_email?: string
  splits?: Split[]
}

export type Split = {
  id: string
  transaction_id: string
  user_id: string
  amount: number
  email?: string
}

// Net balance per user: positive = owed money back, negative = owes money
export type Balance = {
  user_id: string
  email: string
  net: number // positive = others owe them, negative = they owe others
}

export type PersonalLabel = {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export type PersonalExpense = {
  id: string
  user_id: string
  label_id: string | null
  amount: number
  description: string
  date: string
  type: 'income' | 'expense'
  created_at: string
  label?: PersonalLabel | null
}
