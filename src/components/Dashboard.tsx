import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPlaces, fetchSearchSuggestions, CITY_COORDINATES, type SearchSuggestion } from '../lib/tripadvisor'
import { fetchLocalPlaces } from '../lib/localPlaces'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { km } from '../lib/geo'
import { CATEGORIES, SUB_FILTERS, type Category, type LatLng, type Location, type Place } from '../types'
import LocationModal from './LocationModal'
import PlaceModal from './PlaceModal'
import TourVistaLogo from './TourVistaLogo'

declare const L: any

interface Props {
  email: string
  isGuest?: boolean
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

export default function Dashboard({ email, isGuest = false, location, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<'explore' | 'details' | 'saved'>('explore')
  const [category, setCategory] = useState<Category>('attractions')
  const [subFilter, setSubFilter] = useState<string>('all')
  const [places, setPlaces] = useState<Place[]>([])
  const [localPlaces, setLocalPlaces] = useState<Place[]>([])
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
  const [refreshCounter, setRefreshCounter] = useState(0)

  // Real-time synchronization when places are added, updated, or deleted
  useEffect(() => {
    const handleUpdate = () => {
      setRefreshCounter((c) => c + 1)
    }

    window.addEventListener('tourvista_places_updated', handleUpdate)

    let bc: BroadcastChannel | null = null
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('tourvista_places_channel')
        bc.onmessage = handleUpdate
      }
    } catch {}

    let channel: any = null
    if (isSupabaseConfigured) {
      try {
        channel = supabase
          .channel('public:local_places')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'local_places' },
            () => {
              handleUpdate()
            }
          )
          .subscribe()
      } catch {}
    }

    return () => {
      window.removeEventListener('tourvista_places_updated', handleUpdate)
      if (bc) bc.close()
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

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

  // Live Auto-Suggestions (Local places + TripAdvisor)
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

  // 1. Capture real GPS coordinates & sync Supabase saved places
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

    if (isSupabaseConfigured) {
      supabase
        .from('saved_places')
        .select('place_id')
        .then(({ data, error }) => {
          if (!error && data) {
            setSaved((prev) => new Set([...prev, ...data.map((r: any) => r.place_id)]))
          }
        })
    }
  }, [])

  // 2. Fetch live TripAdvisor places for category, city & active search query
  useEffect(() => {
    let live = true
    setLoading(true)
    setApiError(null)
    const latLong = me ? `${me.lat},${me.lng}` : undefined

    // Fetch TripAdvisor + local Supabase places in parallel
    Promise.all([
      fetchPlaces(category, currentLoc.city, latLong, activeSearch),
      fetchLocalPlaces(category, currentLoc.city, activeSearch),
    ])
      .then(([taRes, localRes]) => {
        if (live) {
          setPlaces(taRes.places)
          setLocalPlaces(localRes)
          if (taRes.error) {
            setApiError(taRes.error)
          }
          const allResults = [...taRes.places, ...localRes]
          if (allResults.length > 0) {
            setSelectedId((prev) => (prev && allResults.some((p) => p.id === prev) ? prev : allResults[0].id))
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
  }, [category, currentLoc.city, activeSearch, me, refreshCounter])

  // 3. Filter and sort logic — merges TripAdvisor + local Supabase places
  const allPlaces = useMemo(() => [...places, ...localPlaces], [places, localPlaces])

  const filteredPlaces = useMemo(() => {
    return allPlaces
      .filter((p) => {
        if (activeTab === 'saved' && !saved.has(p.id)) return false
        if (subFilter !== 'all' && p.subCategory && p.subCategory !== subFilter) return false
        if (selectedCluster !== 'all' && p.cluster !== selectedCluster) return false
        const searchTarget = (activeSearch || searchInput).trim().toLowerCase()
        if (searchTarget) {
          const matches =
            p.name.toLowerCase().includes(searchTarget) ||
            (p.address && p.address.toLowerCase().includes(searchTarget)) ||
            (p.category && p.category.toLowerCase().includes(searchTarget)) ||
            (p.description && p.description.toLowerCase().includes(searchTarget)) ||
            (p.tags && p.tags.some((t) => t.toLowerCase().includes(searchTarget)))
          if (!matches) return false
        }
        if (minRating45 && (p.rating || 0) < 4.5 && !p.isLocal) return false
        if (within2km && me && km(me, p) > 2.0) return false
        if (moderatePrice && p.price && !p.price.includes('$$') && !p.price.includes('€€') && !p.price.includes('₱₱')) return false
        if (onlyOpen && p.openStatus && p.openStatus.toLowerCase().includes('closed')) return false
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'distance' && me) return km(me, a) - km(me, b)
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0)
        if (sortBy === 'reviews') return (b.reviewCount || 0) - (a.reviewCount || 0)
        return 0
      })
  }, [allPlaces, activeTab, saved, subFilter, selectedCluster, searchInput, activeSearch, minRating45, within2km, moderatePrice, onlyOpen, sortBy, me])

  const selectedPlace = useMemo(() => {
    return allPlaces.find((p) => p.id === selectedId) || filteredPlaces[0] || null
  }, [allPlaces, selectedId, filteredPlaces])

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
            <p style="font-weight:700;color:#1e3a8a;margin:0">Your Location</p>
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
      const isLocal = p.isLocal === true

      // Color scheme: amber=selected, purple=local, green=TripAdvisor
      const bgColor = isSelected ? '#f59e0b' : isLocal ? '#7c3aed' : '#064e3b'
      const textColor = isSelected ? '#1c1917' : '#ffffff'
      const arrowColor = isSelected ? '#f59e0b' : isLocal ? '#7c3aed' : '#064e3b'
      const scale = isSelected ? 'scale(1.25)' : 'scale(1)'
      const shadow = isSelected
        ? '0 0 0 4px rgba(245,158,11,0.4), 0 4px 12px rgba(0,0,0,0.3)'
        : isLocal
        ? '0 0 0 3px rgba(124,58,237,0.25), 0 2px 8px rgba(0,0,0,0.25)'
        : '0 2px 8px rgba(0,0,0,0.25)'
      const shortName = p.name.split(' ').slice(0, 3).join(' ')
      const labelText = isLocal ? 'Local' : (p.rating > 0 ? `★ ${p.rating.toFixed(1)}` : 'TA')

      const markerHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;transform:${scale};transition:transform 0.2s;cursor:pointer">
          <div style="display:flex;align-items:center;gap:4px;background:${bgColor};color:${textColor};padding:4px 10px;border-radius:9999px;font-size:11px;font-weight:700;border:2px solid white;box-shadow:${shadow}">
            <span>${labelText}</span>
          </div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${arrowColor};margin-top:-1px"></div>
          <span style="margin-top:2px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(255,255,255,0.97);padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;color:#0f172a;box-shadow:0 1px 4px rgba(0,0,0,0.15);border:1px solid ${isLocal ? '#ddd6fe' : '#e2e8f0'}">${shortName}</span>
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

      const targetUrl = isLocal ? (p.referenceUrl || p.url) : p.url
      const targetLabel = isLocal ? 'Reference URL ↗' : 'TripAdvisor Page ↗'
      const badgeText = isLocal ? 'Local Place' : (p.rating > 0 ? `★ ${p.rating.toFixed(1)} TripAdvisor` : 'TripAdvisor')

      marker.bindPopup(`
        <div style="font-family:sans-serif;padding:4px;min-width:170px;max-width:230px">
          <p style="font-weight:800;font-size:12px;color:#0f172a;margin:0 0 4px;line-height:1.25">${p.name}</p>
          <div style="margin-bottom:6px">
            <span style="display:inline-block;font-size:10px;font-weight:700;padding:2px 6px;border-radius:9999px;${isLocal ? 'background:#f5f3ff;color:#6d28d9;border:1px solid #ddd6fe' : 'background:#ecfdf5;color:#047857;border:1px solid #a7f3d0'}">${badgeText}</span>
          </div>
          ${p.address ? `<p style="font-size:10px;color:#64748b;margin:0 0 8px;line-height:1.25">${p.address}</p>` : ''}
          ${targetUrl ? `<a href="${targetUrl}" target="_blank" rel="noreferrer" style="display:block;text-align:center;padding:5px 8px;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none;${isLocal ? 'background:#7c3aed;color:#ffffff' : 'background:#065f46;color:#ffffff'}">${targetLabel}</a>` : ''}
        </div>
      `, { offset: [0, -42] })

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

    const target = allPlaces.find((p) => p.id === routeTargetId)
    if (!target || km(me, target) < 0.01) return

    setRouteLoading(true)

    const origin = `${me.lng},${me.lat}`
    const dest = `${target.lng},${target.lat}`

    const tryFetchRoute = async () => {
      const osrmEndpoints = [
        `https://router.project-osrm.org/route/v1/driving/${origin};${dest}?overview=full&geometries=geojson&steps=false`,
        `https://routing.openstreetmap.de/routed-car/route/v1/driving/${origin};${dest}?overview=full&geometries=geojson&steps=false`,
        `https://osrm.routabletiles.org/route/v1/driving/${origin};${dest}?overview=full&geometries=geojson&steps=false`,
      ]

      // Try each OSRM endpoint in sequence
      for (const url of osrmEndpoints) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(7000) })
          if (res.ok) {
            const data = await res.json()
            if (data.code === 'Ok' && data.routes?.[0]) return data.routes[0]
          }
        } catch { /* try next */ }
      }

      // Valhalla public instance (returns GeoJSON geometry directly)
      try {
        const valhallaBody = JSON.stringify({
          locations: [
            { lon: me.lng, lat: me.lat, type: 'break' },
            { lon: target.lng, lat: target.lat, type: 'break' },
          ],
          costing: 'auto',
          shape_match: 'map_snap',
          directions_options: { units: 'kilometers' },
        })
        const vRes = await fetch('https://valhalla1.openstreetmap.de/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: valhallaBody,
          signal: AbortSignal.timeout(7000),
        })
        if (vRes.ok) {
          const vData = await vRes.json()
          const leg = vData?.trip?.legs?.[0]
          if (leg?.shape) {
            // Valhalla returns encoded polyline6 — decode it
            const coords = decodePolyline6(leg.shape)
            const distM = (vData.trip.summary?.length ?? km(me, target)) * 1000
            const durS = vData.trip.summary?.time ?? (distM / 1000 / 40) * 3600
            return {
              geometry: { type: 'LineString', coordinates: coords },
              distance: distM,
              duration: durS,
            }
          }
        }
      } catch { /* fall through to static fallback */ }

      return null
    }

    // Decode Valhalla's precision-6 encoded polyline
    function decodePolyline6(encoded: string): [number, number][] {
      const coords: [number, number][] = []
      let index = 0, lat = 0, lng = 0
      while (index < encoded.length) {
        let b, shift = 0, result = 0
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
        lat += result & 1 ? ~(result >> 1) : result >> 1
        shift = 0; result = 0
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
        lng += result & 1 ? ~(result >> 1) : result >> 1
        coords.push([lng / 1e6, lat / 1e6])
      }
      return coords
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
  }, [routeTargetId, me, mapReady, allPlaces])

  useEffect(() => {
    if (selectedId && routeTargetId && selectedId !== routeTargetId) {
      setRouteTargetId(null)
    }
  }, [selectedId])

  const handleToggleRoute = (targetPlaceId: string) => {
    if (routeTargetId === targetPlaceId) {
      setRouteTargetId(null)
      if (routeLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(routeLayerRef.current)
        routeLayerRef.current = null
      }
      setRouteInfo(null)
      return
    }

    setSelectedId(targetPlaceId)

    if (me) {
      setRouteTargetId(targetPlaceId)
      return
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords: LatLng = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }
          setMe(userCoords)
          setRouteTargetId(targetPlaceId)
        },
        () => {
          const cityCoords = CITY_COORDINATES[currentLoc.city] || { lat: 6.1164, lon: 125.1716 }
          const defaultOrigin: LatLng = { lat: cityCoords.lat, lng: cityCoords.lon }
          setMe(defaultOrigin)
          setRouteTargetId(targetPlaceId)
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      )
    } else {
      const cityCoords = CITY_COORDINATES[currentLoc.city] || { lat: 6.1164, lon: 125.1716 }
      const defaultOrigin: LatLng = { lat: cityCoords.lat, lng: cityCoords.lon }
      setMe(defaultOrigin)
      setRouteTargetId(targetPlaceId)
    }
  }

  const toggleSave = async (p: Place) => {
    const next = new Set(saved)
    if (saved.has(p.id)) {
      next.delete(p.id)
      setSaved(next)
      localStorage.setItem('wander_saved_ids', JSON.stringify([...next]))
      if (isSupabaseConfigured) {
        try {
          await supabase.from('saved_places').delete().eq('place_id', p.id)
        } catch (err) {
          console.warn('Error removing from Supabase saved_places:', err)
        }
      }
    } else {
      next.add(p.id)
      setSaved(next)
      localStorage.setItem('wander_saved_ids', JSON.stringify([...next]))
      if (isSupabaseConfigured) {
        try {
          await supabase.from('saved_places').insert({
            place_id: p.id,
            name: p.name,
            category: p.category,
            data: p,
          })
        } catch (err) {
          console.warn('Error saving to Supabase saved_places:', err)
        }
      }
    }
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
    if (suggestion.category) {
      setCategory(suggestion.category)
    }
    setSelectedId(suggestion.id)
    if (suggestion.lat && suggestion.lng && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([suggestion.lat, suggestion.lng], 15, { duration: 0.8 })
    }
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
    } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setMe(coords)
          mapInstanceRef.current?.flyTo([coords.lat, coords.lng], 15, { duration: 0.8 })
        },
        () => {
          const cityCoords = CITY_COORDINATES[currentLoc.city] || { lat: 6.1164, lon: 125.1716 }
          mapInstanceRef.current?.flyTo([cityCoords.lat, cityCoords.lon], 15, { duration: 0.8 })
        }
      )
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
          <div className="mr-3 sm:mr-5">
            <TourVistaLogo variant="horizontal" size="sm" />
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
              onClick={() => setActiveTab('saved')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'saved' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Saved Places
            </button>
          </nav>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-3 text-xs">
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
                  <span className="font-bold text-slate-900">{currentLoc.city}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500 capitalize">{category}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(true)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-emerald-800 font-bold transition cursor-pointer shrink-0 shadow-2xs"
                >
                  Change City / Search ↗
                </button>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar pb-1">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCategory(c.id)
                      setSubFilter('all')
                    }}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                      category === c.id
                        ? 'bg-emerald-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                ))}
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
              {apiError && filteredPlaces.length === 0 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 shadow-xs">
                  <div className="flex items-center gap-2 font-bold mb-1 text-amber-800">
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
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold mb-3">
                    No Data
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No matching places found</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Try typing a different search or select another category above.
                  </p>
                </div>
              )}

              {filteredPlaces.map((p, idx) => {
                const isSelected = p.id === selectedId
                const isLocal = p.isLocal === true

                return (
                  <div
                    key={p.id}
                    ref={(el) => {
                      cardRefs.current[p.id] = el
                    }}
                    onClick={() => handleSelectPlace(p.id)}
                    className={`group relative rounded-2xl bg-white transition duration-200 cursor-pointer border ${
                      isSelected
                        ? isLocal
                          ? 'border-violet-500 ring-2 ring-violet-500/30 shadow-md'
                          : 'border-emerald-600 ring-2 ring-emerald-600/30 shadow-md'
                        : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="p-3.5 flex gap-3.5">
                      <div className="relative h-24 w-28 sm:h-28 sm:w-32 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        <img
                          src={p.photo}
                          alt={p.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80'
                          }}
                        />
                        {isLocal && (
                          <span className="absolute top-1.5 left-1.5 rounded-full bg-violet-600/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                            Local
                          </span>
                        )}
                        {!isLocal && p.price && (
                          <span className="absolute top-1.5 left-1.5 rounded bg-slate-950/75 backdrop-blur-xs px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                            {p.price}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-1.5">
                            <h3 className={`text-sm font-bold text-slate-900 leading-snug truncate ${isLocal ? 'group-hover:text-violet-700' : 'group-hover:text-emerald-800'}`}>
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
                            {isLocal ? (
                              <span className="font-semibold text-violet-700 text-[11px]">
                                Locally curated place
                              </span>
                            ) : (
                              <>
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
                              </>
                            )}
                          </div>

                          {p.address && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {p.address}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {p.tags?.slice(0, 2).map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${isLocal ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'}`}
                              >
                                {tag}
                              </span>
                            ))}
                            {me && (
                              <span className="text-[10px] font-bold text-emerald-700 ml-auto flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                {km(me, p).toFixed(2)} km
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${isLocal ? 'bg-violet-500' : 'bg-emerald-500'}`}></span>
                              <span className={isLocal ? 'text-violet-700' : 'text-emerald-700'}>
                                {isLocal ? 'Locally Curated' : (p.openStatus || 'TripAdvisor Place')}
                              </span>
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Direct External Link: Reference URL for local places, TripAdvisor for TripAdvisor places */}
                              {isLocal ? (
                                (p.referenceUrl || p.url) && (
                                  <a
                                    href={p.referenceUrl || p.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="px-2.5 py-1 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 text-xs font-bold text-violet-800 transition flex items-center shadow-2xs"
                                  >
                                    Reference URL ↗
                                  </a>
                                )
                              ) : (
                                p.url && (
                                  <a
                                    href={p.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-800 transition flex items-center shadow-2xs"
                                  >
                                    TripAdvisor ↗
                                  </a>
                                )
                              )}
                              {routeTargetId === p.id ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleToggleRoute(p.id)
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-700 transition cursor-pointer flex items-center gap-1"
                                >
                                  Clear Route
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleToggleRoute(p.id)
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 text-xs font-semibold text-blue-700 transition cursor-pointer flex items-center gap-1"
                                >
                                  Show Route
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDetailModalPlace(p)
                                }}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold text-white transition cursor-pointer shadow-xs ${
                                  isLocal ? 'bg-violet-700 hover:bg-violet-800' : 'bg-emerald-800 hover:bg-emerald-900'
                                }`}
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
                <span>{filteredPlaces.length} Places on Map</span>
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
              <span>Road: {routeInfo.distanceKm} km</span>
              <span className="w-px h-3.5 bg-blue-400/50" />
              <span>Drive: ~{routeInfo.drivMin} min</span>
              <span className="w-px h-3.5 bg-blue-400/50" />
              <span>Walk: ~{routeInfo.walkMin} min</span>
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
                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${selectedPlace.isLocal ? 'text-violet-700' : 'text-emerald-800'}`}>
                    Selected {selectedPlace.isLocal ? '· Local Place' : selectedPlace.price ? `· ${selectedPlace.price}` : ''}
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
                  <span className={`font-bold px-1.5 py-0.5 rounded text-xs shrink-0 ${selectedPlace.isLocal ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'}`}>
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
                <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-blue-700">
                  <span>Road: {routeInfo.distanceKm} km</span>
                  <span className="w-px h-3 bg-blue-200" />
                  <span>Drive: ~{routeInfo.drivMin} min</span>
                  <span className="w-px h-3 bg-blue-200" />
                  <span>Walk: ~{routeInfo.walkMin} min</span>
                </div>
              )}

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-emerald-700 shrink-0">
                  {me ? `~${km(me, selectedPlace).toFixed(2)} km away` : selectedPlace.isLocal ? 'Local Place' : 'Live TripAdvisor Pin'}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setDetailModalPlace(selectedPlace)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer"
                  >
                    Details
                  </button>

                  {/* Direct Link: Reference URL for local places, TripAdvisor for TripAdvisor places */}
                  {selectedPlace.isLocal ? (
                    (selectedPlace.referenceUrl || selectedPlace.url) && (
                      <a
                        href={selectedPlace.referenceUrl || selectedPlace.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-violet-700 hover:bg-violet-800 text-xs font-bold text-white transition flex items-center shadow-xs"
                      >
                        Reference URL ↗
                      </a>
                    )
                  ) : (
                    selectedPlace.url && (
                      <a
                        href={selectedPlace.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-xs font-bold text-white transition flex items-center shadow-xs"
                      >
                        TripAdvisor ↗
                      </a>
                    )
                  )}

                  {routeTargetId === selectedPlace.id ? (
                    <button
                      type="button"
                      onClick={() => handleToggleRoute(selectedPlace.id)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition cursor-pointer flex items-center shadow-xs"
                    >
                      Clear Route
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleRoute(selectedPlace.id)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition cursor-pointer flex items-center shadow-xs"
                    >
                      Show Route
                    </button>
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
            <button
              onClick={centerOnUser}
              className="p-2.5 hover:bg-slate-100 transition cursor-pointer text-blue-600 flex items-center justify-center"
              title="Center on My Location"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="7" />
                <line x1="12" y1="1" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="1" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="23" y2="12" />
              </svg>
            </button>
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
          <span>Live Travel Discovery</span>
        </div>
      </footer>

      {/* 6. MODALS */}
      {detailModalPlace && (
        <PlaceModal
          place={detailModalPlace}
          me={me}
          saved={saved.has(detailModalPlace.id)}
          isGuest={isGuest}
          userEmail={email}
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
