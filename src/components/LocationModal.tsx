import { useState } from 'react'
import { PHILIPPINES_REGIONS } from '../lib/locations'
import { CATEGORIES, type Category, type Location } from '../types'

interface Props {
  initial: Location
  onClose: () => void
  onSelect: (l: Location, c?: Category) => void
}

const select =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 cursor-pointer'

const COUNTRY = 'Philippines'

export default function LocationModal({ initial, onClose, onSelect }: Props) {
  const [region, setRegion] = useState(
    initial.country === COUNTRY ? initial.region : 'Metro Manila (NCR)'
  )
  const [city, setCity] = useState(() => {
    const cities = PHILIPPINES_REGIONS[initial.region] ?? []
    return cities.includes(initial.city) ? initial.city : cities[0] ?? ''
  })
  const [category, setCategory] = useState<Category>('restaurants')

  const cities = PHILIPPINES_REGIONS[region] ?? []

  const changeRegion = (r: string) => {
    setRegion(r)
    setCity(PHILIPPINES_REGIONS[r]?.[0] ?? '')
  }

  const regions = Object.keys(PHILIPPINES_REGIONS)

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-lg">🇵🇭</span>
              <h2 className="text-base font-bold text-slate-900">Change Exploration Scope</h2>
            </div>
            <p className="text-xs text-slate-500">
              Exploring <span className="font-semibold text-emerald-700">Philippines</span> — select your region and city.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Country — locked, display only */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Country (Fixed)</label>
          <div className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-400 flex items-center gap-2 select-none">
            <span>🇵🇭</span>
            <span>Philippines</span>
            <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">LOCKED</span>
          </div>
        </div>

        {/* Region / Province */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Region / Province
          </label>
          <select
            className={select}
            value={region}
            onChange={(e) => changeRegion(e.target.value)}
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* City / Municipality */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            City / Municipality
          </label>
          <select
            className={select}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                  category === c.id
                    ? 'border-emerald-700 bg-emerald-800 text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSelect({ country: COUNTRY, region, city }, category)
            }
            className="rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900 transition cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <span>🗺️</span>
            Explore on Map →
          </button>
        </div>
      </div>
    </div>
  )
}
