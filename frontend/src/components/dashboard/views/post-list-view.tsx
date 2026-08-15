"use client"

import * as React from "react"

import {
  PageConnection, Post, AIPersona, PromptStudioConfig, PerformanceInsights,
  Analytics, DashboardIntelligence, StyleAnalysis, TrackerDashboard, ScheduledSlotItem, GlobalModelSettings
} from "@/types/models"
import { PageTitle, PageMini, PageStatusBadge, formatDate, todayLabel, isPastScheduledSlot, slotStatusClass, MiniBars, emptySchedule, scheduleDayLabel, activeDaysToAbbrev, abbrevDaysToFull, scheduleFromLegacyPersona, LearnedInsightsPanel, ConnectEmpty, FacebookConnectButton, Stat, PostRow, Empty, SkeletonPage, badgeClass } from "@/components/dashboard/shared/dashboard-ui"


import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  CalendarClock,
  Check,
  FileText,
  Home,
  Loader2,
  Menu,
  PenLine,
  Plus,
  Plug,
  Radar,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
  Image,
  LayoutTemplate,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { AgenticPosterLab } from "@/components/social-platform/AgenticPosterLab"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { useApp } from "@/contexts/app-context"
import { API_BASE_URL, BACKEND_ORIGIN, api, getApiErrorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"
import { TemplateBuilder } from "@/components/template-builder/template-builder"
import { PostPhotocardEditor } from "@/components/post-photocard-editor"


export function PostList({ title, posts, emptyText, emptyAction, timezone, published, onChanged }: { title: string; posts: Post[]; emptyText: string; emptyAction: string; timezone: string; published?: boolean; onChanged: () => void }) {
  const [aiFilter, setAiFilter] = React.useState<"all" | "manual" | "ai">("all")
  const [publishing, setPublishing] = React.useState<number | null>(null)
  const [photocardEditPostId, setPhotocardEditPostId] = React.useState<number | null>(null)
  const visiblePosts = published ? posts.filter((post) => aiFilter === "all" || (aiFilter === "ai" ? post.ai_generated : !post.ai_generated)) : posts
  const groupedScheduledPosts = React.useMemo(() => {
    const groups = new Map<string, Post[]>()
    for (const post of visiblePosts) {
      const label = post.persona_name || post.page_name || "Unassigned persona"
      groups.set(label, [...(groups.get(label) || []), post])
    }
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
  }, [visiblePosts])
  async function remove(id: number) {
    if (!window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) return
    await api.delete(`/posts/${id}`)
    toast.success("Post removed.")
    onChanged()
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
    <>
      <PageTitle
        title={title}
        subtitle={
          published
            ? "Live posts with engagement snapshots from the learning optimizer."
            : `Today - ${todayLabel(timezone)}`
        }
      />
      {published ? (
        <div className="flex flex-wrap gap-2">
          {(["all", "manual", "ai"] as const).map((value) => (
            <Button
              key={value}
              variant={aiFilter === value ? "default" : "outline"}
              className={aiFilter === value ? "bg-blue-700 hover:bg-blue-800" : ""}
              onClick={() => setAiFilter(value)}
            >
              {value === "all" ? "Show All" : value === "manual" ? "Manual Only" : "AI Generated Only"}
            </Button>
          ))}
        </div>
      ) : null}
      {!published ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Today - {todayLabel(timezone)}
        </div>
      ) : null}
      <div className="grid gap-4">
        {(published ? [{ label: "", items: visiblePosts }] : groupedScheduledPosts).map((group) => (
          <div key={group.label || "published"} className="grid gap-3">
            {!published ? <h2 className="text-sm font-semibold text-slate-700">{group.label}</h2> : null}
            {group.items.map((post) => (
          <Card key={post.id}>
            <CardContent className="grid gap-3 p-6">
              <PostRow post={post} timezone={timezone} />
              {!published && (post.status === "missed" || isPastScheduledSlot(post)) ? (
                <span className="w-fit rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                  {post.status === "missed" ? "Missed" : "Past"}
                </span>
              ) : null}
              {published ? (
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  {post.low_engagement ? (
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                      Low engagement
                    </span>
                  ) : null}
                  <span>Likes {post.likes_count || 0}</span>
                  <span>Comments {post.comments_count || 0}</span>
                  <span>Shares {post.shares_count || 0}</span>
                  <span>Reach {post.reach_count || 0}</span>
                  <span>Score {Number(post.engagement_score || 0).toFixed(1)}</span>
                  <Button size="icon" variant="ghost">
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <Link href="/dashboard/create">Edit</Link>
                </Button>
                {post.image_url || post.media_urls?.[0] ? (
                  <Button variant="outline" onClick={() => setPhotocardEditPostId(post.id)}>
                    Edit photocard
                  </Button>
                ) : null}
                {!published ? (
                  <Button
                    className="bg-green-700 text-white hover:bg-green-800"
                    onClick={() => publishNow(post.id)}
                    disabled={publishing === post.id}
                  >
                    {publishing === post.id ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Publishing...
                      </>
                    ) : (
                      "Publish Now"
                    )}
                  </Button>
                ) : null}
                <Button variant="destructive" onClick={() => remove(post.id)}>
                  <Trash2 className="size-4" /> {published ? "Delete from Facebook" : "Delete"}
                </Button>
              </div>
            </CardContent>
          </Card>
            ))}
          </div>
        ))}
        {!visiblePosts.length ? <Empty text={emptyText} action={emptyAction} /> : null}
      </div>
      <Sheet open={photocardEditPostId !== null} onOpenChange={(open) => !open && setPhotocardEditPostId(null)}>
        <SheetContent className="overflow-y-auto w-full max-w-lg">
          <div className="mt-6 grid gap-2">
            <h2 className="text-lg font-semibold">Edit photocard</h2>
            <p className="text-sm text-slate-500">Swap background or tweak overlay text without regenerating from AI.</p>
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
    </>
  )
}

