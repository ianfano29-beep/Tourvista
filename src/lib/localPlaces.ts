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
  const cityKey = city.trim().toLowerCase()
  const isGensanScope =
    cityKey.includes('general') ||
    cityKey.includes('santos') ||
    cityKey.includes('gensan') ||
    cityKey.includes('sarangani') ||
    cityKey.includes('dadiangas')

  // 1. Static places from gensan_places.ts
  let staticResults: Place[] = []
  if (isGensanScope) {
    staticResults = GENSAN_LOCAL_PLACES.filter((p) => {
      if (q) {
        return (
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.address?.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
        )
      }
      return p.category === category
    }).map((p, i) => ({
      ...p,
      rating: Number(p.rating) || 0,
      id: `static_local_${i}_${p.name.replace(/\s+/g, '_')}`,
      isLocal: true,
    })) as Place[]
  }

  // 2. Supabase overlay (fetches added local places from database)
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('local_places')
        .select('*')

      if (!error && data && data.length > 0) {
        let dbPlaces = data.map((row: any) => ({
          id: `db_local_${row.id}`,
          name: row.name || 'Local Place',
          lat: Number(row.lat) || 6.1164,
          lng: Number(row.lng) || 125.1716,
          photo: row.image_url || '',
          referenceUrl: row.reference_url || '',
          url: row.reference_url || row.url || '',
          description: row.description || '',
          category: (row.category || 'attractions') as Category,
          address: row.address || row.city || city,
          tags: Array.isArray(row.tags) ? row.tags : [],
          rating: Number(row.rating) || 0,
          reviewCount: 0,
          isLocal: true,
          city: row.city || 'General Santos City',
        })) as Place[]

        // Filter DB places
        if (q) {
          dbPlaces = dbPlaces.filter((p) =>
            p.name.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q) ||
            p.address?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q) ||
            p.tags?.some((t) => t.toLowerCase().includes(q))
          )
        } else {
          dbPlaces = dbPlaces.filter((p) => p.category === category)
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

