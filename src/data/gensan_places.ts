import type { Place } from '../types'

export const GENSAN_LOCAL_PLACES: Omit<Place, 'id'>[] = [

  {
    name: 'General Santos City Oval Plaza',
    lat: 6.112430883354463,
    lng: 125.17333483946027,
    photo: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/19/78/75/dc/20190927-145858-largejpg.jpg?w=800&h=800&s=1',
    url: 'https://gensantourism.gensantos.gov.ph/experience',
    referenceUrl: 'https://gensantourism.gensantos.gov.ph/experience',
    description: 'Public space used for cultural, sports, and community activities.',
    category: 'attractions',
    address: '458C+7Q2, General Santos City (Dadiangas), 9500 South Cotabato',
    tags: ['plaza', 'public space', 'cultural', 'sports', 'community'],
    rating: 4.3,
    isLocal: true,
  },
  {
    name: 'SM City General Santos',
    lat: 6.115616074970451,
    lng: 125.18102552519063,
    photo: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/0b/40/3e/16/sm-city-general-santos.jpg?w=800&h=800&s=1',
    url: 'https://www.smsupermalls.com/mall-directory/sm-city-general-santos',
    referenceUrl: 'https://gensantourism.gensantos.gov.ph/experience',
    description: 'Major shopping, dining, and entertainment destination in General Santos City.',
    category: 'attractions',
    address: 'Santiago Blvd, General Santos City, 9500 South Cotabato',
    tags: ['mall', 'shopping', 'dining', 'entertainment'],
    rating: 4.4,
    isLocal: true,
  },
  {
    name: 'Queen Tuna Park',
    lat: 6.106919408032654,
    lng: 125.1755123,
    photo: 'https://lh3.googleusercontent.com/gps-cs-s/ANWiy9RfP0l_0uS9LGq5et4Dunnlxs1sUobWtjyl3EqqsYR7hTomfDtXcoEHxDHtEjkxFnVX50Kx9K0n7QJRJVSoaCKl0DkPkEHFJeP6R9b6c4LLcwNQtmHExvkpTTu0MU4AeUWKuH_jVA=s680-w680-h510-rw',
    url: 'https://gensantourism.gensantos.gov.ph/experience',
    referenceUrl: 'https://gensantourism.gensantos.gov.ph/experience',
    description: 'Lawned city park on Sarangani Bay with beachside cabanas & a number of trees for shade.',
    category: 'attractions',
    address: 'Brgy. Dadiangas South, General Santos City',
    tags: ['park', 'bay', 'beachside', 'cabanas'],
    rating: 3.8,
    isLocal: true,
  },



]