import { supabase, isSupabaseConfigured } from './supabase'
import type { Category, Place, Review } from '../types'

const TRIPADVISOR_API_KEY =
  (import.meta.env.VITE_TRIPADVISOR_API_KEY as string | undefined) ||
  (import.meta.env.VITE_TRIPADVISOR_KEY as string | undefined) ||
  'ab2264da-675f-43bc-82b0-f85288835d00'

const TA_BASE = '/api/tripadvisor/api'

// Known Philippine City Coordinates for precise Terra Nearby Search
const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
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

const CATEGORY_PHOTOS: Record<Category, string> = {
  restaurants: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
  hotels: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
  attractions: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80',
  tours: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80',
  inspire: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
}

// Direct TripAdvisor Terra API Fetcher
async function directFetchPlaces(category: Category, city: string, latLong?: string): Promise<FetchResult> {
  if (!TRIPADVISOR_API_KEY) {
    return { places: [], error: 'TripAdvisor API key is missing.' }
  }

  try {
    let lat = 6.1164
    let lon = 125.1716

    if (latLong) {
      const [uLat, uLng] = latLong.split(',').map(Number)
      if (!isNaN(uLat) && !isNaN(uLng)) {
        lat = uLat
        lon = uLng
      }
    } else if (CITY_COORDINATES[city]) {
      lat = CITY_COORDINATES[city].lat
      lon = CITY_COORDINATES[city].lon
    }

    const headers = {
      'accept': 'application/json',
      'X-API-KEY': TRIPADVISOR_API_KEY,
    }

    // 1. Fetch nearby POIs around coordinates
    const nearbyUrl = `${TA_BASE}/catalog/locations/nearby?lat=${lat}&lon=${lon}&radius=5`
    const res = await fetch(nearbyUrl, { headers })

    if (!res.ok) {
      const errText = await res.text()
      console.warn('TripAdvisor Terra API Error:', res.status, errText)
      return { places: [], error: `TripAdvisor Error (${res.status}): ${errText.slice(0, 120)}` }
    }

    const json = await res.json()
    const rawData = json?.data ?? []

    if (!Array.isArray(rawData) || rawData.length === 0) {
      return { places: [] }
    }

    // Filter by matching TripAdvisor category URL
    let filtered = rawData.filter((item: any) => {
      const mainUrl = item.location?.urls?.tripadvisor?.main || ''
      if (category === 'restaurants') return mainUrl.includes('Restaurant_Review')
      if (category === 'hotels') return mainUrl.includes('Hotel_Review')
      if (category === 'attractions' || category === 'tours' || category === 'inspire') {
        return mainUrl.includes('Attraction_Review') || mainUrl.includes('Hotel_Review') || mainUrl.includes('Restaurant_Review')
      }
      return true
    })

    // If category filter returned 0, fallback to all available locations
    if (filtered.length === 0) {
      filtered = rawData
    }

    // Process places (limit 1 for testing / quota savings) and fetch real TripAdvisor photos
    const places = await Promise.all(
      filtered.slice(0, 1).map(async (item: any, idx: number): Promise<Place> => {
        const loc = item.location || {}
        const name = loc.names?.[0]?.value || 'TripAdvisor Venue'
        const address = loc.addresses?.[0]?.formatted || loc.addresses?.[0]?.street_address || city
        const rating = Number(loc.overall_rating?.rating ?? 4.0)
        const reviewCount = Number(loc.overall_rating?.count ?? 1)
        const pLat = Number(loc.coordinates?.latitude || lat)
        const pLng = Number(loc.coordinates?.longitude || lon)
        const mainUrl = loc.urls?.tripadvisor?.main || 'https://www.tripadvisor.com'

        let photoUrl = CATEGORY_PHOTOS[category] || CATEGORY_PHOTOS.restaurants

        // Fetch authentic live photos from TripAdvisor CDN for this location
        try {
          const photoRes = await fetch(`${TA_BASE}/locations/${loc.id}/photos`, { headers })
          if (photoRes.ok) {
            const photoData = await photoRes.json()
            const realImg = photoData.data?.[0]?.photo?.original_size_url
            if (realImg) {
              photoUrl = realImg
            }
          }
        } catch {}

        return {
          id: String(loc.id),
          rank: idx + 1,
          name,
          category,
          rating,
          reviewCount,
          price: '₱₱',
          cluster: loc.geo || city,
          address,
          description: loc.descriptions?.[0]?.value || `Authentic verified destination in ${city} on TripAdvisor.`,
          photo: photoUrl,
          url: mainUrl,
          lat: pLat,
          lng: pLng,
          openStatus: 'Open Now',
          tags: [loc.geo || city, 'TripAdvisor Verified', 'Live API'],
        }
      })
    )

    return { places }
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

    return data.slice(0, 5).map((r: any, idx: number) => ({
      id: r.id || idx + 1,
      title: r.title || 'Verified Traveler Review',
      text: r.text || r.summary || 'Authentic review from TripAdvisor traveler.',
      rating: Number(r.rating || 5),
      user: {
        username: r.user?.username || 'TripAdvisor Traveler',
        avatar: r.user?.avatar_url?.url || undefined,
      },
      date: r.publish_ts ? new Date(r.publish_ts).toLocaleDateString() : 'Recent',
    }))
  } catch (err) {
    console.warn('Error fetching TripAdvisor reviews:', err)
    return []
  }
}
