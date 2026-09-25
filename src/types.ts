export type Category = 'restaurants' | 'hotels' | 'tours' | 'attractions' | 'inspire'

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
}

export interface Review {
  id: number
  title: string
  text: string
  rating: number
  user?: { username: string; avatar?: string }
  date?: string
}

export const CATEGORIES: { id: Category; label: string; count?: number; icon?: string }[] = [
  { id: 'restaurants', label: 'Restaurants', count: 142, icon: '🍴' },
  { id: 'attractions', label: 'Popular sights', count: 86, icon: '🏛️' },
  { id: 'hotels', label: 'Hotels', count: 94, icon: '🏨' },
  { id: 'tours', label: 'Tours', count: 48, icon: '🚶' },
  { id: 'inspire', label: 'Inspire me', count: 32, icon: '✨' },
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
  { id: 'gelato', label: 'Gelato & Sweets', icon: '🍨' },
  { id: 'fine_dining', label: 'Fine Dining (Michelin)', icon: '⭐' },
  { id: 'wine_bars', label: 'Wine Bars', icon: '🍷' },
]
