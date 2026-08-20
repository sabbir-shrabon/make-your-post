import * as React from "react"
import Link from "next/link"
import { Plug, Loader2, Sparkles, FileText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { API_BASE_URL, BACKEND_ORIGIN, api } from "@/lib/api"
import { PageConnection, DashboardIntelligence, Post, AIPersona } from "@/types/models"

export function slotStatusClass(status: string) {
  if (status === "pending" || status === "scheduled") return "bg-amber-100 text-amber-700"
  if (status === "generating" || status === "publishing") return "bg-blue-100 text-blue-700"
  if (status === "published") return "bg-green-100 text-green-700"
  return "bg-red-100 text-red-700"
}

export function MiniBars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((item) => item.value), 1)
  return (
    <div className="grid gap-2">
      {items.slice(0, 12).map((item) => (
        <div key={item.label} className="grid grid-cols-[64px_1fr_56px] items-center gap-2 text-xs">
          <span>{item.label}</span>
          <div className="h-3 rounded bg-slate-100">
            <div className="h-3 rounded bg-blue-700" style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} />
          </div>
          <span className="text-right text-slate-500">{item.value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}

export const toneOptions = ["Friendly", "Professional", "Bold", "Witty", "Empathetic", "Authoritative", "Casual", "Luxury", "Rebellious", "Minimalist", "Energetic", "Calm"]
export const languages = ["English", "Bengali", "Hindi", "Arabic", "Spanish", "French", "Indonesian", "Portuguese", "Auto-detect from examples"]
export const dayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
export const scheduleDayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const
export const dayAbbrevToFull: Record<string, string> = {
  Mon: "monday", Tue: "tuesday", Wed: "wednesday", Thu: "thursday",
  Fri: "friday", Sat: "saturday", Sun: "sunday",
}
export const dayFullToAbbrev: Record<string, string> = Object.fromEntries(
  Object.entries(dayAbbrevToFull).map(([abbrev, full]) => [full, abbrev])
)

export type PersonaScheduleData = {
  timezone: string
  active_days: string[]
  default_times: string[]
  day_overrides: Record<string, string[]>
}

export function emptySchedule(timezone: string): PersonaScheduleData {
  return { timezone, active_days: [], default_times: ["09:00"], day_overrides: {} }
}

function dayName(abbrev: string) {
  const names: Record<string, string> = {
    Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
    Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
  }
  return names[abbrev] || abbrev
}

export function scheduleDayLabel(day: string) {
  const abbrev = dayFullToAbbrev[day.toLowerCase()] || day.slice(0, 3)
  return dayName(abbrev)
}

export function activeDaysToAbbrev(days: string[]): string[] {
  return days.map((day) => dayFullToAbbrev[day.toLowerCase()] || day).filter(Boolean)
}

export function abbrevDaysToFull(days: string[]): string[] {
  return days.map((day) => dayAbbrevToFull[day] || day.toLowerCase()).filter(Boolean)
}

export function scheduleFromLegacyPersona(persona: AIPersona, timezone: string): PersonaScheduleData {
  return {
    timezone,
    active_days: abbrevDaysToFull(persona.assigned_days || []),
    default_times: persona.posting_time_slots?.length ? persona.posting_time_slots : ["09:00"],
    day_overrides: {},
  }
}

export const personaColors = ["bg-blue-50 text-blue-800 border-blue-200", "bg-emerald-50 text-emerald-800 border-emerald-200", "bg-amber-50 text-amber-800 border-amber-200", "bg-rose-50 text-rose-800 border-rose-200", "bg-violet-50 text-violet-800 border-violet-200"]
export const templateNames = ["Custom (blank)", "E-commerce Product Page", "Personal Brand / Creator", "Local Restaurant", "Real Estate Agent", "Fitness Coach", "Educational Content", "News and Commentary", "Motivational Page", "Tech and Startup"]
export const goalOptions = ["Educate my audience", "Sell a product or service", "Build a community", "Entertain", "Inspire and motivate", "Drive traffic to my website"]

export function PageTitle({ title, subtitle, aiPowered }: { title: string; subtitle: string; aiPowered?: boolean }) {
  return (
    <div>
      <h1 className="text-xl font-bold leading-6 flex items-center gap-2 text-slate-900">
        {title} {aiPowered ? <Sparkles className="size-5 text-purple-600" /> : null}
      </h1>
      <p className="text-xs font-normal leading-4 text-slate-500 mt-1">{subtitle}</p>
    </div>
  )
}

export function PageMini({ page }: { page: PageConnection }) {
  const picture = page.profile_picture_url || page.page_picture_url
  return (
    <div className="flex items-center gap-3">
      <img alt="" className="size-9 rounded-full bg-slate-100" src={picture || `${API_BASE_URL}/favicon.ico`} />
      <div>
        <p className="text-sm font-medium">{page.page_name}</p>
        <p className="text-xs text-slate-500">Manage Connection</p>
      </div>
    </div>
  )
}

export function PageStatusBadge({ status }: { status: string }) {
  if (status === "connected") {
    return <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">Connected</span>
  }
  if (status === "needs-reconnection") {
    return <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Token Expired</span>
  }
  if (status === "disconnected") {
    return <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">Disconnected</span>
  }
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{status}</span>
}

export function formatDate(value: string | null, timezone: string) {
  if (!value) return "Not scheduled"
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value))
}

export function formatRelativeTime(dateString: string | null, timezone?: string): string {
  if (!dateString) return "Just now"
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return "Just now"
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`
    if (diffInSeconds < 172800) {
      const timeStr = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "numeric",
        timeZone: timezone || "UTC",
      }).format(date)
      return `Yesterday at ${timeStr}`
    }
    if (diffInSeconds < 604800) {
      return `${Math.floor(diffInSeconds / 86400)}d`
    }
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      timeZone: timezone || "UTC",
    }).format(date)
  } catch {
    return dateString
  }
}

export function todayLabel(timezone: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone || "UTC",
  }).format(new Date())
}

export function isPastScheduledSlot(post: Post) {
  return Boolean(post.scheduled_at && new Date(post.scheduled_at).getTime() < Date.now())
}

export function LearnedInsightsPanel({ insights, wide }: { insights: DashboardIntelligence["learned_insights"]; wide?: boolean }) {
  const items = [
    { label: "Best post, last 7 days", value: insights.best_post ? `Score ${insights.best_post.score.toFixed(1)}` : "Not enough data", detail: insights.best_post?.insight },
    { label: "Best time slot", value: insights.best_time_slot ? `${insights.best_time_slot.slot}` : "Not enough data", detail: insights.best_time_slot?.insight },
    { label: "Best persona", value: insights.best_persona ? insights.best_persona.name : "Not enough data", detail: insights.best_persona?.insight },
  ]
  return (
    <Card className={wide ? "" : ""}>
      <CardHeader><CardTitle>What The System Has Learned</CardTitle></CardHeader>
      <CardContent className={cn("grid gap-3", wide && "md:grid-cols-3")}>
        {items.map((item) => (
          <div key={item.label} className="rounded-md border p-3">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-1 font-semibold">{item.value}</p>
            <p className="mt-2 text-sm text-slate-600">{item.detail || "Publish more posts and collect engagement snapshots to unlock this insight."}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function ConnectEmpty({ onConnected }: { onConnected: () => void }) {
  return (
    <Card>
      <CardContent className="grid gap-4 p-6 text-center">
        <Plug className="mx-auto size-10 text-blue-700" />
        <div>
          <h2 className="text-lg font-semibold">You have no connected pages yet.</h2>
          <p className="text-sm text-slate-500">Connect your first Facebook Page.</p>
        </div>
        <FacebookConnectButton className="mx-auto" onConnected={onConnected} />
      </CardContent>
    </Card>
  )
}

export function FacebookConnectButton({
  onConnected,
  onRequiresSelection,
  className,
  urgent,
  label = "Connect Facebook",
}: {
  onConnected: () => void
  onRequiresSelection?: (pages: any[]) => void
  className?: string
  urgent?: boolean
  label?: string
}) {
  const [busy, setBusy] = React.useState(false)
  const connectionSucceededRef = React.useRef(false)
  const popupCheckerRef = React.useRef<number | null>(null)

  function connect() {
    setBusy(true)
    connectionSucceededRef.current = false

    try {
      const token = window.localStorage.getItem("auth_token")
      if (!token) throw new Error("Missing auth token")
      
      const sessionId = crypto.randomUUID()
      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      const popup = window.open(
        `${API_BASE_URL}/auth/facebook/start?token=${encodeURIComponent(token)}&session_id=${sessionId}`,
        "facebook_oauth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      )
      
      if (!popup) throw new Error("Popup blocked")

      popupCheckerRef.current = window.setInterval(async () => {
        try {
          const res = await api.get<{ status: string; pages?: any[]; pageId?: string; pageName?: string; message?: string }>(
            `/auth/facebook/status?session_id=${sessionId}`
          )
          const data = res.data
          if (data.status === "success") {
            connectionSucceededRef.current = true
            if (popupCheckerRef.current !== null) {
              window.clearInterval(popupCheckerRef.current)
              popupCheckerRef.current = null
            }
            if (!popup.closed) popup.close()
            setBusy(false)
            onConnected()
            toast.success("Facebook Page connected successfully")
            return
          } else if (data.status === "requires_selection") {
            connectionSucceededRef.current = true
            if (popupCheckerRef.current !== null) {
              window.clearInterval(popupCheckerRef.current)
              popupCheckerRef.current = null
            }
            if (!popup.closed) popup.close()
            setBusy(false)
            if (onRequiresSelection && data.pages) {
              onRequiresSelection(data.pages)
            } else {
              onConnected()
            }
            toast.info("Multiple pages discovered. Choose which to connect.")
            return
          } else if (data.status === "error") {
            connectionSucceededRef.current = true
            if (popupCheckerRef.current !== null) {
              window.clearInterval(popupCheckerRef.current)
              popupCheckerRef.current = null
            }
            if (!popup.closed) popup.close()
            setBusy(false)
            toast.error(data.message || "Connection failed.")
            return
          }
        } catch (err) {
          // ignore network errors during polling
        }

        if (popup.closed) {
          if (popupCheckerRef.current !== null) {
            window.clearInterval(popupCheckerRef.current)
            popupCheckerRef.current = null
          }
          setBusy(false)
          if (!connectionSucceededRef.current) {
            toast.info("Connection window closed")
          }
        }
      }, 1000)
    } catch (err: any) {
      setBusy(false)
      toast.error(err.message || "Could not launch Facebook connection")
    }
  }

  return (
    <Button
      className={cn(
        urgent ? "bg-amber-600 text-white hover:bg-amber-700" : "bg-[#1877F2] text-white hover:bg-[#0f66d0]",
        className
      )}
      onClick={connect}
      disabled={busy}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <span className="grid size-4 place-items-center rounded-full bg-white text-xs font-bold text-[#1877F2]">f</span>}
      {busy ? "Connecting..." : urgent ? "Reconnect Now" : "Connect Facebook Page"}
    </Button>
  )
}
export function Stat({ label, value, tone = "blue" }: { label: string; value: number | string; tone?: "blue" | "green" | "amber" | "red" }) {
  const colors = { blue: "text-blue-700", green: "text-green-700", amber: "text-amber-700", red: "text-red-700" }
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-normal leading-4 text-slate-500">{label}</p>
        <p className={cn("mt-2 text-xl font-bold leading-6", colors[tone])}>{value}</p>
      </CardContent>
    </Card>
  )
}

export function badgeClass(status: string) {
  if (status === "published" || status === "success") return "bg-green-50 text-green-700"
  if (status.includes("failed")) return "bg-red-50 text-red-700"
  if (status === "scheduled") return "bg-amber-50 text-amber-700"
  return "bg-blue-50 text-blue-700"
}

export function PostRow({ post, timezone }: { post: Post; timezone: string }) {
  const imageUrl = post.image_url || post.media_urls?.[0]
  return (
    <div className="grid gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <span className={cn("rounded-full px-2 py-1 text-xs font-medium", badgeClass(post.status))}>{post.status}</span>
          {post.ai_generated ? <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700"><Sparkles className="size-3" /> AI Generated</span> : null}
          {post.image_status && post.image_status !== "completed" ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{post.image_status}</span> : null}
          {post.facebook_post_id ? (
            <a
              href={`https://www.facebook.com/${post.facebook_post_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:underline"
            >
              View on Facebook
            </a>
          ) : null}
        </div>
        <span className="text-xs text-slate-500">{formatDate(post.posted_at || post.scheduled_at || null, timezone)}</span>
      </div>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{post.content}</p>
      {imageUrl ? (
        <img src={imageUrl} alt="Attached media" className="mt-2 max-h-64 rounded-md object-contain border" />
      ) : null}
      {post.error_message ? <p className="text-sm text-red-600">{post.error_message}</p> : null}
      <div className="flex gap-4 text-xs text-slate-500">
        <span>Likes: {post.likes_count || 0}</span>
        <span>Comments: {post.comments_count || 0}</span>
        <span>Shares: {post.shares_count || 0}</span>
      </div>
    </div>
  )
}

export function Empty({ text, action }: { text: string; action: string }) {
  return <div className="grid gap-3 rounded-md border border-dashed bg-white p-8 text-center"><FileText className="mx-auto size-10 text-blue-700" /><p className="text-sm text-slate-500">{text}</p><Button asChild className="mx-auto bg-blue-700 hover:bg-blue-800"><Link href={action}>Create Post</Link></Button></div>
}

export function SkeletonPage() {
  return <div className="grid gap-4">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-md bg-slate-200" />)}</div>
}

export function PageConnectionCard({
  page,
  onChanged,
  onSyncHistory,
  onDisconnect,
  onReconnect,
  onDelete,
  isSyncing,
  showDashboardActions,
}: {
  page: PageConnection
  onChanged: () => void
  onSyncHistory?: () => void
  onDisconnect?: () => void
  onReconnect?: () => void
  onDelete?: () => void
  isSyncing?: boolean
  showDashboardActions?: boolean
}) {
  const status = page.connection_status
  const postCount = page.post_count ?? 0
  const pausedCount = page.paused_post_count ?? 0

  return (
    <Card className="border-slate-200">
      <CardContent className="grid gap-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <PageMini page={page} />
            <PageStatusBadge status={status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "connected" && showDashboardActions ? (
              <>
                <Button asChild variant="outline" size="sm"><Link href="/dashboard/create">Create Post</Link></Button>
                <Button asChild variant="outline" size="sm"><Link href="/dashboard/published">View Posts</Link></Button>
                {onDisconnect ? <Button variant="destructive" size="sm" onClick={onDisconnect}>Disconnect</Button> : null}
              </>
            ) : null}
            {status === "connected" && !showDashboardActions ? (
              <>
                {onSyncHistory ? (
                  <Button variant="outline" size="sm" disabled={isSyncing} onClick={onSyncHistory}>
                    {isSyncing ? "Syncing..." : "Sync History"}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSyncing}
                  onClick={async () => {
                    await api.post(`/facebook/pages/${page.id}/refresh-token`)
                    toast.success("Token refreshed.")
                    onChanged()
                  }}
                >
                  Refresh Token
                </Button>
                {onDisconnect ? (
                  <Button variant="outline" size="sm" className="text-amber-700 hover:text-amber-800 hover:bg-amber-50" disabled={isSyncing} onClick={onDisconnect}>
                    Disconnect
                  </Button>
                ) : null}
                {onDelete ? (
                  <Button variant="destructive" size="sm" disabled={isSyncing} onClick={onDelete}>
                    Remove
                  </Button>
                ) : null}
              </>
            ) : null}
            {status !== "connected" ? (
              <>
                {onReconnect ? (
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={onReconnect}>
                    Reconnect Page
                  </Button>
                ) : null}
                {onDelete ? (
                  <Button variant="outline" size="sm" className="text-rose-600 hover:bg-rose-50 text-xs" onClick={onDelete}>
                    Remove
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {status === "connected" ? (
          <p className="text-sm text-slate-600">
            {postCount} posts in history
            {(page.scheduled_post_count ?? 0) > 0 ? ` • ${page.scheduled_post_count} scheduled` : ""}
          </p>
        ) : null}

        {status === "disconnected" ? (
          <div className="grid gap-1 text-sm text-slate-600">
            <p>{postCount} posts saved • Your post history is preserved</p>
            {pausedCount > 0 ? (
              <p className="text-amber-700 font-medium">
                {pausedCount} scheduled posts are paused. Reconnect to resume posting.
              </p>
            ) : null}
          </div>
        ) : null}

        {status === "needs-reconnection" ? (
          <p className="text-sm text-amber-700 font-medium">Please reconnect to resume automated publishing.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
