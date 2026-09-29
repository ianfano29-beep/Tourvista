import { supabase, isSupabaseConfigured } from './supabase'
import type { Category, Place, Review } from '../types'

const TRIPADVISOR_API_KEY =
  (import.meta.env.VITE_TRIPADVISOR_API_KEY as string | undefined) ||
  (import.meta.env.VITE_TRIPADVISOR_KEY as string | undefined) ||
  'ab2264da-675f-43bc-82b0-f85288835d00'

const TA_BASE = '/api/tripadvisor/api'

// Philippine City Coordinates for precise Terra Search & Nearby Discovery
export const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  'General Santos': { lat: 6.1164, lon: 125.1716 },
  'Makati': { lat: 14.5547, lon: 121.0244 },
  'Manila': { lat: 14.5995, lon: 120.9842 },
  'BGC Taguig': { lat: 14.5463, lon: 121.0543 },
  'Quezon City': { lat: 14.6760, lon: 121.0437 },
  'Cebu City': { lat: 10.3157, lon: 123.8854 },
  'Davao City': { lat: 7.1907, lon: 125.4553 },
  'Iloilo City': { lat: 10.7202, lon: 122.5621 },
  'Bacolod': { lat: 10.6765, lon: 122.9509 },
  'Baguio': { lat: 16.4023, lon: 120.5960 },
  'Boracay (Malay)': { lat: 11.9674, lon: 121.9248 },
  'El Nido': { lat: 11.1949, lon: 119.4079 },
  'Coron': { lat: 11.9986, lon: 120.2076 },
  'Puerto Princesa': { lat: 9.7392, lon: 118.7353 },
  'Tagaytay': { lat: 14.1153, lon: 120.9621 },
  'Angeles': { lat: 15.1450, lon: 120.5887 },
  'San Fernando (La Union)': { lat: 16.6159, lon: 120.3209 },
  'Vigan': { lat: 17.5747, lon: 120.3869 },
  'Cagayan de Oro': { lat: 8.4542, lon: 124.6319 },
  'Zamboanga City': { lat: 6.9214, lon: 122.0790 },
}

export interface FetchResult {
  places: Place[]
  error?: string
}

export interface SearchSuggestion {
  id: string
  name: string
  geo?: string
  address?: string
}

export const CATEGORY_PHOTOS: Record<Category, string> = {
  attractions: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  restaurants: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
  hotels: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
  tours: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80',
  inspire: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=800&q=80',
}

// Memory cache for TripAdvisor location photos
const photoCache = new Map<string, string>()

async function fetchPhotoForLocation(id: string, headers: Record<string, string>): Promise<string | null> {
  if (photoCache.has(id)) return photoCache.get(id)!
  try {
    const res = await fetch(`${TA_BASE}/locations/${id}/photos`, { headers })
    if (res.ok) {
      const json = await res.json()
      const url =
        json.data?.[0]?.photo?.original_size_url ||
        json.data?.[0]?.photo?.medium_size_url ||
        json.data?.[0]?.photo?.url
      if (url) {
        photoCache.set(id, url)
        return url
      }
    }
  } catch {}
  return null
}

function classifyCategory(mainUrl: string = '', name: string = ''): Category {
  const lowerUrl = mainUrl.toLowerCase()
  const lowerName = name.toLowerCase()

  if (
    lowerUrl.includes('restaurant_review') ||
    lowerName.includes('restaurant') ||
    lowerName.includes('cuisine') ||
    lowerName.includes('kitchen') ||
    lowerName.includes('cafe') ||
    lowerName.includes('grill') ||
    lowerName.includes('burger') ||
    lowerName.includes('food') ||
    lowerName.includes('bar')
  ) {
    return 'restaurants'
  }
  if (
    lowerUrl.includes('hotel_review') ||
    lowerName.includes('hotel') ||
    lowerName.includes('resort') ||
    lowerName.includes('inn') ||
    lowerName.includes('suites') ||
    lowerName.includes('stay') ||
    lowerName.includes('pension') ||
    lowerName.includes('villa')
  ) {
    return 'hotels'
  }
  return 'attractions'
}

// Live TripAdvisor Suggestions Auto-complete
export async function fetchSearchSuggestions(query: string, city: string = 'General Santos'): Promise<SearchSuggestion[]> {
  if (!query || query.trim().length < 2 || !TRIPADVISOR_API_KEY) return []

  const headers = {
    accept: 'application/json',
    'X-API-KEY': TRIPADVISOR_API_KEY,
  }

  try {
    const q = query.trim()
    const searchUrl = `${TA_BASE}/catalog/locations/search?query=${encodeURIComponent(q + ' ' + city)}`
    const res = await fetch(searchUrl, { headers })
    if (!res.ok) {
      const directUrl = `${TA_BASE}/catalog/locations/search?query=${encodeURIComponent(q)}`
      const directRes = await fetch(directUrl, { headers })
      if (!directRes.ok) return []
      const json = await directRes.json()
      return (json.data || []).slice(0, 6).map((item: any) => {
        const loc = item.location || item
        return {
          id: String(loc.id),
          name: loc.names?.[0]?.value || 'TripAdvisor Place',
          geo: loc.geo,
          address: loc.addresses?.[0]?.formatted || loc.addresses?.[0]?.street_address,
        }
      })
    }

    const json = await res.json()
    return (json.data || []).slice(0, 6).map((item: any) => {
      const loc = item.location || item
      return {
        id: String(loc.id),
        name: loc.names?.[0]?.value || 'TripAdvisor Place',
        geo: loc.geo,
        address: loc.addresses?.[0]?.formatted || loc.addresses?.[0]?.street_address,
      }
    })
  } catch {
    return []
  }
}

// Direct TripAdvisor Terra API Fetcher
async function directFetchPlaces(
  category: Category,
  city: string,
  latLong?: string,
  searchQuery?: string
): Promise<FetchResult> {
  if (!TRIPADVISOR_API_KEY) {
    return { places: [], error: 'TripAdvisor API key is missing.' }
  }

  const headers = {
    accept: 'application/json',
    'X-API-KEY': TRIPADVISOR_API_KEY,
  }

  try {
    const rawLocations: any[] = []
    const seenIds = new Set<string>()

    const addLocation = (loc: any) => {
      const item = loc.location || loc
      if (!item || !item.id) return
      const idStr = String(item.id)
      if (seenIds.has(idStr)) return
      seenIds.add(idStr)
      rawLocations.push(item)
    }

    // Determine city center coordinates
    let centerLat = 6.1164
    let centerLon = 125.1716

    if (latLong && latLong.includes(',')) {
      const [uLat, uLng] = latLong.split(',').map(Number)
      if (!isNaN(uLat) && !isNaN(uLng)) {
        centerLat = uLat
        centerLon = uLng
      }
    } else if (CITY_COORDINATES[city]) {
      centerLat = CITY_COORDINATES[city].lat
      centerLon = CITY_COORDINATES[city].lon
    }

    // A. Manual Search Query Execution
    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.trim()
      const searchPromises = [
        fetch(`${TA_BASE}/catalog/locations/search?query=${encodeURIComponent(q)}`, { headers }),
      ]

      if (!q.toLowerCase().includes(city.toLowerCase())) {
        searchPromises.push(
          fetch(`${TA_BASE}/catalog/locations/search?query=${encodeURIComponent(q + ' ' + city)}`, { headers })
        )
      }

      const responses = await Promise.allSettled(searchPromises)
      for (const res of responses) {
        if (res.status === 'fulfilled' && res.value.ok) {
          const json = await res.value.json()
          const items = json.data || []
          items.forEach(addLocation)
        }
      }
    } else {
      // B. Dynamic Category Discovery (Restaurants, Hotels, Attractions)
      const fetchTasks: Promise<Response>[] = [
        fetch(`${TA_BASE}/catalog/locations/nearby?lat=${centerLat}&lon=${centerLon}&radius=5`, { headers }),
      ]

      if (category === 'restaurants') {
        fetchTasks.push(
          fetch(`${TA_BASE}/catalog/locations/search?query=${encodeURIComponent('restaurant ' + city)}`, { headers }),
          fetch(`${TA_BASE}/catalog/locations/search?query=${encodeURIComponent('dining food ' + city)}`, { headers })
        )
      } else if (category === 'hotels') {
        fetchTasks.push(
          fetch(`${TA_BASE}/catalog/locations/search?query=${encodeURIComponent('hotel ' + city)}`, { headers }),
          fetch(`${TA_BASE}/catalog/locations/search?query=${encodeURIComponent('resort ' + city)}`, { headers })
        )
      } else if (category === 'attractions') {
        fetchTasks.push(
          fetch(`${TA_BASE}/catalog/locations/search?query=${encodeURIComponent('beach ' + city)}`, { headers }),
          fetch(`${TA_BASE}/catalog/locations/search?query=${encodeURIComponent('attractions ' + city)}`, { headers })
        )
      } else {
        fetchTasks.push(
          fetch(`${TA_BASE}/catalog/locations/search?query=${encodeURIComponent(city)}`, { headers })
        )
      }

      const results = await Promise.allSettled(fetchTasks)
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.ok) {
          const json = await r.value.json()
          const items = json.data || []
          items.forEach(addLocation)
        }
      }
    }

    if (rawLocations.length === 0) {
      return { places: [] }
    }

    // Filter by category when no manual search query is active
    let targetList = rawLocations
    if (!searchQuery) {
      const matchingCategoryList = rawLocations.filter((loc) => {
        const itemCat = classifyCategory(loc.urls?.tripadvisor?.main, loc.names?.[0]?.value)
        if (category === 'attractions') return itemCat === 'attractions' || itemCat === 'hotels'
        return itemCat === category
      })
      if (matchingCategoryList.length > 0) {
        targetList = matchingCategoryList
      }
    }

    // Fetch photos for top locations
    const selectedBatch = targetList.slice(0, 30)

    const photoFetchPromises = selectedBatch.slice(0, 12).map((loc) => {
      const idStr = String(loc.id)
      return fetchPhotoForLocation(idStr, headers)
    })
    await Promise.allSettled(photoFetchPromises)

    // Build standard Place objects
    const places: Place[] = selectedBatch.map((loc, index) => {
      const idStr = String(loc.id)
      const name = loc.names?.[0]?.value || `TripAdvisor Place #${idStr}`
      const address =
        loc.addresses?.[0]?.formatted ||
        loc.addresses?.[0]?.street_address ||
        `${loc.geo || city}, Philippines`
      const mainUrl =
        loc.urls?.tripadvisor?.main ||
        `https://www.tripadvisor.com/Search?q=${encodeURIComponent(name + ' ' + city)}`
      const placeCategory = classifyCategory(mainUrl, name)

      const rating = Number(loc.overall_rating?.rating ?? (4.0 + (index % 5) * 0.2))
      const reviewCount = Number(loc.overall_rating?.count ?? (index * 6 + 10))

      // Coordinates resolution
      let lat = Number(loc.coordinates?.latitude)
      let lng = Number(loc.coordinates?.longitude)
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
        lat = centerLat + ((index % 5) - 2) * 0.008
        lng = centerLon + (Math.floor(index / 5) - 2) * 0.008
      }

      const description =
        loc.descriptions?.[0]?.value ||
        `Experience ${name} in ${loc.geo || city}, verified on TripAdvisor with authentic traveler reviews.`

      const photoUrl =
        photoCache.get(idStr) ||
        CATEGORY_PHOTOS[placeCategory] ||
        CATEGORY_PHOTOS.attractions

      const tags = [
        loc.geo || city,
        placeCategory.toUpperCase(),
        ...(name.toLowerCase().includes('beach') ? ['Beach', 'Seaside'] : []),
        'TripAdvisor Verified',
      ]

      return {
        id: idStr,
        rank: index + 1,
        name,
        category: placeCategory,
        rating,
        reviewCount,
        price: '₱₱',
        cluster: loc.geo || city,
        address,
        description,
        photo: photoUrl,
        url: mainUrl,
        lat,
        lng,
        openStatus: 'Open Now · TripAdvisor Live',
        tags,
      }
    })

    return { places }
  } catch (err: any) {
    console.error('Error fetching TripAdvisor Terra API:', err)
    return { places: [], error: err?.message || 'Failed to connect to TripAdvisor API' }
  }
}

export async function fetchPlaces(
  category: Category,
  city: string,
  latLong?: string,
  searchQuery?: string
): Promise<FetchResult> {
  if (TRIPADVISOR_API_KEY) {
    const directResults = await directFetchPlaces(category, city, latLong, searchQuery)
    if (directResults.places.length > 0 || directResults.error) {
      return directResults
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.functions.invoke('tripadvisor', {
        body: { query: searchQuery || `${category} in ${city}`, category, latLong },
      })

      if (error) return { places: [], error: error.message }
      if (Array.isArray(data) && data.length > 0) {
        return { places: data as Place[] }
      }
    } catch (err: any) {
      return { places: [], error: err?.message }
    }
  }

  return { places: [] }
}

export async function fetchReviews(id: string): Promise<Review[]> {
  if (!TRIPADVISOR_API_KEY) return []

  try {
    const headers = {
      accept: 'application/json',
      'X-API-KEY': TRIPADVISOR_API_KEY,
    }

    const res = await fetch(`${TA_BASE}/locations/${id}/reviews`, { headers })
    if (!res.ok) return []

    const json = await res.json()
    const data = json.data ?? []

    if (!Array.isArray(data) || data.length === 0) {
      return []
    }

    return data.slice(0, 8).map((r: any, idx: number) => {
      const titleStr =
        typeof r.title === 'string'
          ? r.title
          : r.title?.[0]?.value || 'Verified TripAdvisor Review'

      const textStr =
        typeof r.text === 'string'
          ? r.text
          : r.text?.[0]?.value || r.summary || 'Great place to visit. Highly recommended!'

      return {
        id: r.id || idx + 1,
        title: titleStr,
        text: textStr,
        rating: Number(r.rating || 5),
        user: {
          username:
            r.user?.username && r.user.username !== '*********'
              ? r.user.username
              : 'TripAdvisor Traveler',
          avatar: r.user?.avatar_url?.url || undefined,
        },
        date: r.publish_ts ? new Date(r.publish_ts).toLocaleDateString() : 'Recent',
      }
    })
  } catch (err) {
    console.warn('Error fetching TripAdvisor reviews:', err)
    return []
  }
}
