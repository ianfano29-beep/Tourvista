/**
 * ============================================================
 *  GENSAN LOCAL PLACES — Static Data File
 * ============================================================
 *  Add your places here following the sample format below.
 *
 *  FIELDS:
 *   name         — Name of the place
 *   lat / lng    — Coordinates from Google Maps (right-click → "Copy coordinates")
 *   image        — Direct image URL (Google, Facebook, or any public image link)
 *   reference    — Link to more info (Facebook page, Wikipedia, blog, etc.)
 *   description  — Short description of the place
 *   category     — ONE of: 'attractions' | 'restaurants' | 'hotels' | 'tours' | 'inspire'
 *   address      — Street or barangay address
 *   tags         — Keywords (for search filtering)
 *   rating       — Your own rating out of 5 (e.g. 4.8), or 0 if none
 * ============================================================
 */

import type { Place } from '../types'

export const GENSAN_LOCAL_PLACES: Omit<Place, 'id'>[] = [
  // ──────────────────────────────────────────────
  //  BEACHES & NATURE
  // ──────────────────────────────────────────────
  {
    name: 'Isla Vista Beach Resort',
    lat: 6.0485,
    lng: 125.1603,
    photo: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    url: 'https://www.facebook.com/IslaVistaPH',
    referenceUrl: 'https://www.facebook.com/IslaVistaPH',
    description: 'A beautiful beachfront resort with clear blue waters and white sand shores along Sarangani Bay.',
    category: 'attractions',
    address: 'Barangay Tambler, General Santos City',
    tags: ['beach', 'resort', 'swimming', 'sarangani'],
    rating: 4.5,
    isLocal: true,
  },
  {
    name: 'Sarangani Bay National Protected Seascape',
    lat: 6.0523,
    lng: 125.1602,
    photo: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
    url: 'https://en.wikipedia.org/wiki/Sarangani_Bay',
    referenceUrl: 'https://en.wikipedia.org/wiki/Sarangani_Bay',
    description: 'Protected marine area and scenic bay known for its rich biodiversity and stunning sunsets.',
    category: 'attractions',
    address: 'Sarangani Bay, General Santos City',
    tags: ['bay', 'nature', 'marine', 'protected area', 'sunset'],
    rating: 4.8,
    isLocal: true,
  },

  // ──────────────────────────────────────────────
  //  RESTAURANTS & FOOD
  // ──────────────────────────────────────────────
  {
    name: 'Tuna Capital Grill',
    lat: 6.1126,
    lng: 125.1716,
    photo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    url: 'https://www.facebook.com',
    referenceUrl: 'https://www.facebook.com',
    description: 'Famous for fresh bluefin and yellowfin tuna dishes straight from the General Santos fish port.',
    category: 'restaurants',
    address: 'National Highway, General Santos City',
    tags: ['tuna', 'seafood', 'Filipino food', 'local', 'fresh fish'],
    rating: 4.6,
    isLocal: true,
  },

  // ──────────────────────────────────────────────
  //  HOTELS & RESORTS
  // ──────────────────────────────────────────────
  {
    name: 'East Asia Royale Hotel',
    lat: 6.1135,
    lng: 125.1724,
    photo: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
    url: 'https://www.eastasiaroyale.com',
    referenceUrl: 'https://www.eastasiaroyale.com',
    description: 'Premier hotel in the heart of General Santos City offering deluxe rooms and business amenities.',
    category: 'hotels',
    address: 'Pioneer Avenue, General Santos City',
    tags: ['hotel', 'business', 'deluxe', 'city center'],
    rating: 4.4,
    isLocal: true,
  },

  // ──────────────────────────────────────────────
  //  ADD YOUR OWN PLACES BELOW ↓
  //  Copy any block above and edit the values.
  // ──────────────────────────────────────────────
]
