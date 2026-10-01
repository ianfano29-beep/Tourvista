import { supabase, isSupabaseConfigured } from './supabase'
import { GENSAN_LOCAL_PLACES } from '../data/gensan_places'
import type { Category, Place } from '../types'

/**
 * Fetch locally-curated places for a given category + city.
 *
 * Priority:
 *  1. Always reads from the static `gensan_places.ts` file first (no DB needed).
 *  2. If Supabase is configured, also fetches from the `local_places` table
 *     and merges those results on top.
 */
export async function fetchLocalPlaces(
  category: Category,
  city: string,
  searchQuery?: string
): Promise<Place[]> {
  const q = searchQuery?.trim().toLowerCase() ?? ''

  // 1. Static places from gensan_places.ts
  let staticResults = GENSAN_LOCAL_PLACES.filter((p) => {
    if (p.category !== category) return false
    if (q) {
      return (
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
      )
    }
    return true
  }).map((p, i) => ({
    ...p,
    id: `static_local_${i}_${p.name.replace(/\s+/g, '_')}`,
  })) as Place[]

  // 2. Optional Supabase overlay (only if credentials are set)
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from('local_places')
        .select('*')
        .ilike('city', `%${city.split(' ')[0]}%`)
        .eq('category', category)

      if (data && data.length > 0) {
        let dbPlaces = data.map((row: any) => ({
          id: `db_local_${row.id}`,
          name: row.name,
          lat: row.lat,
          lng: row.lng,
          photo: row.image_url,
          referenceUrl: row.reference_url || '',
          url: row.reference_url || '',
          description: row.description || '',
          category: row.category as Category,
          address: row.address || city,
          tags: row.tags || [],
          rating: row.rating || 0,
          reviewCount: 0,
          isLocal: true,
        })) as Place[]

        // Client-side filter by search query (name, description, or tags)
        if (q) {
          dbPlaces = dbPlaces.filter((p) =>
            p.name.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q) ||
            p.tags?.some((t) => t.toLowerCase().includes(q))
          )
        }

        // Merge: static first, then DB additions (no duplicates by name)
        const existingNames = new Set(staticResults.map((p) => p.name.toLowerCase()))
        const newFromDb = dbPlaces.filter((p) => !existingNames.has(p.name.toLowerCase()))
        staticResults = [...staticResults, ...newFromDb]
      }
    } catch (err) {
      console.warn('[localPlaces] Supabase fetch error (using static only):', err)
    }
  }

  return staticResults
}

