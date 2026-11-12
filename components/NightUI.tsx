'use client'

// Các thành phần giao diện tông tối dùng chung cho các trang trên nền thung lũng hoa đêm
// (/rooms): logo, card phát sáng, ô biểu tượng, nút mũi tên tròn, popup tối.

import { X, ArrowRight } from 'lucide-react'
import PulsatingBorder from '@/components/PulsatingBorder'
import { getContrastColors, getGlowColors } from '@/lib/theme'

/** Ô nhập liệu tông tối */
export const darkInput =
  'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-[#f5efe2] placeholder:text-[#f5efe2]/35 focus:border-white/40 focus:outline-none [color-scheme:dark]'

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" width={30} height={30} />
      <span className="text-xl font-bold tracking-[-0.02em] text-[#f5efe2]">
        Spend<span className="text-[#ffc4a4]">ly</span>
      </span>
    </span>
  )
}

/** Card nền tối, ánh màu chủ đề ở góc, viền phát sáng chuyển động phía sau */
export function GlowCard({ theme, className = '', lift = true, children }: {
  theme: string; className?: string; lift?: boolean; children: React.ReactNode
}) {
  return (
    <div className={`group relative min-w-0 transition-transform duration-300 ${lift ? 'hover:-translate-y-1' : ''} ${className}`}>
      <PulsatingBorder colors={getGlowColors(theme)} cornerRadius={24} />
      <div
        className="relative z-10 h-full overflow-hidden rounded-3xl border border-white/10 bg-[#0b0f1f]/[0.92]"
        style={{ backgroundImage: `radial-gradient(120% 90% at 0% 0%, ${theme}33 0%, transparent 55%)` }}
      >
        {children}
      </div>
    </div>
  )
}

export function IconTile({ theme, children }: { theme: string; children: React.ReactNode }) {
  return (
    <span
      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
      style={{ backgroundColor: theme, color: getContrastColors(theme).text, boxShadow: `0 8px 24px ${theme}55` }}
    >
      {children}
    </span>
  )
}

export function ArrowCircle({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full border-[1.5px] border-[#f5efe2]/70 text-[#f5efe2] transition-colors duration-300 group-hover:border-[#f5efe2] group-hover:bg-[#f5efe2] group-hover:text-[#151510] ${
        small ? 'h-11 w-11' : 'h-14 w-14'
      }`}
    >
      <ArrowRight size={small ? 18 : 22} strokeWidth={1.6} />
    </span>
  )
}

export function DarkModal({ title, onClose, children, size = 'md' }: {
  title: string; onClose: () => void; children: React.ReactNode; size?: 'sm' | 'md'
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-3xl border border-white/10 bg-[#0e1324] p-6 text-[#f5efe2] shadow-2xl ${size === 'sm' ? 'max-w-sm' : 'max-w-md'}`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} aria-label="Đóng" className="text-[#f5efe2]/50 hover:text-[#f5efe2]"><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
