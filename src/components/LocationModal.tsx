import { useEffect, useRef, useState } from 'react'
import { PHILIPPINES_REGIONS } from '../lib/locations'
import { type Category, type Location } from '../types'
import { fetchSearchSuggestions, type SearchSuggestion } from '../lib/tripadvisor'

interface Props {
  initial: Location
  initialCategory?: Category
  initialSearch?: string
  onClose: () => void
  onSelect: (l: Location, c?: Category, searchQuery?: string) => void
}

const select =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 cursor-pointer shadow-2xs transition'

const COUNTRY = 'Philippines'

export default function LocationModal({
  initial,
  initialCategory = 'restaurants',
  initialSearch = '',
  onClose,
  onSelect,
}: Props) {
  const [region, setRegion] = useState(
    initial.country === COUNTRY ? initial.region : 'Region XII — SOCCSKSARGEN'
  )
  const [city, setCity] = useState(() => {
    const cities = PHILIPPINES_REGIONS[initial.region] ?? []
    return cities.includes(initial.city) ? initial.city : cities[0] ?? 'General Santos'
  })

  const [searchQuery, setSearchQuery] = useState(initialSearch)

  // Live TripAdvisor suggestions
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const searchInputRef = useRef<HTMLDivElement | null>(null)

  const cities = PHILIPPINES_REGIONS[region] ?? []

  const changeRegion = (r: string) => {
    setRegion(r)
    setCity(PHILIPPINES_REGIONS[r]?.[0] ?? '')
  }

  const regions = Object.keys(PHILIPPINES_REGIONS)

  // Fetch live TripAdvisor suggestions as the user types
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([])
      setSuggestionsLoading(false)
      return
    }

    let active = true
    setSuggestionsLoading(true)
    const timeout = setTimeout(() => {
      fetchSearchSuggestions(searchQuery, city)
        .then((items) => {
          if (active) {
            setSuggestions(items)
            setShowSuggestions(items.length > 0)
          }
        })
        .finally(() => {
          if (active) setSuggestionsLoading(false)
        })
    }, 250)

    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [searchQuery, city])

  // Click outside to dismiss suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    setSearchQuery(suggestion.name)
    setShowSuggestions(false)
  }

  const handleSubmit = () => {
    onSelect(
      { country: COUNTRY, region, city },
      undefined,
      searchQuery.trim() || undefined
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
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
              Exploring <span className="font-semibold text-emerald-700">Philippines</span> — select your region, city, and target place.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Country — locked */}
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

        {/* Search Bar PLACED AT THE TOP OF CATEGORY */}
        <div className="relative" ref={searchInputRef}>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
            <span>Search Specific Place / Keyword (Optional)</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[11px] text-rose-600 hover:underline font-semibold cursor-pointer"
              >
                Clear
              </button>
            )}
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-slate-400 pointer-events-none">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true)
              }}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowSuggestions(true)
              }}
              placeholder={`e.g. beach, London Beach Resort, Aa's Native Cuisine, cafe…`}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 transition shadow-2xs"
            />
            {suggestionsLoading && (
              <span className="absolute right-3 h-3.5 w-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></span>
            )}
          </div>

          {/* TripAdvisor Auto-Suggestions Dropdown Popup */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
              <div className="px-3.5 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span>TripAdvisor® Suggestions in {city}</span>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 transition flex items-start gap-2 cursor-pointer group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-900 truncate">
                        {item.name}
                      </p>
                      {item.address && (
                        <p className="text-[10px] text-slate-400 truncate">
                          {item.address}
                        </p>
                      )}
                    </div>
                    {item.geo && (
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium shrink-0">
                        {item.geo}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
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
            onClick={handleSubmit}
            className="rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900 transition cursor-pointer shadow-xs flex items-center"
          >
            Explore on Map →
          </button>
        </div>
      </div>
    </div>
  )
}
