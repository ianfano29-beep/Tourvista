// Proxy for the TripAdvisor Content API so the API key never reaches the browser.
// Deploy: supabase functions deploy tripadvisor && supabase secrets set TRIPADVISOR_KEY=xxxx
const KEY = Deno.env.get('TRIPADVISOR_KEY')!
const BASE = 'https://api.content.tripadvisor.com/api/v1/location'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { ...cors, 'Content-Type': 'application/json' } })

const get = async (path: string, q: Record<string, string> = {}) => {
  const u = new URL(BASE + path)
  u.search = new URLSearchParams({ ...q, key: KEY, language: 'en' }).toString()
  return (await fetch(u)).json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const { query, category, latLong, id } = await req.json()
  if (id) return json((await get(`/${id}/reviews`)).data ?? [])

  const taCategory = category === 'restaurants' || category === 'hotels' ? category : 'attractions'
  const found = await get('/search', { searchQuery: query, category: taCategory, ...(latLong ? { latLong } : {}) })
  const places = await Promise.all(
    (found.data ?? []).slice(0, 10).map(async (p: any) => {
      const [d, ph] = await Promise.all([get(`/${p.location_id}/details`), get(`/${p.location_id}/photos`, { limit: '1' })])
      return {
        id: p.location_id, name: d.name, category, rating: Number(d.rating ?? 0),
        lat: Number(d.latitude), lng: Number(d.longitude),
        address: d.address_obj?.address_string ?? '', description: d.description ?? '',
        photo: ph.data?.[0]?.images?.large?.url ?? '', url: d.web_url ?? '',
      }
    }),
  )
  return json(places.filter((p) => p.lat && p.lng))
})
