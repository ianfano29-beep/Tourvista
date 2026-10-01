import { useEffect, useState, type FormEvent } from 'react'
import { fetchReviews } from '../lib/tripadvisor'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { km } from '../lib/geo'
import type { LatLng, Place, Review } from '../types'

interface LocalComment {
  id: string
  place_id: string
  user_email: string
  rating: number
  comment: string
  created_at: string
}

interface Props {
  place: Place
  me: LatLng | null
  saved: boolean
  isGuest?: boolean
  userEmail?: string
  onSave: () => void
  onClose: () => void
}

export default function PlaceModal({
  place,
  me,
  saved,
  isGuest = false,
  userEmail = 'Traveler',
  onSave,
  onClose,
}: Props) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loadingReviews, setLoadingReviews] = useState(true)

  // Local place comments state
  const [comments, setComments] = useState<LocalComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [commentRating, setCommentRating] = useState(5)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [commentError, setCommentError] = useState('')

  // 1. Fetch TripAdvisor reviews if place is NOT local
  useEffect(() => {
    if (place.isLocal) return
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
  }, [place.id, place.isLocal])

  // 2. Fetch visitor comments from localStorage and Supabase for all places
  const fetchLocalComments = async () => {
    setLoadingComments(true)
    try {
      const stored = localStorage.getItem(`tv_comments_${place.id}`)
      if (stored) {
        setComments(JSON.parse(stored))
      }
    } catch {}

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('place_comments')
          .select('*')
          .eq('place_id', place.id)
          .order('created_at', { ascending: false })

        if (!error && data && data.length > 0) {
          setComments((prev) => {
            const combined = [...(data as LocalComment[])]
            prev.forEach((pItem) => {
              if (!combined.some((c) => c.id === pItem.id)) {
                combined.push(pItem)
              }
            })
            return combined.sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
          })
        }
      } catch (err) {
        console.warn('Error fetching place comments from DB:', err)
      }
    }
    setLoadingComments(false)
  }

  useEffect(() => {
    fetchLocalComments()
  }, [place.id])

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setSubmittingComment(true)
    setCommentError('')

    const commentEmail = userEmail && userEmail.trim() ? userEmail.trim() : 'Traveler'
    const newCommentItem: LocalComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      place_id: place.id,
      user_email: commentEmail,
      rating: commentRating,
      comment: newComment.trim(),
      created_at: new Date().toISOString(),
    }

    // Save to state and localStorage immediately
    setComments((prev) => {
      const updated = [newCommentItem, ...prev]
      try {
        localStorage.setItem(`tv_comments_${place.id}`, JSON.stringify(updated))
      } catch {}
      return updated
    })
    setNewComment('')

    // Attempt to sync to Supabase
    if (isSupabaseConfigured) {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData?.user?.id || null

        await supabase.from('place_comments').insert({
          place_id: place.id,
          user_id: userId,
          user_email: commentEmail,
          rating: commentRating,
          comment: newCommentItem.comment,
        })
      } catch (err: any) {
        console.warn('Saved comment locally; Supabase sync:', err)
      }
    }

    setSubmittingComment(false)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-xs p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero Photo with overlay badges */}
        <div className="relative h-64 sm:h-72 w-full bg-slate-900">
          <img
            src={place.photo}
            alt={place.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000&auto=format&fit=crop&q=80'
            }}
          />
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
              {place.isLocal ? (
                <span className="rounded-full bg-violet-600/90 backdrop-blur-xs px-2.5 py-0.5 text-xs font-bold shadow text-white">
                  Local Discovery
                </span>
              ) : place.rating > 0 ? (
                <span className="rounded bg-emerald-800 px-2 py-0.5 text-xs font-bold shadow">
                  ★ {place.rating.toFixed(1)}
                </span>
              ) : null}
              <span className="text-xs text-slate-200">
                {place.isLocal
                  ? '(Curated Local Place)'
                  : place.reviewCount
                  ? `(${place.reviewCount.toLocaleString()} reviews on TripAdvisor)`
                  : '(TripAdvisor)'}
              </span>
              {place.price && (
                <span className="rounded bg-white/20 backdrop-blur-xs px-2 py-0.5 text-xs font-bold text-white ml-auto">
                  {place.price}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black tracking-tight leading-tight">{place.name}</h2>
            {place.address && <p className="text-xs text-slate-300 mt-0.5">{place.address}</p>}
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
              <span>{saved ? 'Saved in Itinerary' : 'Save Place'}</span>
            </button>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Open Directions ↗
            </a>

            {/* Destination Link: Reference URL for Local Places, TripAdvisor Page for TripAdvisor places */}
            {place.isLocal ? (
              (place.referenceUrl || place.url) && (
                <a
                  href={place.referenceUrl || place.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100 transition ml-auto flex items-center gap-1 shadow-2xs"
                >
                  Reference URL ↗
                </a>
              )
            ) : (
              place.url && (
                <a
                  href={place.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition ml-auto flex items-center gap-1 shadow-2xs"
                >
                  TripAdvisor Page ↗
                </a>
              )
            )}
          </div>

          {/* Description & Attributes */}
          {place.description && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Overview</h3>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {place.description}
              </p>
            </div>
          )}

          {/* Tags */}
          {place.tags && place.tags.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Highlights</h3>
              <div className="flex flex-wrap gap-1.5">
                {place.tags.map((tag, i) => (
                  <span
                    key={i}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      place.isLocal ? 'bg-violet-50 text-violet-700 border border-violet-100' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {tag}
                  </span>
                ))}
                {me && (
                  <span className="rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 text-xs font-semibold">
                    ~{km(me, place).toFixed(1)} km from your current location
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 1. Community Comments & Feedback for ALL Places */}
          <div className="pt-3 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Visitor Reviews & Feedback</span>
                <span className="text-[11px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                  {comments.length}
                </span>
              </h3>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                place.isLocal
                  ? 'text-violet-700 bg-violet-50 border-violet-200'
                  : 'text-emerald-800 bg-emerald-50 border-emerald-200'
              }`}>
                {place.isLocal ? 'Local Community' : 'Community Feedback'}
              </span>
            </div>

            {/* Review input form */}
            <form onSubmit={handleCommentSubmit} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Post as <span className="text-emerald-700 font-semibold">{userEmail || 'Traveler'}</span>
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setCommentRating(star)}
                      className={`text-base leading-none transition cursor-pointer ${
                        star <= commentRating ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
                      }`}
                      title={`${star} Star${star > 1 ? 's' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your experience, tips, or recommendations for this place..."
                maxLength={500}
                required
                className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 resize-none"
              />

              {commentError && (
                <p className="text-[11px] font-semibold text-rose-600">{commentError}</p>
              )}

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-slate-400">{newComment.length}/500</span>
                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className="rounded-xl bg-emerald-800 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-900 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  {submittingComment ? 'Posting…' : 'Post Feedback'}
                </button>
              </div>
            </form>

            {/* Scrollable Comments List */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {loadingComments ? (
                <p className="text-xs text-slate-500 py-2">Loading visitor feedback…</p>
              ) : comments.length === 0 ? (
                <div className="rounded-2xl bg-slate-50/60 border border-slate-100 p-4 text-center">
                  <p className="text-xs text-slate-500">No feedback posted yet for this place.</p>
                  <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                    Be the first to share your thoughts!
                  </p>
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="rounded-2xl bg-slate-50/80 p-3.5 border border-slate-200/60 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                          {c.user_email?.slice(0, 1) || 'U'}
                        </div>
                        <span className="font-bold text-slate-900 truncate max-w-[160px] sm:max-w-xs">
                          {c.user_email}
                        </span>
                      </div>
                      <span className="font-bold text-amber-600 shrink-0">★ {c.rating}.0</span>
                    </div>
                    <p className="text-slate-700 mt-1 leading-relaxed whitespace-pre-wrap">{c.comment}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Reviews for TripAdvisor places */}
          {!place.isLocal && (
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">TripAdvisor Verified Reviews</h3>
                <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Live TripAdvisor API
                </span>
              </div>
              {loadingReviews ? (
                <p className="text-xs text-slate-500 py-3">Loading authentic traveler reviews…</p>
              ) : reviews.length === 0 ? (
                <p className="text-xs text-slate-500">No written reviews found on TripAdvisor for this location.</p>
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
                      {r.title && <p className="font-semibold text-slate-800 mt-1">{r.title}</p>}
                      <p className="text-slate-600 mt-0.5 leading-relaxed">{r.text}</p>
                      {r.date && <span className="text-[10px] text-slate-400 mt-1 block">{r.date}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
