'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ProfileHeader({ textColor = '#ffffff' }: { textColor?: string }) {
  // Since this component is always mounted purely on the client (after parent's LoadingSpinner),
  // we can safely read localStorage during initialization for 0-delay rendering.
  const [avatar, setAvatar] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('spendly_avatar') || ''
    return ''
  })
  const [displayName, setDisplayName] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('spendly_display_name') || 'User'
    return 'User'
  })
  
  useEffect(() => {
    // Also set up a listener in case another tab/component updates it
    const handleStorage = () => {
      setDisplayName(localStorage.getItem('spendly_display_name') || 'User')
      setAvatar(localStorage.getItem('spendly_avatar') || '')
    }
    window.addEventListener('storage', handleStorage)

    // Background sync with DB to ensure cache is always populated
    async function syncProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).single()
      if (profile) {
        const freshName = profile.display_name || user.email?.split('@')[0] || 'User'
        const freshAvatar = profile.avatar_url || ''
        
        // Only update if changed to avoid unnecessary re-renders
        if (freshName !== localStorage.getItem('spendly_display_name')) {
          setDisplayName(freshName)
          localStorage.setItem('spendly_display_name', freshName)
        }
        if (freshAvatar !== localStorage.getItem('spendly_avatar')) {
          setAvatar(freshAvatar)
          if (freshAvatar) localStorage.setItem('spendly_avatar', freshAvatar)
          else localStorage.removeItem('spendly_avatar')
        }
      }
    }
    syncProfile()

    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // If not yet mounted (during SSR or parent initial mount frame), render a transparent placeholder
  // so the height is preserved but there's no flashing.
  if (!displayName) {
    return (
      <div className="flex items-center gap-2 mb-4 invisible">
        <div className="w-8 h-8 rounded-full" />
        <span className="font-medium text-sm">Loading</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      {avatar ? (
        <img src={avatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-white/20 shadow-sm" />
      ) : (
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm bg-black/10" style={{ color: textColor }}>
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="font-medium text-sm" style={{ color: textColor }}>
        Xin chào, {displayName} 👋
      </span>
    </div>
  )
}
