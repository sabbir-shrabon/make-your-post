"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  FileImage,
  Send,
  Calendar,
  RefreshCw,
  Award,
  Wand2,
  Plus,
  Palette,
  Trash2,
  Bold,
  Sun,
  Zap,
  BookmarkPlus,
  LayoutTemplate,
  Info,
  Globe,
  MoreHorizontal,
  ThumbsUp,
  MessageSquare,
  Share2,
  Settings2,
  X,
  Code,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { axiosInstance } from "@/lib/axios"
import { api, getApiErrorMessage } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useApp } from "@/contexts/app-context"
import { PageSelector } from "@/components/dashboard/shared/page-selector"
import { formatDate } from "@/components/dashboard/shared/dashboard-ui"
import { toast } from "sonner"
import dynamic from "next/dynamic"
import { SaveCanvasAsTemplateDialog } from "./SaveCanvasAsTemplateDialog"
import { AIPersona } from "@/types/models"

const InteractiveCanvas = dynamic(
  () => import("./InteractiveCanvas").then((mod) => mod.InteractiveCanvas),
  { ssr: false }
)

const PRESET_TOPICS = [
  { label: "🚀 Product Launch", topic: "Announcing our groundbreaking AI Poster Creator tool today!" },
  { label: "🔥 Weekend Flash Sale", topic: "Exclusive 50% Off Flash Sale this weekend only across all products." },
  { label: "💡 Industry Insight", topic: "3 Key design trends transforming social media marketing in 2026." },
  { label: "🏆 Milestone Celebration", topic: "Proud to celebrate 100,000 active creators on our platform!" },
  { label: "⚡ Tip of the Day", topic: "Pro Tip: Consistency in brand typography boosts recognition by 80%." },
]

const ACCENT_COLORS = [
  "#EF4444", "#F59E0B", "#10B981", "#0D9488", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899", "#FFFFFF", "#0F172A"
]
const COLOR_SWATCHES = ACCENT_COLORS

export function AgenticPosterLab({
  pages = [],
}: {
  pages?: any[]
}) {
  const router = useRouter()
  const { user } = useAuth()
  const { activePageId, setActivePageId } = useApp()
  const timezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

  const [selectedPageId, setSelectedPageId] = useState<number | null>(
    activePageId ?? pages.find((p) => p.connection_status === "connected")?.id ?? pages[0]?.id ?? null
  )
  const selectedPage = pages.find((p) => p.id === selectedPageId) || pages[0]

  // Personas
  const [personas, setPersonas] = useState<any[]>([])
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(null)

  // Core Form State
  const [topic, setTopic] = useState("")
  const [postCaption, setPostCaption] = useState("")
  const [loading, setLoading] = useState(false)
  const [trace, setTrace] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

  // Generation Flags
  const [useNewsGrounding, setUseNewsGrounding] = useState(false)
  const [allowPexelsBg, setAllowPexelsBg] = useState(false)
  const [allowCatBg, setAllowCatBg] = useState(false)

  // Interactive Layer & Variant Selection
  const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null)
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0)

  // Templates
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("auto")
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false)
  const [blueprintTemplate, setBlueprintTemplate] = useState<any | null>(null)

  // Publishing & Scheduling
  const [saving, setSaving] = useState(false)
  const [scheduleLater, setScheduleLater] = useState(false)
  const [scheduleDate, setScheduleDate] = useState("")

  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await axiosInstance.get("/api/poster/templates")
        if (res.data?.templates) {
          setTemplates(res.data.templates)
        }
      } catch (e) {
        console.error("Failed to load poster templates:", e)
      }
    }
    loadTemplates()

    const prefillTpl = sessionStorage.getItem("poster_lab_selected_template")
    if (prefillTpl) {
      setSelectedTemplateId(prefillTpl)
      sessionStorage.removeItem("poster_lab_selected_template")
      toast.success(`Selected template: ${prefillTpl}`)
    }
  }, [])

  // Load personas for selected page
  useEffect(() => {
    if (!selectedPage?.id) {
      setPersonas([])
      return
    }
    api.get(`/api/ai/personas/${selectedPage.id}`)
      .then((res) => setPersonas(res.data || []))
      .catch(() => setPersonas([]))
  }, [selectedPage?.id])

  async function copyPathToClipboard(path: string) {
    if (!path) return
    try {
      await navigator.clipboard.writeText(path)
      setCopied(true)
      toast.success("Output path copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy path automatically.")
    }
  }

  async function handleGenerate(e?: React.FormEvent, customTopic?: string) {
    if (e) e.preventDefault()
    const targetTopic = (customTopic || topic).trim()
    if (!targetTopic) return

    setLoading(true)
    setTrace(null)
    setCopied(false)
    setSelectedElementIndex(null)
    setSelectedVariantIndex(0)

    try {
      const res = await axiosInstance.post("/api/poster/assemble-trace", {
        topic: targetTopic,
        aspect_ratio: "1:1",
        use_news_grounding: useNewsGrounding,
        allow_pexels_bg: allowPexelsBg,
        allow_cat_bg: allowCatBg,
        template_id: selectedTemplateId !== "auto" ? selectedTemplateId : undefined,
      })
      setTrace(res.data)
      if (!postCaption.trim()) {
        setPostCaption(targetTopic)
      }
      toast.success("Canva-grade poster variants assembled!")

      if (res.data?.output_path) {
        await copyPathToClipboard(res.data.output_path)
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail ??
        err.message ??
        "Failed to generate poster."
      )
    } finally {
      setLoading(false)
    }
  }

  function handleSelectVariant(variant: any, index: number) {
    setSelectedVariantIndex(index)
    if (!trace) return

    setTrace({
      ...trace,
      art_director: variant.art_director || trace.art_director,
      resolved_assets: variant.resolved_assets || trace.resolved_assets,
      final_opacity: variant.final_opacity ?? trace.final_opacity,
      base64_image: variant.base64_image || trace.base64_image,
      output_path: variant.output_path || trace.output_path,
      vision_critic: variant.vision_critic || trace.vision_critic,
    })
    setSelectedElementIndex(null)
    toast.success(`Loaded Variant #${index + 1}`)
  }

  function handleUpdateSelected(patch: any) {
    if (selectedElementIndex === null || !trace?.resolved_assets?.[selectedElementIndex]) return
    const newAssets = [...trace.resolved_assets]
    newAssets[selectedElementIndex] = { ...newAssets[selectedElementIndex], ...patch }
    setTrace({ ...trace, resolved_assets: newAssets })
  }

  function handleDeleteSelected() {
    if (selectedElementIndex === null || !trace?.resolved_assets) return
    const newAssets = trace.resolved_assets.filter((_: any, i: number) => i !== selectedElementIndex)
    setTrace({ ...trace, resolved_assets: newAssets })
    setSelectedElementIndex(null)
    toast.success("Layer removed from canvas")
  }

  function handleAddVectorAsset(
    shapeId: string,
    role: string,
    size: { w: number; h: number },
    pos: { x: number; y: number },
    content?: string
  ) {
    if (!trace) return
    const newAsset: any = {
      type: role === "cta" ? "text" : (role === "badge" ? "badge" : "shape"),
      role: role,
      shape_id: shapeId,
      content: content || (role === "cta" ? "SHOP NOW" : (role === "badge" ? "50% OFF" : undefined)),
      badge_text: role === "badge" ? (content || "50% OFF") : undefined,
      x: pos.x,
      y: pos.y,
      w: size.w,
      h: size.h,
      z_index: (trace.resolved_assets?.length || 0) + 1,
      color: "#0D9488",
    }
    const newAssets = [...(trace.resolved_assets || []), newAsset]
    setTrace({ ...trace, resolved_assets: newAssets })
    setSelectedElementIndex(newAssets.length - 1)
    toast.success(`Added ${shapeId} component to canvas!`)
  }

  // --- Save / Publish / Schedule Submission (Calls /posts/publish) ---
  async function submit(saveAsDraft = false) {
    if (!selectedPage) return toast.error("Connect a Facebook page before publishing.")
    if (!postCaption.trim() && !trace?.base64_image) {
      return toast.error("Generate a poster or enter a caption first.")
    }

    const isScheduling = !saveAsDraft && scheduleLater
    setSaving(true)
    try {
      const mediaUrls = trace?.base64_image
        ? [`data:image/png;base64,${trace.base64_image}`]
        : (trace?.output_path ? [trace.output_path] : [])

      const response = await api.post<{ success: boolean; error_message?: string }>("/posts/publish", {
        message: postCaption.trim() || topic.trim() || " ",
        page_connection_id: selectedPage.id,
        media_urls: mediaUrls,
        link_url: null,
        link_preview_data: null,
        scheduled_at: isScheduling && scheduleDate ? new Date(scheduleDate).toISOString() : null,
        save_as_draft: saveAsDraft,
      })

      if (!response.data.success && !saveAsDraft) {
        toast.error(
          response.data.error_message ||
          (isScheduling ? "Scheduling failed. Please try again." : "Publishing failed. Please try again.")
        )
        return
      }

      toast.success(
        saveAsDraft
          ? "Draft saved successfully."
          : isScheduling
            ? `Poster post scheduled for ${formatDate(new Date(scheduleDate).toISOString(), timezone)}.`
            : "Poster published to Facebook successfully!"
      )

      if (!saveAsDraft && !scheduleLater) {
        setPostCaption("")
        setTopic("")
        setTrace(null)
      }

      router.push(isScheduling ? "/dashboard/scheduled" : "/dashboard")
    } catch (error: any) {
      toast.error(
        getApiErrorMessage(
          error,
          isScheduling ? "Scheduling failed. Please try again." : "Publishing failed. Please try again."
        )
      )
    } finally {
      setSaving(false)
    }
  }

  const selectedElement =
    selectedElementIndex !== null && trace?.resolved_assets?.[selectedElementIndex]
      ? trace.resolved_assets[selectedElementIndex]
      : null

  return (
    <div className="grid gap-6">
      {/* Main Studio 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column (7 cols): Controls, Form & Sticky Publish Bar */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* 1. Topic / Creative Brief Card */}
          <Card className="shadow-xs border border-purple-200 bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50 rounded-t-xl">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Wand2 className="size-3.5 text-purple-600" />
                  Topic / Creative Brief
                </Label>
                <div className="flex items-center gap-2">
                  <PageSelector
                    pages={pages}
                    selectedPageId={selectedPageId}
                    onSelectPageId={(id) => {
                      setSelectedPageId(id)
                      setActivePageId(id)
                      setSelectedPersonaId(null)
                    }}
                    size="sm"
                  />
                  <div className="w-36 sm:w-44">
                    <Select
                      value={selectedPersonaId ? String(selectedPersonaId) : ""}
                      onChange={(e) => setSelectedPersonaId(e.target.value ? Number(e.target.value) : null)}
                      className="h-8 text-xs font-semibold bg-white border-slate-200"
                    >
                      <option value="">Auto (Default Voice)</option>
                      {personas.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.persona_name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 grid gap-4">
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Summer Mega Sale — 50% Off Tropical Collection..."
                className="w-full min-h-[120px] text-sm p-3 rounded-md border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 resize-none shadow-inner"
              />

              {/* Thematic Preset Chips */}
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TOPICS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTopic(preset.topic)
                      handleGenerate(undefined, preset.topic)
                    }}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  className="text-xs text-slate-600 font-semibold"
                >
                  <Settings2 className="size-3.5 mr-1.5" />
                  Advanced Settings
                </Button>

                <Button
                  onClick={() => handleGenerate()}
                  disabled={loading || !topic.trim()}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold h-9 shadow-xs px-5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Assembling Posters...
                    </>
                  ) : (
                    <>
                      <Wand2 className="size-4 mr-2" />
                      Generate Posters
                    </>
                  )}
                </Button>
              </div>

              {/* Advanced Settings Collapsible */}
              {isAdvancedOpen && (
                <div className="pt-4 mt-2 border-t border-slate-100 grid gap-4 animate-in fade-in duration-200 slide-in-from-top-4">
                  {/* Template Architecture Selector */}
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="template-select" className="text-xs font-bold uppercase text-slate-600 flex items-center gap-1.5">
                        <LayoutTemplate className="size-3.5 text-purple-600" />
                        Template / Layout Blueprint
                      </Label>
                      {selectedTemplateId !== "auto" && (
                        <button
                          type="button"
                          onClick={() => {
                            const t = templates.find((x) => x.id === selectedTemplateId)
                            if (t) setBlueprintTemplate(t)
                          }}
                          className="text-[11px] text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                        >
                          <Info className="size-3" /> View Blueprint
                        </button>
                      )}
                    </div>
                    <select
                      id="template-select"
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      disabled={loading}
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-xs focus:border-purple-600 focus:outline-hidden"
                    >
                      <option value="auto">✨ Auto (AI Art Director Choice)</option>
                      {templates.filter((t) => t.is_system).length > 0 && (
                        <optgroup label="── Built-In System Templates ──">
                          {templates
                            .filter((t) => t.is_system)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.category})
                              </option>
                            ))}
                        </optgroup>
                      )}
                      {templates.filter((t) => !t.is_system).length > 0 && (
                        <optgroup label="── My Custom Templates ──">
                          {templates
                            .filter((t) => !t.is_system)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                ⭐ {t.name}
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* Toggles */}
                  <div className="grid gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="use-news-grounding" className="text-xs font-medium cursor-pointer">Live Trend Grounding</Label>
                      <Switch id="use-news-grounding" checked={useNewsGrounding} onCheckedChange={setUseNewsGrounding} disabled={loading} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="allow-pexels-bg" className="text-xs font-medium cursor-pointer">Stock Photos Background</Label>
                      <Switch id="allow-pexels-bg" checked={allowPexelsBg} onCheckedChange={setAllowPexelsBg} disabled={loading} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="allow-cat-bg" className="text-xs font-medium cursor-pointer">AI Cat Vector Background</Label>
                      <Switch id="allow-cat-bg" checked={allowCatBg} onCheckedChange={setAllowCatBg} disabled={loading} />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Post Caption & Poster Canvas Tuning (When generated) */}
          {trace && (
            <Card className="shadow-xs border border-slate-200 bg-white animate-in fade-in duration-300">
              <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-bold text-slate-800">Post Copy &amp; Layer Tuning</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                      onClick={() => setIsSaveTemplateOpen(true)}
                    >
                      <BookmarkPlus className="size-3.5 mr-1" />
                      Save as Template
                    </Button>
                    {trace?.output_path && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-slate-200 text-slate-700 hover:bg-slate-50"
                        onClick={() => copyPathToClipboard(trace.output_path)}
                      >
                        {copied ? <Check className="size-3 mr-1 text-emerald-600" /> : <Copy className="size-3 mr-1" />}
                        Copy Path
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 grid gap-4">
                {/* Caption Input */}
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Facebook Post Copy</Label>
                  <Textarea
                    value={postCaption}
                    onChange={(e) => setPostCaption(e.target.value)}
                    rows={3}
                    placeholder="Write or edit post copy for this poster..."
                    className="text-xs resize-y"
                  />
                </div>

                {/* Design Variations Switcher */}
                {trace.variants && trace.variants.length > 1 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Design Variations ({trace.variants.length})</Label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {trace.variants.map((v: any, idx: number) => {
                        const isSelected = selectedVariantIndex === idx
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectVariant(v, idx)}
                            className={`rounded-lg overflow-hidden border-2 text-left p-1 transition-all bg-slate-50 ${isSelected ? "border-purple-600 ring-2 ring-purple-600/20 bg-purple-50/50" : "border-slate-200 hover:border-slate-300"
                              }`}
                          >
                            <div className="aspect-square w-full rounded overflow-hidden bg-slate-200 mb-1">
                              {v.base64_image && (
                                <img
                                  src={`data:image/png;base64,${v.base64_image}`}
                                  alt={`Variant ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px] font-bold text-slate-800">
                                #{idx + 1} {v.is_winner && "⭐"}
                              </span>
                              <Badge variant={isSelected ? "default" : "outline"} className={`text-[9px] px-1 py-0 ${isSelected ? "bg-purple-700" : ""}`}>
                                {Math.round((v.composite_score || 0.9) * 100)}%
                              </Badge>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Quick Vector Asset Inserter */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase">Add Vector Components:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1 px-2 border-amber-200 bg-amber-50/50 text-amber-900 hover:bg-amber-100"
                      onClick={() => handleAddVectorAsset("sunburst-rays", "background", { w: 1080, h: 1080 }, { x: 0, y: 0 })}
                    >
                      <Sun className="size-3 text-amber-600" /> + Sunburst
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1 px-2 border-emerald-200 bg-emerald-50/50 text-emerald-900 hover:bg-emerald-100"
                      onClick={() => handleAddVectorAsset("tropical-palm-fronds", "corner_accent", { w: 220, h: 220 }, { x: 840, y: 0 })}
                    >
                      🌴 + Leaves
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1 px-2 border-red-200 bg-red-50/50 text-red-900 hover:bg-red-100"
                      onClick={() => handleAddVectorAsset("starburst-badge", "badge", { w: 160, h: 160 }, { x: 860, y: 40 }, "50% OFF")}
                    >
                      <Zap className="size-3 text-red-600" /> + Starburst
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1 px-2 border-teal-200 bg-teal-50/50 text-teal-900 hover:bg-teal-100"
                      onClick={() => handleAddVectorAsset("pill-button", "cta", { w: 320, h: 64 }, { x: 380, y: 920 }, "SHOP NOW")}
                    >
                      <Plus className="size-3 text-teal-600" /> + Pill CTA
                    </Button>
                  </div>
                </div>

                {/* Context Layer Styling Toolbar (When a layer is clicked on canvas) */}
                {selectedElement && (
                  <div className="p-3 bg-white rounded-lg border border-purple-200 shadow-xs flex flex-col gap-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                        <Palette className="size-3.5 text-purple-600" />
                        Selected Layer #{selectedElementIndex! + 1}: <span className="font-mono text-purple-700 capitalize">{selectedElement.role || selectedElement.type}</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-red-600 hover:bg-red-50 text-[11px] gap-1"
                          onClick={handleDeleteSelected}
                        >
                          <Trash2 className="size-3" /> Remove
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-slate-500 hover:bg-slate-100 text-[11px]"
                          onClick={() => setSelectedElementIndex(null)}
                        >
                          Done
                        </Button>
                      </div>
                    </div>

                    {/* Color Swatches */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <span className="text-[11px] text-slate-500 font-medium shrink-0">Color:</span>
                      {COLOR_SWATCHES.map((hex, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleUpdateSelected({ color: hex })}
                          style={{ backgroundColor: hex }}
                          className={`size-5 rounded-full border border-slate-300 shrink-0 transition-transform ${selectedElement.color === hex ? "ring-2 ring-purple-600 ring-offset-1 scale-110" : "hover:scale-105"
                            }`}
                          title={hex}
                        />
                      ))}
                    </div>

                    {/* Text Size Nudge & Font Weight */}
                    {selectedElement.type === "text" && (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-500 font-medium">Font Size:</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleUpdateSelected({ font_size: Math.max(12, (selectedElement.font_size || 24) - 4) })}
                          >
                            A-
                          </Button>
                          <span className="text-xs font-mono font-semibold w-8 text-center">{Math.round(selectedElement.font_size || 24)}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleUpdateSelected({ font_size: Math.min(160, (selectedElement.font_size || 24) + 4) })}
                          >
                            A+
                          </Button>
                        </div>

                        <Button
                          variant={selectedElement.font_weight === "bold" ? "default" : "outline"}
                          size="sm"
                          className={`h-6 px-2 text-xs gap-1 ${selectedElement.font_weight === "bold" ? "bg-purple-700" : ""}`}
                          onClick={() => handleUpdateSelected({ font_weight: selectedElement.font_weight === "bold" ? "normal" : "bold" })}
                        >
                          <Bold className="size-3" /> Bold
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 3. Always Visible 1-Line Sticky Action Bar: Save as Draft, Schedule, Publish Now */}
          <div className="sticky bottom-4 z-40 mt-2 bg-white/95 backdrop-blur-md border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.12)] px-4 py-2.5 rounded-xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => submit(true)}
                disabled={saving || (!postCaption.trim() && !trace?.base64_image)}
                className="text-slate-700 bg-white shadow-xs text-xs h-8"
              >
                Save as Draft
              </Button>

              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <Switch checked={scheduleLater} onCheckedChange={setScheduleLater} id="poster-schedule-switch" />
                <Label htmlFor="poster-schedule-switch" className="text-xs font-semibold cursor-pointer text-slate-700 whitespace-nowrap">
                  Schedule
                </Label>
                {scheduleLater && (
                  <div className="flex items-center gap-1 animate-in fade-in duration-200">
                    <Input
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="h-8 text-xs w-[175px] shadow-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!scheduleLater) setScheduleLater(true)
                  else submit(false)
                }}
                disabled={saving || (!postCaption.trim() && !trace?.base64_image)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold shadow-xs text-xs h-8"
              >
                {saving && scheduleLater ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar className="size-3.5 mr-1.5" />
                    {scheduleLater ? "Confirm Schedule" : "Schedule"}
                  </>
                )}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setScheduleLater(false)
                  submit(false)
                }}
                disabled={saving || (!postCaption.trim() && !trace?.base64_image)}
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold shadow-xs text-xs h-8"
              >
                {saving && !scheduleLater ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send className="size-3.5 mr-1.5" />
                    Publish Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Pure Live Facebook Feed Mockup */}
        <div className="lg:col-span-5 sticky top-6 grid gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Globe className="size-3.5 text-blue-600" />
              Live Facebook Feed Mockup
            </span>
            <Badge variant="outline" className="text-[10px] text-slate-500 font-normal">
              Desktop & Mobile Preview
            </Badge>
          </div>

          {/* Genuine Facebook Post Card */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all">
            {/* Facebook Post Header */}
            <div className="flex items-center justify-between p-3.5 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden ring-1 ring-slate-100 shrink-0">
                  {selectedPage?.page_picture_url ? (
                    <img
                      src={selectedPage.page_picture_url}
                      alt={selectedPage.page_name}
                      className="size-full object-cover"
                    />
                  ) : (
                    (selectedPage?.page_name || "P")[0].toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">
                      {selectedPage?.page_name || "Your Facebook Page"}
                    </h4>
                    <span className="size-3 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px]">
                      ✓
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <span>Just now</span>
                    <span>·</span>
                    <Globe className="size-3" />
                  </p>
                </div>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-600 p-1">
                <MoreHorizontal className="size-4" />
              </button>
            </div>

            {/* Facebook Post Caption */}
            <div className="px-3.5 py-2 text-xs leading-relaxed text-slate-900 whitespace-pre-wrap">
              {postCaption ? (
                <span>
                  {postCaption.split(" ").map((word, i) => {
                    if (word.startsWith("#")) {
                      return (
                        <span key={i} className="text-[#1877F2] font-medium hover:underline cursor-pointer">
                          {word}{" "}
                        </span>
                      )
                    }
                    if (word.startsWith("http://") || word.startsWith("https://")) {
                      return (
                        <span key={i} className="text-[#1877F2] hover:underline cursor-pointer break-all">
                          {word}{" "}
                        </span>
                      )
                    }
                    return word + " "
                  })}
                </span>
              ) : (
                <span className="text-slate-400 italic">Your poster copy will appear live here...</span>
              )}
            </div>

            {/* Facebook Graphic / Media Container */}
            {trace?.base64_image ? (
              <div className="relative border-y border-slate-100 bg-slate-950 overflow-hidden">
                {trace.resolved_assets?.length > 0 ? (
                  <div className="relative w-full aspect-square bg-white flex items-center justify-center">
                    <InteractiveCanvas
                      trace={trace}
                      onUpdateElement={(index, newProps) => {
                        const newTrace = { ...trace }
                        newTrace.resolved_assets[index] = newProps
                        setTrace(newTrace)
                      }}
                      onSelectElement={setSelectedElementIndex}
                      selectedElementIndex={selectedElementIndex}
                    />
                  </div>
                ) : (
                  <img
                    src={`data:image/png;base64,${trace.base64_image}`}
                    alt="Generated Poster Graphic"
                    className="w-full max-h-[460px] object-contain mx-auto bg-slate-900"
                  />
                )}
              </div>
            ) : (
              <div className="border-y border-dashed border-slate-200 bg-slate-50/50 p-12 text-center flex flex-col items-center justify-center">
                <div className="size-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mb-2">
                  <FileImage className="size-6" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Generated poster graphic will appear live here</p>
              </div>
            )}

            {/* Facebook Engagement Counters */}
            <div className="flex items-center justify-between px-3.5 py-2 text-[11px] text-slate-500 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="flex size-4 items-center justify-center rounded-full bg-blue-500 text-white text-[9px]">
                  👍
                </span>
                <span>0</span>
              </div>
              <div className="flex items-center gap-3">
                <span>0 comments</span>
                <span>0 shares</span>
              </div>
            </div>

            {/* Facebook Action Buttons */}
            <div className="grid grid-cols-3 p-1 text-slate-600 text-xs font-semibold">
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
              >
                <ThumbsUp className="size-4" />
                Like
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
              >
                <MessageSquare className="size-4" />
                Comment
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
              >
                <Share2 className="size-4" />
                Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Canvas As Template Dialog */}
      <SaveCanvasAsTemplateDialog
        isOpen={isSaveTemplateOpen}
        onClose={() => setIsSaveTemplateOpen(false)}
        canvasState={trace}
        onSaved={async () => {
          try {
            const res = await axiosInstance.get("/api/poster/templates")
            if (res.data?.templates) setTemplates(res.data.templates)
          } catch (e) { }
        }}
      />

      {/* Blueprint Inspection Modal */}
      {blueprintTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-white overflow-hidden flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <LayoutTemplate className="size-4 text-purple-400" />
                  {blueprintTemplate.name || blueprintTemplate.id}
                </h3>
                <p className="text-xs text-slate-400">
                  {blueprintTemplate.category || "Layout Architecture"} · {blueprintTemplate.description || "Slot Bounds"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBlueprintTemplate(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Wireframe Box */}
            <div className="relative aspect-square w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden p-2">
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(#818CF8 1px, transparent 1px)`,
                  backgroundSize: "14px 14px",
                }}
              />
              {Object.entries(blueprintTemplate.slots || {}).map(([slotKey, slot]: any) => (
                <div
                  key={slotKey}
                  className="absolute flex flex-col items-center justify-center p-1 rounded border-2 border-dashed border-sky-400/80 bg-sky-500/15 text-sky-200"
                  style={{
                    left: `${slot.x_pct}%`,
                    top: `${slot.y_pct}%`,
                    width: `${slot.w_pct}%`,
                    height: `${slot.h_pct}%`,
                  }}
                >
                  <span className="font-mono text-[9px] font-bold truncate leading-none">{slotKey}</span>
                  <span className="font-mono text-[7px] text-white/50">{slot.w_pct}%×{slot.h_pct}%</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-400 font-mono">
                {Object.keys(blueprintTemplate.slots || {}).length} defined slots
              </span>
              <Button
                size="sm"
                className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold"
                onClick={() => {
                  setSelectedTemplateId(blueprintTemplate.id)
                  setBlueprintTemplate(null)
                  toast.success(`Template ${blueprintTemplate.name || blueprintTemplate.id} selected!`)
                }}
              >
                Select this Template
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
