import { supabase } from '@/lib/supabase'

// fetch tới API route của app, tự gắn token đăng nhập để server xác thực người gọi.
export async function authFetch(input: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(input, { ...init, headers })
}
