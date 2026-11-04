import { format } from 'date-fns'
import type { PersonalExpense, PersonalGoal, PersonalLabel } from '@/lib/supabase'

// ── Kỳ chi tiêu: từ ngày 10 tháng này đến ngày 9 tháng sau ────────────────
export type Period = { from: string; to: string } // yyyy-MM-dd

export function currentPeriod(today = new Date()): Period {
  const y = today.getFullYear(), m = today.getMonth()
  const start = today.getDate() >= 10 ? new Date(y, m, 10) : new Date(y, m - 1, 10)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 9)
  return { from: format(start, 'yyyy-MM-dd'), to: format(end, 'yyyy-MM-dd') }
}

/** Đọc 'yyyy-MM-dd' theo giờ địa phương (new Date('yyyy-MM-dd') đọc theo UTC) */
export function parseDay(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Tỉ lệ thời gian đã trôi qua trong kỳ (0..1); null nếu hôm nay nằm ngoài kỳ */
export function periodElapsed(period: Period, today = new Date()): number | null {
  const from = parseDay(period.from).getTime()
  const to = parseDay(period.to).getTime() + 86_400_000 // hết ngày cuối kỳ
  const now = today.getTime()
  if (now < from || now >= to) return null
  return (now - from) / (to - from)
}

// ── Chi tiêu / Tích luỹ ────────────────────────────────────────────────────
/** Nhãn có mục tiêu tích luỹ: các khoản của nhãn này là tiền chuyển đi để dành, không phải tiêu */
export function savingLabelIds(goals: PersonalGoal[]): Set<string> {
  return new Set(goals.filter(g => g.kind === 'target').map(g => g.label_id))
}

export function isSaving(exp: PersonalExpense, savingIds: Set<string>) {
  return exp.type !== 'income' && !!exp.label_id && savingIds.has(exp.label_id)
}

export type Totals = { income: number; spending: number; saving: number; net: number }

/** Thu vào, Chi tiêu (tiêu dùng), Tích luỹ (chuyển sang quỹ). Còn lại = Thu − Chi tiêu − Tích luỹ. */
export function splitTotals(expenses: PersonalExpense[], savingIds: Set<string>): Totals {
  let income = 0, spending = 0, saving = 0
  for (const e of expenses) {
    if (e.type === 'income') income += e.amount
    else if (isSaving(e, savingIds)) saving += e.amount
    else spending += e.amount
  }
  return { income, spending, saving, net: income - spending - saving }
}

// ── Tiến độ mục tiêu ───────────────────────────────────────────────────────
export type GoalStatus = 'ok' | 'warn' | 'over' | 'progress' | 'done'

export type GoalProgress = {
  goal: PersonalGoal
  label: PersonalLabel | null
  actual: number
  pct: number          // % so với mục tiêu (có thể > 100)
  remaining: number    // mục tiêu − thực tế (âm khi vượt)
  status: GoalStatus
  fastPace: boolean    // giới hạn chi: đang chi nhanh hơn thời gian đã trôi qua
}

export function goalProgress(
  goals: PersonalGoal[],
  labels: PersonalLabel[],
  expenses: PersonalExpense[],
  period: Period,
  today = new Date(),
): GoalProgress[] {
  const labelById = new Map(labels.map(l => [l.id, l]))
  const sumByLabel = new Map<string, number>()
  for (const e of expenses) {
    if (e.type === 'income' || !e.label_id) continue
    sumByLabel.set(e.label_id, (sumByLabel.get(e.label_id) ?? 0) + e.amount)
  }
  const elapsed = periodElapsed(period, today)

  return goals
    .map(goal => {
      const actual = sumByLabel.get(goal.label_id) ?? 0
      const ratio = goal.amount > 0 ? actual / goal.amount : 0
      let status: GoalStatus
      if (goal.kind === 'limit') status = ratio > 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok'
      else status = ratio >= 1 ? 'done' : 'progress'
      // Chi nhanh: đã dùng nhiều hơn phần thời gian đã qua ít nhất 15 điểm %, và đã dùng từ 30%
      const fastPace = goal.kind === 'limit' && status !== 'over' && elapsed !== null
        && ratio >= 0.3 && ratio > elapsed + 0.15
      return {
        goal,
        label: labelById.get(goal.label_id) ?? null,
        actual,
        pct: ratio * 100,
        remaining: goal.amount - actual,
        status,
        fastPace,
      }
    })
    // Giới hạn chi trước (đáng chú ý hơn), rồi tích luỹ; trong mỗi nhóm xếp theo % giảm dần
    .sort((a, b) => (a.goal.kind === b.goal.kind ? b.pct - a.pct : a.goal.kind === 'limit' ? -1 : 1))
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'
}
