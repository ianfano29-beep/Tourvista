import { useEffect, useMemo, useRef, useState } from 'react'
import { APIProvider, AdvancedMarker, Map, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { fetchPlaces } from '../lib/tripadvisor'
import { km } from '../lib/geo'
import { CATEGORIES, type Category, type LatLng, type Location, type Place } from '../types'
import PlaceModal from './PlaceModal'

interface Props {
  location: Location
  initialCategory: Category
  onBack: () => void
}

function Fit({ points }: { points: LatLng[] }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !points.length || typeof google === 'undefined') return
    try {
      const b = new google.maps.LatLngBounds()
      points.forEach((p) => b.extend(p))
      map.fitBounds(b, 60)
    } catch {
      // Ignore if google is not fully ready
    }
  }, [map, points])
  return null
}

function Route({ from, to, onInfo }: { from: LatLng; to: LatLng; onInfo: (t: string) => void }) {
  const map = useMap()
  const routes = useMapsLibrary('routes')
  useEffect(() => {
    if (!map || !routes) return
    try {
      const renderer = new routes.DirectionsRenderer({ map, suppressMarkers: true })
      new routes.DirectionsService()
        .route({ origin: from, destination: to, travelMode: routes.TravelMode.DRIVING })
        .then((r) => {
          renderer.setDirections(r)
          const leg = r.routes[0]?.legs[0]
          if (leg) onInfo(`${leg.distance?.text} · ${leg.duration?.text} by car`)
        })
        .catch(() => onInfo('Route unavailable'))
      return () => renderer.setMap(null)
    } catch {
      onInfo('Route unavailable')
    }
  }, [map, routes, from.lat, from.lng, to.lat, to.lng, onInfo])
  return null
}

// Fallback interactive stylized map when Google Maps API Key is not configured
function FallbackInteractiveMap({
  places,
  selectedId,
  onSelect,
  me,
}: {
  places: Place[]
  selectedId: string | null
  onSelect: (id: string) => void
  me: LatLng | null
}) {
  const lats = places.map((p) => p.lat).concat(me ? [me.lat] : [])
  const lngs = places.map((p) => p.lng).concat(me ? [me.lng] : [])

  const minLat = Math.min(...(lats.length ? lats : [14.5]))
  const maxLat = Math.max(...(lats.length ? lats : [14.6]))
  const minLng = Math.min(...(lngs.length ? lngs : [120.9]))
  const maxLng = Math.max(...(lngs.length ? lngs : [121.0]))

  const latSpan = Math.max(maxLat - minLat, 0.01)
  const lngSpan = Math.max(maxLng - minLng, 0.01)

  const getXY = (lat: number, lng: number) => {
    const x = 10 + ((lng - minLng) / lngSpan) * 80
    const y = 90 - ((lat - minLat) / latSpan) * 80
    return { x: Math.max(8, Math.min(92, x)), y: Math.max(8, Math.min(92, y)) }
  }

  return (
    <div className="relative h-full w-full bg-slate-900 overflow-hidden select-none">
      {/* Grid background texture */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="absolute top-4 left-4 z-10 rounded-lg bg-slate-800/90 backdrop-blur-xs border border-slate-700 px-3 py-1.5 text-xs text-slate-300 shadow">
        <span className="font-semibold text-teal-400">Interactive Discovery Map</span>
        <span className="ml-2 text-slate-400 text-[11px]">(Click pins to focus)</span>
      </div>

      {/* SVG Connecting lines */}
      <svg className="absolute inset-0 h-full w-full pointer-events-none">
        {selectedId && me && (
          (() => {
            const sel = places.find((p) => p.id === selectedId)
            if (!sel) return null
            const p1 = getXY(me.lat, me.lng)
            const p2 = getXY(sel.lat, sel.lng)
            return (
              <line
                x1={`${p1.x}%`}
                y1={`${p1.y}%`}
                x2={`${p2.x}%`}
                y2={`${p2.y}%`}
                stroke="#14b8a6"
                strokeWidth="3"
                strokeDasharray="6 4"
                className="animate-pulse"
              />
            )
          })()
        )}
      </svg>

      {/* User Location Marker */}
      {me && (
        (() => {
          const pos = getXY(me.lat, me.lng)
          return (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group z-20"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div className="h-4 w-4 rounded-full bg-blue-500 ring-4 ring-blue-500/30 animate-ping absolute" />
              <div className="h-4 w-4 rounded-full bg-blue-600 border-2 border-white relative z-10 shadow" />
              <span className="mt-1 rounded bg-blue-900/90 text-white px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap shadow">
                You are here
              </span>
            </div>
          )
        })()
      )}

      {/* Place Markers */}
      {places.map((p) => {
        const isSel = p.id === selectedId
        const pos = getXY(p.lat, p.lng)
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            className={`absolute -translate-x-1/2 -translate-y-full transition-all duration-200 cursor-pointer flex flex-col items-center z-10 ${
              isSel ? 'scale-125 z-30' : 'hover:scale-110 hover:z-20'
            }`}
          >
            <div
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-lg transition-all ${
                isSel
                  ? 'bg-amber-500 ring-4 ring-amber-500/40 text-slate-950'
                  : 'bg-teal-700 hover:bg-teal-600'
              }`}
            >
              <span>★ {p.rating.toFixed(1)}</span>
            </div>
            <div
              className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] -mt-0.5 ${
                isSel ? 'border-t-amber-500' : 'border-t-teal-700'
              }`}
            />
            <span
              className={`mt-1 max-w-[120px] truncate rounded px-1.5 py-0.5 text-[10px] font-medium shadow ${
                isSel
                  ? 'bg-amber-100 text-amber-950 font-bold'
                  : 'bg-slate-800/90 text-slate-200'
              }`}
            >
              {p.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function MapView({ location, initialCategory, onBack }: Props) {
  const [category, setCategory] = useState(initialCategory)
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [me, setMe] = useState<LatLng | null>(null)
  const [nearMe, setNearMe] = useState(false)
  const [query, setQuery] = useState('')
  const [minRating, setMinRating] = useState(0)
  const [maxKm, setMaxKm] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Place | null>(null)
  const [saved, setSaved] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('wander_saved_ids')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [routeInfo, setRouteInfo] = useState('')
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY

  const latLong = nearMe && me ? `${me.lat},${me.lng}` : undefined

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {}
      )
    }

    if (isSupabaseConfigured) {
      supabase
        .from('saved_places')
        .select('place_id')
        .then(({ data }) => {
          if (data) {
            setSaved((prev) => new Set([...prev, ...data.map((r) => r.place_id)]))
          }
        })
    }
  }, [])

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    setSelectedId(null)

    if (isSupabaseConfigured) {
      supabase
        .from('recent_searches')
        .insert({ ...location, category })
        .then(() => {})
    }

    fetchPlaces(category, location.city, latLong)
      .then((p) => {
        if (live) setPlaces(p)
      })
      .catch((e: Error) => {
        if (live) setError(e.message)
      })
      .finally(() => {
        if (live) setLoading(false)
      })

    return () => {
      live = false
    }
  }, [category, location, latLong])

  const visible = useMemo(
    () =>
      places.filter(
        (p) =>
          p.rating >= minRating &&
          `${p.name} ${p.address}`.toLowerCase().includes(query.toLowerCase()) &&
          (!maxKm || !me || km(me, p) <= maxKm)
      ),
    [places, query, minRating, maxKm, me]
  )

  const points = useMemo(
    () => [...visible.map((p) => ({ lat: p.lat, lng: p.lng })), ...(me ? [me] : [])],
    [visible, me]
  )

  const selected = visible.find((p) => p.id === selectedId)

  const select = (id: string) => {
    setSelectedId(id)
    setRouteInfo('')
    cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (me) {
      const target = places.find((p) => p.id === id)
      if (target) {
        const dist = km(me, target)
        setRouteInfo(`~${dist.toFixed(1)} km away (${Math.round(dist * 2.5)} mins drive)`)
      }
    }
  }

  const toggleSave = async (p: Place) => {
    const next = new Set(saved)
    if (saved.has(p.id)) {
      next.delete(p.id)
      setSaved(next)
      localStorage.setItem('wander_saved_ids', JSON.stringify([...next]))
      if (isSupabaseConfigured) {
        await supabase.from('saved_places').delete().eq('place_id', p.id)
      }
    } else {
      next.add(p.id)
      setSaved(next)
      localStorage.setItem('wander_saved_ids', JSON.stringify([...next]))
      if (isSupabaseConfigured) {
        await supabase.from('saved_places').insert({
          place_id: p.id,
          name: p.name,
          category: p.category,
          data: p,
        })
      }
    }
  }

  return (
    <div className="flex h-screen flex-col bg-stone-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-100 transition cursor-pointer text-stone-700"
          >
            ← Back
          </button>
          <div>
            <span className="font-bold text-teal-900 text-base">{location.city}</span>
            <span className="text-xs text-stone-500 ml-1.5">({location.country})</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`rounded-full px-3.5 py-1 text-xs font-medium transition cursor-pointer ${
                category === c.id
                  ? 'bg-teal-800 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-4 py-2 text-xs">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or street…"
          className="rounded-lg border border-stone-300 px-3 py-1.5 outline-none focus:border-teal-700 w-48 sm:w-64"
        />
        <select
          value={minRating}
          onChange={(e) => setMinRating(Number(e.target.value))}
          className="rounded-lg border border-stone-300 px-2.5 py-1.5 outline-none bg-white text-stone-700 cursor-pointer"
        >
          <option value={0}>All ratings</option>
          <option value={3}>3+ stars</option>
          <option value={4}>4+ stars</option>
          <option value={4.5}>4.5+ stars</option>
        </select>
        <select
          value={maxKm}
          onChange={(e) => setMaxKm(Number(e.target.value))}
          disabled={!me}
          className="rounded-lg border border-stone-300 px-2.5 py-1.5 outline-none bg-white text-stone-700 disabled:opacity-50 cursor-pointer"
        >
          <option value={0}>Any distance</option>
          <option value={2}>Within 2 km</option>
          <option value={5}>Within 5 km</option>
          <option value={10}>Within 10 km</option>
        </select>
        <button
          disabled={!me}
          onClick={() => setNearMe(!nearMe)}
          className={`rounded-lg border px-3 py-1.5 font-medium transition cursor-pointer disabled:opacity-40 ${
            nearMe ? 'border-teal-800 bg-teal-800 text-white' : 'border-stone-300 hover:bg-stone-100 text-stone-700'
          }`}
        >
          {nearMe ? '✓ Near me' : 'Near me'}
        </button>
        {me && (
          <span className="text-stone-500 hidden md:inline ml-auto text-[11px]">
            GPS: {me.lat.toFixed(3)}, {me.lng.toFixed(3)}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        <aside className="h-1/2 space-y-3 overflow-y-auto border-r border-stone-200 p-3.5 md:h-auto md:w-96 bg-stone-50">
          {loading && (
            <div className="flex items-center gap-2 text-stone-500 text-sm py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-800 border-t-transparent"></div>
              <span>Loading places in {location.city}…</span>
            </div>
          )}
          {error && <p className="text-rose-600 text-xs">{error}</p>}
          {!loading && !error && visible.length === 0 && (
            <div className="text-center py-8 text-stone-500 text-sm">
              <p>No places match your search filters.</p>
              <button
                onClick={() => {
                  setQuery('')
                  setMinRating(0)
                  setMaxKm(0)
                }}
                className="mt-2 text-xs font-semibold text-teal-800 hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          )}
          {visible.map((p) => (
            <div
              key={p.id}
              ref={(el) => {
                cardRefs.current[p.id] = el
              }}
              onClick={() => select(p.id)}
              className={`cursor-pointer overflow-hidden rounded-xl bg-white shadow-xs border transition duration-150 ${
                p.id === selectedId
                  ? 'border-teal-600 ring-2 ring-teal-600/30 shadow-md'
                  : 'border-stone-200 hover:border-stone-300 hover:shadow-sm'
              }`}
            >
              {p.photo && (
                <div className="relative h-36 w-full bg-stone-100">
                  <img src={p.photo} alt={p.name} className="h-full w-full object-cover" />
                  <span className="absolute bottom-2 left-2 rounded-md bg-stone-900/80 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                    ★ {p.rating.toFixed(1)}
                  </span>
                </div>
              )}
              <div className="space-y-1.5 p-3">
                <h3 className="font-semibold text-sm text-stone-900 line-clamp-1">{p.name}</h3>
                {me && (
                  <p className="text-xs text-teal-700 font-medium">
                    {km(me, p).toFixed(1)} km away
                  </p>
                )}
                <p className="line-clamp-1 text-xs text-stone-500">{p.address}</p>
                <div className="flex gap-2 pt-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDetail(p)
                    }}
                    className="flex-1 rounded-lg bg-teal-800 py-1.5 text-xs font-medium text-white hover:bg-teal-900 transition cursor-pointer"
                  >
                    View details
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSave(p)
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                      saved.has(p.id)
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : 'border-stone-300 hover:bg-stone-100 text-stone-700'
                    }`}
                  >
                    {saved.has(p.id) ? '♥ Saved' : '♡ Save'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </aside>

        <main className="relative h-1/2 flex-1 md:h-auto">
          {mapsApiKey ? (
            <APIProvider apiKey={mapsApiKey}>
              <Map
                mapId="DEMO_MAP_ID"
                defaultCenter={{ lat: visible[0]?.lat || 14.5995, lng: visible[0]?.lng || 120.9842 }}
                defaultZoom={13}
                gestureHandling="greedy"
              >
                <Fit points={points} />
                {me && (
                  <AdvancedMarker position={me} title="You are here">
                    <Pin background="#2563eb" borderColor="#1e3a8a" glyphColor="#fff" />
                  </AdvancedMarker>
                )}
                {visible.map((p) => (
                  <AdvancedMarker
                    key={p.id}
                    position={p}
                    title={p.name}
                    onClick={() => select(p.id)}
                    zIndex={p.id === selectedId ? 10 : 1}
                  >
                    <Pin
                      background={p.id === selectedId ? '#f59e0b' : '#115e59'}
                      borderColor="#042f2e"
                      glyphColor="#fff"
                      scale={p.id === selectedId ? 1.3 : 1}
                    />
                  </AdvancedMarker>
                ))}
                {me && selected && <Route from={me} to={selected} onInfo={setRouteInfo} />}
              </Map>
            </APIProvider>
          ) : (
            <FallbackInteractiveMap
              places={visible}
              selectedId={selectedId}
              onSelect={select}
              me={me}
            />
          )}

          {selected && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl bg-white/95 backdrop-blur-xs px-4 py-2.5 text-xs shadow-xl border border-stone-200 z-30 max-w-sm w-[90%] sm:w-auto text-center">
              <p className="font-semibold text-stone-900">{selected.name}</p>
              <p className="text-stone-500 mt-0.5">
                {routeInfo || (me ? 'Calculating direct distance…' : 'Enable location to see route distance')}
              </p>
            </div>
          )}
        </main>
      </div>

      {detail && (
        <PlaceModal
          place={detail}
          me={me}
          saved={saved.has(detail.id)}
          onSave={() => toggleSave(detail)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}
