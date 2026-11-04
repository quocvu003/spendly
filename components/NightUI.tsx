'use client'

// Các thành phần giao diện tông tối dùng chung cho các trang trên nền thung lũng hoa đêm
// (/rooms, /personal): logo, card phát sáng, ô biểu tượng, nút mũi tên tròn, popup tối.

import Link from 'next/link'
import { X, ArrowRight, ArrowLeft } from 'lucide-react'
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

/** Card nền tối không có viền phát sáng (cho khối nội dung dài như danh sách, bộ lọc) */
export function DarkPanel({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 rounded-3xl border border-white/10 bg-[#0b0f1f]/[0.92] ${className}`}>
      {children}
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

/** Thanh trên cùng của trang con: nút quay lại + logo, bên phải tuỳ trang */
export function NightTopBar({ backHref, children }: { backHref: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 py-5 sm:py-7">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={backHref} aria-label="Quay lại"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 text-[#f5efe2]/80 transition-colors hover:bg-white/10">
          <ArrowLeft size={18} />
        </Link>
        <Link href="/rooms?mode=list" className="hidden sm:block"><Wordmark /></Link>
      </div>
      {children && <nav className="flex items-center gap-2">{children}</nav>}
    </header>
  )
}

/** Nút viên thuốc có biểu tượng; chữ ẩn trên điện thoại */
export function NavPill({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} aria-label={label}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-3 text-sm font-semibold text-[#f5efe2]/85 transition-colors hover:bg-white/10 sm:px-4">
      {children}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  )
}

/** Khối tiêu đề trang: nhãn nhỏ có chấm màu, tiêu đề lớn (tối đa 2 dòng), dòng phụ */
export function PageTitle({ eyebrow, dotColor, title, subtitle }: {
  eyebrow: string; dotColor: string; title: React.ReactNode; subtitle?: React.ReactNode
}) {
  return (
    <section className="pb-8 pt-6 sm:pt-10">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#f5efe2]/60">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
        {eyebrow}
      </p>
      <h1 className="line-clamp-2 text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] [overflow-wrap:anywhere] sm:text-6xl">
        {title}
      </h1>
      {subtitle && <p className="mt-3 text-sm text-[#f5efe2]/60 sm:text-base">{subtitle}</p>}
    </section>
  )
}

/** Ô số liệu nhỏ trong card tổng kết */
export function Stat({ label, value, tone, loading = false, children }: {
  label: string; value: string; tone: string; loading?: boolean; children?: React.ReactNode
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${tone}`}>
        {children}{label}
      </p>
      {loading
        ? <div className="mt-2 h-6 w-24 animate-pulse rounded bg-white/10" />
        : <p className="mt-1.5 truncate text-lg font-bold tabular-nums sm:text-xl">{value}</p>}
    </div>
  )
}
