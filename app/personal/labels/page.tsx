'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type PersonalLabel, type PersonalGoal } from '@/lib/supabase'
import { formatMoney } from '@/lib/goals'
import { THEME_DEFAULTS, PERSONAL_THEME_KEY, readCachedTheme, claimThemeCache, syncPersonalTheme } from '@/lib/themeStore'
import { Plus, Pencil, Trash2, Check, BarChart2 } from 'lucide-react'
import { getContrastColors } from '@/lib/theme'
import NightFlowerField from '@/components/NightFlowerField'
import { DarkPanel, DarkModal, darkInput, NightTopBar, NavPill, PageTitle } from '@/components/NightUI'

const PRESET_COLORS = [
  '#6c7ee1', '#92b9e3', '#ffc4a4', '#fba2d0',
  '#5d7b6f', '#a4c2a2', '#b0d4b8', '#eae7d6',
  '#d7f9fa', '#593e67', '#84495f', '#b85b56',
  '#de741c', '#fea837', '#d24150',
]

export default function LabelsPage() {
  const router = useRouter()
  const [labels, setLabels] = useState<PersonalLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [avatar, setAvatar] = useState('')
  const [displayName, setDisplayName] = useState('User')

  // Add/Edit state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState(PRESET_COLORS[0])
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [themeColor, setThemeColor] = useState('#059669')

  // Mục tiêu hằng tháng của từng nhãn
  const [goals, setGoals] = useState<PersonalGoal[]>([])
  const [goalKind, setGoalKind] = useState<'none' | 'limit' | 'target'>('none')
  const [goalAmount, setGoalAmount] = useState('')

  useEffect(() => {
    const saved = readCachedTheme(PERSONAL_THEME_KEY)
    if (saved) setThemeColor(saved)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      if (!claimThemeCache(user.id)) setThemeColor(THEME_DEFAULTS.personal)

      const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url, personal_theme').eq('id', user.id).single()
      if (profile) {
        setDisplayName(profile.display_name || user.email?.split('@')[0] || 'User')
        setAvatar(profile.avatar_url || '')
      }
      syncPersonalTheme(user.id, profile?.personal_theme, setThemeColor)

      const [{ data }, { data: goalData }] = await Promise.all([
        supabase.from('personal_labels').select('*').order('created_at'),
        supabase.from('personal_goals').select('*'),
      ])
      setLabels((data as PersonalLabel[]) ?? [])
      setGoals((goalData as PersonalGoal[]) ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  const goalByLabel = new Map(goals.map(g => [g.label_id, g]))

  function openAdd() {
    setEditingId(null); setFormName(''); setFormColor(PRESET_COLORS[0])
    setGoalKind('none'); setGoalAmount('')
    setFormError(''); setShowForm(true)
  }

  function openEdit(label: PersonalLabel) {
    setEditingId(label.id); setFormName(label.name); setFormColor(label.color)
    const g = goalByLabel.get(label.id)
    setGoalKind(g?.kind ?? 'none')
    setGoalAmount(g ? Math.round(g.amount).toLocaleString('vi-VN') : '')
    setFormError(''); setShowForm(true)
  }

  function handleGoalAmountChange(val: string) {
    const d = val.replace(/\D/g, '')
    setGoalAmount(d ? parseInt(d).toLocaleString('vi-VN') : '')
  }

  async function handleSave() {
    if (!formName.trim()) { setFormError('Vui lòng nhập tên nhãn'); return }
    const goalNum = parseFloat(goalAmount.replace(/\./g, '').replace(/,/g, ''))
    if (goalKind !== 'none' && (isNaN(goalNum) || goalNum <= 0)) { setFormError('Số tiền mục tiêu không hợp lệ'); return }
    setSaving(true)

    let labelId = editingId
    if (editingId) {
      const { error } = await supabase.from('personal_labels')
        .update({ name: formName.trim(), color: formColor }).eq('id', editingId)
      if (error) { setFormError(error.message); setSaving(false); return }
      setLabels(prev => prev.map(l => l.id === editingId ? { ...l, name: formName.trim(), color: formColor } : l))
    } else {
      const { data, error } = await supabase.from('personal_labels')
        .insert({ name: formName.trim(), color: formColor, user_id: userId })
        .select().single()
      if (error) { setFormError(error.message); setSaving(false); return }
      setLabels(prev => [...prev, data as PersonalLabel])
      labelId = (data as PersonalLabel).id
    }

    // Mục tiêu: không đặt → xoá; có → tạo mới hoặc cập nhật (mỗi nhãn tối đa 1 mục tiêu)
    if (labelId) {
      if (goalKind === 'none') {
        if (goalByLabel.has(labelId)) {
          const { error } = await supabase.from('personal_goals').delete().eq('label_id', labelId)
          if (error) { setFormError('Đã lưu nhãn nhưng lỗi khi xoá mục tiêu: ' + error.message); setSaving(false); return }
          setGoals(prev => prev.filter(g => g.label_id !== labelId))
        }
      } else {
        const { data, error } = await supabase.from('personal_goals')
          .upsert({ label_id: labelId, user_id: userId, kind: goalKind, amount: goalNum }, { onConflict: 'label_id' })
          .select().single()
        if (error) { setFormError('Đã lưu nhãn nhưng lỗi khi lưu mục tiêu: ' + error.message); setSaving(false); return }
        setGoals(prev => [...prev.filter(g => g.label_id !== labelId), data as PersonalGoal])
      }
    }
    setSaving(false); setShowForm(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    // Mục tiêu của nhãn bị xoá theo (on delete cascade)
    await supabase.from('personal_labels').delete().eq('id', deleteId)
    setLabels(prev => prev.filter(l => l.id !== deleteId))
    setGoals(prev => prev.filter(g => g.label_id !== deleteId))
    setDeleteId(null)
  }

  const cc = getContrastColors(themeColor)

  return (
    // overflow-x-clip: quầng sáng của card tràn ra ngoài, không để nó tạo thanh cuộn ngang
    <div className="min-h-screen bg-[#04050b] text-[#f5efe2] overflow-x-clip">
      <NightFlowerField calm />

      <div className="relative z-10 mx-auto max-w-3xl px-5 pb-24 sm:px-8">
        <NightTopBar backHref="/personal">
          <NavPill href="/personal/report" label="Báo cáo"><BarChart2 size={16} /></NavPill>
        </NightTopBar>

        <PageTitle
          eyebrow="Cá nhân"
          dotColor={themeColor}
          title="Nhãn chi tiêu"
          subtitle={loading ? 'Đang tải…' : `${labels.length} nhãn · ${goals.length} mục tiêu hằng tháng · bấm ✎ để đặt mục tiêu`}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {loading
            ? [0, 1, 2, 3].map(i => (
                <div key={i} className="h-[76px] animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
              ))
            : labels.map(label => (
                <DarkPanel key={label.id} className="flex items-center gap-4 px-5 py-4 transition-colors hover:border-white/20">
                  <span className="h-10 w-10 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color, boxShadow: `0 0 18px ${label.color}66` }} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-semibold [overflow-wrap:anywhere]">{label.name}</p>
                    {(() => {
                      const g = goalByLabel.get(label.id)
                      if (!g) return <p className="mt-0.5 text-xs text-[#f5efe2]/35">Chưa đặt mục tiêu</p>
                      return (
                        <p className={`mt-0.5 text-xs font-medium ${g.kind === 'limit' ? 'text-[#f5efe2]/60' : 'text-sky-300'}`}>
                          {g.kind === 'limit' ? 'Giới hạn chi ' : 'Tích luỹ '}{formatMoney(g.amount)} / tháng
                        </p>
                      )
                    })()}
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button onClick={() => openEdit(label)} aria-label="Sửa nhãn"
                      className="rounded-lg p-2 text-[#f5efe2]/40 transition-colors hover:bg-white/10 hover:text-[#f5efe2]">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => setDeleteId(label.id)} aria-label="Xoá nhãn"
                      className="rounded-lg p-2 text-[#f5efe2]/40 transition-colors hover:bg-rose-400/15 hover:text-rose-300">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </DarkPanel>
              ))}

          {/* Thêm nhãn */}
          {!loading && (
            <button onClick={openAdd}
              className="flex min-h-[76px] items-center gap-4 rounded-3xl border border-dashed border-white/20 bg-[#0b0f1f]/75 px-5 py-4 text-left transition-colors hover:border-white/40">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 text-[#f5efe2]/80">
                <Plus size={20} />
              </span>
              <span>
                <span className="block font-semibold">Thêm nhãn</span>
                <span className="block text-sm text-[#f5efe2]/50">
                  {labels.length === 0 ? 'Tạo nhãn đầu tiên, ví dụ Ăn uống, Đi lại' : 'Thêm một nhóm thu chi mới'}
                </span>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── Popup thêm / sửa ── */}
      {showForm && (
        <DarkModal title={editingId ? 'Sửa nhãn' : 'Thêm nhãn mới'} onClose={() => setShowForm(false)}>
          <div className="space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[#f5efe2]/70">Tên nhãn</span>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus
                placeholder="Ví dụ: Ăn uống, Đi lại…" className={darkInput} />
            </label>

            <div>
              <span className="mb-2 block text-sm font-medium text-[#f5efe2]/70">Màu sắc</span>
              <div className="flex flex-wrap gap-3">
                {PRESET_COLORS.map(color => (
                  <button key={color} onClick={() => setFormColor(color)} aria-label={`Màu ${color}`}
                    className={`grid h-9 w-9 place-items-center rounded-full transition-transform hover:scale-110 ${
                      formColor === color ? 'ring-2 ring-[#f5efe2] ring-offset-2 ring-offset-[#0e1324]' : ''
                    }`}
                    style={{ backgroundColor: color }}>
                    {formColor === color && <Check size={16} color={getContrastColors(color).text} />}
                  </button>
                ))}
                {/* Màu tuỳ chỉnh */}
                <label title="Chọn màu tuỳ chỉnh"
                  className={`relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed transition-transform hover:scale-110 ${
                    !PRESET_COLORS.includes(formColor)
                      ? 'border-transparent ring-2 ring-[#f5efe2] ring-offset-2 ring-offset-[#0e1324]'
                      : 'border-white/30'
                  }`}
                  style={!PRESET_COLORS.includes(formColor) ? { backgroundColor: formColor } : undefined}>
                  {!PRESET_COLORS.includes(formColor)
                    ? <Check size={16} color={getContrastColors(formColor).text} />
                    : <Plus size={16} className="text-[#f5efe2]/60" />}
                  <input type="color" value={formColor} onChange={e => setFormColor(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs text-[#f5efe2]/50">Xem trước:</span>
                <span className="max-w-[14rem] truncate rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: formColor, color: getContrastColors(formColor).text }}>
                  {formName || 'Tên nhãn'}
                </span>
              </div>
            </div>

            {/* Mục tiêu hằng tháng */}
            <div>
              <span className="mb-2 block text-sm font-medium text-[#f5efe2]/70">Mục tiêu mỗi tháng</span>
              <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
                {([
                  ['none', 'Không đặt'],
                  ['limit', 'Giới hạn chi'],
                  ['target', 'Tích luỹ'],
                ] as const).map(([k, text]) => (
                  <button key={k} type="button" onClick={() => setGoalKind(k)}
                    className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors sm:text-sm ${
                      goalKind === k ? 'bg-[#f5efe2] text-[#151510]' : 'text-[#f5efe2]/55 hover:text-[#f5efe2]'
                    }`}>
                    {text}
                  </button>
                ))}
              </div>

              {goalKind !== 'none' && (
                <>
                  <div className="relative mt-3">
                    <input type="text" inputMode="numeric" value={goalAmount}
                      onChange={e => handleGoalAmountChange(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                      placeholder={goalKind === 'limit' ? 'Ví dụ: 2.000.000' : 'Ví dụ: 1.000.000'}
                      className={`${darkInput} pr-10 font-bold tabular-nums`} />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#f5efe2]/40">đ</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#f5efe2]/50">
                    {goalKind === 'limit'
                      ? 'Cảnh báo khi chi cho nhãn này gần chạm hoặc vượt mức trong mỗi kỳ (từ ngày 10 đến ngày 9 tháng sau).'
                      : 'Dùng cho tiền chuyển sang thẻ tiết kiệm/đầu tư. Các khoản của nhãn này được tính là "Tích luỹ", không tính vào "Chi tiêu".'}
                  </p>
                </>
              )}
            </div>

            {formError && <p className="text-sm text-rose-300">{formError}</p>}
            <button onClick={handleSave} disabled={saving}
              className="w-full rounded-full py-3.5 font-semibold transition-opacity disabled:opacity-50"
              style={{ backgroundColor: themeColor, color: cc.text }}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </DarkModal>
      )}

      {/* ── Xác nhận xoá ── */}
      {deleteId && (
        <DarkModal title="Xoá nhãn?" onClose={() => setDeleteId(null)} size="sm">
          <p className="mb-6 text-sm text-[#f5efe2]/60">Các khoản thu chi đang dùng nhãn này sẽ không còn được phân loại.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)}
              className="flex-1 rounded-full border border-white/20 py-3 font-semibold text-[#f5efe2]/80 hover:bg-white/10">
              Huỷ
            </button>
            <button onClick={handleDelete} className="flex-1 rounded-full bg-rose-500 py-3 font-semibold text-white hover:bg-rose-600">
              Xoá
            </button>
          </div>
        </DarkModal>
      )}
    </div>
  )
}
