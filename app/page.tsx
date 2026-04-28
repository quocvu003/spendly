'use client'

import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const STORAGE_KEY = 'spendly_saved_credentials'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(true) // bắt đầu true để auto-login check
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const autoLoginAttempted = useRef(false)

  // Hàm redirect sau khi đăng nhập thành công
  async function redirectAfterLogin(userId: string) {
    const { data: memberships } = await supabase
      .from('room_members')
      .select('room_id, rooms!inner(id)')
      .eq('user_id', userId)

    const list = (memberships ?? []) as Array<{ room_id: string; rooms: { id: string } }>
    if (list.length === 1) {
      router.replace(`/rooms/${list[0].rooms.id}`)
    } else {
      router.replace('/rooms')
    }
  }

  // Auto-login khi có saved credentials
  useEffect(() => {
    if (autoLoginAttempted.current) return
    autoLoginAttempted.current = true

    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) { setLoading(false); return }

    const { username: savedUser, password: savedPass } = JSON.parse(saved)
    setUsername(savedUser)
    setPassword(savedPass)
    setRememberMe(true)

    const syntheticEmail = `${savedUser.toLowerCase().trim().replace(/\s+/g, '')}@spendly.com`
    supabase.auth.signInWithPassword({ email: syntheticEmail, password: savedPass })
      .then(({ data, error }) => {
        if (!error && data.user) {
          redirectAfterLogin(data.user.id)
        } else {
          // Credentials cũ không còn hợp lệ → xóa và hiện form
          localStorage.removeItem(STORAGE_KEY)
          setUsername(''); setPassword(''); setRememberMe(false)
          setLoading(false)
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')

    const syntheticEmail = `${username.toLowerCase().trim().replace(/\s+/g, '')}@spendly.com`

    if (isSignUp) {
      const { data: signUpData, error } = await supabase.auth.signUp({ email: syntheticEmail, password })
      if (error) {
        let errorMsg = error.message.replace(/Email/gi, 'Username').replace(/email/gi, 'username')
        setError(errorMsg)
      } else {
        if (signUpData.user?.id) {
          await supabase.from('profiles').upsert({ id: signUpData.user.id, username: username.toLowerCase().trim() })
        }
        setMessage('Tạo tài khoản thành công! Vui lòng đăng nhập.')
      }
    } else {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: syntheticEmail, password })
      if (error) {
        setError('Username hoặc mật khẩu không đúng')
      } else {
        // Lưu hoặc xóa credentials tùy checkbox
        if (rememberMe) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: username.trim(), password }))
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }

        const userId = signInData.user?.id
        if (userId) {
          await redirectAfterLogin(userId)
        } else {
          router.replace('/rooms')
        }
      }
    }
    setLoading(false)
  }

  // Màn hình loading khi đang tự động đăng nhập
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <span className="text-3xl">🏠</span>
          </div>
          <p className="text-gray-400 text-sm mt-2">Đang đăng nhập...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <span className="text-3xl">🏠</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Spendly</h1>
          <p className="text-gray-500 text-sm mt-1">Chia tiền phòng trọ dễ dàng</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">
            {isSignUp ? 'Tạo tài khoản' : 'Đăng nhập'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="tennguoidung" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required minLength={6}
                  className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Tối thiểu 6 ký tự" />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {!isSignUp && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                />
                <span className="text-sm text-gray-600">Lưu mật khẩu</span>
              </label>
            )}
            {error && <p className="text-red-500 text-sm">{error}</p>}
            {message && <p className="text-indigo-600 text-sm">{message}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {loading ? 'Đang xử lý...' : isSignUp ? 'Tạo tài khoản' : 'Đăng nhập'}
            </button>
          </form>
          <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
            className="w-full mt-4 text-sm text-gray-500 hover:text-indigo-600 transition-colors">
            {isSignUp ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
          </button>
        </div>
      </div>
    </main>
  )
}

