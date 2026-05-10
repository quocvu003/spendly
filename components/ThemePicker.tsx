'use client'

import { useRef, useEffect } from 'react'
import { Settings, Check } from 'lucide-react'
import { getContrastColors } from '@/lib/theme'

const THEME_PRESETS = [
  '#6c7ee1', '#92b9e3', '#ffc4a4', '#fba2d0',
  '#5d7b6f', '#a4c2a2', '#b0d4b8', '#eae7d6',
  '#d7f9fa', '#593e67', '#84495f', '#b85b56',
  '#de741c', '#fea837', '#d24150',
]

interface ThemePickerProps {
  color: string
  open: boolean
  onToggle: () => void
  onClose: () => void
  onChange: (color: string) => void
}

export default function ThemePicker({ color, open, onToggle, onClose, onChange }: ThemePickerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const cc = getContrastColors(color)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className="p-2 rounded-full transition-colors"
        style={{ backgroundColor: cc.iconBg, color: cc.text }}
      >
        <Settings size={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-11 bg-white rounded-2xl shadow-2xl p-4 w-52 z-50">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Màu chủ đề</p>
          <div className="grid grid-cols-6 gap-2 mb-3">
            {THEME_PRESETS.map(c => (
              <button key={c} onClick={() => { onChange(c); onClose() }}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{ backgroundColor: c }}>
                {color === c && <Check size={12} color="white" strokeWidth={3} />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2.5 border-t border-gray-100">
            <span className="text-xs text-gray-500 flex-1">Tùy chỉnh</span>
            <label className="relative cursor-pointer">
              <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center"
                style={!THEME_PRESETS.includes(color) ? { backgroundColor: color, borderColor: color } : {}}>
                {!THEME_PRESETS.includes(color)
                  ? <Check size={12} color="white" strokeWidth={3} />
                  : <span className="text-gray-400 text-xs font-bold leading-none">+</span>}
                <input type="color" value={color}
                  onChange={e => onChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
