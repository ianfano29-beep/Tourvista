import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPlaces, fetchSearchSuggestions, type SearchSuggestion } from '../lib/tripadvisor'
import { km } from '../lib/geo'
import { CATEGORIES, SUB_FILTERS, type Category, type LatLng, type Location, type Place } from '../types'
import LocationModal from './LocationModal'
import PlaceModal from './PlaceModal'

declare const L: any

interface Props {
  email: string
  location: Location
  onSelect: (l: Location, c: Category) => void
  onLogout?: () => void
}

// Compute realistic coastal and highway road waypoints for General Santos & coastal destinations
function computeRoadWaypoints(from: LatLng, to: LatLng): [number, number][] {
  const isSouthPoint = (p: LatLng) => p.lat < 6.08 && p.lng < 125.16
  const isNorthOrCityPoint = (p: LatLng) => p.lat >= 6.08

  if ((isSouthPoint(from) && isNorthOrCityPoint(to)) || (isNorthOrCityPoint(from) && isSouthPoint(to))) {
    const fromIsNorth = isNorthOrCityPoint(from)
    const north = fromIsNorth ? from : to
    const south = fromIsNorth ? to : from

    // Coastal road corridor waypoints along Makar-Siguel Road (AH26 / National Hwy)
    const corridor: [number, number][] = [
      [6.1120, 125.1580], // West Diversion Road
      [6.1040, 125.1430], // Makar Junction / Coastal interchange
      [6.0792, 125.1325], // Calumpang Coast Road
      [6.0425, 125.1242], // Fatima / Sarangani Highlands turn
      [6.0150, 125.1215], // Tambler Fish Port highway
      [5.9920, 125.1205], // Bawing / Coastal road
    ]

    const path: [number, number][] = [[north.lat, north.lng]]
    corridor.forEach((wp) => {
      if (wp[0] < north.lat && wp[0] >= south.lat) {
        path.push(wp)
      }
    })
    path.push([south.lat, south.lng])
    return fromIsNorth ? path : path.reverse()
  }

  // Standard city road interpolation
  return [
    [from.lat, from.lng],
    [(from.lat * 2 + to.lat) / 3, (from.lng * 2 + to.lng) / 3],
    [(from.lat + to.lat * 2) / 3, (from.lng + to.lng * 2) / 3],
    [to.lat, to.lng],
  ]
}

export default function Dashboard({ email, location, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<'explore' | 'details' | 'saved'>('explore')
  const [category, setCategory] = useState<Category>('attractions')
  const [subFilter, setSubFilter] = useState<string>('all')
  const [places, setPlaces] = useState<Place[]>([])
  const [apiError, setApiError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Search & Suggestions States
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)

  const [selectedCluster, setSelectedCluster] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'reviews'>('distance')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [minRating45, setMinRating45] = useState(false)
  const [within2km, setWithin2km] = useState(false)
  const [moderatePrice, setModeratePrice] = useState(false)
  const [viewMode, setViewMode] = useState<'split' | 'map'>('split')
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite' | 'terrain'>('standard')

  // Selected Place & Detail Modal
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailModalPlace, setDetailModalPlace] = useState<Place | null>(null)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [currentLoc, setCurrentLoc] = useState<Location>(location)

  // Real User Geolocation & Saved Places
  const [me, setMe] = useState<LatLng | null>(null)
  const [saved, setSaved] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('wander_saved_ids')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const userMarkerRef = useRef<any>(null)
  const routeLayerRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)
  const [routeTargetId, setRouteTargetId] = useState<string | null>(null)
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: string; walkMin: number; drivMin: number; name: string } | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Live TripAdvisor Auto-Suggestions
  useEffect(() => {
    if (!searchInput || searchInput.trim().length < 2) {
      setSuggestions([])
      setSuggestionsLoading(false)
      return
    }

    let active = true
    setSuggestionsLoading(true)
    const timeout = setTimeout(() => {
      fetchSearchSuggestions(searchInput, currentLoc.city)
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
  }, [searchInput, currentLoc.city])

  // 1. Capture real GPS coordinates from browser
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude
          const userLng = position.coords.longitude
          const userCoords: LatLng = { lat: userLat, lng: userLng }
          setMe(userCoords)
        },
        (error) => {
          console.warn('Geolocation access denied or unavailable:', error)
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      )
    }
  }, [])

  // 2. Fetch live TripAdvisor places for category, city & active search query
  useEffect(() => {
    let live = true
    setLoading(true)
    setApiError(null)
    const latLong = me ? `${me.lat},${me.lng}` : undefined

    fetchPlaces(category, currentLoc.city, latLong, activeSearch)
      .then((res) => {
        if (live) {
          setPlaces(res.places)
          if (res.error) {
            setApiError(res.error)
          }
          if (res.places.length > 0) {
            setSelectedId((prev) => (prev && res.places.some((p) => p.id === prev) ? prev : res.places[0].id))
          } else {
            setSelectedId(null)
          }
        }
      })
      .catch((err) => {
        if (live) setApiError(err?.message || 'Error fetching data')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [category, currentLoc.city, activeSearch, me])

  // 3. Filter and sort logic
  const filteredPlaces = useMemo(() => {
    return places
      .filter((p) => {
        if (activeTab === 'saved' && !saved.has(p.id)) return false
        if (subFilter !== 'all' && p.subCategory && p.subCategory !== subFilter) return false
        if (selectedCluster !== 'all' && p.cluster !== selectedCluster) return false
        if (searchInput && !activeSearch) {
          const q = searchInput.toLowerCase()
          const matches =
            p.name.toLowerCase().includes(q) ||
            p.address.toLowerCase().includes(q) ||
            (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
          if (!matches) return false
        }
        if (minRating45 && p.rating < 4.5) return false
        if (within2km && me && km(me, p) > 2.0) return false
        if (moderatePrice && p.price && !p.price.includes('$$') && !p.price.includes('€€') && !p.price.includes('₱₱')) return false
        if (onlyOpen && p.openStatus && p.openStatus.toLowerCase().includes('closed')) return false
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'distance' && me) return km(me, a) - km(me, b)
        if (sortBy === 'rating') return b.rating - a.rating
        if (sortBy === 'reviews') return (b.reviewCount || 0) - (a.reviewCount || 0)
        return 0
      })
  }, [places, activeTab, saved, subFilter, selectedCluster, searchInput, activeSearch, minRating45, within2km, moderatePrice, onlyOpen, sortBy, me])

  const selectedPlace = useMemo(() => {
    return places.find((p) => p.id === selectedId) || filteredPlaces[0] || null
  }, [places, selectedId, filteredPlaces])

  // 4. Initialize Leaflet Map
  useEffect(() => {
    let retries = 0
    const MAX_RETRIES = 40

    const tryInit = () => {
      if (mapInstanceRef.current) return

      const container = mapContainerRef.current
      if (!container || typeof L === 'undefined' || container.offsetWidth === 0) {
        retries++
        if (retries < MAX_RETRIES) {
          setTimeout(tryInit, 100)
        }
        return
      }

      const initialLat = me ? me.lat : places[0]?.lat || 6.1164
      const initialLng = me ? me.lng : places[0]?.lng || 125.1716

      const map = L.map(container, {
        center: [initialLat, initialLng],
        zoom: 13,
        zoomControl: false,
      })

      const googleStandard = L.tileLayer(
        'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        {
          maxZoom: 20,
          subdomains: ['0', '1', '2', '3'],
          attribution: 'Map data © Google',
        }
      )

      googleStandard.addTo(map)
      tileLayerRef.current = googleStandard
      mapInstanceRef.current = map
      setMapReady(true)
    }

    requestAnimationFrame(() => tryInit())
  }, [])

  // 5. Update Map Layer
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || typeof L === 'undefined') return

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current)
    }

    let url = 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
    if (mapLayer === 'satellite') {
      url = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
    } else if (mapLayer === 'terrain') {
      url = 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'
    }

    const newLayer = L.tileLayer(url, {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      attribution: 'Map data © Google',
    })

    newLayer.addTo(mapInstanceRef.current)
    tileLayerRef.current = newLayer
  }, [mapLayer, mapReady])

  // 6. Plot Place & User Markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || typeof L === 'undefined') return

    const map = mapInstanceRef.current

    if (me) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([me.lat, me.lng])
      } else {
        const userIcon = L.divIcon({
          className: '',
          html: `
            <div style="position:relative;display:flex;align-items:center;justify-content:center;width:36px;height:36px">
              <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(59,130,246,0.35);animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite"></div>
              <div style="width:20px;height:20px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);position:relative;z-index:2"></div>
              <div style="position:absolute;top:40px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1e3a5f;color:white;font-weight:700;padding:2px 8px;border-radius:9999px;font-size:10px;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:1px solid rgba(96,165,250,0.4)">You are here</div>
            </div>
            <style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })

        const marker = L.marker([me.lat, me.lng], { icon: userIcon, zIndexOffset: 2000 }).addTo(map)
        marker.bindPopup(`
          <div style="padding:8px;font-family:sans-serif">
            <p style="font-weight:700;color:#1e3a8a;margin:0">📍 Your Location</p>
            <p style="color:#64748b;font-size:11px;margin:4px 0 0">GPS: ${me.lat.toFixed(5)}, ${me.lng.toFixed(5)}</p>
          </div>
        `)
        userMarkerRef.current = marker
      }
    }

    Object.values(markersRef.current).forEach((m: any) => map.removeLayer(m))
    markersRef.current = {}

    filteredPlaces.forEach((p) => {
      const isSelected = p.id === selectedId
      const bgColor = isSelected ? '#f59e0b' : '#064e3b'
      const textColor = isSelected ? '#1c1917' : '#ffffff'
      const arrowColor = isSelected ? '#f59e0b' : '#064e3b'
      const scale = isSelected ? 'scale(1.25)' : 'scale(1)'
      const shadow = isSelected
        ? '0 0 0 4px rgba(245,158,11,0.4), 0 4px 12px rgba(0,0,0,0.3)'
        : '0 2px 8px rgba(0,0,0,0.25)'
      const shortName = p.name.split(' ').slice(0, 3).join(' ')

      const markerHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;transform:${scale};transition:transform 0.2s;cursor:pointer">
          <div style="display:flex;align-items:center;gap:4px;background:${bgColor};color:${textColor};padding:4px 10px;border-radius:9999px;font-size:11px;font-weight:700;border:2px solid white;box-shadow:${shadow}">
            <span>★${p.rating > 0 ? p.rating.toFixed(1) : 'TA'}</span>
          </div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${arrowColor};margin-top:-1px"></div>
          <span style="margin-top:2px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(255,255,255,0.97);padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;color:#0f172a;box-shadow:0 1px 4px rgba(0,0,0,0.15);border:1px solid #e2e8f0">${shortName}</span>
        </div>
      `

      const placeIcon = L.divIcon({
        className: '',
        html: markerHtml,
        iconSize: [120, 60],
        iconAnchor: [60, 52],
      })

      const marker = L.marker([p.lat, p.lng], {
        icon: placeIcon,
        zIndexOffset: isSelected ? 1000 : 100,
      }).addTo(map)

      marker.on('click', () => {
        setSelectedId(p.id)
        cardRefs.current[p.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })

      markersRef.current[p.id] = marker
    })

    if (filteredPlaces.length > 0 && map) {
      try {
        const boundsPoints: [number, number][] = filteredPlaces.map((p) => [p.lat, p.lng])
        if (me) boundsPoints.push([me.lat, me.lng])
        const bounds = L.latLngBounds(boundsPoints)
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.12), { maxZoom: 15 })
        }
      } catch {}
    }
  }, [filteredPlaces, selectedId, me, mapReady])

  // 7. Road Routing Fetcher (Hugs Actual Highways & Roads)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || typeof L === 'undefined') return

    const map = mapInstanceRef.current

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current)
      routeLayerRef.current = null
    }
    setRouteInfo(null)

    if (!routeTargetId || !me) return

    const target = places.find((p) => p.id === routeTargetId)
    if (!target || km(me, target) < 0.01) return

    setRouteLoading(true)

    const origin = `${me.lng},${me.lat}`
    const dest = `${target.lng},${target.lat}`

    const tryFetchRoute = async () => {
      try {
        const r1 = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${origin};${dest}?overview=full&geometries=geojson`,
          { signal: AbortSignal.timeout(4500) }
        )
        if (r1.ok) {
          const data = await r1.json()
          if (data.code === 'Ok' && data.routes?.[0]) return data.routes[0]
        }
      } catch {}

      try {
        const r2 = await fetch(
          `https://routing.openstreetmap.de/routed-car/route/v1/driving/${origin};${dest}?overview=full&geometries=geojson`,
          { signal: AbortSignal.timeout(4500) }
        )
        if (r2.ok) {
          const data = await r2.json()
          if (data.code === 'Ok' && data.routes?.[0]) return data.routes[0]
        }
      } catch {}

      return null
    }

    tryFetchRoute()
      .then((route) => {
        if (route && route.geometry?.coordinates?.length > 1) {
          const geojson = route.geometry
          const distM = route.distance as number
          const durS = route.duration as number

          setRouteInfo({
            distanceKm: (distM / 1000).toFixed(2),
            walkMin: Math.ceil((distM / 1000 / 4.5) * 60),
            drivMin: Math.max(1, Math.ceil(durS / 60)),
            name: target.name,
          })

          const glowLayer = L.geoJSON(geojson, {
            style: { color: '#60a5fa', weight: 12, opacity: 0.35, lineCap: 'round', lineJoin: 'round' },
          }).addTo(map)

          const casingLayer = L.geoJSON(geojson, {
            style: { color: '#1e40af', weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round' },
          }).addTo(map)

          const coreLayer = L.geoJSON(geojson, {
            style: { color: '#93c5fd', weight: 3, opacity: 1, lineCap: 'round', lineJoin: 'round' },
          }).addTo(map)

          const group = L.layerGroup([glowLayer, casingLayer, coreLayer])
          group.addTo(map)
          routeLayerRef.current = group

          const bounds = casingLayer.getBounds()
          if (bounds.isValid()) {
            map.fitBounds(bounds.pad(0.18), { animate: true, duration: 0.9 })
          }
        } else {
          // Fallback along coastal highway / road network corridors
          const waypoints = computeRoadWaypoints(me, target)
          const directDist = km(me, target)
          const distKm = directDist > 5 ? directDist * 1.25 : directDist * 1.15

          setRouteInfo({
            distanceKm: distKm.toFixed(2),
            walkMin: Math.ceil((distKm / 4.5) * 60),
            drivMin: Math.max(1, Math.ceil((distKm / 42) * 60)),
            name: target.name,
          })

          const glow = L.polyline(waypoints, {
            color: '#60a5fa',
            weight: 12,
            opacity: 0.35,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map)

          const casing = L.polyline(waypoints, {
            color: '#1e40af',
            weight: 6,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map)

          const core = L.polyline(waypoints, {
            color: '#93c5fd',
            weight: 3,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map)

          const group = L.layerGroup([glow, casing, core])
          group.addTo(map)
          routeLayerRef.current = group

          map.fitBounds(L.latLngBounds(waypoints).pad(0.2), { animate: true, duration: 0.8 })
        }
      })
      .finally(() => setRouteLoading(false))
  }, [routeTargetId, me, mapReady, places])

  useEffect(() => {
    setRouteTargetId(null)
  }, [selectedId])

  const toggleSave = (p: Place) => {
    const next = new Set(saved)
    if (saved.has(p.id)) {
      next.delete(p.id)
    } else {
      next.add(p.id)
    }
    setSaved(next)
    localStorage.setItem('wander_saved_ids', JSON.stringify([...next]))
  }

  const handleSelectPlace = (id: string) => {
    setSelectedId(id)
    cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setShowSuggestions(false)
    setActiveSearch(searchInput.trim())
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setActiveSearch('')
    setShowSuggestions(false)
    setSuggestions([])
  }

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    setSearchInput(suggestion.name)
    setActiveSearch(suggestion.name)
    setShowSuggestions(false)
  }

  const handleQuickSearch = (queryText: string, targetCategory?: Category) => {
    setSearchInput(queryText)
    setActiveSearch(queryText)
    setShowSuggestions(false)
    if (targetCategory) {
      setCategory(targetCategory)
    }
  }

  const handleCategorySelect = (catId: Category) => {
    setCategory(catId)
    setSubFilter('all')
    setSearchInput('')
    setActiveSearch('')
    setShowSuggestions(false)
  }

  const centerOnUser = () => {
    if (me && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([me.lat, me.lng], 15, { duration: 0.8 })
    }
  }

  // Clusters
  const clusters = useMemo(() => {
    const clusterMap = new Map<string, number>()
    places.forEach((p) => {
      if (p.cluster) {
        clusterMap.set(p.cluster, (clusterMap.get(p.cluster) || 0) + 1)
      }
    })
    const list = [{ id: 'all', label: 'All Areas', count: places.length }]
    clusterMap.forEach((count, name) => {
      list.push({ id: name, label: name, count })
    })
    return list
  }, [places])

  return (
    <div className="h-screen max-h-screen w-full bg-[#f8fafc] text-slate-900 flex flex-col overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. TOP GLOBAL NAVIGATION BAR */}
      <header className="h-14 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-2xs">
        {/* Left Tabs */}
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="flex items-center gap-2 mr-3 sm:mr-5">
            <div className="h-7 w-7 rounded-lg bg-emerald-950 flex items-center justify-center text-emerald-400 font-bold shadow-xs">
              <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.2l6 3.75v7.7l-6 3.75-6-3.75v-7.7l6-3.75zM11 7v6.5l4-2.5-4-2.5V7z" />
              </svg>
            </div>
            <span className="text-base font-extrabold tracking-tight text-slate-900 hidden sm:inline">Tourvista</span>
          </div>

          <nav className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/50 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('explore')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'explore' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Explore Map
            </button>
            <button
              onClick={() => {
                setActiveTab('details')
                if (selectedPlace) setDetailModalPlace(selectedPlace)
              }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'details' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Place Details
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'saved' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Saved Places</span>
              {saved.size > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                  {saved.size}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-3 text-xs">
          {me && (
            <button
              onClick={centerOnUser}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-600 bg-emerald-50 text-emerald-800 text-xs font-bold transition cursor-pointer hover:bg-emerald-100"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>Center on Me</span>
            </button>
          )}

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[11px]">
            <span className="text-emerald-600">⚡</span>
            <span>TripAdvisor® Live</span>
          </div>

          <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
            <button
              onClick={onLogout}
              className="h-8 w-8 rounded-full bg-emerald-800 hover:bg-emerald-700 transition flex items-center justify-center text-white cursor-pointer relative"
              title={`Logged in as ${email}. Click to log out.`}
            >
              <span className="text-xs font-bold uppercase">{email.slice(0, 1)}</span>
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 ring-1.5 ring-white"></span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. SUB-HEADER / SCOPE & POPULAR SHORTCUT BAR */}
      <div className="h-11 bg-slate-50 border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 text-xs gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setLocationModalOpen(true)}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 shadow-2xs px-3 py-1 rounded-full text-slate-800 font-semibold transition cursor-pointer"
          >
            <span className="h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
              📍
            </span>
            <span>{currentLoc.country}</span>
            <span className="text-slate-400">›</span>
            <span>{currentLoc.city}</span>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold border border-emerald-200 ml-1">
              ● Live City
            </span>
            <span className="text-slate-400 text-xs">↕</span>
          </button>
        </div>

        {/* Quick Search Shortcut Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-bold text-slate-400 mr-0.5 hidden sm:inline">Popular:</span>
          <button
            onClick={() => handleQuickSearch('beach', 'attractions')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1 border ${
              activeSearch.toLowerCase() === 'beach'
                ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>🏖️</span>
            <span>Beaches</span>
          </button>
          <button
            onClick={() => handleQuickSearch('restaurant', 'restaurants')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1 border ${
              activeSearch.toLowerCase() === 'restaurant'
                ? 'bg-emerald-800 text-white border-emerald-900 font-bold shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>🍽️</span>
            <span>Restaurants</span>
          </button>
          <button
            onClick={() => handleQuickSearch('hotel resort', 'hotels')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1 border ${
              activeSearch.toLowerCase() === 'hotel resort'
                ? 'bg-emerald-800 text-white border-emerald-900 font-bold shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>🏨</span>
            <span>Hotels & Resorts</span>
          </button>
          <button
            onClick={() => handleQuickSearch('seafood tuna', 'restaurants')}
            className="hidden md:flex px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer items-center gap-1 border bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            <span>🐟</span>
            <span>Seafood</span>
          </button>
          <button
            onClick={() => handleQuickSearch('coffee cafe', 'restaurants')}
            className="hidden md:flex px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer items-center gap-1 border bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            <span>☕</span>
            <span>Cafes</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'split' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>☷</span>
              <span className="hidden sm:inline">Split</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'map' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>⛶</span>
              <span className="hidden sm:inline">Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. CATEGORY & FILTER CHIPS BAR */}
      <div className="h-12 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 text-xs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategorySelect(cat.id)}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              category === cat.id && !activeSearch
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}

        <div className="h-5 w-px bg-slate-200 mx-1 shrink-0"></div>

        {SUB_FILTERS.slice(1).map((sub) => (
          <button
            key={sub.id}
            onClick={() => setSubFilter(subFilter === sub.id ? 'all' : sub.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer flex items-center gap-1 shrink-0 border ${
              subFilter === sub.id
                ? 'border-emerald-700 bg-emerald-50 text-emerald-900 font-bold'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {sub.icon && <span>{sub.icon}</span>}
            <span>{sub.label}</span>
          </button>
        ))}

        <div className="h-5 w-px bg-slate-200 mx-1 shrink-0"></div>

        <button
          onClick={() => setMinRating45(!minRating45)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer shrink-0 ${
            minRating45 ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          ★ 4.5+
        </button>
        {me && (
          <button
            onClick={() => setWithin2km(!within2km)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer shrink-0 ${
              within2km ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            ↗ &lt; 2 km
          </button>
        )}
        <button
          onClick={() => setModeratePrice(!moderatePrice)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer shrink-0 ${
            moderatePrice ? 'border-teal-600 bg-teal-50 text-teal-900 font-bold' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Moderate Price
        </button>
        <button
          onClick={() => setOnlyOpen(!onlyOpen)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer shrink-0 ${
            onlyOpen ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          ● Open Now
        </button>
      </div>

      {/* 4. MAIN SPLIT-SCREEN WORKSPACE */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* LEFT PANEL: PLACES LISTING */}
        {viewMode === 'split' && (
          <aside className="w-full lg:w-[38%] xl:w-[34%] bg-white border-r border-slate-200/90 flex flex-col h-full overflow-hidden shrink-0 z-10 shadow-xs">
            {/* CLEAN PANEL HEADER WITH CURRENT SCOPE & STATUS */}
            <div className="p-4 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <span>TRIPADVISOR / {currentLoc.city.toUpperCase()}</span>
                <div className="flex items-center gap-1.5 text-slate-700 font-medium lowercase">
                  <span className="text-slate-400 text-[10px]">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                  >
                    {me && <option value="distance">Nearest to Me</option>}
                    <option value="rating">Highest Rated</option>
                    <option value="reviews">Most Reviewed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between mt-1.5">
                <h2 className="text-lg font-extrabold text-slate-900">
                  {activeSearch ? (
                    <span className="flex items-center gap-1.5">
                      <span>&ldquo;{activeSearch}&rdquo; in {currentLoc.city}</span>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {filteredPlaces.length}
                      </span>
                    </span>
                  ) : (
                    <span>
                      {filteredPlaces.length} {category.charAt(0).toUpperCase() + category.slice(1)} in {currentLoc.city}
                    </span>
                  )}
                </h2>
                {activeSearch && (
                  <button
                    onClick={handleClearSearch}
                    className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              {/* Scope change helper button */}
              <div className="mt-2.5 flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/80 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate">
                  <span>📍</span>
                  <span className="font-bold text-slate-900">{currentLoc.city}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500 capitalize">{category}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(true)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-emerald-800 font-bold transition cursor-pointer shrink-0 shadow-2xs"
                >
                  Change Place / Search ↗
                </button>
              </div>

              {clusters.length > 1 && (
                <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
                  <span className="text-[11px] font-bold text-slate-400 mr-1 shrink-0">Areas:</span>
                  {clusters.map((cl) => (
                    <button
                      key={cl.id}
                      onClick={() => setSelectedCluster(cl.id)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition cursor-pointer shrink-0 ${
                        selectedCluster === cl.id
                          ? 'bg-emerald-800 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cl.label} {cl.count ? `(${cl.count})` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
              {apiError && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 shadow-xs">
                  <div className="flex items-center gap-2 font-bold mb-1 text-amber-800">
                    <span>⚠️</span>
                    <span>TripAdvisor API Note</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-950 font-mono bg-white/70 p-2 rounded-xl border border-amber-200/60 mt-1">
                    {apiError}
                  </p>
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-16 text-slate-500 gap-3 text-xs">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent"></div>
                  <span>Loading TripAdvisor places in {currentLoc.city}…</span>
                </div>
              )}

              {!loading && filteredPlaces.length === 0 && !apiError && (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-2xl mb-3">
                    🔍
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No matching TripAdvisor places found</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Try typing &quot;beach&quot;, &quot;hotel&quot;, &quot;seafood&quot;, or select another category above.
                  </p>
                </div>
              )}

              {filteredPlaces.map((p, idx) => {
                const isSelected = p.id === selectedId

                return (
                  <div
                    key={p.id}
                    ref={(el) => {
                      cardRefs.current[p.id] = el
                    }}
                    onClick={() => handleSelectPlace(p.id)}
                    className={`group relative rounded-2xl bg-white transition duration-200 cursor-pointer border ${
                      isSelected
                        ? 'border-emerald-600 ring-2 ring-emerald-600/30 shadow-md'
                        : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="p-3.5 flex gap-3.5">
                      <div className="relative h-24 w-28 sm:h-28 sm:w-32 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        <img
                          src={p.photo}
                          alt={p.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        {p.price && (
                          <span className="absolute top-1.5 left-1.5 rounded bg-slate-950/75 backdrop-blur-xs px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                            {p.price}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-1.5">
                            <h3 className="text-sm font-bold text-slate-900 leading-snug truncate group-hover:text-emerald-800">
                              #{idx + 1} {p.name}
                            </h3>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleSave(p)
                              }}
                              className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                              title={saved.has(p.id) ? 'Saved' : 'Save place'}
                            >
                              {saved.has(p.id) ? (
                                <svg className="w-4 h-4 text-rose-500 fill-current" viewBox="0 0 24 24">
                                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-600">
                            {p.rating > 0 && (
                              <span className="font-bold text-amber-600 flex items-center gap-0.5">
                                ★ {p.rating.toFixed(1)}
                              </span>
                            )}
                            {p.reviewCount ? (
                              <span className="text-slate-400 text-[11px]">
                                ({p.reviewCount.toLocaleString()} reviews)
                              </span>
                            ) : null}
                          </div>

                          {p.address && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              📍 {p.address}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {p.tags?.slice(0, 2).map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                              >
                                {tag}
                              </span>
                            ))}
                            {me && (
                              <span className="text-[10px] font-bold text-emerald-700 ml-auto flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                🚗 {km(me, p).toFixed(2)} km
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              {p.openStatus || 'TripAdvisor Place'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {me && (
                                routeTargetId === p.id ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setRouteTargetId(null)
                                      if (routeLayerRef.current && mapInstanceRef.current) {
                                        mapInstanceRef.current.removeLayer(routeLayerRef.current)
                                        routeLayerRef.current = null
                                      }
                                      setRouteInfo(null)
                                    }}
                                    className="px-2.5 py-1 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-700 transition cursor-pointer flex items-center gap-1"
                                  >
                                    <span>✕</span> Clear Route
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setRouteTargetId(p.id)
                                    }}
                                    className="px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 text-xs font-semibold text-blue-700 transition cursor-pointer flex items-center gap-1"
                                  >
                                    <span>🗺️</span> Show Route
                                  </button>
                                )
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDetailModalPlace(p)
                                }}
                                className="px-3 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-xs font-semibold text-white transition cursor-pointer shadow-xs"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </aside>
        )}

        {/* RIGHT PANEL: GOOGLE MAPS WITH LIVE INTERACTIVE PINS */}
        <main className="flex-1 relative h-full bg-slate-100 overflow-hidden">
          {/* Top Floating Map Controls Bar */}
          <div className="absolute top-3 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
              {me && (
                <button
                  onClick={centerOnUser}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl shadow-md border bg-white/95 text-slate-800 border-slate-200 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-ping"></span>
                  <span>My Location</span>
                </button>
              )}

              <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-slate-200 text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <span>📍</span>
                <span>{filteredPlaces.length} TripAdvisor Places on Map</span>
              </div>
            </div>

            {/* Layer Switcher */}
            <div className="flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200 text-xs font-medium pointer-events-auto">
              {(['standard', 'satellite', 'terrain'] as const).map((layer) => (
                <button
                  key={layer}
                  onClick={() => setMapLayer(layer)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition cursor-pointer ${
                    mapLayer === layer ? 'bg-emerald-800 text-white font-bold shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {layer}
                </button>
              ))}
            </div>
          </div>

          {/* Map Container */}
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Route Loading Indicator */}
          {routeLoading && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl pointer-events-none">
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
              </svg>
              Calculating road route…
            </div>
          )}

          {/* Route Info Ribbon */}
          {routeInfo && !routeLoading && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-blue-700/95 backdrop-blur-md text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl border border-blue-400/40">
              <span className="flex items-center gap-1"><span>🛣️</span><span>{routeInfo.distanceKm} km (via road)</span></span>
              <span className="w-px h-3.5 bg-blue-400/50" />
              <span className="flex items-center gap-1"><span>🚗</span><span>~{routeInfo.drivMin} min drive</span></span>
              <span className="w-px h-3.5 bg-blue-400/50" />
              <span className="flex items-center gap-1"><span>🚶</span><span>~{routeInfo.walkMin} min walk</span></span>
              <button
                onClick={() => {
                  if (routeLayerRef.current && mapInstanceRef.current) {
                    mapInstanceRef.current.removeLayer(routeLayerRef.current)
                    routeLayerRef.current = null
                  }
                  setRouteInfo(null)
                }}
                className="ml-1 text-blue-200 hover:text-white transition cursor-pointer text-base leading-none"
                title="Clear route"
              >✕</button>
            </div>
          )}

          {/* Floating Selected Place Card */}
          {selectedPlace && (
            <div className="absolute bottom-5 left-4 z-30 max-w-sm w-[90%] bg-white/97 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border border-slate-200">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    📍 Selected {selectedPlace.price ? `· ${selectedPlace.price}` : ''}
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900 leading-snug mt-0.5 truncate">
                    {selectedPlace.name}
                  </h4>
                  {selectedPlace.address && (
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      {selectedPlace.address}
                    </p>
                  )}
                </div>
                {selectedPlace.rating > 0 && (
                  <span className="bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded text-xs shrink-0">
                    ★ {selectedPlace.rating.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Route Stats */}
              {routeLoading && routeTargetId === selectedPlace.id && (
                <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5 text-[11px] text-blue-600 font-semibold">
                  <svg className="w-3 h-3 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
                  Calculating road driving route…
                </div>
              )}
              {routeInfo && !routeLoading && routeTargetId === selectedPlace.id && (
                <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5">
                  <div className="flex items-center gap-1 text-blue-700 text-[11px] font-bold"><span>🛣️</span><span>{routeInfo.distanceKm} km</span></div>
                  <span className="w-px h-3 bg-blue-200" />
                  <div className="flex items-center gap-1 text-blue-700 text-[11px] font-bold"><span>🚗</span><span>{routeInfo.drivMin} min drive</span></div>
                  <span className="w-px h-3 bg-blue-200" />
                  <div className="flex items-center gap-1 text-blue-700 text-[11px] font-bold"><span>🚶</span><span>{routeInfo.walkMin} min walk</span></div>
                </div>
              )}

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-emerald-700 shrink-0">
                  {me ? `🚗 ~${km(me, selectedPlace).toFixed(2)} km away` : 'Live TripAdvisor Pin'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDetailModalPlace(selectedPlace)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer"
                  >
                    Details
                  </button>
                  {me && (
                    routeTargetId === selectedPlace.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRouteTargetId(null)
                          if (routeLayerRef.current && mapInstanceRef.current) {
                            mapInstanceRef.current.removeLayer(routeLayerRef.current)
                            routeLayerRef.current = null
                          }
                          setRouteInfo(null)
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        ✕ Clear Route
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRouteTargetId(selectedPlace.id)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        🗺️ Show Route
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Zoom & Locate Controls */}
          <div className="absolute bottom-5 right-4 z-30 flex flex-col bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 overflow-hidden text-slate-800 text-xs font-bold">
            <button
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="p-2.5 hover:bg-slate-100 transition cursor-pointer border-b border-slate-100"
              title="Zoom In"
            >
              +
            </button>
            <button
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="p-2.5 hover:bg-slate-100 transition cursor-pointer border-b border-slate-100"
              title="Zoom Out"
            >
              −
            </button>
            {me && (
              <button
                onClick={centerOnUser}
                className="p-2.5 hover:bg-slate-100 transition cursor-pointer text-blue-600"
                title="Center on My Location"
              >
                🎯
              </button>
            )}
          </div>
        </main>
      </div>

      {/* 5. FOOTER STATUS BAR */}
      <footer className="h-8 bg-white border-t border-slate-200/80 px-4 sm:px-6 flex items-center justify-between text-[11px] text-slate-500 shrink-0 z-30">
        <div className="flex items-center gap-4">
          <span>© 2025 Tourvista Inc.</span>
          <span>Powered by TripAdvisor Terra Content API</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium text-slate-600">
          <span>🌐</span>
          <span>Live Travel Discovery</span>
        </div>
      </footer>

      {/* 6. MODALS */}
      {detailModalPlace && (
        <PlaceModal
          place={detailModalPlace}
          me={me}
          saved={saved.has(detailModalPlace.id)}
          onSave={() => toggleSave(detailModalPlace)}
          onClose={() => setDetailModalPlace(null)}
        />
      )}

      {locationModalOpen && (
        <LocationModal
          initial={currentLoc}
          initialCategory={category}
          initialSearch={activeSearch}
          onClose={() => setLocationModalOpen(false)}
          onSelect={(newLoc, newCategory, query) => {
            setCurrentLoc(newLoc)
            if (newCategory) setCategory(newCategory)
            if (query) {
              setSearchInput(query)
              setActiveSearch(query)
            } else {
              setSearchInput('')
              setActiveSearch('')
            }
            setLocationModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
