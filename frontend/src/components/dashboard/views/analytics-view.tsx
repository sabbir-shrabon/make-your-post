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


export function AnalyticsView({ analytics, setAnalytics }: { analytics: Analytics | null; setAnalytics: (value: Analytics) => void }) {
  async function changeRange(value: string) {
    const response = await api.get<Analytics>("/analytics", { params: { days: Number(value) } })
    setAnalytics(response.data)
  }
  const max = Math.max(...(analytics?.posts_per_day.map((day) => day.count) || [0]), 1) + 2
  return <><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><PageTitle title="Analytics" subtitle="Current performance across published posts." /><Select className="w-44" defaultValue="30" onChange={(event) => changeRange(event.target.value)}><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 3 Months</option></Select></div>{analytics ? <><section className="grid gap-4 md:grid-cols-4"><Stat label="Total posts published" value={analytics.total_posts} /><Stat label="Total likes received" value={analytics.total_likes} /><Stat label="Total comments received" value={analytics.total_comments} /><Stat label="Total shares received" value={analytics.total_shares} /></section><Card><CardContent className="flex h-64 items-end gap-1 p-6">{analytics.posts_per_day.map((day) => <div key={day.date} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t bg-blue-700" style={{ height: `${Math.max(4, (day.count / max) * 210)}px` }} /><span className="hidden text-[10px] text-slate-500 md:block">{day.date.slice(5)}</span></div>)}</CardContent></Card></> : <Empty text="No analytics yet." action="/dashboard/create" />}</>
}

