"use client"

import * as React from "react"

import {
  PageConnection, Post, AIPersona, PromptStudioConfig, PerformanceInsights,
  Analytics, DashboardIntelligence, StyleAnalysis, TrackerDashboard, ScheduledSlotItem, GlobalModelSettings
} from "@/types/models"
import { PageTitle, PageMini, PageStatusBadge, formatDate, todayLabel, isPastScheduledSlot, slotStatusClass, MiniBars, emptySchedule, scheduleDayLabel, activeDaysToAbbrev, abbrevDaysToFull, scheduleFromLegacyPersona, LearnedInsightsPanel, ConnectEmpty, FacebookConnectButton, Stat, PostRow, Empty, SkeletonPage, badgeClass } from "@/components/dashboard/shared/dashboard-ui"

import Link from "next/link"
import { RefreshCw, Loader2, Sparkles, PenLine, Radar, Image as ImageIcon, ArrowRight, Lightbulb, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"



export function HomeView({ pages, onConnected, timezone }: { pages: PageConnection[]; posts: Post[]; onConnected: () => void; timezone: string }) {
  const [dashboardData, setDashboardData] = React.useState<{ todays_slots: any[], recent_posts: any[] } | null>(null)
  const [trackerData, setTrackerData] = React.useState<TrackerDashboard | null>(null)
  const [loadingDashboard, setLoadingDashboard] = React.useState(true)
  const [dashboardError, setDashboardError] = React.useState<string | null>(null)
  const [retrying, setRetrying] = React.useState<string | null>(null)
  
  const fetchDashboard = React.useCallback(async () => {
    setDashboardError(null)
    try {
      const [dashRes, trackRes] = await Promise.allSettled([
        api.get("/api/dashboard"),
        api.get<TrackerDashboard>("/api/tracker")
      ])
      if (dashRes.status === "fulfilled") setDashboardData(dashRes.value.data)
      if (trackRes.status === "fulfilled") setTrackerData(trackRes.value.data)
    } catch (err: any) {
      console.error("Failed to load dashboard data:", err)
      setDashboardError(err?.response?.data?.detail || "Failed to load dashboard data. Retrying soon...")
    } finally {
      setLoadingDashboard(false)
    }
  }, [])

  const hasActiveSlots = dashboardData?.todays_slots?.some(
    (slot) => slot.status === "pending" || slot.status === "generating"
  )

  React.useEffect(() => {
    fetchDashboard()
    const intervalMs = hasActiveSlots ? 5000 : 30000
    const interval = setInterval(fetchDashboard, intervalMs)
    return () => clearInterval(interval)
  }, [fetchDashboard, hasActiveSlots])

  async function retrySlot(slotId: string) {
    setRetrying(slotId)
    try {
      await api.post(`/api/scheduled-slots/${slotId}/retry`)
      toast.success("Slot retry started.")
      await fetchDashboard()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not retry slot.")
    } finally {
      setRetrying(null)
    }
  }

  if (!pages.length) return (
    <>
      <PageTitle title="Dashboard" subtitle="Connect your Facebook page to get started." />
      <ConnectEmpty onConnected={onConnected} />
    </>
  )

  if (loadingDashboard) {
    return (
      <>
        <PageTitle title="Dashboard" subtitle="Today's schedule and recent activity." />
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-slate-400" /></div>
      </>
    )
  }

  return (
    <>
      <PageTitle title="Dashboard" subtitle="Today's schedule, agentic suggestions, and recent activity." />
      
      {dashboardError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{dashboardError}</div>
      )}

      {/* Fast-Start 3-Step Onboarding Path (Phase B) */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50/80 via-white to-blue-50/50 shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                <Sparkles className="size-5 text-purple-700" />
                Fast-Start Launch Guide
              </CardTitle>
              <CardDescription className="text-xs">
                Complete these 3 simple steps to fully automate your AI content publishing pipeline.
              </CardDescription>
            </div>
            <Badge variant="outline" className="w-fit text-xs border-purple-300 text-purple-800 bg-purple-100/60 font-medium">
              {pages.length > 0 ? (dashboardData?.todays_slots?.length || dashboardData?.recent_posts?.length ? "3 / 3 Steps Completed" : "2 / 3 Steps Completed") : "1 / 3 Steps"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 pt-1">
          {/* Step 1 */}
          <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-xs flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>
                <p className="text-xs font-semibold text-slate-800">1. Connect Facebook Page</p>
              </div>
              <p className="text-[11px] text-slate-500 pl-8">
                {pages.length > 0 ? `${pages.length} page(s) connected.` : "Connect your page for publishing."}
              </p>
            </div>
            <Button asChild size="sm" variant="ghost" className="h-7 text-xs text-purple-700 hover:bg-purple-50 justify-start pl-0">
              <Link href="/dashboard/settings">View Connection Settings →</Link>
            </Button>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-xs flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-xs font-bold">2</span>
                <p className="text-xs font-semibold text-slate-800">2. Extract Style DNA</p>
              </div>
              <p className="text-[11px] text-slate-500 pl-8">
                Analyze past posts to generate an autonomous brand tone.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="h-7 text-xs text-purple-700 border-purple-200 hover:bg-purple-50 justify-start">
              <Link href="/dashboard/style-analyzer">Launch Style Analyzer →</Link>
            </Button>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-xs flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">3</span>
                <p className="text-xs font-semibold text-slate-800">3. Create / Schedule Post</p>
              </div>
              <p className="text-[11px] text-slate-500 pl-8">
                Draft content with AI visuals and set autonomous schedule.
              </p>
            </div>
            <Button asChild size="sm" className="h-7 text-xs bg-purple-700 hover:bg-purple-800 text-white justify-start">
              <Link href="/dashboard/create">Draft &amp; Schedule Post →</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Bar */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Link href="/dashboard/create" className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-blue-500 hover:shadow-md">
          <div className="rounded-md bg-blue-50 p-2.5 text-blue-700">
            <PenLine className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Create Post</p>
            <p className="text-xs text-slate-500">Draft &amp; schedule content</p>
          </div>
        </Link>
        <Link href="/dashboard/style-analyzer" className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-purple-500 hover:shadow-md">
          <div className="rounded-md bg-purple-50 p-2.5 text-purple-700">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Style Analyzer</p>
            <p className="text-xs text-slate-500">Extract persona from posts</p>
          </div>
        </Link>
        <Link href="/dashboard/page-tracker" className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-indigo-500 hover:shadow-md">
          <div className="rounded-md bg-indigo-50 p-2.5 text-indigo-700">
            <Radar className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Page Tracker</p>
            <p className="text-xs text-slate-500">Monitor competitor trends</p>
          </div>
        </Link>
        <Link href="/dashboard/templates" className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-emerald-500 hover:shadow-md">
          <div className="rounded-md bg-emerald-50 p-2.5 text-emerald-700">
            <ImageIcon className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Poster Workbench</p>
            <p className="text-xs text-slate-500">Visuals &amp; Templates</p>
          </div>
        </Link>
      </div>


      {/* Proactive Agent Intelligence Suggestions */}
      {trackerData?.trends && trackerData.trends.length > 0 && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-900 font-semibold">
                <Lightbulb className="size-5 text-blue-600" />
                Agentic Recommendations &amp; Competitor Trends
              </span>
              <Button asChild variant="ghost" size="sm" className="text-xs text-blue-700 hover:bg-blue-100">
                <Link href="/dashboard/page-tracker">View All Tracked Insights <ArrowRight className="size-3.5 ml-1" /></Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {trackerData.trends.slice(0, 2).map((trend) => (
              <div key={trend.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-md border border-blue-100 shadow-sm text-sm">
                <div className="flex items-start gap-2.5">
                  <TrendingUp className="size-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-800">{trend.summary}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Topic: <span className="font-semibold text-blue-700">{trend.topic}</span></p>
                  </div>
                </div>
                <Button asChild size="sm" className="bg-blue-700 hover:bg-blue-800 text-white shrink-0">
                  <Link href={`/dashboard/create?topic=${encodeURIComponent(trend.topic)}`}>
                    <PenLine className="size-3.5 mr-1.5" /> Draft Post Now
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Today's Schedule</span>
              <Button variant="ghost" size="icon" onClick={fetchDashboard} title="Refresh">
                <RefreshCw className="size-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!dashboardData?.todays_slots?.length ? (
              <p className="text-sm text-slate-500 py-4 text-center">No slots scheduled for today.</p>
            ) : (
              dashboardData.todays_slots.map((slot: any) => (
                <div key={slot.id} className="flex items-center justify-between p-3 rounded-md border gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{slot.persona_name}</p>
                    <p className="text-xs text-slate-500">
                      {slot.scheduled_at_utc
                        ? new Intl.DateTimeFormat(undefined, { timeStyle: "short", timeZone: timezone }).format(new Date(slot.scheduled_at_utc))
                        : slot.scheduled_at_local}
                    </p>
                    {slot.error_message && (
                      <p className="text-xs text-red-500 mt-1 truncate max-w-[200px]" title={slot.error_message}>{slot.error_message}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full font-medium capitalize",
                      slot.status === "pending" ? "bg-amber-100 text-amber-700" :
                      slot.status === "generating" ? "bg-blue-100 text-blue-700" :
                      slot.status === "publishing" ? "bg-purple-100 text-purple-700" :
                      slot.status === "published" ? "bg-green-100 text-green-700" :
                      slot.status === "failed" ? "bg-red-100 text-red-700" :
                      slot.status === "cancelled" ? "bg-slate-100 text-slate-500" :
                      "bg-slate-100 text-slate-600"
                    )}>
                      {slot.status}
                    </span>
                    {slot.retry_count > 0 && (
                      <span className="text-[10px] text-slate-500">retry #{slot.retry_count}</span>
                    )}
                    {slot.status === "failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs px-2"
                        disabled={retrying === slot.id}
                        onClick={() => retrySlot(slot.id)}
                      >
                        {retrying === slot.id ? <Loader2 className="size-3 animate-spin" /> : "Retry"}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Published Posts</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {!dashboardData?.recent_posts?.length ? (
              <p className="text-sm text-slate-500 py-4 text-center">No recent posts.</p>
            ) : (
              dashboardData.recent_posts.map((post: any) => (
                <div key={post.id} className="flex gap-3 p-3 rounded-md border">
                  {post.image_url && <img src={post.image_url} alt="Post" className="size-16 rounded object-cover" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-xs text-slate-500">{post.persona_name}</p>
                      {post.facebook_post_url && (
                        <a href={post.facebook_post_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
                      )}
                    </div>
                    <p className="text-sm line-clamp-2">{post.content_preview}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {post.published_at
                        ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(post.published_at))
                        : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
