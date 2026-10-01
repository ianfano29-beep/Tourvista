import { supabase, isSupabaseConfigured } from './supabase'
import type { Category, Place } from '../types'

// Shape of a row in the Supabase `local_places` table
interface LocalPlaceRow {
  id: string
  name: string
  lat: number
  lng: number
  image_url: string
  reference_url?: string
  description?: string
  category: Category
  address?: string
  tags?: string[]
  rating?: number
  city: string
}

/**
 * Fetch locally-added places from Supabase for a given category + city.
 * Returns an empty array (silently) when Supabase is not configured.
 */
export async function fetchLocalPlaces(
  category: Category,
  city: string,
  searchQuery?: string
): Promise<Place[]> {
  if (!isSupabaseConfigured) return []

  try {
    let query = supabase
      .from('local_places')
      .select('*')
      .ilike('city', `%${city.split(' ')[0]}%`) // loose city match
      .eq('category', category)

    if (searchQuery && searchQuery.trim().length > 0) {
      query = query.ilike('name', `%${searchQuery}%`)
    }

    const { data, error } = await query

    if (error) {
      console.warn('[localPlaces] Supabase fetch error:', error.message)
      return []
    }

    return (data as LocalPlaceRow[]).map((row) => ({
      id: `local_${row.id}`,
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      photo: row.image_url,
      referenceUrl: row.reference_url || '',
      url: row.reference_url || '',
      description: row.description || '',
      category: row.category,
      address: row.address || city,
      tags: row.tags || [],
      rating: row.rating || 0,
      reviewCount: 0,
      isLocal: true,
    }))
  } catch (err) {
    console.warn('[localPlaces] Unexpected error:', err)
    return []
  }
}
