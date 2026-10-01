import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import TourVistaLogo from './TourVistaLogo'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category =
  | 'restaurants'
  | 'hotels'
  | 'tours'
  | 'attractions'
  | 'nature'
  | 'inspire'
  | 'heritage'
  | 'shopping'
  | 'beaches'
  | 'religious'

interface LocalPlace {
  id: string
  name: string
  lat: number
  lng: number
  image_url: string
  url?: string
  reference_url?: string
  description?: string
  category: Category
  address?: string
  tags?: string[]
  rating?: number | null
  city: string
  created_at?: string
}

const BLANK_FORM: Omit<LocalPlace, 'id' | 'created_at'> = {
  name: '',
  lat: 6.1164,
  lng: 125.1716,
  image_url: '',
  url: '',
  reference_url: '',
  description: '',
  category: 'attractions',
  address: '',
  tags: [],
  rating: 0,
  city: 'General Santos City',
}

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'attractions', label: 'Attractions' },
  { id: 'nature', label: 'Nature & Parks' },
  { id: 'beaches', label: 'Beaches' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'heritage', label: 'Heritage' },
  { id: 'religious', label: 'Religious' },
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'hotels', label: 'Hotels' },
  { id: 'tours', label: 'Tours' },
  { id: 'inspire', label: 'Inspire' },
]

interface Props {
  onLogout: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard({ onLogout }: Props) {
  const [places, setPlaces] = useState<LocalPlace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<LocalPlace, 'id' | 'created_at'>>(BLANK_FORM)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  const [filterCat, setFilterCat] = useState<Category | 'all'>('all')
  const [searchQ, setSearchQ] = useState('')

  // ── Helpers ───────────────────────────────────────────────────────────────

  const flash = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3500) }
    else { setError(msg); setTimeout(() => setError(''), 5000) }
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchPlaces = async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('local_places')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) { flash(err.message, 'error'); setLoading(false); return }
    setPlaces((data ?? []) as LocalPlace[])
    setLoading(false)
  }

  useEffect(() => { fetchPlaces() }, [])

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      lat: Number(form.lat),
      lng: Number(form.lng),
      image_url: form.image_url.trim(),
      reference_url: form.reference_url?.trim() || null,
      description: form.description?.trim() || null,
      category: form.category,
      address: form.address?.trim() || null,
      tags: form.tags && form.tags.length > 0 ? form.tags : null,
      rating: form.rating ? Number(form.rating) : null,
      city: form.city.trim() || 'General Santos City',
    }
    if (!payload.name || !payload.image_url) {
      flash('Name and Image URL are required.', 'error')
      setSaving(false)
      return
    }
    if (editingId) {
      const { error: err } = await supabase.from('local_places').update(payload).eq('id', editingId)
      if (err) { flash(err.message, 'error') }
      else { flash(`"${payload.name}" updated successfully.`, 'success'); closeForm(); fetchPlaces() }
    } else {
      const { error: err } = await supabase.from('local_places').insert(payload)
      if (err) { flash(err.message, 'error') }
      else { flash(`"${payload.name}" added successfully.`, 'success'); closeForm(); fetchPlaces() }
    }
    setSaving(false)
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deletingId) return
    const target = places.find(p => p.id === deletingId)
    if (!target) return
    const { error: err } = await supabase.from('local_places').delete().eq('id', deletingId)
    if (err) { flash(err.message, 'error') }
    else { flash(`"${target.name}" deleted.`, 'success'); fetchPlaces() }
    setDeletingId(null)
    setDeleteConfirmName('')
  }

  // ── Form helpers ──────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingId(null)
    setForm(BLANK_FORM)
    setTagInput('')
    setShowForm(true)
  }

  const openEdit = (p: LocalPlace) => {
    setEditingId(p.id)
    setForm({
      name: p.name, lat: p.lat, lng: p.lng, image_url: p.image_url,
      url: p.url ?? '', reference_url: p.reference_url ?? '',
      description: p.description ?? '', category: p.category,
      address: p.address ?? '', tags: p.tags ?? [],
      rating: p.rating ?? 0, city: p.city,
    })
    setTagInput('')
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(BLANK_FORM) }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !form.tags?.includes(t)) {
      setForm(f => ({ ...f, tags: [...(f.tags ?? []), t] }))
    }
    setTagInput('')
  }

  const removeTag = (t: string) => setForm(f => ({ ...f, tags: f.tags?.filter(x => x !== t) ?? [] }))

  // ── Filtered ──────────────────────────────────────────────────────────────

  const filtered = places.filter(p => {
    const catOk = filterCat === 'all' || p.category === filterCat
    const q = searchQ.toLowerCase()
    const searchOk = !q || p.name.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q)
    return catOk && searchOk
  })

  const inputCls = 'w-full text-sm bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen font-['Plus_Jakarta_Sans',sans-serif]"
      style={{ background: 'linear-gradient(135deg,#f8fafc 0%,#eef2f7 100%)' }}
    >

      {/* ── Top Nav ───────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 px-6 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          boxShadow: '0 1px 12px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center gap-3">
          <TourVistaLogo variant="horizontal" size="sm" />
          <span
            className="text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full"
            style={{ background: 'linear-gradient(135deg,#08182b 0%,#0d2f50 100%)', color: '#a5f3fc' }}
          >
            Admin Panel
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-xs text-slate-400 font-medium">admin@gmail.com</span>
          <button
            onClick={onLogout}
            className="text-xs font-semibold text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 hover:bg-rose-50 px-4 py-1.5 rounded-lg transition cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Flash Messages ─────────────────────────────────────────── */}
      {success && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-semibold px-6 py-3 rounded-2xl shadow-2xl pointer-events-none">
          {success}
        </div>
      )}
      {error && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white text-sm font-semibold px-6 py-3 rounded-2xl shadow-2xl pointer-events-none">
          {error}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

        {/* ── Page Header ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Manage Places</h1>
            <p className="text-sm text-slate-500 mt-1">Add, edit, or delete curated local places shown on the map.</p>
          </div>
          <button
            onClick={openAdd}
            id="admin-add-place-btn"
            className="inline-flex items-center text-sm font-bold px-6 py-2.5 rounded-xl transition cursor-pointer shrink-0"
            style={{
              background: 'linear-gradient(135deg,#08182b 0%,#0d2f50 100%)',
              color: '#fff',
              boxShadow: '0 4px 20px rgba(8,24,43,0.25)',
            }}
          >
            Add New Place
          </button>
        </div>

        {/* ── Stats Cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div
            className="rounded-2xl p-5 shadow-md"
            style={{ background: 'linear-gradient(135deg,#08182b 0%,#0d2f50 100%)' }}
          >
            <p className="text-3xl font-black text-white leading-none">{places.length}</p>
            <p className="text-xs font-semibold mt-2 text-slate-300 uppercase tracking-wider">Total Places</p>
          </div>
          {CATEGORIES.slice(0, 3).map(c => (
            <div key={c.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/70 hover:shadow-md transition">
              <p className="text-3xl font-black text-slate-900 leading-none">{places.filter(p => p.category === c.id).length}</p>
              <p className="text-xs font-semibold mt-2 text-slate-500 uppercase tracking-wider">{c.label}</p>
            </div>
          ))}
        </div>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            id="admin-search-input"
            type="text"
            placeholder="Search by name or address..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className={`flex-1 ${inputCls}`}
          />
          <select
            id="admin-filter-cat"
            value={filterCat}
            onChange={e => setFilterCat(e.target.value as Category | 'all')}
            className="text-sm bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition cursor-pointer"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        {/* ── Table ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-28 gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
              <p className="text-sm text-slate-500 font-medium">Loading places...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-28 gap-3">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-black text-slate-300"
                style={{ background: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)' }}
              >
                0
              </div>
              <p className="font-bold text-slate-500">No places found</p>
              <button onClick={openAdd} className="text-xs font-bold text-teal-600 hover:text-teal-800 hover:underline cursor-pointer transition">
                Add your first place
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest px-5 py-3.5 w-16">Photo</th>
                    <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest px-5 py-3.5">Name</th>
                    <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest px-5 py-3.5 hidden md:table-cell">Category</th>
                    <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest px-5 py-3.5 hidden lg:table-cell">Address</th>
                    <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest px-5 py-3.5 hidden sm:table-cell">Rating</th>
                    <th className="text-right text-[11px] font-bold text-slate-400 uppercase tracking-widest px-5 py-3.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition group">
                      <td className="px-5 py-3.5">
                        <div className="h-11 w-11 rounded-xl overflow-hidden bg-slate-100 shrink-0 shadow-sm">
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                            : <div className="h-full w-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">?</div>
                          }
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900 leading-tight">{p.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]">{p.city}</div>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <span className="inline-block text-[11px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full capitalize tracking-wide">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span className="text-slate-500 text-xs truncate max-w-[200px] block">{p.address || '—'}</span>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className="font-bold text-slate-700">
                          {p.rating ? p.rating.toFixed(1) : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                          <button
                            id={`admin-edit-${p.id}`}
                            onClick={() => openEdit(p)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50 transition cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            id={`admin-delete-${p.id}`}
                            onClick={() => { setDeletingId(p.id); setDeleteConfirmName(p.name) }}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3.5 border-t border-slate-100 text-xs text-slate-400 font-medium bg-slate-50/50">
                Showing <span className="font-bold text-slate-600">{filtered.length}</span> of <span className="font-bold text-slate-600">{places.length}</span> places
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════
          ADD / EDIT FORM MODAL
      ════════════════════════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between px-7 py-5 shrink-0"
              style={{ background: 'linear-gradient(135deg,#08182b 0%,#0d2f50 100%)' }}
            >
              <div>
                <h2 className="text-lg font-black text-white">
                  {editingId ? 'Edit Place' : 'Add New Place'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingId ? 'Update the place details below.' : 'Fill in all details for the new place.'}
                </p>
              </div>
              <button
                onClick={closeForm}
                className="h-8 w-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer text-base font-black"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <form id="admin-place-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-7 py-6 space-y-5">

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Place Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="admin-form-name" type="text" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. SM City General Santos" className={inputCls}
                />
              </div>

              {/* Lat / Lng */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Latitude <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="admin-form-lat" type="number" step="any" required value={form.lat}
                    onChange={e => setForm(f => ({ ...f, lat: parseFloat(e.target.value) || 0 }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Longitude <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="admin-form-lng" type="number" step="any" required value={form.lng}
                    onChange={e => setForm(f => ({ ...f, lng: parseFloat(e.target.value) || 0 }))}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Image URL */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Direct Image URL <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Must be direct image link (.jpg, .png, Unsplash, etc.)
                  </span>
                </div>
                <input
                  id="admin-form-image" type="url" required value={form.image_url}
                  onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                  placeholder="e.g. https://images.unsplash.com/photo-... or https://example.com/photo.jpg" className={inputCls}
                />

                {form.image_url && (
                  <div className="mt-2.5 space-y-1.5">
                    <div className="relative rounded-2xl overflow-hidden h-36 bg-slate-100 border border-slate-200 shadow-inner flex items-center justify-center">
                      <img
                        id="admin-image-preview"
                        src={form.image_url}
                        alt="preview"
                        className="h-full w-full object-cover"
                        onLoad={() => {
                          const errEl = document.getElementById('admin-img-err')
                          const succEl = document.getElementById('admin-img-succ')
                          if (errEl) errEl.style.display = 'none'
                          if (succEl) succEl.style.display = 'flex'
                        }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none'
                          const errEl = document.getElementById('admin-img-err')
                          const succEl = document.getElementById('admin-img-succ')
                          if (errEl) errEl.style.display = 'block'
                          if (succEl) succEl.style.display = 'none'
                        }}
                      />
                      <div id="admin-img-err" className="hidden p-4 text-center">
                        <div className="text-rose-600 font-bold text-xs flex items-center justify-center gap-1 mb-1">
                          <span>⚠️ Invalid Image URL</span>
                        </div>
                        <p className="text-[11px] text-slate-500 max-w-sm">
                          This URL is a website page (not a direct image file). Right-click the image on the website and select <strong className="text-slate-700">"Copy image address"</strong> (ending in .jpg, .png, .webp).
                        </p>
                      </div>
                    </div>
                    <div id="admin-img-succ" className="hidden items-center gap-1.5 text-[11px] font-semibold text-emerald-700 px-1">
                      <span>✓ Image loaded successfully</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Website / Reference URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Website URL</label>
                  <input
                    id="admin-form-url" type="url" value={form.url ?? ''}
                    onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                    placeholder="https://..." className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Reference URL</label>
                  <input
                    id="admin-form-ref-url" type="url" value={form.reference_url ?? ''}
                    onChange={e => setForm(f => ({ ...f, reference_url: e.target.value }))}
                    placeholder="https://..." className={inputCls}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Description</label>
                <textarea
                  id="admin-form-description" rows={3} value={form.description ?? ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the place..."
                  className="w-full text-sm bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                />
              </div>

              {/* Category / Rating */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="admin-form-category" value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
                    className="w-full text-sm bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition cursor-pointer"
                  >
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Rating (0–5)</label>
                  <input
                    id="admin-form-rating" type="number" min={0} max={5} step={0.1} value={form.rating ?? 0}
                    onChange={e => setForm(f => ({ ...f, rating: parseFloat(e.target.value) || 0 }))}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Address / City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Address</label>
                  <input
                    id="admin-form-address" type="text" value={form.address ?? ''}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Street, Barangay, City" className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">City</label>
                  <input
                    id="admin-form-city" type="text" value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="General Santos City" className={inputCls}
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Tags</label>
                <div className="flex gap-2">
                  <input
                    id="admin-form-tag-input" type="text" value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                    placeholder="Type a tag and press Enter" className={inputCls}
                  />
                  <button
                    type="button" onClick={addTag}
                    className="text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl transition cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
                {(form.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {(form.tags ?? []).map(t => (
                      <span key={t} className="inline-flex items-center gap-1.5 text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-100 px-3 py-1 rounded-full">
                        {t}
                        <button
                          type="button" onClick={() => removeTag(t)}
                          className="text-teal-400 hover:text-rose-500 cursor-pointer transition font-bold leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </form>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
              <button
                type="button" onClick={closeForm}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="admin-form-submit" form="admin-place-form" type="submit" disabled={saving}
                className="inline-flex items-center gap-2 text-sm font-bold px-7 py-2 rounded-xl transition cursor-pointer disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#08182b 0%,#0d2f50 100%)', color: '#fff', boxShadow: '0 4px 16px rgba(8,24,43,0.25)' }}
              >
                {saving && <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {editingId ? 'Save Changes' : 'Add Place'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          DELETE CONFIRM MODAL
      ════════════════════════════════════════════════════════════════ */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8">
            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-900">Delete Place</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                You are about to permanently delete{' '}
                <span className="font-bold text-slate-800">"{deleteConfirmName}"</span>.
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                id="admin-delete-cancel"
                onClick={() => setDeletingId(null)}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="admin-delete-confirm"
                onClick={confirmDelete}
                className="text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl shadow shadow-rose-200 transition cursor-pointer"
              >
                Delete Place
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
