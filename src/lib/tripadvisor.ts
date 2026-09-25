import { supabase, isSupabaseConfigured } from './supabase'
import type { Category, Place, Review } from '../types'
import { getFallbackPlaces, MOCK_REVIEWS } from './mockData'

const QUERY: Record<Category, string> = {
  restaurants: 'restaurants',
  hotels: 'hotels',
  tours: 'tours',
  attractions: 'popular sights',
  inspire: 'things to do',
}

export async function fetchPlaces(category: Category, city: string, latLong?: string): Promise<Place[]> {
  if (!isSupabaseConfigured) {
    return getFallbackPlaces(category, city)
  }

  try {
    const { data, error } = await supabase.functions.invoke('tripadvisor', {
      body: { query: `${QUERY[category]} ${city}`, category, latLong },
    })

    if (error || !data || !Array.isArray(data) || data.length === 0) {
      console.warn('Supabase tripadvisor function unavailable, using curated places.', error)
      return getFallbackPlaces(category, city)
    }

    return data as Place[]
  } catch (err) {
    console.warn('Error invoking tripadvisor function, falling back to mock data:', err)
    return getFallbackPlaces(category, city)
  }
}

export async function fetchReviews(id: string): Promise<Review[]> {
  if (MOCK_REVIEWS[id]) {
    return MOCK_REVIEWS[id]
  }

  if (!isSupabaseConfigured) {
    return [
      {
        id: 1,
        title: 'Outstanding experience!',
        text: 'Top notch service, wonderful atmosphere, and exceeded all our travel expectations.',
        rating: 5,
        user: { username: 'Wanderer' },
      },
      {
        id: 2,
        title: 'Worth visiting',
        text: 'Clean, well-organized, and great location. Highly recommended for travelers.',
        rating: 4,
        user: { username: 'TravelLover' },
      },
    ]
  }

  try {
    const { data, error } = await supabase.functions.invoke('tripadvisor', { body: { id } })
    if (error || !data) {
      return [
        {
          id: 1,
          title: 'Memorable experience',
          text: 'Great ambiance and excellent location for exploring the area.',
          rating: 5,
          user: { username: 'Traveler' },
        },
      ]
    }
    return (data ?? []) as Review[]
  } catch {
    return []
  }
}
