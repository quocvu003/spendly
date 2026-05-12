'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, type PersonalLabel, type PersonalExpense } from '@/lib/supabase'
import { format } from 'date-fns'
import { ArrowLeft, Plus, Tag, BarChart2, ArrowUp, ArrowDown, Trash2, X, Pencil, Settings } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { getContrastColors } from '@/lib/theme'
import GlobalProfileHeader from '@/components/GlobalProfileHeader'
import ProfileSettingsModal from '@/components/ProfileSettingsModal'

function formatMoney(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'
}

function getMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
  }
}

export default function PersonalPage() {
  console.log("Trigger rebuild")
  const router = useRouter()
  const [expenses, setExpenses] = useState<PersonalExpense[]>([])
  const [labels, setLabels] = useState<PersonalLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')

  const defaultRange = getMonthRange()
  const [filterLabel, setFilterLabel] = useState('all')
  const [filterFrom, setFilterFrom] = useState(defaultRange.from)
  const [filterTo, setFilterTo] = useState(defaultRange.to)
  const [sortField, setSortField] = useState<'date' | 'amount'>('date')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  const [showAdd, setShowAdd] = useState(false)
  const [addAmount, setAddAmount] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [addDate, setAddDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [addLabelId, setAddLabelId] = useState('')
  const [addType, setAddType] = useState<'expense' | 'income'>('expense')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [themeColor, setThemeColor] = useState('#059669')
  const [personalName, setPersonalName] = useState('Sổ cá nhân')
  const [showSettings, setShowSettings] = useState(false)
  const [avatar, setAvatar] = useState('')
  const [displayName, setDisplayName] = useState('User')

  function handleThemeChange(color: string) {
    setThemeColor(color)
    localStorage.setItem('spendly_personal_theme', color)
  }

  const fetchExpenses = useCallback(async (
    labelId: string, from: string, to: string,
    field: 'date' | 'amount', order: 'desc' | 'asc'
  ) => {
    let q = supabase
      .from('personal_expenses')
      .select('*, label:personal_labels(*)')
      .gte('date', from)
      .lte('date', to)
      .order(field, { ascending: order === 'asc' })
    if (labelId !== 'all') q = (q as any).eq('label_id', labelId)
    const { data } = await q
    setExpenses((data as PersonalExpense[]) ?? [])
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      const savedTheme = localStorage.getItem('spendly_personal_theme')
      if (savedTheme) setThemeColor(savedTheme)
      const savedName = localStorage.getItem('spendly_personal_name')
      if (savedName) setPersonalName(savedName)

      const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).single()
      if (profile) {
        setDisplayName(profile.display_name || user.email?.split('@')[0] || 'User')
        setAvatar(profile.avatar_url || '')
      }

      const { data } = await supabase.from('personal_labels').select('*').order('created_at')
      setLabels((data as PersonalLabel[]) ?? [])
      await fetchExpenses('all', defaultRange.from, defaultRange.to, 'date', 'desc')
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line

  function handleSort(field: 'date' | 'amount') {
    const newOrder = sortField === field ? (sortOrder === 'desc' ? 'asc' : 'desc') : 'desc'
    setSortField(field); setSortOrder(newOrder)
    fetchExpenses(filterLabel, filterFrom, filterTo, field, newOrder)
  }

  function handleFilterLabel(id: string) {
    setFilterLabel(id)
    fetchExpenses(id, filterFrom, filterTo, sortField, sortOrder)
  }

  function handleDateChange(from: string, to: string) {
    setFilterFrom(from); setFilterTo(to)
    fetchExpenses(filterLabel, from, to, sortField, sortOrder)
  }

  function handleAmountChange(val: string) {
    const d = val.replace(/\D/g, '')
    setAddAmount(d ? parseInt(d).toLocaleString('vi-VN') : '')
  }

  function openAdd() {
    setEditingId(null)
    setAddAmount('')
    setAddDesc('')
    setAddDate(format(new Date(), 'yyyy-MM-dd'))
    setAddLabelId('')
    setAddType('expense')
    setAddError('')
    setShowAdd(true)
  }

  function openEdit(exp: PersonalExpense) {
    setEditingId(exp.id)
    setAddAmount(exp.amount.toLocaleString('vi-VN'))
    setAddDesc(exp.description)
    setAddDate(exp.date)
    setAddLabelId(exp.label_id || '')
    setAddType(exp.type || 'expense')
    setAddError('')
    setShowAdd(true)
  }

  async function handleSave() {
    if (!addAmount || !addDesc.trim()) { setAddError('Vui lòng điền đủ thông tin'); return }
    const num = parseFloat(addAmount.replace(/\./g, '').replace(/,/g, ''))
    if (isNaN(num) || num <= 0) { setAddError('Số tiền không hợp lệ'); return }
    setSaving(true)
    
    if (editingId) {
      const { error } = await supabase.from('personal_expenses')
        .update({
          amount: num, description: addDesc.trim(), date: addDate,
          label_id: addLabelId || null, type: addType
        })
        .eq('id', editingId)
      if (error) { setAddError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('personal_expenses').insert({
        user_id: userId,
        amount: num, description: addDesc.trim(), date: addDate,
        label_id: addLabelId || null,
        type: addType,
      })
      if (error) { setAddError(error.message); setSaving(false); return }
    }
    
    setShowAdd(false); setEditingId(null); setAddAmount(''); setAddDesc(''); setAddLabelId(''); setAddType('expense');
    setAddDate(format(new Date(), 'yyyy-MM-dd')); setAddError(''); setSaving(false)
    fetchExpenses(filterLabel, filterFrom, filterTo, sortField, sortOrder)
  }

  async function handleDelete() {
    if (!deleteId) return
    await supabase.from('personal_expenses').delete().eq('id', deleteId)
    setDeleteId(null)
    fetchExpenses(filterLabel, filterFrom, filterTo, sortField, sortOrder)
  }

  const totalExpense = expenses.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0)
  const totalIncome = expenses.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const netTotal = totalIncome - totalExpense
  const cc = getContrastColors(themeColor)
  if (loading) return <LoadingSpinner message="Đang tải..." fullscreen />

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4" style={{ backgroundColor: themeColor }}>
        <GlobalProfileHeader textColor={cc.text} />
        <div className="flex items-center gap-3 mb-3">
          <Link href="/rooms?mode=list" style={{ color: cc.muted }}>
            <ArrowLeft size={22} />
          </Link>
          <h1 className="font-bold text-lg flex-1 truncate" style={{ color: cc.text }}>{personalName}</h1>
          <div className="flex items-center gap-2">
            <Link href="/personal/labels" className="p-2 rounded-full transition-colors" style={{ backgroundColor: cc.iconBg, color: cc.text }}>
              <Tag size={18} />
            </Link>
            <Link href="/personal/report" className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: cc.iconBg, color: cc.text }}>
              <BarChart2 size={14} /> Report
            </Link>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-full transition-colors" style={{ backgroundColor: cc.iconBg, color: cc.text }}>
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Date range */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <p className="text-[10px] font-medium mb-0.5" style={{ color: cc.muted }}>Từ ngày</p>
            <input type="date" value={filterFrom} onChange={e => handleDateChange(e.target.value, filterTo)}
              className="w-full text-xs px-2 py-1.5 rounded-lg outline-none [color-scheme:dark]"
              style={{ backgroundColor: cc.iconBg, color: cc.text }} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-medium mb-0.5" style={{ color: cc.muted }}>Đến ngày</p>
            <input type="date" value={filterTo} onChange={e => handleDateChange(filterFrom, e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded-lg outline-none [color-scheme:dark]"
              style={{ backgroundColor: cc.iconBg, color: cc.text }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl px-2 py-2 flex flex-col items-center justify-center text-center" style={{ backgroundColor: cc.iconBg }}>
            <span className="text-[10px] font-medium opacity-80" style={{ color: cc.text }}>Thu vào</span>
            <span className="font-bold text-sm truncate w-full" style={{ color: cc.text }}>+{formatMoney(totalIncome)}</span>
          </div>
          <div className="rounded-xl px-2 py-2 flex flex-col items-center justify-center text-center" style={{ backgroundColor: cc.iconBg }}>
            <span className="text-[10px] font-medium opacity-80" style={{ color: cc.text }}>Chi ra</span>
            <span className="font-bold text-sm truncate w-full" style={{ color: cc.text }}>-{formatMoney(totalExpense)}</span>
          </div>
          <div className="rounded-xl px-2 py-2 flex flex-col items-center justify-center text-center" style={{ backgroundColor: cc.iconBg }}>
            <span className="text-[10px] font-medium opacity-80" style={{ color: cc.text }}>Còn lại</span>
            <span className="font-bold text-sm truncate w-full" style={{ color: cc.text }}>{netTotal >= 0 ? '+' : ''}{formatMoney(netTotal)}</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Filter + Sort */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button onClick={() => handleFilterLabel('all')}
            className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
            style={filterLabel === 'all'
              ? { backgroundColor: themeColor, borderColor: themeColor, color: cc.text }
              : { backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#6b7280' }}>
            Tất cả
          </button>
          {labels.map(l => (
            <button key={l.id} onClick={() => handleFilterLabel(l.id)}
              className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
              style={filterLabel === l.id
                ? { backgroundColor: l.color, borderColor: l.color, color: '#fff' }
                : { backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#6b7280' }}>
              {l.name}
            </button>
          ))}
          <div className="flex gap-1 ml-auto">
            <button onClick={() => handleSort('date')}
              className="flex items-center gap-0.5 px-2 h-7 rounded-lg border text-xs font-medium transition-colors"
              style={sortField === 'date'
                ? { backgroundColor: themeColor, borderColor: themeColor, color: cc.text }
                : { backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#6b7280' }}>
              📅{sortField === 'date' ? (sortOrder === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />) : <ArrowDown size={11} className="opacity-40" />}
            </button>
            <button onClick={() => handleSort('amount')}
              className="flex items-center gap-0.5 px-2 h-7 rounded-lg border text-xs font-medium transition-colors"
              style={sortField === 'amount'
                ? { backgroundColor: themeColor, borderColor: themeColor, color: cc.text }
                : { backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#6b7280' }}>
              💰{sortField === 'amount' ? (sortOrder === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />) : <ArrowDown size={11} className="opacity-40" />}
            </button>
          </div>
        </div>

        {/* List */}
        {expenses.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-sm">Chưa có khoản chi nào</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map(exp => (
              <div key={exp.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {exp.label && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                          style={{ backgroundColor: exp.label.color }}>
                          {exp.label.name}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{format(new Date(exp.date), 'dd/MM/yyyy')}</span>
                    </div>
                    <p className="font-medium text-sm text-gray-900">{exp.description}</p>
                  </div>
                      <div className="flex flex-col items-end gap-1.5 ml-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm ${exp.type === 'income' ? 'text-emerald-600' : 'text-gray-900'}`}>
                            {exp.type === 'income' ? '+' : '-'}{formatMoney(exp.amount)}
                          </span>
                          <button onClick={() => openEdit(exp)} className="text-gray-300 hover:text-indigo-400">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => setDeleteId(exp.id)} className="text-gray-300 hover:text-red-400">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={openAdd}
        className="fixed bottom-6 right-4 rounded-full px-5 py-3 flex items-center gap-2 shadow-lg transition-colors"
        style={{ backgroundColor: themeColor, color: cc.text }}>
        <Plus size={20} /><span className="font-medium text-sm">Thêm</span>
      </button>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Sửa giao dịch' : 'Thêm giao dịch'}</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
            </div>
            <div className="space-y-4">
              {/* Type Toggle */}
              <div className="flex bg-gray-100 rounded-xl p-1">
                {(['expense', 'income'] as const).map(t => (
                  <button key={t} onClick={() => setAddType(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${addType === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    style={addType === t ? { color: themeColor } : {}}>
                    {t === 'expense' ? '➖ Khoản chi' : '➕ Khoản thu'}
                  </button>
                ))}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền (VND)</label>
                <input type="text" inputMode="numeric" value={addAmount} onChange={e => handleAmountChange(e.target.value)}
                  placeholder="0" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <input type="text" value={addDesc} onChange={e => setAddDesc(e.target.value)}
                  placeholder="Ví dụ: Cà phê, Xăng xe..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
                  <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                  <select value={addLabelId} onChange={e => setAddLabelId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    <option value="">-- Không có --</option>
                    {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              {addError && <p className="text-red-500 text-sm">{addError}</p>}
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
            <h3 className="text-xl font-bold text-gray-900 mb-2">Xoá khoản chi?</h3>
            <p className="text-gray-500 text-sm mb-6">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-3 rounded-xl font-medium text-gray-700 bg-gray-100">Huỷ</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-red-500">Xoá</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <ProfileSettingsModal 
          onClose={() => setShowSettings(false)} 
          themeColor={themeColor} 
          currentTheme={themeColor}
          onChangeTheme={handleThemeChange}
        />
      )}
    </main>
  )
}
