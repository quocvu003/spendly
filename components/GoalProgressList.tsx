'use client'

// Khung "Mục tiêu": tiến độ từng mục tiêu trong kỳ, tổng đã lên kế hoạch so với thu nhập,
// cảnh báo khi đang chi nhanh hơn thời gian đã trôi qua. Dùng ở Sổ cá nhân và Báo cáo.

import Link from 'next/link'
import { AlertTriangle, Check, Target } from 'lucide-react'
import { DarkPanel, SectionHeader } from '@/components/NightUI'
import { formatMoney, type GoalProgress, type GoalStatus } from '@/lib/goals'

const BAR_COLOR: Record<GoalStatus, string> = {
  ok: '#34d399',       // xanh: trong giới hạn
  warn: '#fbbf24',     // vàng: đã dùng từ 80%
  over: '#fb7185',     // đỏ: vượt giới hạn
  progress: '#60a5fa', // xanh dương: đang tích luỹ
  done: '#34d399',     // xanh: đạt mục tiêu tích luỹ
}

export default function GoalProgressList({ title, periodLabel, items, income, loading = false, className = '' }: {
  title: string
  periodLabel: string
  items: GoalProgress[]
  income: number
  loading?: boolean
  className?: string
}) {
  const planned = items.reduce((s, i) => s + i.goal.amount, 0)
  const unplanned = income - planned

  return (
    <DarkPanel className={`overflow-hidden ${className}`}>
      <SectionHeader title={title} right={periodLabel} />

      {loading ? (
        <div className="space-y-5 p-5 sm:p-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-3.5 w-1/3 animate-pulse rounded bg-white/10" />
              <div className="h-2 w-full animate-pulse rounded-full bg-white/5" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 text-[#f5efe2]/60">
            <Target size={22} />
          </span>
          <p className="mt-3 font-semibold">Chưa có mục tiêu nào</p>
          <p className="mt-1 max-w-xs text-sm text-[#f5efe2]/50">
            Đặt giới hạn chi (vd: Ăn uống 2 triệu) hoặc mục tiêu tích luỹ (vd: Tiết kiệm 1 triệu) cho từng nhãn.
          </p>
          <Link href="/personal/labels"
            className="mt-4 rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-[#f5efe2]/85 hover:bg-white/10">
            Đặt mục tiêu
          </Link>
        </div>
      ) : (
        <>
          {/* Tổng đã lên kế hoạch so với thu nhập */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/5 px-5 py-3 text-xs text-[#f5efe2]/55 sm:px-6">
            <span>Đã lên kế hoạch <b className="font-semibold tabular-nums text-[#f5efe2]">{formatMoney(planned)}</b></span>
            {income > 0 && (
              <>
                <span>Thu nhập <b className="font-semibold tabular-nums text-[#f5efe2]">{formatMoney(income)}</b></span>
                <span className={unplanned < 0 ? 'text-rose-300' : ''}>
                  {unplanned >= 0 ? 'Chưa phân bổ ' : 'Kế hoạch vượt thu nhập '}
                  <b className="font-semibold tabular-nums">{formatMoney(Math.abs(unplanned))}</b>
                </span>
              </>
            )}
          </div>

          <ul className="divide-y divide-white/5">
            {items.map(item => <GoalRow key={item.goal.id} item={item} />)}
          </ul>
        </>
      )}
    </DarkPanel>
  )
}

function GoalRow({ item }: { item: GoalProgress }) {
  const { goal, label, actual, pct, remaining, status, fastPace } = item
  const isLimit = goal.kind === 'limit'
  const color = BAR_COLOR[status]

  let note: React.ReactNode
  if (status === 'over') note = <span className="text-rose-300">vượt {formatMoney(-remaining)}</span>
  else if (status === 'done') note = (
    <span className="inline-flex items-center gap-1 text-emerald-300">
      <Check size={13} /> đạt{remaining < 0 ? `, hơn ${formatMoney(-remaining)}` : ''}
    </span>
  )
  else if (isLimit) note = <span className={status === 'warn' ? 'text-amber-300' : 'text-[#f5efe2]/60'}>còn {formatMoney(remaining)}</span>
  else note = <span className="text-[#f5efe2]/60">cần thêm {formatMoney(remaining)}</span>

  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: label?.color ?? '#9ca3af' }} />
          <span className="truncate text-sm font-semibold">{label?.name ?? 'Nhãn đã xoá'}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            isLimit ? 'bg-white/10 text-[#f5efe2]/60' : 'bg-sky-400/15 text-sky-300'
          }`}>
            {isLimit ? 'Giới hạn' : 'Tích luỹ'}
          </span>
        </div>
        <span className="shrink-0 text-right text-sm tabular-nums">
          <b className="font-bold">{formatMoney(actual)}</b>
          <span className="text-[#f5efe2]/45"> / {formatMoney(goal.amount)}</span>
        </span>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color, boxShadow: `0 0 12px ${color}88` }} />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        {note}
        <span className="tabular-nums text-[#f5efe2]/45">{Math.round(pct)}%</span>
      </div>

      {fastPace && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-300">
          <AlertTriangle size={13} /> Đang chi nhanh hơn kế hoạch so với thời gian đã qua trong kỳ
        </p>
      )}
    </li>
  )
}
