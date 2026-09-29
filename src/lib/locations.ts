import type { Location } from '../types'

// Philippines — Region → Cities/Municipalities
export const PHILIPPINES_REGIONS: Record<string, string[]> = {
  'Metro Manila (NCR)': [
    'Manila', 'Makati', 'BGC Taguig', 'Quezon City', 'Pasig',
    'Mandaluyong', 'Marikina', 'Parañaque', 'Las Piñas', 'Muntinlupa',
    'Caloocan', 'Malabon', 'Navotas', 'Valenzuela', 'Pasay', 'Pateros',
  ],
  'Region I — Ilocos': [
    'Vigan', 'Laoag', 'San Fernando (La Union)', 'Dagupan', 'Alaminos',
  ],
  'Region II — Cagayan Valley': [
    'Tuguegarao', 'Ilagan', 'Cauayan', 'Santiago',
  ],
  'Region III — Central Luzon': [
    'Angeles', 'San Fernando (Pampanga)', 'Olongapo', 'Malolos', 'Cabanatuan',
    'Tarlac City', 'Balanga', 'Palayan', 'Meycauayan',
  ],
  'Region IV-A — CALABARZON': [
    'Calamba', 'Antipolo', 'Batangas City', 'Lucena', 'Lipa',
    'San Pablo', 'Tagaytay', 'Santa Rosa', 'Biñan',
  ],
  'Region IV-B — MIMAROPA': [
    'Puerto Princesa', 'El Nido', 'Coron', 'San Jose (Occidental Mindoro)',
    'Calapan', 'Romblon',
  ],
  'Region V — Bicol': [
    'Legazpi', 'Naga', 'Sorsogon City', 'Masbate City', 'Iriga', 'Tabaco',
  ],
  'Region VI — Western Visayas': [
    'Iloilo City', 'Bacolod', 'Roxas City', 'San Carlos', 'Boracay (Malay)',
    'Kalibo',
  ],
  'Region VII — Central Visayas': [
    'Cebu City', 'Lapu-Lapu', 'Mandaue', 'Bohol (Tagbilaran)', 'Dumaguete',
    'Toledo', 'Danao', 'Carcar',
  ],
  'Region VIII — Eastern Visayas': [
    'Tacloban', 'Ormoc', 'Borongan', 'Catbalogan', 'Baybay',
  ],
  'Region IX — Zamboanga Peninsula': [
    'Zamboanga City', 'Dipolog', 'Pagadian', 'Isabela City',
  ],
  'Region X — Northern Mindanao': [
    'Cagayan de Oro', 'Iligan', 'Butuan', 'Gingoog', 'Oroquieta', 'Ozamiz',
    'Valencia', 'Malaybalay',
  ],
  'Region XI — Davao': [
    'Davao City', 'Tagum', 'Panabo', 'Island Garden City of Samal',
    'Digos', 'Mati',
  ],
  'Region XII — SOCCSKSARGEN': [
    'General Santos', 'Koronadal', 'Kidapawan', 'Cotabato City', 'Tacurong',
  ],
  'Region XIII — Caraga': [
    'Butuan', 'Surigao City', 'Bislig', 'Tandag', 'Bayugan',
  ],
  'CAR — Cordillera': [
    'Baguio', 'Tabuk', 'Bangued', 'La Trinidad', 'Lagawe', 'Bontoc',
  ],
  'BARMM — Bangsamoro': [
    'Cotabato City', 'Marawi', 'Lamitan', 'Jolo', 'Bongao',
  ],
}

// Keep LOCATIONS for backward compat but Philippines is now the only country
export const LOCATIONS: Record<string, Record<string, string[]>> = {
  Philippines: PHILIPPINES_REGIONS,
}

export const DEFAULT_LOCATION: Location = {
  country: 'Philippines',
  region: 'Region XII — SOCCSKSARGEN',
  city: 'General Santos',
}
