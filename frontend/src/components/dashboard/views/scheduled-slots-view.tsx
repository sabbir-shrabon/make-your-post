"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarClock,
  RefreshCw,
  Loader2,
  Sparkles,
  AlertCircle,
  Calendar as CalendarIcon,
  List as ListIcon,
  Plus,
  Send,
  Trash2,
  Edit3,
  Check,
  ChevronRight,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  Clock,
  Globe,
  Sliders,
  X,
  Eye,
} from "lucide-react"
import { toast } from "sonner"

import { ScheduledSlotItem, PageConnection, AIPersona } from "@/types/models"
import {
  PageTitle,
  formatDate,
  slotStatusClass,
  Empty,
} from "@/components/dashboard/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { api, getApiErrorMessage } from "@/lib/api"
import { axiosInstance } from "@/lib/axios"
import { cn } from "@/lib/utils"

export function ScheduledSlotsView({
  timezone,
  pages = [],
}: {
  timezone: string
  pages?: PageConnection[]
}) {
  const router = useRouter()
  const [slots, setSlots] = useState<ScheduledSlotItem[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar")

  // Batch Campaign Planner Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [selectedPageId, setSelectedPageId] = useState<number | null>(
    pages.find((p) => p.connection_status === "connected")?.id ?? pages[0]?.id ?? null
  )
  const [daysCount, setDaysCount] = useState<number>(7)
  const [customFocus, setCustomFocus] = useState<string>("")
  const [includePosters, setIncludePosters] = useState<boolean>(true)
  const [generatingBatch, setGeneratingBatch] = useState(false)
  const [schedulingBatch, setSchedulingBatch] = useState(false)
  const [batchResult, setBatchResult] = useState<any>(null)
  const [selectedDayPreview, setSelectedDayPreview] = useState<any>(null)

  const selectedPage = pages.find((page) => page.id === selectedPageId) || pages[0]

  const loadSlots = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get<{ slots: ScheduledSlotItem[] }>("/api/scheduled-slots")
      setSlots(response.data.slots || [])
    } catch {
      setSlots([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSlots()
    const interval = setInterval(loadSlots, 30000)
    return () => clearInterval(interval)
  }, [loadSlots])

  // --- 1-Click Generate Batch Campaign ---
  async function handleGenerateBatchCampaign() {
    setGeneratingBatch(true)
    try {
      const res = await axiosInstance.post("/api/campaign/generate-batch", {
        page_connection_id: selectedPage?.id || undefined,
        days_count: daysCount,
        custom_focus: customFocus.trim() || undefined,
        include_posters: includePosters,
        allow_pexels_bg: true,
      })
      setBatchResult(res.data)
      setSelectedDayPreview(res.data.days?.[0] || null)
      toast.success(`Generated ${res.data.days_count}-day campaign successfully!`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Batch campaign generation failed.")
    } finally {
      setGeneratingBatch(false)
    }
  }

  // --- 1-Click Approve & Schedule Batch ---
  async function handleApproveAndScheduleBatch() {
    if (!batchResult || !batchResult.days?.length) return
    if (!selectedPage) return toast.error("Connect a Facebook page first.")

    setSchedulingBatch(true)
    try {
      const res = await axiosInstance.post("/api/campaign/schedule-batch", {
        page_connection_id: selectedPage.id,
        posts: batchResult.days.map((d: any) => ({
          scheduled_at: d.scheduled_at,
          post_content: d.post_content,
          poster: d.poster,
          theme: d.theme,
          persona_name: batchResult.campaign_name,
        })),
      })
      toast.success(`Successfully scheduled ${res.data.scheduled_count} posts to your calendar!`)
      setIsBatchModalOpen(false)
      setBatchResult(null)
      loadSlots()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to schedule batch campaign.")
    } finally {
      setSchedulingBatch(false)
    }
  }

  // Publish immediate single slot trigger
  async function handlePublishImmediate(slot: ScheduledSlotItem) {
    if (!window.confirm("Publish this scheduled post to Facebook immediately?")) return
    try {
      await api.post(`/posts/${slot.id}/publish-now`)
      toast.success("Post triggered for immediate publishing.")
      loadSlots()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Could not publish post.")
    }
  }

  // Delete / cancel scheduled slot
  async function handleDeleteSlot(slot: ScheduledSlotItem) {
    if (!window.confirm("Delete this scheduled post?")) return
    try {
      await api.delete(`/posts/${slot.id}`)
      toast.success("Scheduled post cancelled.")
      loadSlots()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Could not cancel scheduled post.")
    }
  }

  return (
    <div className="grid gap-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageTitle
          title="Content Calendar & Schedule"
          subtitle="Plan, visualize, and batch-schedule your Facebook campaigns across days."
        />
        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all",
                viewMode === "calendar" ? "bg-white text-slate-900 shadow-xs font-semibold" : ""
              )}
            >
              <CalendarIcon className="size-3.5" />
              Calendar Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all",
                viewMode === "list" ? "bg-white text-slate-900 shadow-xs font-semibold" : ""
              )}
            >
              <ListIcon className="size-3.5" />
              List
            </button>
          </div>

          <Button
            onClick={() => setIsBatchModalOpen(true)}
            className="bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs h-8 shadow-xs"
          >
            <Sparkles className="size-3.5 mr-1.5" />
            7-Day Batch Planner
          </Button>

          <Button variant="outline" size="sm" onClick={loadSlots} disabled={loading} className="h-8">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* --- Visual Calendar Grid View --- */}
      {viewMode === "calendar" ? (
        loading && !slots.length ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-purple-600" />
          </div>
        ) : !slots.length ? (
          <Card className="border-dashed p-10 text-center">
            <CalendarIcon className="size-12 text-slate-400 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-slate-800">Your Content Calendar is Empty</h4>
            <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
              Plan out an entire week of posts and branded graphic posters in 1 click using the Batch Planner.
            </p>
            <Button
              onClick={() => setIsBatchModalOpen(true)}
              className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold"
            >
              <Sparkles className="size-3.5 mr-1.5" />
              Plan Next 7 Days in 1-Click
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {slots.map((slot) => (
              <Card
                key={`${slot.type}-${slot.id}`}
                className="overflow-hidden shadow-xs hover:border-purple-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Slot Card Header */}
                  <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      <Clock className="size-3 text-slate-500" />
                      <span>{slot.scheduled_at_local || formatDate(slot.scheduled_at, timezone)}</span>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] uppercase font-bold", slotStatusClass(slot.status))}>
                      {slot.status}
                    </Badge>
                  </div>

                  {/* Slot Content Body */}
                  <div className="p-3.5 grid gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{slot.persona_name || "Auto Post"}</span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        {slot.type === "manual_post" ? "Manual" : "Auto"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {slot.content_preview || "Post copy scheduled..."}
                    </p>

                    {slot.error_message && (
                      <p className="text-[11px] text-red-600 bg-red-50 p-1.5 rounded border border-red-200">
                        {slot.error_message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Slot Card Actions Footer */}
                <div className="p-2.5 border-t border-slate-100 bg-white flex items-center justify-between text-xs">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-slate-600 hover:text-blue-600"
                    onClick={() => handlePublishImmediate(slot)}
                  >
                    <Send className="size-3 mr-1" />
                    Publish Now
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-slate-400 hover:text-red-600"
                    onClick={() => handleDeleteSlot(slot)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        /* --- Structured List View --- */
        <Card className="shadow-xs">
          <CardContent className="grid gap-3 p-5">
            {loading && !slots.length ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-slate-400" />
              </div>
            ) : !slots.length ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500">No upcoming scheduled slots.</p>
                <Button
                  onClick={() => setIsBatchModalOpen(true)}
                  className="mt-3 bg-purple-700 hover:bg-purple-800 text-white text-xs"
                >
                  <Sparkles className="size-3.5 mr-1.5" />
                  Plan 7-Day Campaign
                </Button>
              </div>
            ) : (
              slots.map((slot) => (
                <div
                  key={`${slot.type}-${slot.id}`}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0 grid gap-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-slate-900">{slot.persona_name}</p>
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                        {slot.type === "manual_post" ? "Manual" : "Auto"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="size-3" />
                      {slot.scheduled_at_local || formatDate(slot.scheduled_at, timezone)}
                    </p>
                    {slot.content_preview && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{slot.content_preview}</p>
                    )}
                    {slot.error_message && (
                      <p className="text-xs text-red-500 mt-1">{slot.error_message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", slotStatusClass(slot.status))}>
                      {slot.status}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0 text-slate-400 hover:text-red-600"
                      onClick={() => handleDeleteSlot(slot)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* --- Batch Campaign Planner Modal --- */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs p-4 flex items-center justify-center animate-in fade-in duration-200">
          <Card className="w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col bg-white">
            {/* Modal Header */}
            <CardHeader className="pb-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-xs">
                    <Sparkles className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Multi-Day Campaign Batch Planner
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Generate an entire week of synchronized copy, hashtags, and branded poster graphics in 1 click.
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0 text-slate-400 hover:text-slate-900"
                  onClick={() => {
                    setIsBatchModalOpen(false)
                    setBatchResult(null)
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 grid gap-6">
              {!batchResult ? (
                /* Step 1: Configuration Form */
                <div className="max-w-xl mx-auto w-full grid gap-5 py-4">
                  <div className="grid gap-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Campaign Duration
                    </Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { count: 3, label: "3 Days", desc: "Mini Sprint" },
                        { count: 5, label: "5 Days", desc: "Workweek" },
                        { count: 7, label: "7 Days", desc: "Full Week" },
                        { count: 14, label: "14 Days", desc: "Bi-Weekly" },
                      ].map((item) => (
                        <button
                          key={item.count}
                          type="button"
                          onClick={() => setDaysCount(item.count)}
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all",
                            daysCount === item.count
                              ? "bg-purple-50 border-purple-600 ring-2 ring-purple-600/20 shadow-xs text-purple-900 font-bold"
                              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                          )}
                        >
                          <span className="text-sm font-bold">{item.label}</span>
                          <span className="text-[10px] text-slate-500">{item.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Target Focus or Theme Override (Optional)
                    </Label>
                    <Input
                      value={customFocus}
                      onChange={(e) => setCustomFocus(e.target.value)}
                      placeholder="e.g. Startup Growth, Time Management Hacks, Product Launch, or Real Estate Tips"
                      className="text-sm"
                    />
                    <p className="text-[11px] text-slate-500">
                      Leave blank to automatically use your AI Persona niche and brand personality.
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Generate Branded Graphic Posters</p>
                      <p className="text-[11px] text-slate-500">
                        Automatically designs and composites high-res posters for every day.
                      </p>
                    </div>
                    <Switch checked={includePosters} onCheckedChange={setIncludePosters} />
                  </div>

                  <Button
                    onClick={handleGenerateBatchCampaign}
                    disabled={generatingBatch}
                    className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold h-11 shadow-xs"
                  >
                    {generatingBatch ? (
                      <>
                        <Loader2 className="size-4 animate-spin mr-2" />
                        Generating {daysCount}-Day Campaign & Posters...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4 mr-2" />
                        Generate {daysCount}-Day Content Campaign
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                /* Step 2: Interactive Batch Review Grid */
                <div className="grid gap-5">
                  <div className="flex items-center justify-between bg-purple-50 p-3.5 rounded-lg border border-purple-200">
                    <div>
                      <h4 className="text-sm font-bold text-purple-900">{batchResult.campaign_name}</h4>
                      <p className="text-xs text-purple-700">
                        Review your generated {batchResult.days_count}-day campaign below before scheduling.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBatchResult(null)}
                      className="text-xs text-purple-800 border-purple-300"
                    >
                      <Edit3 className="size-3 mr-1" />
                      Configure Different Campaign
                    </Button>
                  </div>

                  {/* Multi-Day Cards */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {batchResult.days.map((day: any, idx: number) => (
                      <Card
                        key={idx}
                        className={cn(
                          "shadow-xs border transition-all overflow-hidden flex flex-col justify-between",
                          selectedDayPreview?.day_index === day.day_index ? "border-purple-600 ring-2 ring-purple-600/20" : ""
                        )}
                      >
                        <div>
                          {/* Day Header */}
                          <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">{day.day_label}</span>
                            <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-[10px] font-bold border-none">
                              {day.graphic_concept?.badge_text || "INSIGHT"}
                            </Badge>
                          </div>

                          {/* Day Poster Thumbnail */}
                          {day.poster?.base64_image && (
                            <div className="relative bg-slate-900 max-h-48 overflow-hidden">
                              <img
                                src={day.poster.base64_image}
                                alt={`Day ${day.day_index} poster`}
                                className="w-full h-40 object-cover object-center"
                              />
                              <div className="absolute bottom-1.5 right-1.5 bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] text-white font-semibold">
                                Score: {(day.poster.score || 0.8).toFixed(2)}
                              </div>
                            </div>
                          )}

                          {/* Day Caption */}
                          <div className="p-3 grid gap-2 text-xs">
                            <Textarea
                              value={day.post_content}
                              onChange={(e) => {
                                const updatedDays = [...batchResult.days]
                                updatedDays[idx].post_content = e.target.value
                                setBatchResult({ ...batchResult, days: updatedDays })
                              }}
                              className="min-h-24 text-xs resize-y"
                            />
                            <div className="flex flex-wrap gap-1">
                              {(day.hashtags || []).map((tag: string, tIdx: number) => (
                                <span key={tIdx} className="text-[10px] font-medium text-blue-600">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {batchResult && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Ready to schedule {batchResult.days?.length} posts to your Facebook content calendar?
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setBatchResult(null)}>
                    Back
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
                    onClick={handleApproveAndScheduleBatch}
                    disabled={schedulingBatch}
                  >
                    {schedulingBatch ? (
                      <>
                        <Loader2 className="size-4 animate-spin mr-2" />
                        Scheduling Campaign...
                      </>
                    ) : (
                      <>
                        <Check className="size-4 mr-2" />
                        Approve & Schedule All ({batchResult.days?.length} Posts)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
