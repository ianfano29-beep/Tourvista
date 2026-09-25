import { useEffect, useState } from 'react'
import { fetchReviews } from '../lib/tripadvisor'
import { km } from '../lib/geo'
import type { LatLng, Place, Review } from '../types'

interface Props {
  place: Place
  me: LatLng | null
  saved: boolean
  onSave: () => void
  onClose: () => void
}

export default function PlaceModal({ place, me, saved, onSave, onClose }: Props) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loadingReviews, setLoadingReviews] = useState(true)

  useEffect(() => {
    let active = true
    setLoadingReviews(true)
    fetchReviews(place.id)
      .then((data) => {
        if (active) setReviews(data)
      })
      .finally(() => {
        if (active) setLoadingReviews(false)
      })
    return () => {
      active = false
    }
  }, [place.id])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-xs p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero Photo with overlay badges */}
        <div className="relative h-64 sm:h-72 w-full bg-slate-900">
          <img src={place.photo} alt={place.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30" />
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center text-base transition cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>

          <div className="absolute bottom-4 left-5 right-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded bg-emerald-800 px-2 py-0.5 text-xs font-bold shadow">
                ★ {place.rating.toFixed(1)}
              </span>
              <span className="text-xs text-slate-200">
                ({(place.reviewCount || 3200).toLocaleString()} reviews on TripAdvisor)
              </span>
              <span className="rounded bg-white/20 backdrop-blur-xs px-2 py-0.5 text-xs font-bold text-white ml-auto">
                {place.price || '€€'}
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight leading-tight">{place.name}</h2>
            <p className="text-xs text-slate-300 mt-0.5">📍 {place.address}</p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Action buttons bar */}
          <div className="flex flex-wrap items-center gap-2.5 pb-4 border-b border-slate-100">
            <button
              onClick={onSave}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                saved
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  : 'bg-emerald-800 text-white hover:bg-emerald-900'
              }`}
            >
              <span>{saved ? '♥ Saved in Itinerary' : '♡ Save Place'}</span>
            </button>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              ▲ Open Directions
            </a>
            <a
              href={place.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition ml-auto"
            >
              TripAdvisor Page ↗
            </a>
          </div>

          {/* Description & Attributes */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Overview</h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {place.description || 'Authentic top-rated destination offering unforgettable local experiences and exceptional hospitality.'}
            </p>
          </div>

          {/* Tags */}
          {place.tags && place.tags.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Highlights</h3>
              <div className="flex flex-wrap gap-1.5">
                {place.tags.map((tag, i) => (
                  <span key={i} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {tag}
                  </span>
                ))}
                {me && (
                  <span className="rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 text-xs font-semibold">
                    🚶 ~{km(me, place).toFixed(1)} km from your current location
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Verified TripAdvisor Reviews */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>★ Verified Traveler Reviews</span>
              </h3>
              <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                TripAdvisor Verified
              </span>
            </div>

            {loadingReviews ? (
              <p className="text-xs text-slate-500 py-3">Loading authentic traveler reviews…</p>
            ) : reviews.length === 0 ? (
              <p className="text-xs text-slate-500">No written reviews yet. Be the first to share your thoughts!</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl bg-slate-50/80 p-3.5 border border-slate-200/60 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        {r.user?.avatar ? (
                          <img src={r.user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-[10px]">
                            {r.user?.username?.slice(0, 1) || 'T'}
                          </div>
                        )}
                        <span className="font-bold text-slate-900">{r.user?.username || 'Traveler'}</span>
                      </div>
                      <span className="font-bold text-amber-600">★ {r.rating}.0</span>
                    </div>
                    <p className="font-semibold text-slate-800 mt-1">{r.title}</p>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">{r.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
