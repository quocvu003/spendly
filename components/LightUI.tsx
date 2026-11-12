'use client'

// Các thành phần giao diện tông sáng (nền trắng) dùng chung cho Sổ cá nhân (/personal):
// logo, card tổng kết ánh màu chủ đề, khung nội dung, popup, thanh trên cùng, tiêu đề trang.

import Link from 'next/link'
import { X, ArrowLeft } from 'lucide-react'
import { getContrastColors } from '@/lib/theme'

/** Ô nhập liệu tông sáng */
export const lightInput =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none [color-scheme:light]'

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" width={30} height={30} />
      <span className="text-xl font-bold tracking-[-0.02em] text-slate-900">
        Spend<span className="text-[#f0936b]">ly</span>
      </span>
    </span>
  )
}

/**
 * Nền trang: trắng, có dải màu chủ đề nhạt ở phía trên để thấy rõ màu đã chọn.
 * Dùng cho thẻ ngoài cùng của trang: <div className="min-h-screen ..." style={themePageStyle(theme)}>
 */
export function themePageStyle(theme: string): React.CSSProperties {
  return {
    backgroundColor: '#ffffff',
    backgroundImage: `linear-gradient(to bottom, ${theme}2e 0px, ${theme}12 260px, #ffffff 520px)`,
    backgroundRepeat: 'no-repeat',
  }
}

/**
 * Card tô kín màu chủ đề (cho khối tổng kết). Chữ bên trong tự đổi đen/trắng theo độ sáng của màu;
 * con dùng text-[var(--on-theme-muted)] cho chữ phụ, bg-[var(--on-theme-soft)] cho khung chờ tải.
 */
export function ThemeCard({ theme, className = '', children }: {
  theme: string; className?: string; children: React.ReactNode
}) {
  const cc = getContrastColors(theme)
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-3xl ${className}`}
      style={{
        backgroundColor: theme,
        backgroundImage: 'radial-gradient(120% 100% at 0% 0%, rgba(255,255,255,0.22) 0%, transparent 55%)',
        color: cc.text,
        boxShadow: `0 16px 40px -12px ${theme}99`,
        ['--on-theme-muted' as string]: cc.muted,
        ['--on-theme-soft' as string]: cc.iconBg,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Khung nền trắng có viền (cho khối nội dung dài như danh sách, bộ lọc).
 * Có theme: phủ nhẹ màu chủ đề — quầng tròn ở góc trên phải + dải chéo từ góc trên trái,
 * nhạt dần về trắng để nội dung bên dưới vẫn dễ đọc; viền và bóng cũng ngả theo màu chủ đề.
 */
export function Panel({ theme, className = '', children }: { theme?: string; className?: string; children: React.ReactNode }) {
  const style: React.CSSProperties | undefined = theme
    ? {
        backgroundColor: '#ffffff',
        backgroundImage: [
          `radial-gradient(85% 75% at 100% 0%, ${theme}52 0%, transparent 72%)`,
          `linear-gradient(160deg, ${theme}2e 0%, ${theme}0d 50%, transparent 80%)`,
        ].join(', '),
        borderColor: `${theme}5c`,
        boxShadow: `0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -14px ${theme}80`,
      }
    : undefined
  return (
    <div style={style}
      className={`min-w-0 rounded-3xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {children}
    </div>
  )
}

export function Modal({ title, onClose, children, size = 'md' }: {
  title: string; onClose: () => void; children: React.ReactNode; size?: 'sm' | 'md'
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl ${size === 'sm' ? 'max-w-sm' : 'max-w-md'}`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-700"><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Thanh trên cùng của trang con: nút quay lại + logo, bên phải tuỳ trang */
export function TopBar({ backHref, children }: { backHref: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 py-5 sm:py-7">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={backHref} aria-label="Quay lại"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white/80 text-slate-600 transition-colors hover:bg-white">
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
      className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-white sm:px-4">
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
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
        {eyebrow}
      </p>
      <h1 className="line-clamp-2 text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] [overflow-wrap:anywhere] sm:text-6xl">
        {title}
      </h1>
      {subtitle && <p className="mt-3 text-sm text-slate-500 sm:text-base">{subtitle}</p>}
    </section>
  )
}

/** Ô số liệu nhỏ (nền trắng) đặt trên card màu chủ đề */
export function Stat({ label, value, tone, loading = false, children }: {
  label: string; value: string; tone: string; loading?: boolean; children?: React.ReactNode
}) {
  return (
    // [container-type:inline-size]: cỡ chữ số tiền tính theo bề ngang ô (cqi), để ô hẹp trên điện thoại
    // vẫn hiện đủ "+11.569.000đ" thay vì bị cắt "…"; ô rộng thì tối đa 1.25rem như cũ
    <div className="min-w-0 rounded-2xl bg-white p-3 text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.12)] [container-type:inline-size] sm:p-4">
      <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${tone}`}>
        {children}{label}
      </p>
      {loading
        ? <div className="mt-2 h-6 w-24 animate-pulse rounded bg-slate-100" />
        : <p className="mt-1.5 truncate text-[clamp(0.75rem,12.5cqi,1.25rem)] font-bold tabular-nums tracking-[-0.01em]">{value}</p>}
    </div>
  )
}

/** Dòng tiêu đề trên cùng của một khung */
export function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6">
      <h2 className="text-xl font-extrabold tracking-[-0.03em] sm:text-2xl">{title}</h2>
      {right && <span className="shrink-0 text-sm tabular-nums text-slate-500">{right}</span>}
    </div>
  )
}
