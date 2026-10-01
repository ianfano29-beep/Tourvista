export type Category = 'restaurants' | 'hotels' | 'tours' | 'attractions' | 'inspire' | 'heritage'

export interface LatLng {
  lat: number
  lng: number
}

export interface Location {
  country: string
  region: string
  city: string
}

export interface Place extends LatLng {
  id: string
  name: string
  category: Category
  rating: number
  address: string
  description: string
  photo: string
  url: string
  price?: string
  reviewCount?: number
  cluster?: string
  tags?: string[]
  subCategory?: string
  openStatus?: string
  michelin?: boolean
  rank?: number
  phone?: string
  hours?: string
  isLocal?: boolean        // true = sourced from Supabase local_places, not TripAdvisor
  referenceUrl?: string   // external reference link (blog, wiki, FB page, etc.)
}

export interface Review {
  id: number
  title: string
  text: string
  rating: number
  user?: { username: string; avatar?: string }
  date?: string
}

export const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'attractions', label: 'Popular sights', icon: '🏛️' },
  { id: 'heritage', label: 'Heritage', icon: '🏺' },
  { id: 'restaurants', label: 'Restaurants', icon: '🍴' },
  { id: 'hotels', label: 'Hotels', icon: '🏨' },
  { id: 'tours', label: 'Tours', icon: '🚶' },
  { id: 'inspire', label: 'Inspire me', icon: '✨' },
]

export interface SubCategoryFilter {
  id: string
  label: string
  icon?: string
}

export const SUB_FILTERS: SubCategoryFilter[] = [
  { id: 'all', label: 'All Places' },
  { id: 'trattorias', label: 'Trattorias & Osterias', icon: '🍝' },
  { id: 'pizzerias', label: 'Pizzerias', icon: '🍕' },
  { id: 'gelato', label: 'Desserts & Bakeries', icon: '🍨' },
  { id: 'fine_dining', label: 'Fine Dining', icon: '⭐' },
  { id: 'wine_bars', label: 'Bars & Lounges', icon: '🍷' },
]
