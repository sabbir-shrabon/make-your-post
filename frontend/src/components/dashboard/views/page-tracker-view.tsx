"use client"

import * as React from "react"

import {
  PageConnection, Post, AIPersona, PromptStudioConfig, PerformanceInsights,
  Analytics, DashboardIntelligence, StyleAnalysis, TrackerDashboard, ScheduledSlotItem, GlobalModelSettings
} from "@/types/models"
import { PageTitle, PageMini, PageStatusBadge, formatDate, todayLabel, isPastScheduledSlot, slotStatusClass, MiniBars, emptySchedule, scheduleDayLabel, activeDaysToAbbrev, abbrevDaysToFull, scheduleFromLegacyPersona, LearnedInsightsPanel, ConnectEmpty, FacebookConnectButton, Stat, PostRow, Empty, SkeletonPage, badgeClass } from "@/components/dashboard/shared/dashboard-ui"

import Link from "next/link"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"


export function PageTrackerView({
  pages,
  onRemixPost,
}: {
  pages: PageConnection[]
  onRemixPost?: (content: string, topic?: string) => void
}) {
  const [data, setData] = React.useState<TrackerDashboard | null>(null)
  const [url, setUrl] = React.useState("")
  const [name, setName] = React.useState("")
  const [addingPostsFor, setAddingPostsFor] = React.useState<any | null>(null)
  const [manualPosts, setManualPosts] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [personas, setPersonas] = React.useState<AIPersona[]>([])
  const [personaId, setPersonaId] = React.useState("")
  const [visibleCount, setVisibleCount] = React.useState(10)
  const loaderRef = React.useRef<HTMLDivElement>(null)
  const selectedPage = pages[0]
  
  const load = React.useCallback(() => api.get<TrackerDashboard>("/api/tracker").then((response) => setData(response.data)), [])
  React.useEffect(() => { load().catch(() => setData(null)) }, [load])
  
  React.useEffect(() => {
    if (!selectedPage?.id) return
    api.get<AIPersona[]>(`/api/ai/personas/${selectedPage.id}`).then((response) => setPersonas(response.data)).catch(() => setPersonas([]))
  }, [selectedPage?.id])

  React.useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((v) => v + 10)
      }
    }, { threshold: 0.1 })
    if (loaderRef.current) observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [])

  async function addPage() {
    if (!url || !name) return toast.error("Provide URL and Name.")
    setLoading(true)
    try {
      await api.post("/api/tracker/pages", { url, name })
      setUrl("")
      setName("")
      toast.success("Page added to tracker.")
      await load()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Could not add page.")
    } finally {
      setLoading(false)
    }
  }

  async function submitManualPosts() {
    if (!manualPosts.trim()) return
    setLoading(true)
    try {
      const postsArray = manualPosts.split("\n\n").filter((p) => p.trim())
      await api.post(`/api/tracker/pages/${addingPostsFor.id}/posts`, { posts: postsArray })
      setManualPosts("")
      setAddingPostsFor(null)
      toast.success("Posts added successfully.")
      await load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not add posts.")
    } finally {
      setLoading(false)
    }
  }

  async function useInspiration(content: string) {
    if (!personaId) return toast.error("Choose a persona first.")
    await api.post("/api/style/apply", { persona_id: Number(personaId), inspiration_post: content })
    toast.success("Post added as style inspiration.")
  }

  return (
    <>
      <PageTitle title="Page Tracker" subtitle="Track public pages, spot winning posts, and borrow style inspiration responsibly." aiPowered />
      <Sheet open={!!addingPostsFor} onOpenChange={(open) => !open && setAddingPostsFor(null)}>
        <SheetContent className="overflow-y-auto w-full max-w-md">
          <div className="grid gap-4 mt-6">
            <h2 className="text-lg font-semibold">Add Posts to {addingPostsFor?.nickname}</h2>
            <p className="text-sm text-slate-500">Paste recent posts from this page. Separate multiple posts by double newlines.</p>
            <Textarea className="min-h-64" value={manualPosts} onChange={(e) => setManualPosts(e.target.value)} placeholder="Post 1 content...&#10;&#10;Post 2 content..." />
            <Button onClick={submitManualPosts} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null} Save Posts
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Card>
        <CardContent className="grid gap-3 p-5">
          <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
            <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Facebook Page URL" />
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Page Name" />
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={addPage} disabled={loading}>Add Page</Button>
          </div>
          <Select className="max-w-sm" value={personaId} onChange={(event) => setPersonaId(event.target.value)}>
            <option value="">Persona for style inspiration</option>
            {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.persona_name}</option>)}
          </Select>
          <p className="text-xs text-slate-500">{data?.tracked_pages.length || 0}/10 pages tracked.</p>
        </CardContent>
      </Card>

      {data?.trends.map((trend) => (
        <div key={trend.id} className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{trend.summary}</span>
            <Button asChild variant="outline">
              <Link href={`/dashboard/create?topic=${encodeURIComponent(trend.topic)}`}>Generate</Link>
            </Button>
          </div>
        </div>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Top Tracked Posts This Week</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data?.posts.slice(0, visibleCount).map((post) => (
            <div key={post.id} className="grid gap-2 rounded-md border p-3">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-medium">{post.page_name}</span>
                <span className="text-slate-500">Score {post.engagement_score?.toFixed(1) || "0.0"}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{post.content}</p>
              <p className="text-xs text-slate-500">
                Likes {post.likes_count} · Comments {post.comments_count} · Shares {post.shares_count} · Topic {post.topic || "-"}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => useInspiration(post.content)}>
                  Use as Style Inspiration
                </Button>
                {onRemixPost ? (
                  <Button
                    size="sm"
                    className="bg-blue-700 hover:bg-blue-800 text-white font-semibold"
                    onClick={() => onRemixPost(post.content, post.topic || post.page_name)}
                  >
                    Remix into Composer
                  </Button>
                ) : (
                  <Button asChild size="sm" className="bg-blue-700 hover:bg-blue-800 text-white">
                    <Link href={`/dashboard/create?topic=${encodeURIComponent(post.topic || post.page_name || "Trending Topic")}&inspiration=${encodeURIComponent(post.content)}`}>
                      Draft Post from this Example
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!data?.posts.length ? <p className="text-sm text-slate-500">No tracked posts yet. Add a page to start collecting examples.</p> : null}
          {data?.posts && data.posts.length > visibleCount ? (
            <div ref={loaderRef} className="py-4 text-center text-slate-500 flex justify-center">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Comparison</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="p-2">Page</th>
                <th className="p-2">Posts</th>
                <th className="p-2">Avg Likes</th>
                <th className="p-2">Avg Comments</th>
                <th className="p-2">Avg Shares</th>
                <th className="p-2">Active Day</th>
                <th className="p-2">Topics</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.comparison.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-2 font-medium">{row.nickname}</td>
                  <td className="p-2">{row.posts}</td>
                  <td className="p-2">{row.average_likes}</td>
                  <td className="p-2">{row.average_comments}</td>
                  <td className="p-2">{row.average_shares}</td>
                  <td className="p-2">{row.most_active_day}</td>
                  <td className="p-2">{row.most_used_topics}</td>
                  <td className="p-2">
                    <Button variant="outline" size="sm" onClick={() => setAddingPostsFor(row)}>Add Posts</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  )
}
