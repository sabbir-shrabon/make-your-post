"use client"

import * as React from "react"

import {
  PageConnection, Post, AIPersona, PromptStudioConfig, PerformanceInsights,
  Analytics, DashboardIntelligence, StyleAnalysis, TrackerDashboard, ScheduledSlotItem, GlobalModelSettings
} from "@/types/models"
import { PageConnectionCard, PageTitle, PageMini, PageStatusBadge, formatDate, todayLabel, isPastScheduledSlot, slotStatusClass, MiniBars, emptySchedule, scheduleDayLabel, activeDaysToAbbrev, abbrevDaysToFull, scheduleFromLegacyPersona, LearnedInsightsPanel, ConnectEmpty, FacebookConnectButton, Stat, PostRow, Empty, SkeletonPage, badgeClass } from "@/components/dashboard/shared/dashboard-ui"


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


export function SettingsView({ pages, timezone, onChanged }: { pages: PageConnection[]; timezone: string; onChanged: () => void }) {
  const { user } = useAuth()
  const [email, setEmail] = React.useState(user?.email || "")
  const [tz, setTz] = React.useState(timezone)
  const [manualPageId, setManualPageId] = React.useState("")
  const [manualToken, setManualToken] = React.useState("")
  const [syncingPageId, setSyncingPageId] = React.useState<number | null>(null)

  async function saveAccount() {
    await api.patch("/users/me", { email, timezone: tz })
    toast.success("Settings saved.")
  }
  async function manualConnect() {
    await api.post("/facebook/manual-connect", { page_id: manualPageId, page_access_token: manualToken })
    setManualPageId("")
    setManualToken("")
    toast.success("Facebook Page connected.")
    onChanged()
  }
  async function disconnect(id: number) {
    if (!window.confirm("Are you sure? Your post history will be saved.")) return
    try {
      const response = await api.delete<{ success: boolean; message: string; paused_posts: number }>(
        `/api/pages/${id}/disconnect`
      )
      toast.success(response.data.message)
      onChanged()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.response?.data?.detail || "Could not disconnect page.")
    }
  }
  async function syncHistory(id: number) {
    setSyncingPageId(id)
    const toastId = toast.loading("Syncing your post history from Facebook...")
    try {
      const response = await api.post<{ success: boolean; synced_posts_count: number }>(`/facebook/pages/recover-history/${id}`)
      toast.success(`Synced ${response.data.synced_posts_count} historical posts to your dashboard.`, { id: toastId })
      onChanged()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.response?.data?.detail || "Could not sync history. Backend error.", { id: toastId })
    } finally {
      setSyncingPageId(null)
    }
  }

  return <><PageTitle title="Settings" subtitle="Account, AI models, page connections, and timezone." /><AIModelsSettingsCard /><Card><CardHeader><CardTitle>Account</CardTitle></CardHeader><CardContent className="grid gap-3"><Label>Email</Label><Input value={email} onChange={(event) => setEmail(event.target.value)} /><Button className="w-fit bg-blue-700 hover:bg-blue-800" onClick={saveAccount}>Save Account</Button></CardContent></Card><Card><CardHeader><CardTitle>Connected Pages</CardTitle></CardHeader><CardContent className="grid gap-3">{pages.map((page) => (
    <PageConnectionCard
      key={page.id}
      page={page}
      isSyncing={syncingPageId === page.id}
      onSyncHistory={() => syncHistory(page.id)}
      onDisconnect={() => disconnect(page.id)}
      onChanged={onChanged}
    />
  ))}<div className="grid gap-2 rounded-md border p-3"><p className="font-medium">Manual connection</p><Input placeholder="Facebook Page ID" value={manualPageId} onChange={(event) => setManualPageId(event.target.value)} /><Textarea placeholder="Long-lived Page Access Token" value={manualToken} onChange={(event) => setManualToken(event.target.value)} /><Button className="w-fit bg-blue-700 hover:bg-blue-800" onClick={manualConnect}>Validate Page</Button></div></CardContent></Card><Card><CardHeader><CardTitle>Timezone</CardTitle></CardHeader><CardContent className="grid gap-3"><Input value={tz} onChange={(event) => setTz(event.target.value)} /><p className="text-sm text-slate-500">Default was detected from your browser. All stored schedule times are converted to UTC.</p></CardContent></Card></>
}



const postModelOptions: Record<GlobalModelSettings["post_generation_provider"], string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  gemini: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
  anthropic: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
  mistral: ["mistral-large-latest", "mistral-small-latest"],
}

const imageModelOptions: Record<GlobalModelSettings["image_generation_provider"], string[]> = {
  gemini: ["imagen-3.0-generate-001", "imagen-2.0"],
  openai: ["dall-e-3", "dall-e-2"],
  stability: ["stable-diffusion-3", "stable-diffusion-xl"],
}

function providerLabel(provider: string) {
  if (provider === "openai") return "OpenAI"
  if (provider === "gemini") return "Gemini"
  if (provider === "anthropic") return "Anthropic"
  if (provider === "mistral") return "Mistral"
  if (provider === "stability") return "Stability AI"
  return provider
}

function AIModelsSettingsCard() {
  const [value, setValue] = React.useState<GlobalModelSettings>({
    post_generation_provider: "openai",
    post_generation_model: "gpt-4o",
    image_generation_provider: "gemini",
    image_generation_model: "imagen-3.0-generate-001",
  })
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    api.get<GlobalModelSettings>("/api/settings/models")
      .then((res) => setValue(res.data))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  function changePostProvider(next: GlobalModelSettings["post_generation_provider"]) {
    const firstModel = postModelOptions[next][0]
    setValue((prev) => ({
      ...prev,
      post_generation_provider: next,
      post_generation_model: firstModel,
    }))
  }

  function changeImageProvider(next: GlobalModelSettings["image_generation_provider"]) {
    const firstModel = imageModelOptions[next][0]
    setValue((prev) => ({
      ...prev,
      image_generation_provider: next,
      image_generation_model: firstModel,
    }))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await api.put<GlobalModelSettings>("/api/settings/models", value)
      setValue(res.data)
      toast.success("Model settings saved")
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not save model settings.")
    } finally {
      setSaving(false)
    }
  }

  const postModels = postModelOptions[value.post_generation_provider]
  const imageModels = imageModelOptions[value.image_generation_provider]

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Models</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium">API key usage</p>
          <ul className="mt-2 grid gap-1 text-slate-600">
            <li><span className="font-medium">OpenAI</span>: Used for Post Generation, Image Generation (when selected)</li>
            <li><span className="font-medium">Gemini</span>: Used for Post Generation, Image Generation, Image Analysis</li>
            <li><span className="font-medium">Anthropic</span>: Used for Post Generation</li>
            <li><span className="font-medium">Stability AI</span>: Used for Image Generation</li>
            <li><span className="font-medium">Mistral</span>: Used for Post Generation (image generation not supported here)</li>
          </ul>
        </div>
        {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}
        <div className="grid gap-3 rounded-md border p-4">
          <p className="font-medium">Post Generation Model</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Provider</Label>
              <Select value={value.post_generation_provider} onChange={(e) => changePostProvider(e.target.value as any)}>
                {Object.keys(postModelOptions).map((p) => (
                  <option key={p} value={p}>{providerLabel(p)}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Model</Label>
              <Select value={value.post_generation_model} onChange={(e) => setValue((prev) => ({ ...prev, post_generation_model: e.target.value }))}>
                {postModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-md border p-4">
          <p className="font-medium">Image Generation Model</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Provider</Label>
              <Select value={value.image_generation_provider} onChange={(e) => changeImageProvider(e.target.value as any)}>
                {Object.keys(imageModelOptions).map((p) => (
                  <option key={p} value={p}>{p === "openai" ? "OpenAI / DALL-E" : providerLabel(p)}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Model</Label>
              <Select value={value.image_generation_model} onChange={(e) => setValue((prev) => ({ ...prev, image_generation_model: e.target.value }))}>
                {imageModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button className="bg-blue-700 hover:bg-blue-800" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

