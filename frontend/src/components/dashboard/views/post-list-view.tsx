"use client"

import * as React from "react"
import Link from "next/link"
import {
  Loader2,
  RefreshCw,
  Trash2,
  Globe,
  Sparkles,
  ExternalLink,
  Edit3,
  Image as ImageIcon,
  ThumbsUp,
  MessageSquare,
  Share2,
  MoreHorizontal,
  Search,
  Flame,
  TrendingUp,
  X,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Send,
  Eye,
  CheckCircle2,
  Layers,
  SlidersHorizontal,
} from "lucide-react"
import { toast } from "sonner"

import { Post } from "@/types/models"
import {
  PageTitle,
  todayLabel,
  isPastScheduledSlot,
  PostRow,
  Empty,
  formatRelativeTime,
  formatDate,
} from "@/components/dashboard/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { api, getApiErrorMessage } from "@/lib/api"
import { useApp } from "@/contexts/app-context"
import { PostPhotocardEditor } from "@/components/post-photocard-editor"
import { cn } from "@/lib/utils"

export function PostList({
  title,
  posts,
  emptyText,
  emptyAction,
  timezone,
  published,
  onChanged,
}: {
  title: string
  posts: Post[]
  emptyText: string
  emptyAction: string
  timezone: string
  published?: boolean
  onChanged: () => void
}) {
  const { pages } = useApp()
  const [pageFilter, setPageFilter] = React.useState<number | "all">("all")
  const [pageDropdownOpen, setPageDropdownOpen] = React.useState(false)
  const pageDropdownRef = React.useRef<HTMLDivElement>(null)

  const [aiFilter, setAiFilter] = React.useState<"all" | "manual" | "ai">("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [sortBy, setSortBy] = React.useState<"newest" | "engagement" | "likes" | "comments">("newest")
  const [publishing, setPublishing] = React.useState<number | null>(null)
  const [photocardEditPostId, setPhotocardEditPostId] = React.useState<number | null>(null)
  const [lightboxImage, setLightboxImage] = React.useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  // Click outside listener to close page dropdown
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pageDropdownRef.current && !pageDropdownRef.current.contains(event.target as Node)) {
        setPageDropdownOpen(false)
      }
    }
    if (pageDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [pageDropdownOpen])

  // Robust helper to match a post with a connected page by ID, Page ID, or Page Name
  function isPostMatchingPage(post: Post, pageIdOrAll: number | string | "all"): boolean {
    if (pageIdOrAll === "all") return true
    const targetPage = pages.find((p) => String(p.id) === String(pageIdOrAll) || String(p.page_id) === String(pageIdOrAll))
    if (!targetPage) return false

    const matchConnectionId =
      (post.facebook_connection_id != null && String(post.facebook_connection_id) === String(targetPage.id)) ||
      (post.page_connection_id != null && String(post.page_connection_id) === String(targetPage.id))

    const matchPageId =
      (post.page_id && targetPage.page_id && String(post.page_id) === String(targetPage.page_id)) ||
      (post.page_id && targetPage.facebook_page_id && String(post.page_id) === String(targetPage.facebook_page_id))

    const matchPageName = Boolean(
      post.page_name &&
      targetPage.page_name &&
      post.page_name.trim().toLowerCase() === targetPage.page_name.trim().toLowerCase()
    )

    return Boolean(matchConnectionId || matchPageId || matchPageName)
  }

  // Currently selected page object
  const selectedPageObj = pageFilter === "all" ? null : pages.find((p) => String(p.id) === String(pageFilter))

  // Filter by Page
  const pageFilteredPosts = posts.filter((p) => isPostMatchingPage(p, pageFilter))

  // Filter by AI / Manual
  const aiFilteredPosts = published
    ? pageFilteredPosts.filter((post) => (aiFilter === "all" ? true : aiFilter === "ai" ? post.ai_generated : !post.ai_generated))
    : pageFilteredPosts

  // Search Filter
  const searchFilteredPosts = aiFilteredPosts.filter((post) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      post.content?.toLowerCase().includes(q) ||
      post.page_name?.toLowerCase().includes(q) ||
      post.persona_name?.toLowerCase().includes(q)
    )
  })

  // Sorting
  const visiblePosts = React.useMemo(() => {
    if (!published) return searchFilteredPosts
    const sorted = [...searchFilteredPosts]
    if (sortBy === "engagement") {
      sorted.sort((a, b) => Number(b.engagement_score || 0) - Number(a.engagement_score || 0))
    } else if (sortBy === "likes") {
      sorted.sort((a, b) => Number(b.likes_count || 0) - Number(a.likes_count || 0))
    } else if (sortBy === "comments") {
      sorted.sort((a, b) => Number(b.comments_count || 0) - Number(a.comments_count || 0))
    } else {
      // newest
      sorted.sort((a, b) => {
        const timeA = a.posted_at ? new Date(a.posted_at).getTime() : a.id
        const timeB = b.posted_at ? new Date(b.posted_at).getTime() : b.id
        return Number(timeB) - Number(timeA)
      })
    }
    return sorted
  }, [searchFilteredPosts, sortBy, published])

  // Summary Metrics for Published Posts
  const metrics = React.useMemo(() => {
    if (!published) return null
    const totalPosts = posts.length
    const totalLikes = posts.reduce((sum, p) => sum + (p.likes_count || 0), 0)
    const totalComments = posts.reduce((sum, p) => sum + (p.comments_count || 0), 0)
    const totalShares = posts.reduce((sum, p) => sum + (p.shares_count || 0), 0)
    const totalReach = posts.reduce((sum, p) => sum + (p.reach_count || 0), 0)
    const avgScore = totalPosts > 0
      ? (posts.reduce((sum, p) => sum + Number(p.engagement_score || 0), 0) / totalPosts).toFixed(1)
      : "0.0"

    return { totalPosts, totalLikes, totalComments, totalShares, totalReach, avgScore }
  }, [posts, published])

  const groupedScheduledPosts = React.useMemo(() => {
    if (published) return []
    const groups = new Map<string, Post[]>()
    for (const post of visiblePosts) {
      const label = post.persona_name || post.page_name || "Unassigned persona"
      groups.set(label, [...(groups.get(label) || []), post])
    }
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
  }, [visiblePosts, published])

  async function handleRefresh() {
    setIsRefreshing(true)
    try {
      await onChanged()
      toast.success("Feed refreshed with latest Facebook engagement data.")
    } catch {
      toast.error("Failed to refresh feed.")
    } finally {
      setIsRefreshing(false)
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) return
    try {
      await api.delete(`/posts/${id}`)
      toast.success("Post removed.")
      onChanged()
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "Failed to delete post."))
    }
  }

  async function publishNow(id: number) {
    setPublishing(id)
    try {
      await api.post(`/posts/${id}/publish`)
      toast.success("Post published to Facebook successfully!")
      onChanged()
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "Publishing failed. Please try again."))
    } finally {
      setPublishing(null)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageTitle
          title={title}
          subtitle={
            published
              ? "Live Facebook posts rendered in real-time with engagement snapshots and learner analytics."
              : `Today - ${todayLabel(timezone)}`
          }
        />
        <div className="flex items-center gap-2">
          {published && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-9 px-3 text-xs font-semibold text-slate-700 bg-white shadow-xs hover:bg-slate-50"
            >
              <RefreshCw className={cn("size-3.5 mr-1.5", isRefreshing && "animate-spin text-blue-600")} />
              Sync Stats
            </Button>
          )}
          <Button asChild size="sm" className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs">
            <Link href="/dashboard/create">
              <Sparkles className="size-3.5 mr-1.5" />
              Create Post
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards (Published only) */}
      {published && metrics && metrics.totalPosts > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Live Posts</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{metrics.totalPosts}</p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <span>👍</span> Reactions
            </p>
            <p className="text-xl font-bold text-blue-600 mt-1">{metrics.totalLikes.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <span>💬</span> Comments
            </p>
            <p className="text-xl font-bold text-indigo-600 mt-1">{metrics.totalComments.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <span>🔁</span> Shares
            </p>
            <p className="text-xl font-bold text-purple-600 mt-1">{metrics.totalShares.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Eye className="size-3 text-slate-400" /> Total Reach
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1">{metrics.totalReach.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs bg-gradient-to-br from-amber-50/50 to-orange-50/50">
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <Flame className="size-3 text-amber-600" /> Avg Score
            </p>
            <p className="text-xl font-bold text-amber-900 mt-1">{metrics.avgScore}</p>
          </div>
        </div>
      )}

      {/* Filter & Control Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3">
        {/* Row 1: Page Dropdown Selector & AI Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Page Dropdown Choose Button */}
          {pages.length > 0 && (
            <div className="relative" ref={pageDropdownRef}>
              <button
                type="button"
                onClick={() => setPageDropdownOpen(!pageDropdownOpen)}
                className={cn(
                  "h-9 px-3 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs",
                  pageFilter !== "all"
                    ? "bg-blue-50/80 border-blue-200 text-blue-700 font-bold hover:bg-blue-100/70"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                )}
              >
                <div className="flex items-center gap-1.5">
                  {selectedPageObj ? (
                    <>
                      <img
                        src={
                          selectedPageObj.page_picture_url ||
                          `https://graph.facebook.com/${selectedPageObj.facebook_page_id || selectedPageObj.page_id}/picture?type=large`
                        }
                        alt=""
                        className="size-4 rounded-full object-cover shrink-0"
                        onError={(e) => {
                          ;(e.target as HTMLElement).style.display = "none"
                        }}
                      />
                      <span className="max-w-[140px] truncate">{selectedPageObj.page_name}</span>
                      <span className="text-[10px] text-blue-600/80 font-mono">
                        ({posts.filter((item) => isPostMatchingPage(item, selectedPageObj.id)).length})
                      </span>
                    </>
                  ) : (
                    <>
                      <Globe className="size-3.5 text-blue-600 shrink-0" />
                      <span>Page: All Pages</span>
                      <span className="text-[10px] text-slate-400 font-mono">({posts.length})</span>
                    </>
                  )}
                </div>
                <ChevronDown className={cn("size-3.5 text-slate-400 transition-transform duration-200", pageDropdownOpen && "rotate-180")} />
              </button>

              {pageDropdownOpen && (
                <div className="absolute left-0 top-10.5 z-30 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 text-xs font-medium text-slate-700 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Filter by Facebook Page
                  </div>

                  {/* Option: All Pages */}
                  <button
                    type="button"
                    onClick={() => {
                      setPageFilter("all")
                      setPageDropdownOpen(false)
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer",
                      pageFilter === "all" && "bg-blue-50/70 text-blue-700 font-bold"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        <Globe className="size-3.5" />
                      </div>
                      <span>All Pages</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400">({posts.length})</span>
                      {pageFilter === "all" && <CheckCircle2 className="size-3.5 text-blue-600" />}
                    </div>
                  </button>

                  {/* Option: Individual Pages */}
                  {pages.map((p) => {
                    const count = posts.filter((item) => isPostMatchingPage(item, p.id)).length
                    const isSelected = String(pageFilter) === String(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPageFilter(p.id)
                          setPageDropdownOpen(false)
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer",
                          isSelected && "bg-blue-50/70 text-blue-700 font-bold"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <img
                            src={
                              p.page_picture_url ||
                              `https://graph.facebook.com/${p.facebook_page_id || p.page_id}/picture?type=large`
                            }
                            alt=""
                            className="size-6 rounded-full object-cover shrink-0 ring-1 ring-slate-100"
                            onError={(e) => {
                              ;(e.target as HTMLElement).style.display = "none"
                            }}
                          />
                          <span className="truncate">{p.page_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono text-slate-400">({count})</span>
                          {isSelected && <CheckCircle2 className="size-3.5 text-blue-600" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* AI / Manual Toggle Pills */}
          {published && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              {(["all", "ai", "manual"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAiFilter(value)}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1",
                    aiFilter === value
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {value === "ai" && <Sparkles className="size-3 text-purple-600" />}
                  {value === "all" ? "All Sources" : value === "ai" ? "AI Generated" : "Manual"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Row 2: Search & Sort (Published only) */}
        {published && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search posts, captions, personas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-50 border-slate-200 rounded-lg focus-visible:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-400">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="h-8 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="newest">🕒 Newest First</option>
                <option value="engagement">🔥 Highest Engagement</option>
                <option value="likes">👍 Most Reactions</option>
                <option value="comments">💬 Most Comments</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Scheduled Mode Header Pill */}
      {!published && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Today - {todayLabel(timezone)}
        </div>
      )}

      {/* Published Feed or Scheduled Posts Layout */}
      {published ? (
        /* Realistic Facebook Social Feed */
        <div className="max-w-2xl mx-auto space-y-5">
          {visiblePosts.map((post) => (
            <FacebookPublishedFeedCard
              key={post.id}
              post={post}
              timezone={timezone}
              onRemove={() => remove(post.id)}
              onEditPhotocard={() => setPhotocardEditPostId(post.id)}
              onOpenLightbox={(url) => setLightboxImage(url)}
              onChanged={onChanged}
            />
          ))}

          {!visiblePosts.length && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="size-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <Globe className="size-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No published posts found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No posts matched your search query "${searchQuery}".`
                  : "You haven't published any posts to your connected Facebook pages yet."}
              </p>
              <Button asChild className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">
                <Link href={emptyAction}>Create Your First Post</Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Scheduled Legacy / Grouped View */
        <div className="grid gap-4">
          {groupedScheduledPosts.map((group) => (
            <div key={group.label || "scheduled"} className="grid gap-3">
              {group.label ? <h2 className="text-sm font-semibold text-slate-700">{group.label}</h2> : null}
              {group.items.map((post) => (
                <Card key={post.id} className="border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
                  <CardContent className="grid gap-3 p-5">
                    {(post.page_name || post.persona_name) && (
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          {post.page_name && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50/80 text-blue-700 font-semibold border border-blue-100 text-[11px]">
                              <img
                                src={
                                  post.page_picture_url ||
                                  `https://graph.facebook.com/${post.page_id || post.facebook_connection_id}/picture?type=large`
                                }
                                alt=""
                                className="size-3.5 rounded-full object-cover"
                                onError={(e) => {
                                  ;(e.target as HTMLElement).style.display = "none"
                                }}
                              />
                              {post.page_name}
                            </span>
                          )}
                          {post.persona_name && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50/80 text-purple-700 font-semibold border border-purple-100 text-[11px]">
                              {post.persona_name}
                            </span>
                          )}
                        </div>
                        {post.scheduled_at && (
                          <span className="text-[11px] text-slate-400 font-medium">
                            {formatDate(post.scheduled_at, timezone)}
                          </span>
                        )}
                      </div>
                    )}
                    <PostRow post={post} timezone={timezone} />
                    {post.status === "missed" || isPastScheduledSlot(post) ? (
                      <span className="w-fit rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {post.status === "missed" ? "Missed" : "Past"}
                      </span>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/create?edit_id=${post.id}`}>Edit</Link>
                      </Button>
                      {post.image_url || post.media_urls?.[0] ? (
                        <Button variant="outline" size="sm" onClick={() => setPhotocardEditPostId(post.id)}>
                          Edit photocard
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        className="bg-green-700 text-white hover:bg-green-800"
                        onClick={() => publishNow(post.id)}
                        disabled={publishing === post.id}
                      >
                        {publishing === post.id ? (
                          <>
                            <Loader2 className="size-4 animate-spin mr-1" /> Publishing...
                          </>
                        ) : (
                          "Publish Now"
                        )}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => remove(post.id)}>
                        <Trash2 className="size-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
          {!visiblePosts.length ? <Empty text={emptyText} action={emptyAction} /> : null}
        </div>
      )}

      {/* Photocard Editor Sheet */}
      <Sheet open={photocardEditPostId !== null} onOpenChange={(open) => !open && setPhotocardEditPostId(null)}>
        <SheetContent className="overflow-y-auto w-full max-w-lg">
          <div className="mt-6 grid gap-2">
            <h2 className="text-base font-semibold leading-5">Edit photocard</h2>
            <p className="text-xs font-normal leading-4 text-slate-500">
              Swap background or tweak overlay text without regenerating from AI.
            </p>
          </div>
          {photocardEditPostId !== null ? (
            <PostPhotocardEditor
              postId={photocardEditPostId}
              onSaved={() => {
                setPhotocardEditPostId(null)
                onChanged()
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 size-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-all z-10"
          >
            <X className="size-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Full size media preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

/**
 * High-Fidelity Facebook Post Card Component
 * Mimics the exact visual style and interactive feel of Facebook Feed
 */
function FacebookPublishedFeedCard({
  post,
  timezone,
  onRemove,
  onEditPhotocard,
  onOpenLightbox,
  onChanged,
}: {
  post: Post
  timezone: string
  onRemove: () => void
  onEditPhotocard: () => void
  onOpenLightbox: (url: string) => void
  onChanged: () => void
}) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [isLiked, setIsLiked] = React.useState(false)
  const [likesCount, setLikesCount] = React.useState(post.likes_count || 0)
  const [showComments, setShowComments] = React.useState(false)
  const [commentInput, setCommentInput] = React.useState("")
  const [simulatedComments, setSimulatedComments] = React.useState<string[]>([])
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)

  const mediaUrl = post.image_url || post.media_urls?.[0]
  const isAi = post.ai_generated
  const threshold = 5.0
  const score = Number(post.engagement_score || 0)
  const isHighEngagement = score >= 7.5
  const isLowEngagement = post.low_engagement || (score > 0 && score < threshold)

  const relativeTime = formatRelativeTime(post.posted_at || post.scheduled_at || null, timezone)
  const formattedFullDate = formatDate(post.posted_at || post.scheduled_at || null, timezone)

  const content = post.content || ""
  const isLongContent = content.length > 260
  const displayContent = isLongContent && !isExpanded ? content.slice(0, 260) + "..." : content

  function toggleLike() {
    if (isLiked) {
      setIsLiked(false)
      setLikesCount((prev) => Math.max(0, prev - 1))
    } else {
      setIsLiked(true)
      setLikesCount((prev) => prev + 1)
      toast.success("Simulated like added.")
    }
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentInput.trim()) return
    setSimulatedComments((prev) => [...prev, commentInput.trim()])
    setCommentInput("")
    toast.success("Simulated comment submitted.")
  }

  function handleShare() {
    if (post.facebook_post_id) {
      navigator.clipboard.writeText(`https://www.facebook.com/${post.facebook_post_id}`)
      toast.success("Facebook post link copied to clipboard!")
    } else {
      navigator.clipboard.writeText(post.content)
      toast.success("Post copy copied to clipboard!")
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-md transition-all overflow-hidden relative">
      {/* Facebook Post Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-center gap-3">
          {/* Avatar with fallback initial */}
          <div className="size-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden ring-2 ring-slate-100 shrink-0 shadow-xs">
            {post.page_picture_url ? (
              <img
                src={post.page_picture_url}
                alt={post.page_name || "Page avatar"}
                className="size-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLElement).style.display = "none"
                }}
              />
            ) : (
              (post.page_name || "P")[0].toUpperCase()
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-sm font-bold text-slate-900 leading-tight hover:underline cursor-pointer">
                {post.page_name || "Connected Facebook Page"}
              </h4>
              <span className="size-3.5 rounded-full bg-[#1877F2] text-white flex items-center justify-center text-[9px] font-black shrink-0">
                ✓
              </span>
              {post.persona_name && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold border border-purple-100 text-[10px]">
                  {post.persona_name}
                </span>
              )}
              {isAi && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-100 text-[10px]">
                  <Sparkles className="size-2.5 text-blue-600" /> AI
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5" title={formattedFullDate}>
              <span>{relativeTime}</span>
              <span>·</span>
              <Globe className="size-3 text-slate-400" />
            </p>
          </div>
        </div>

        {/* Dropdown Menu Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-full transition-colors cursor-pointer"
            aria-label="Post options"
          >
            <MoreHorizontal className="size-5" />
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-30 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-700 animate-in fade-in zoom-in-95 duration-100">
                <Link
                  href={`/dashboard/create?edit_id=${post.id}`}
                  className="flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Edit3 className="size-3.5 text-slate-500" /> Edit in Composer
                </Link>
                {mediaUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false)
                      onEditPhotocard()
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 text-left cursor-pointer"
                  >
                    <Layers className="size-3.5 text-indigo-500" /> Edit Photocard
                  </button>
                )}
                {post.facebook_post_id && (
                  <a
                    href={`https://www.facebook.com/${post.facebook_post_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-blue-600"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <ExternalLink className="size-3.5" /> View on Facebook
                  </a>
                )}
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    onRemove()
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-red-50 text-red-600 text-left cursor-pointer"
                >
                  <Trash2 className="size-3.5" /> Delete from Facebook
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Facebook Post Caption */}
      <div className="px-4 pb-3 text-[13px] leading-relaxed text-slate-900 whitespace-pre-wrap font-normal">
        <span>
          {displayContent.split(" ").map((word, i) => {
            if (word.startsWith("#")) {
              return (
                <span key={i} className="text-[#1877F2] font-semibold hover:underline cursor-pointer">
                  {word}{" "}
                </span>
              )
            }
            if (word.startsWith("http://") || word.startsWith("https://")) {
              return (
                <a
                  key={i}
                  href={word}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1877F2] hover:underline break-all"
                >
                  {word}{" "}
                </a>
              )
            }
            return word + " "
          })}
        </span>
        {isLongContent && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-500 font-bold hover:underline ml-1 cursor-pointer"
          >
            {isExpanded ? "See less" : "See more"}
          </button>
        )}
      </div>

      {/* Facebook Media Container */}
      {mediaUrl && (
        <div className="relative border-y border-slate-100 bg-slate-950 overflow-hidden group">
          <img
            src={mediaUrl}
            alt="Published graphic"
            className="w-full max-h-[500px] object-contain mx-auto bg-slate-900 cursor-pointer transition-transform duration-200 group-hover:scale-[1.01]"
            onClick={() => onOpenLightbox(mediaUrl)}
          />
          <button
            type="button"
            onClick={() => onOpenLightbox(mediaUrl)}
            className="absolute bottom-3 right-3 size-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
            title="View full resolution"
          >
            <Maximize2 className="size-4" />
          </button>
        </div>
      )}

      {/* Facebook Engagement Counters */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-500 border-b border-slate-100 bg-slate-50/40">
        <div className="flex items-center gap-1.5">
          {/* Reaction Emoji Stack */}
          <div className="flex items-center -space-x-1">
            <span className="flex size-4.5 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-1 ring-white">
              👍
            </span>
            <span className="flex size-4.5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] ring-1 ring-white">
              ❤️
            </span>
            <span className="flex size-4.5 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] ring-1 ring-white">
              😆
            </span>
          </div>
          <span className="font-semibold text-slate-700 ml-1">{likesCount}</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-medium">
          <span>{post.comments_count || simulatedComments.length} comments</span>
          <span>·</span>
          <span>{post.shares_count || 0} shares</span>
          {post.reach_count ? (
            <>
              <span>·</span>
              <span className="font-semibold text-slate-700">{post.reach_count.toLocaleString()} reach</span>
            </>
          ) : null}

          {/* Performance Badge */}
          {isHighEngagement && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
              <Flame className="size-3 text-amber-600" /> High Score ({score.toFixed(1)})
            </span>
          )}
          {isLowEngagement && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px]">
              Score {score.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Facebook Action Row (Like, Comment, Share) */}
      <div className="grid grid-cols-3 px-2 py-1 text-slate-600 text-xs font-semibold border-b border-slate-100">
        <button
          type="button"
          onClick={toggleLike}
          className={cn(
            "flex items-center justify-center gap-2 py-2 rounded-lg transition-colors cursor-pointer",
            isLiked
              ? "text-[#1877F2] font-bold bg-blue-50/50"
              : "hover:bg-slate-100 text-slate-600"
          )}
        >
          <ThumbsUp className={cn("size-4", isLiked && "fill-[#1877F2]")} />
          Like
        </button>
        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className={cn(
            "flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer",
            showComments && "bg-slate-100 text-slate-900 font-bold"
          )}
        >
          <MessageSquare className="size-4" />
          Comment
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Share2 className="size-4" />
          Share
        </button>
      </div>

      {/* Simulated Comments Drawer */}
      {showComments && (
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 space-y-3 animate-in slide-in-from-top-2 duration-150">
          {simulatedComments.length > 0 && (
            <div className="space-y-2">
              {simulatedComments.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <div className="size-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-[10px] shrink-0">
                    U
                  </div>
                  <div className="bg-white rounded-xl px-3 py-2 border border-slate-200 text-slate-800 shadow-2xs">
                    <p className="font-bold text-[11px] text-slate-900">Viewer</p>
                    <p className="mt-0.5">{c}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddComment} className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Write a public comment..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              className="h-8 text-xs bg-white rounded-full px-3.5 border-slate-200"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!commentInput.trim()}
              className="h-8 px-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0"
            >
              <Send className="size-3 mr-1" /> Post
            </Button>
          </form>
        </div>
      )}

      {/* Post Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50/60 text-xs">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="h-7 px-2.5 text-xs bg-white font-medium shadow-2xs">
            <Link href={`/dashboard/create?edit_id=${post.id}`}>
              <Edit3 className="size-3 mr-1 text-slate-500" /> Edit Copy
            </Link>
          </Button>
          {mediaUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEditPhotocard}
              className="h-7 px-2.5 text-xs bg-white font-medium shadow-2xs"
            >
              <Layers className="size-3 mr-1 text-indigo-500" /> Edit Photocard
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {post.facebook_post_id ? (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-7 px-2.5 text-xs text-blue-700 bg-blue-50/60 border-blue-200 hover:bg-blue-100 font-semibold"
            >
              <a
                href={`https://www.facebook.com/${post.facebook_post_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-3 mr-1 text-blue-600" /> View on Facebook
              </a>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-7 px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 font-medium"
          >
            <Trash2 className="size-3 mr-1" /> Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
