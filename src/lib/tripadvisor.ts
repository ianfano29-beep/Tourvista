import { supabase, isSupabaseConfigured } from './supabase'
import type { Category, Place, Review } from '../types'

const TRIPADVISOR_API_KEY =
  (import.meta.env.VITE_TRIPADVISOR_API_KEY as string | undefined) ||
  (import.meta.env.VITE_TRIPADVISOR_KEY as string | undefined) ||
  'ab2264da-675f-43bc-82b0-f85288835d00'

// Use proxy route on both local dev (Vite proxy) and Vercel production (vercel.json rewrite)
const TA_BASE = '/api/tripadvisor/api/v1/location'

const QUERY: Record<Category, string> = {
  restaurants: 'restaurants',
  hotels: 'hotels',
  tours: 'tours',
  attractions: 'popular sights',
  inspire: 'things to do',
}

const mapTaCategory = (cat: Category): string => {
  if (cat === 'restaurants' || cat === 'hotels') return cat
  return 'attractions'
}

export interface FetchResult {
  places: Place[]
  error?: string
}

// Direct TripAdvisor fetcher
async function directFetchPlaces(category: Category, city: string, latLong?: string): Promise<FetchResult> {
  if (!TRIPADVISOR_API_KEY) {
    return { places: [], error: 'TripAdvisor API key is missing. Please add VITE_TRIPADVISOR_API_KEY in .env.' }
  }

  try {
    const searchParams = new URLSearchParams({
      key: TRIPADVISOR_API_KEY,
      searchQuery: `${QUERY[category]} in ${city}`,
      category: mapTaCategory(category),
      language: 'en',
    })
    if (latLong) {
      searchParams.set('latLong', latLong)
    }

    const searchRes = await fetch(`${TA_BASE}/search?${searchParams.toString()}`)
    
    if (!searchRes.ok) {
      let errDetail = `HTTP ${searchRes.status} ${searchRes.statusText}`
      try {
        const errJson = await searchRes.json()
        if (errJson.Message) errDetail = errJson.Message
        else if (errJson.message) errDetail = errJson.message
      } catch {}
      
      console.error('TripAdvisor API Error:', errDetail)
      return {
        places: [],
        error: `TripAdvisor API: ${errDetail} (Key: ${TRIPADVISOR_API_KEY.slice(0, 8)}…)`,
      }
    }

    const searchData = await searchRes.json()
    const rawLocations = searchData?.data ?? []
    if (!Array.isArray(rawLocations) || rawLocations.length === 0) {
      return { places: [] }
    }

    // Limited to 1 place for testing / quota savings
    const places = await Promise.all(
      rawLocations.slice(0, 1).map(async (p: any, idx: number): Promise<Place | null> => {
        try {
          const locId = p.location_id
          const [detailsRes, photosRes] = await Promise.all([
            fetch(`${TA_BASE}/${locId}/details?key=${TRIPADVISOR_API_KEY}&language=en`),
            fetch(`${TA_BASE}/${locId}/photos?key=${TRIPADVISOR_API_KEY}&language=en&limit=1`),
          ])

          const d = detailsRes.ok ? await detailsRes.json() : {}
          const ph = photosRes.ok ? await photosRes.json() : {}

          const lat = Number(d.latitude || p.latitude)
          const lng = Number(d.longitude || p.longitude)

          if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
            return null
          }

          const photoUrl =
            ph.data?.[0]?.images?.large?.url ||
            ph.data?.[0]?.images?.medium?.url ||
            ph.data?.[0]?.images?.small?.url ||
            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80'

          const tags: string[] = []
          if (d.ranking_data?.ranking_string) {
            tags.push(d.ranking_data.ranking_string)
          }
          if (Array.isArray(d.cuisine)) {
            d.cuisine.forEach((c: any) => {
              if (c.name) tags.push(c.name)
            })
          }
          if (Array.isArray(d.subcategory)) {
            d.subcategory.forEach((s: any) => {
              if (s.name && !tags.includes(s.name)) tags.push(s.name)
            })
          }

          return {
            id: String(locId),
            rank: idx + 1,
            name: d.name || p.name || 'TripAdvisor Venue',
            category,
            rating: Number(d.rating ?? 0),
            reviewCount: Number(d.num_reviews ?? 0),
            price: d.price_level || '',
            cluster: d.address_obj?.city || d.address_obj?.neighborhood || city,
            address: d.address_obj?.address_string || [d.address_obj?.street1, d.address_obj?.city].filter(Boolean).join(', ') || city,
            description: d.description || '',
            photo: photoUrl,
            url: d.web_url || `https://www.tripadvisor.com`,
            lat,
            lng,
            openStatus: d.open_now_text || (d.is_closed === false ? 'Open Now' : ''),
            tags,
            phone: d.phone || '',
          }
        } catch (err) {
          console.warn(`Error fetching details for location ${p.location_id}:`, err)
          return null
        }
      })
    )

    return { places: places.filter((p): p is Place => p !== null) }
  } catch (err: any) {
    console.error('Error in directFetchPlaces:', err)
    return { places: [], error: err?.message || 'Failed to connect to TripAdvisor API' }
  }
}

// Direct TripAdvisor reviews fetcher
async function directFetchReviews(id: string): Promise<Review[]> {
  if (!TRIPADVISOR_API_KEY) return []

  try {
    const res = await fetch(`${TA_BASE}/${id}/reviews?key=${TRIPADVISOR_API_KEY}&language=en`)
    if (!res.ok) return []
    const json = await res.json()
    const data = json?.data ?? []
    if (!Array.isArray(data)) return []

    return data.slice(0, 3).map((r: any) => ({
      id: Number(r.id) || Math.floor(Math.random() * 100000),
      title: r.title || 'TripAdvisor Review',
      text: r.text || '',
      rating: Number(r.rating || 5),
      user: {
        username: r.user?.username || 'TripAdvisor Traveler',
      },
      date: r.published_date || '',
    }))
  } catch (err) {
    console.warn('Error fetching TripAdvisor reviews directly:', err)
    return []
  }
}

export async function fetchPlaces(category: Category, city: string, latLong?: string): Promise<FetchResult> {
  if (TRIPADVISOR_API_KEY) {
    const directResults = await directFetchPlaces(category, city, latLong)
    if (directResults.places.length > 0 || directResults.error) {
      return directResults
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.functions.invoke('tripadvisor', {
        body: { query: `${QUERY[category]} in ${city}`, category, latLong },
      })

      if (error) {
        return { places: [], error: error.message }
      }

      if (Array.isArray(data) && data.length > 0) {
        return { places: (data as Place[]).slice(0, 1) }
      }
    } catch (err: any) {
      return { places: [], error: err?.message || 'Error connecting to TripAdvisor function' }
    }
  }

  return { places: [] }
}

export async function fetchReviews(id: string): Promise<Review[]> {
  if (TRIPADVISOR_API_KEY) {
    const directReviews = await directFetchReviews(id)
    if (directReviews.length > 0) return directReviews
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.functions.invoke('tripadvisor', { body: { id } })
      if (!error && Array.isArray(data)) {
        return (data as Review[]).slice(0, 3)
      }
    } catch (err) {
      console.warn('Error fetching reviews from Supabase function:', err)
    }
  }

  return []
}
