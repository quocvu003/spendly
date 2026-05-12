'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, type PersonalLabel } from '@/lib/supabase'
import { ArrowLeft, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { getContrastColors } from '@/lib/theme'
import GlobalProfileHeader from '@/components/GlobalProfileHeader'

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

  useEffect(() => {
    const saved = localStorage.getItem('spendly_personal_theme')
    if (saved) setThemeColor(saved)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      
      const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).single()
      if (profile) {
        setDisplayName(profile.display_name || user.email?.split('@')[0] || 'User')
        setAvatar(profile.avatar_url || '')
      }

      const { data } = await supabase.from('personal_labels').select('*').order('created_at')
      setLabels((data as PersonalLabel[]) ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  function openAdd() {
    setEditingId(null); setFormName(''); setFormColor(PRESET_COLORS[0])
    setFormError(''); setShowForm(true)
  }

  function openEdit(label: PersonalLabel) {
    setEditingId(label.id); setFormName(label.name); setFormColor(label.color)
    setFormError(''); setShowForm(true)
  }

  async function handleSave() {
    if (!formName.trim()) { setFormError('Vui lòng nhập tên label'); return }
    setSaving(true)
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
    }
    setSaving(false); setShowForm(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    await supabase.from('personal_labels').delete().eq('id', deleteId)
    setLabels(prev => prev.filter(l => l.id !== deleteId))
    setDeleteId(null)
  }

  if (loading) return <LoadingSpinner message="Đang tải..." fullscreen />

  const cc = getContrastColors(themeColor)

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="px-4 pt-6 pb-4" style={{ backgroundColor: themeColor }}>
        <GlobalProfileHeader textColor={cc.text} />
        <div className="flex items-center gap-3">
          <Link href="/personal" style={{ color: cc.muted }}>
            <ArrowLeft size={22} />
          </Link>
          <h1 className="font-bold text-lg flex-1" style={{ color: cc.text }}>Quản lý Label</h1>
          <button onClick={openAdd}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
            style={{ backgroundColor: cc.iconBg, color: cc.text }}>
            <Plus size={14} /> Thêm
          </button>
        </div>
      </div>

      <div className="px-4 py-5">
        {labels.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🏷️</p>
            <p className="text-sm mb-4">Chưa có label nào</p>
            <button onClick={openAdd}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ backgroundColor: themeColor, color: cc.text }}>
              Tạo label đầu tiên
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {labels.map(label => (
              <div key={label.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
                <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
                <p className="flex-1 font-medium text-gray-900 text-sm">{label.name}</p>
                <button onClick={() => openEdit(label)} className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors">
                  <Pencil size={16} />
                </button>
                <button onClick={() => setDeleteId(label.id)} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                {editingId ? 'Sửa label' : 'Thêm label mới'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên label</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="Ví dụ: Ăn uống, Đi lại..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Màu sắc</label>
                <div className="flex flex-wrap gap-3">
                  {PRESET_COLORS.map(color => (
                    <button key={color} onClick={() => setFormColor(color)}
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                      style={{ backgroundColor: color }}>
                      {formColor === color && <Check size={16} color="white" />}
                    </button>
                  ))}
                  {/* Custom color picker */}
                  <label
                    className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 border-2 border-dashed border-gray-300 overflow-hidden relative"
                    title="Chọn màu tùy chỉnh"
                    style={!PRESET_COLORS.includes(formColor) ? { borderColor: formColor, backgroundColor: formColor } : {}}>
                    {!PRESET_COLORS.includes(formColor)
                      ? <Check size={16} color="white" />
                      : <span className="text-gray-400 text-xs font-bold">+</span>}
                    <input type="color" value={formColor}
                      onChange={e => setFormColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  </label>
                </div>
                {/* Preview */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Xem trước:</span>
                  <span className="text-xs px-3 py-1 rounded-full font-medium text-white"
                    style={{ backgroundColor: formColor }}>
                    {formName || 'Tên label'}
                  </span>
                </div>
              </div>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <button onClick={handleSave} disabled={saving}
                className="w-full py-3.5 rounded-xl font-semibold transition-colors disabled:opacity-50"
                style={{ backgroundColor: themeColor, color: cc.text }}>
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Xoá label?</h3>
            <p className="text-gray-500 text-sm mb-6">Các chi tiêu dùng label này sẽ không còn được phân loại.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-3 rounded-xl font-medium text-gray-700 bg-gray-100">Huỷ</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-red-500">Xoá</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
