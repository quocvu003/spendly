'use client'

import { useState, useEffect } from 'react'
import { X, Check, Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ProfileSettingsModalProps {
  onClose: () => void
  themeColor?: string
  currentTheme?: string
  onChangeTheme?: (color: string) => void
}

const THEME_PRESETS = [
  '#6c7ee1', '#92b9e3', '#ffc4a4', '#fba2d0',
  '#5d7b6f', '#a4c2a2', '#b0d4b8', '#eae7d6',
  '#d7f9fa', '#593e67', '#84495f', '#b85b56',
  '#de741c', '#fea837', '#d24150',
]

export default function ProfileSettingsModal({ onClose, themeColor = '#6c7ee1', currentTheme, onChangeTheme }: ProfileSettingsModalProps) {
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    async function load() {
      const savedAvatar = localStorage.getItem('spendly_avatar') || ''
      setEditAvatar(savedAvatar)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).single()
        setEditDisplayName(data?.display_name || '')
        if (data?.avatar_url) {
          setEditAvatar(data.avatar_url)
        }
      }
    }
    load()
  }, [])

  async function saveProfile() {
    setSavingProfile(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase.from('profiles').upsert({ 
        id: user.id,
        display_name: editDisplayName.trim() || null,
        avatar_url: editAvatar || null
      })
      if (error) console.error('Save profile error:', error)
      
      const freshName = editDisplayName.trim() || 'User'
      localStorage.setItem('spendly_display_name', freshName)
      if (editAvatar) {
        localStorage.setItem('spendly_avatar', editAvatar)
      } else {
        localStorage.removeItem('spendly_avatar')
      }
      
      // Trigger a storage event manually to update headers across the app
      window.dispatchEvent(new Event('storage'))
    }
    setSavingProfile(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-gray-900">Hồ sơ của bạn</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <label className="relative cursor-pointer group">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-200 group-hover:border-indigo-400 transition-colors">
              {editAvatar ? (
                <img src={editAvatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <Camera size={24} className="text-gray-300" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow-sm border-2 border-white" style={{ backgroundColor: themeColor }}>
              <Camera size={14} className="text-white" />
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onload = ev => setEditAvatar(ev.target?.result as string)
                  reader.readAsDataURL(file)
                }
              }}
            />
          </label>
          {editAvatar && (
            <button onClick={() => setEditAvatar('')} className="text-xs text-red-400 mt-2 hover:text-red-600 transition-colors font-medium">
              Xóa ảnh
            </button>
          )}
        </div>

        {/* Display Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tên hiển thị</label>
          <input
            value={editDisplayName}
            onChange={e => setEditDisplayName(e.target.value)}
            placeholder="Tên của bạn..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2"
            style={{ outlineColor: themeColor }}
            onKeyDown={e => e.key === 'Enter' && saveProfile()}
          />
          <p className="text-xs text-gray-400 mt-1.5">Tên và ảnh sẽ hiển thị trên tất cả các báo cáo chung.</p>
        </div>

        {/* Theme Picker */}
        <div className="mb-6 pt-6 border-t border-gray-100">
          <h3 className="block text-sm font-medium text-gray-700 mb-3">Màu chủ đề</h3>
          <div className="grid grid-cols-6 gap-2 mb-3">
            {THEME_PRESETS.map(c => (
              <button key={c} onClick={() => onChangeTheme && onChangeTheme(c)}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{ backgroundColor: c }}>
                {(currentTheme || themeColor) === c && <Check size={12} color="white" strokeWidth={3} />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2.5 border-t border-gray-100">
            <span className="text-xs text-gray-500 flex-1">Tùy chỉnh màu khác</span>
            <label className="relative cursor-pointer">
              <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center"
                style={!THEME_PRESETS.includes(currentTheme || themeColor) ? { backgroundColor: currentTheme || themeColor, borderColor: currentTheme || themeColor } : {}}>
                {!THEME_PRESETS.includes(currentTheme || themeColor)
                  ? <Check size={12} color="white" strokeWidth={3} />
                  : <span className="text-gray-400 text-xs font-bold leading-none">+</span>}
                <input type="color" value={currentTheme || themeColor}
                  onChange={e => onChangeTheme && onChangeTheme(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </div>
            </label>
          </div>
        </div>

        <button
          onClick={saveProfile}
          disabled={savingProfile}
          className="w-full text-white py-3 rounded-2xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-sm"
          style={{ backgroundColor: themeColor }}
        >
          <Check size={16} />
          {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
    </div>
  )
}
