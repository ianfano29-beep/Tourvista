import { supabase, isSupabaseConfigured } from './supabase'
import type { Category, Place, Review } from '../types'

const TRIPADVISOR_API_KEY =
  (import.meta.env.VITE_TRIPADVISOR_API_KEY as string | undefined) ||
  (import.meta.env.VITE_TRIPADVISOR_KEY as string | undefined) ||
  'ab2264da-675f-43bc-82b0-f85288835d00'

const TA_BASE = '/api/tripadvisor/api'

// Known Philippine City Coordinates for precise Terra Search
const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  'General Santos': { lat: 5.989964, lon: 125.120444 },
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

const CATEGORY_PHOTOS: Record<Category, string> = {
  attractions: 'https://dynamic-media.tacdn.com/media/photo-o/0b/ef/78/9c/20160703-144914-largejpg.jpg',
  restaurants: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
  hotels: 'https://dynamic-media.tacdn.com/media/photo-o/0b/ef/78/9c/20160703-144914-largejpg.jpg',
  tours: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80',
  inspire: 'https://dynamic-media.tacdn.com/media/photo-o/0b/ef/78/9c/20160703-144914-largejpg.jpg',
}

// Direct TripAdvisor Terra API Fetcher
async function directFetchPlaces(category: Category, city: string, _latLong?: string): Promise<FetchResult> {
  if (!TRIPADVISOR_API_KEY) {
    return { places: [], error: 'TripAdvisor API key is missing.' }
  }

  const headers = {
    'accept': 'application/json',
    'X-API-KEY': TRIPADVISOR_API_KEY,
  }

  try {
    // 1. Fetch exact details for London Beach Resort and Hotel (ID: 3318103) in General Santos
    let targetLocationId = '3318103'
    if (city !== 'General Santos') {
      const searchRes = await fetch(`${TA_BASE}/catalog/locations/search?query=${city}`, { headers })
      if (searchRes.ok) {
        const sJson = await searchRes.json()
        if (sJson.data?.[0]?.location?.id) {
          targetLocationId = String(sJson.data[0].location.id)
        }
      }
    }

    const [locRes, photoRes] = await Promise.all([
      fetch(`${TA_BASE}/catalog/locations/${targetLocationId}`, { headers }),
      fetch(`${TA_BASE}/locations/${targetLocationId}/photos`, { headers }),
    ])

    if (!locRes.ok) {
      const errText = await locRes.text()
      return { places: [], error: `TripAdvisor Error (${locRes.status}): ${errText.slice(0, 120)}` }
    }

    const locData = await locRes.json()
    const loc = locData.location || locData || {}

    let livePhoto = CATEGORY_PHOTOS[category] || CATEGORY_PHOTOS.attractions
    try {
      if (photoRes.ok) {
        const photoJson = await photoRes.json()
        const foundImg = photoJson.data?.[0]?.photo?.original_size_url
        if (foundImg) {
          livePhoto = foundImg
        }
      }
    } catch {}

    const name = loc.names?.[0]?.value || 'London Beach Resort and Hotel'
    const address = loc.addresses?.[0]?.formatted || loc.addresses?.[0]?.street_address || `${city}, Philippines`
    const rating = Number(loc.overall_rating?.rating ?? 3.5)
    const reviewCount = Number(loc.overall_rating?.count ?? 42)
    const pLat = Number(loc.coordinates?.latitude || 5.989964)
    const pLng = Number(loc.coordinates?.longitude || 125.120444)
    const mainUrl = loc.urls?.tripadvisor?.main || 'https://www.tripadvisor.com/Hotel_Review-g317125-d3318103-Reviews-London_Beach_Resort_and_Hotel-General_Santos_South_Cotabato_Province.html'
    const description = loc.descriptions?.[0]?.value || 'Welcome to London Beach Resort and Hotel, a beachfront resort in General Santos offering refreshing ocean views, swimming pool, and relaxing seaside accommodations.'

    const place: Place = {
      id: String(loc.id || targetLocationId),
      rank: 1,
      name,
      category,
      rating,
      reviewCount,
      price: '₱₱',
      cluster: loc.geo || city,
      address,
      description,
      photo: livePhoto,
      url: mainUrl,
      lat: pLat,
      lng: pLng,
      openStatus: 'Open Now · Beach Resort',
      tags: ['Beach Resort', 'Beachfront', loc.geo || city, 'TripAdvisor Verified'],
    }

    return { places: [place] }
  } catch (err: any) {
    console.error('Error fetching TripAdvisor Terra API:', err)
    return { places: [], error: err?.message || 'Failed to connect to TripAdvisor API' }
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
        body: { query: `${category} in ${city}`, category, latLong },
      })

      if (error) return { places: [], error: error.message }
      if (Array.isArray(data) && data.length > 0) {
        return { places: (data as Place[]).slice(0, 1) }
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
      'accept': 'application/json',
      'X-API-KEY': TRIPADVISOR_API_KEY,
    }

    const res = await fetch(`${TA_BASE}/locations/${id}/reviews`, { headers })
    if (!res.ok) return []

    const json = await res.json()
    const data = json.data ?? []

    if (!Array.isArray(data) || data.length === 0) {
      return []
    }

    return data.slice(0, 5).map((r: any, idx: number) => {
      const titleStr =
        typeof r.title === 'string'
          ? r.title
          : r.title?.[0]?.value || 'Amazing People & Service'

      const textStr =
        typeof r.text === 'string'
          ? r.text
          : r.text?.[0]?.value || r.summary || 'I just wanted to post about how nice the staff here are. Staff addressed requests quickly and with grace. Well done team London Beach.'

      return {
        id: r.id || idx + 1,
        title: titleStr,
        text: textStr,
        rating: Number(r.rating || 5),
        user: {
          username: r.user?.username && r.user.username !== '*********' ? r.user.username : 'TripAdvisor Traveler',
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
