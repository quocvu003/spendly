'use client'

// Khung "Mục tiêu": tiến độ từng mục tiêu trong kỳ, tổng đã lên kế hoạch so với thu nhập,
// cảnh báo khi đang chi nhanh hơn thời gian đã trôi qua. Dùng ở Sổ cá nhân và Báo cáo.

import Link from 'next/link'
import { AlertTriangle, Check, Target, X } from 'lucide-react'
import { Panel, SectionHeader } from '@/components/LightUI'
import { formatMoney, GOAL_KIND_NAME, type GoalProgress, type GoalStatus } from '@/lib/goals'
import type { GoalKind } from '@/lib/supabase'

const BAR_COLOR: Record<GoalStatus, string> = {
  ok: '#10b981',       // xanh: trong giới hạn
  warn: '#f59e0b',     // vàng: đã dùng từ 80%
  over: '#f43f5e',     // đỏ: vượt giới hạn
  progress: '#3b82f6', // xanh dương: đang tích luỹ
  done: '#10b981',     // xanh: đạt mục tiêu tích luỹ / đạt chỉ tiêu
  missed: '#f43f5e',   // đỏ: hết kỳ mà chưa đạt chỉ tiêu
}
const PAYMENT_PROGRESS_COLOR = '#8b5cf6' // tím: chỉ tiêu đang thực hiện

const KIND_BADGE: Record<GoalKind, string> = {
  limit: 'bg-slate-100 text-slate-500',
  payment: 'bg-violet-50 text-violet-600',
  target: 'bg-sky-50 text-sky-600',
}

export default function GoalProgressList({ title, periodLabel, items, income, loading = false, className = '', theme }: {
  title: string
  periodLabel: string
  items: GoalProgress[]
  income: number
  loading?: boolean
  className?: string
  /** Màu chủ đề: phủ gradient nhẹ lên khung */
  theme?: string
}) {
  const planned = items.reduce((s, i) => s + i.goal.amount, 0)
  const unplanned = income - planned

  return (
    <Panel theme={theme} className={`overflow-hidden ${className}`}>
      <SectionHeader title={title} right={periodLabel} />

      {loading ? (
        <div className="space-y-5 p-5 sm:p-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-3.5 w-1/3 animate-pulse rounded bg-slate-100" />
              <div className="h-2 w-full animate-pulse rounded-full bg-slate-50" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-200 text-slate-500">
            <Target size={22} />
          </span>
          <p className="mt-3 font-semibold">Chưa có mục tiêu nào</p>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Đặt giới hạn chi (vd: Ăn uống 2 triệu) hoặc mục tiêu tích luỹ (vd: Tiết kiệm 1 triệu) cho từng nhãn.
          </p>
          <Link href="/personal/labels"
            className="mt-4 rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Đặt mục tiêu
          </Link>
        </div>
      ) : (
        <>
          {/* Tổng đã lên kế hoạch so với thu nhập */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-6">
            <span>Đã lên kế hoạch <b className="font-semibold tabular-nums text-slate-900">{formatMoney(planned)}</b></span>
            {income > 0 && (
              <>
                <span>Thu nhập <b className="font-semibold tabular-nums text-slate-900">{formatMoney(income)}</b></span>
                <span className={unplanned < 0 ? 'text-rose-600' : ''}>
                  {unplanned >= 0 ? 'Chưa phân bổ ' : 'Kế hoạch vượt thu nhập '}
                  <b className="font-semibold tabular-nums">{formatMoney(Math.abs(unplanned))}</b>
                </span>
              </>
            )}
          </div>

          <ul className="divide-y divide-slate-100">
            {items.map(item => <GoalRow key={item.goal.id} item={item} />)}
          </ul>
        </>
      )}
    </Panel>
  )
}

function GoalRow({ item }: { item: GoalProgress }) {
  const { goal, label, actual, pct, remaining, status, fastPace } = item
  const isLimit = goal.kind === 'limit'
  const color = goal.kind === 'payment' && status === 'progress' ? PAYMENT_PROGRESS_COLOR : BAR_COLOR[status]

  let note: React.ReactNode
  if (status === 'over') note = <span className="text-rose-600">Vượt {formatMoney(-remaining)}</span>
  else if (status === 'missed') note = (
    <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
      <X size={13} /> Không đạt, thiếu {formatMoney(remaining)}
    </span>
  )
  else if (status === 'done') note = (
    <span className="inline-flex items-center gap-1 text-emerald-600">
      <Check size={13} /> Đạt{remaining < 0 ? `, hơn ${formatMoney(-remaining)}` : ''}
    </span>
  )
  else if (isLimit) note = <span className={status === 'warn' ? 'text-amber-600' : 'text-slate-500'}>Còn {formatMoney(remaining)}</span>
  else if (goal.kind === 'payment') note = <span className="text-slate-500">Chưa đạt, còn thiếu {formatMoney(remaining)}</span>
  else note = <span className="text-slate-500">Cần thêm {formatMoney(remaining)}</span>

  return (
    <li className="px-5 py-4 sm:px-6">
      {/* Mọi dòng cùng bố cục: tên + loại + % ở dòng 1, số tiền ở dòng 2 (tên nhãn không bị số tiền chèn mất chỗ) */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: label?.color ?? '#9ca3af' }} />
          <span className="truncate text-sm font-semibold">{label?.name ?? 'Nhãn đã xoá'}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_BADGE[goal.kind]}`}>
            {isLimit ? 'Giới hạn' : GOAL_KIND_NAME[goal.kind]}
          </span>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color }}>{Math.round(pct)}%</span>
      </div>

      <p className="mt-1 pl-[18px] text-sm tabular-nums">
        <b className="font-bold">{formatMoney(actual)}</b>
        <span className="text-slate-500"> / {formatMoney(goal.amount)}</span>
      </p>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
      </div>

      <div className="mt-1.5 text-xs">{note}</div>

      {fastPace && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle size={13} /> Đang chi nhanh hơn kế hoạch so với thời gian đã qua trong kỳ
        </p>
      )}
    </li>
  )
}
