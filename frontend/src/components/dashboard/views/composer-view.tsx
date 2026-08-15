"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import {
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Send,
  Calendar,
  Clock,
  ThumbsUp,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Globe,
  X,
  Plus,
  Edit3,
  RefreshCw,
  Layers,
  Wand2,
  Check,
  Lightbulb,
  Sliders,
  Maximize2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { toast } from "sonner"

import { PageConnection, AIPersona } from "@/types/models"
import { PageTitle, PageMini, formatDate } from "@/components/dashboard/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { api, getApiErrorMessage } from "@/lib/api"
import { axiosInstance } from "@/lib/axios"

// Dynamically import InteractiveCanvas for direct manipulation
const InteractiveCanvas = dynamic(
  () => import("@/components/social-platform/InteractiveCanvas").then((mod) => mod.InteractiveCanvas),
  { ssr: false }
)

export function Composer({
  pages,
  timezone,
  onSaved,
}: {
  pages: PageConnection[]
  timezone: string
  onSaved: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const publishablePages = pages.filter((page) => page.connection_status === "connected")
  const [selectedPageId, setSelectedPageId] = useState<number | null>(publishablePages[0]?.id ?? null)
  const selectedPage = publishablePages.find((page) => page.id === selectedPageId) || publishablePages[0]

  // --- Campaign / Generation State ---
  const [campaignPrompt, setCampaignPrompt] = useState("")
  const [candidateCount, setCandidateCount] = useState<number>(3)
  const [allowPexelsBg, setAllowPexelsBg] = useState<boolean>(true)
  const [generatingCampaign, setGeneratingCampaign] = useState(false)
  const [sourceBadge, setSourceBadge] = useState<string | null>(null)

  // --- Post Content State ---
  const [content, setContent] = useState("")
  const [hashtags, setHashtags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState("")
  const [campaignTheme, setCampaignTheme] = useState<string | null>(null)
  const [graphicConcept, setGraphicConcept] = useState<any>(null)

  // --- Visual Media / Poster State ---
  const [mediaType, setMediaType] = useState<"ai_poster" | "custom_url" | "template" | "none">("ai_poster")
  const [media, setMedia] = useState("")
  const [posterVariants, setPosterVariants] = useState<any[]>([])
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0)
  const [activeTrace, setActiveTrace] = useState<any>(null)
  const [isCanvasModalOpen, setIsCanvasModalOpen] = useState(false)

  // --- Legacy Template State ---
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [visualTopic, setVisualTopic] = useState("")
  const [generatingLayered, setGeneratingLayered] = useState(false)

  // --- Publishing State ---
  const [scheduleLater, setScheduleLater] = useState(false)
  const [scheduledAt, setScheduledAt] = useState("")
  const [saving, setSaving] = useState(false)
  const [aiSettingsReady, setAiSettingsReady] = useState(false)

  // --- Quick AI Helpers ---
  const [generatingHelper, setGeneratingHelper] = useState<string | null>(null)

  const remaining = 63206 - content.length
  const detectedUrl = content.match(/https?:\/\/\S+/)?.[0] || ""

  // Load handoff parameters & templates on mount
  useEffect(() => {
    const topicParam = searchParams?.get("topic")
    const inspParam = searchParams?.get("inspiration")
    if (topicParam) {
      setCampaignPrompt(topicParam)
      setVisualTopic(topicParam)
      setSourceBadge(`Imported Topic: "${topicParam}"`)
    }
    if (inspParam) {
      setContent(inspParam)
      setSourceBadge("Imported Inspiration Draft")
    }

    try {
      const storedImage = sessionStorage.getItem("composer_prefill_image")
      const storedTopic = sessionStorage.getItem("composer_prefill_topic")
      const storedContent = sessionStorage.getItem("composer_prefill_content")

      if (storedImage) {
        setMedia(storedImage)
        setMediaType("ai_poster")
        sessionStorage.removeItem("composer_prefill_image")
        setSourceBadge("Poster Graphic Imported from Poster Lab")
        toast.success("Graphic from Poster Lab loaded into Composer!")
      }
      if (storedTopic) {
        setCampaignPrompt(storedTopic)
        setVisualTopic(storedTopic)
        sessionStorage.removeItem("composer_prefill_topic")
      }
      if (storedContent) {
        setContent(storedContent)
        sessionStorage.removeItem("composer_prefill_content")
      }
    } catch {
      // ignore
    }
  }, [searchParams])

  useEffect(() => {
    api.get<any[]>("/api/image-templates")
      .then((res) => setTemplates(res.data))
      .catch((err) => console.error("Error loading templates:", err))
  }, [])

  useEffect(() => {
    if (!selectedPage?.id) return setAiSettingsReady(false)
    api.get<AIPersona[]>(`/api/ai/personas/${selectedPage.id}`)
      .then((response) => setAiSettingsReady(response.data.some((p) => Boolean(p.niche))))
      .catch(() => setAiSettingsReady(false))
  }, [selectedPage?.id])

  // --- 1-Click Unified Campaign Generation ---
  async function handleGenerateUnifiedCampaign(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!campaignPrompt.trim()) {
      return toast.error("Please enter a campaign topic, niche, or prompt.")
    }

    setGeneratingCampaign(true)
    try {
      const res = await axiosInstance.post("/api/campaign/generate-unified", {
        topic_or_niche: campaignPrompt.trim(),
        page_connection_id: selectedPage?.id || undefined,
        candidate_count: candidateCount,
        allow_pexels_bg: allowPexelsBg,
        aspect_ratio: "1:1",
      })

      const data = res.data
      setCampaignTheme(data.campaign_theme || campaignPrompt)
      setContent(data.post_content || "")
      setHashtags(data.hashtags || [])
      setGraphicConcept(data.graphic_concept || null)

      const variants = data.poster_variants || []
      setPosterVariants(variants)
      setSelectedVariantIndex(0)

      const winner = data.poster_winner || variants[0]
      if (winner) {
        setMedia(winner.base64_image || "")
        setMediaType("ai_poster")
        setActiveTrace({
          art_director: winner.art_director,
          resolved_assets: winner.resolved_assets,
          final_opacity: winner.final_opacity,
          base64_image: winner.base64_image,
        })
      }

      toast.success("Unified Campaign & Poster generated successfully!")
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Campaign generation failed. Please try again.")
    } finally {
      setGeneratingCampaign(false)
    }
  }

  // --- Switch Graphic Variant ---
  function handleSelectVariant(index: number) {
    setSelectedVariantIndex(index)
    const variant = posterVariants[index]
    if (variant) {
      setMedia(variant.base64_image || "")
      setActiveTrace({
        art_director: variant.art_director,
        resolved_assets: variant.resolved_assets,
        final_opacity: variant.final_opacity,
        base64_image: variant.base64_image,
      })
      toast.success(`Switched to Graphic Variant #${index + 1}`)
    }
  }

  // --- Manual Hashtag Management ---
  function toggleHashtagInContent(tag: string) {
    const cleanTag = tag.startsWith("#") ? tag : `#${tag}`
    if (content.includes(cleanTag)) {
      setContent((prev) => prev.replace(cleanTag, "").replace(/\s\s+/g, " ").trim())
    } else {
      setContent((prev) => (prev.trim() ? `${prev.trim()} ${cleanTag}` : cleanTag))
    }
  }

  function addCustomHashtag() {
    if (!newTagInput.trim()) return
    const tag = newTagInput.startsWith("#") ? newTagInput.trim() : `#${newTagInput.trim()}`
    if (!hashtags.includes(tag)) {
      setHashtags((prev) => [...prev, tag])
      toggleHashtagInContent(tag)
    }
    setNewTagInput("")
  }

  // --- Quick AI Helper Tools ---
  async function runAiHelper(action: "hook" | "hashtags" | "cta") {
    if (!content.trim()) return toast.error("Write some post content first.")
    setGeneratingHelper(action)
    try {
      let prompt = ""
      if (action === "hook") {
        prompt = `Generate a punchy, high-converting opening hook for this Facebook post:\n\n${content}`
      } else if (action === "hashtags") {
        prompt = `Generate 5 viral, relevant hashtags for this Facebook post:\n\n${content}`
      } else if (action === "cta") {
        prompt = `Add a high-engagement question or Call To Action (CTA) for the end of this Facebook post:\n\n${content}`
      }

      const res = await api.post<{ content: string }>("/api/ai/generate", {
        page_connection_id: selectedPage?.id || null,
        topic_hint: prompt,
      })

      const aiText = res.data.content
      if (action === "hook") {
        setContent(`${aiText.trim()}\n\n${content}`)
        toast.success("Opening hook added!")
      } else if (action === "cta") {
        setContent(`${content.trim()}\n\n${aiText.trim()}`)
        toast.success("Engagement CTA added!")
      } else if (action === "hashtags") {
        const extractedTags = aiText.match(/#[a-zA-Z0-9_]+/g) || []
        if (extractedTags.length) {
          setHashtags((prev) => Array.from(new Set([...prev, ...extractedTags])))
          setContent(`${content.trim()}\n\n${extractedTags.join(" ")}`)
          toast.success("Hashtags generated & attached!")
        } else {
          setContent(`${content.trim()}\n\n${aiText.trim()}`)
        }
      }
    } catch (err: any) {
      toast.error("AI enhancement failed. Please try again.")
    } finally {
      setGeneratingHelper(null)
    }
  }

  // --- Layered Graphic Generation (Legacy Templates) ---
  async function generateLayeredGraphic() {
    if (!selectedTemplateId) return toast.error("Please select a template first.")
    const topic = visualTopic || campaignPrompt || "Product"
    setGeneratingLayered(true)
    try {
      const response = await api.post("/api/images/generate-layered", {
        template_id: selectedTemplateId,
        topic: topic,
        post_text: content,
      })
      setMedia(response.data.image_url)
      setMediaType("template")
      toast.success("Layered graphic generated successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Layered graphic generation failed.")
    } finally {
      setGeneratingLayered(false)
    }
  }

  // --- Save / Publish Submission ---
  async function submit(saveAsDraft = false) {
    if (!content.trim()) return toast.error("Write post content first.")
    if (!selectedPage) return toast.error("Connect a page before publishing.")
    if (remaining < 0) return toast.error("Post exceeds maximum allowed length.")

    setSaving(true)
    try {
      const mediaUrls = mediaType !== "none" && media ? [media] : []
      const response = await api.post<{ success: boolean; error_message?: string }>("/posts/publish", {
        message: content,
        page_connection_id: selectedPage.id,
        media_urls: mediaUrls,
        link_url: detectedUrl || null,
        link_preview_data: detectedUrl
          ? { title: detectedUrl, description: "Link preview detected from post." }
          : null,
        scheduled_at: scheduleLater && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        save_as_draft: saveAsDraft,
      })

      if (!response.data.success && !saveAsDraft) {
        toast.error(
          response.data.error_message ||
            (scheduleLater ? "Scheduling failed. Please try again." : "Publishing failed. Please try again.")
        )
        onSaved()
        return
      }

      toast.success(
        saveAsDraft
          ? "Draft saved successfully."
          : scheduleLater
          ? `Scheduled for ${formatDate(new Date(scheduledAt).toISOString(), timezone)}.`
          : "Post published to Facebook successfully!"
      )
      if (!saveAsDraft && !scheduleLater) {
        setContent("")
        setMedia("")
        setPosterVariants([])
      }
      onSaved()
      router.push(scheduleLater ? "/dashboard/scheduled" : "/dashboard")
    } catch (error: any) {
      toast.error(
        getApiErrorMessage(
          error,
          scheduleLater ? "Scheduling failed. Please try again." : "Publishing failed. Please try again."
        )
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <PageTitle
          title="Creator Studio"
          subtitle="Generate high-converting Facebook campaigns with synchronized post copy and on-brand graphic posters."
        />
        {publishablePages.length > 1 ? (
          <div className="w-full sm:w-64">
            <Select
              value={String(selectedPageId ?? publishablePages[0].id)}
              onChange={(e) => setSelectedPageId(Number(e.target.value))}
            >
              {publishablePages.map((page) => (
                <option key={page.id} value={String(page.id)}>
                  {page.page_name}
                </option>
              ))}
            </Select>
          </div>
        ) : publishablePages[0] ? (
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-xs">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-slate-700">{publishablePages[0].page_name}</span>
          </div>
        ) : null}
      </div>

      {sourceBadge && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-2.5 text-xs font-medium text-blue-900 shadow-xs">
          <span className="flex items-center gap-2">
            <Lightbulb className="size-4 text-blue-600 shrink-0" />
            {sourceBadge}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-blue-600 hover:bg-blue-100"
            onClick={() => setSourceBadge(null)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {/* --- Unified Agentic Campaign Generation Bar --- */}
      <Card className="border-indigo-100 bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-blue-50/80 shadow-xs">
        <CardContent className="p-5">
          <form onSubmit={handleGenerateUnifiedCampaign} className="grid gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-md bg-purple-600 text-white shadow-xs">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Agentic Campaign Autopilot</h3>
                  <p className="text-xs text-slate-500">
                    Enter a topic or niche to generate post copy, hashtags, and branded poster graphics in 1 click.
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-3 text-xs text-slate-600">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Switch checked={allowPexelsBg} onCheckedChange={setAllowPexelsBg} />
                  <span>Stock Photography</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Input
                  value={campaignPrompt}
                  onChange={(e) => setCampaignPrompt(e.target.value)}
                  placeholder="e.g. 5 Time Management Hacks for Startup Founders, or Tips for First-Time Homebuyers..."
                  className="bg-white pr-10 text-sm shadow-xs focus-visible:ring-purple-600"
                  disabled={generatingCampaign}
                />
                {campaignPrompt && (
                  <button
                    type="button"
                    onClick={() => setCampaignPrompt("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <Button
                type="submit"
                className="bg-purple-700 text-white hover:bg-purple-800 shadow-xs font-semibold shrink-0"
                disabled={generatingCampaign || !campaignPrompt.trim()}
              >
                {generatingCampaign ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Generating Campaign & Posters...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Generate Full Post & Poster
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* --- Main Studio Workspace (Side-by-Side) --- */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* LEFT COLUMN: Manual & Fine-Tuning Controls (7 Cols) */}
        <div className="grid gap-5 lg:col-span-7">
          {/* Post Copy Editor Card */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Post Copy & Content</CardTitle>
                  <CardDescription className="text-xs">
                    Write manually or fine-tune your generated AI copy.
                  </CardDescription>
                </div>
                <div
                  className={cn(
                    "text-xs font-medium",
                    remaining < 100 ? "text-red-600" : remaining < 500 ? "text-amber-600" : "text-slate-500"
                  )}
                >
                  {content.length} / 63,206 chars
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 grid gap-4">
              <Textarea
                className="min-h-48 resize-y text-sm leading-relaxed focus-visible:ring-purple-600"
                placeholder="Write your Facebook post here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

              {/* Hashtag Chips */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Hashtag Suggestions (Click to toggle in post)</span>
                  <span>{hashtags.length} tags available</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {hashtags.map((tag, idx) => {
                    const isIncluded = content.includes(tag)
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleHashtagInContent(tag)}
                        className={cn(
                          "rounded-md px-2 py-1 text-xs font-medium transition-colors border",
                          isIncluded
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        {tag} {isIncluded ? "✓" : "+"}
                      </button>
                    )
                  })}
                  <div className="flex items-center gap-1">
                    <Input
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomHashtag())}
                      placeholder="#addtag"
                      className="h-7 w-24 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={addCustomHashtag}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Quick AI Refine Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-500 mr-1">Quick AI:</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => runAiHelper("hook")}
                  disabled={Boolean(generatingHelper) || !content.trim()}
                >
                  {generatingHelper === "hook" ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : (
                    <Wand2 className="size-3 mr-1 text-purple-600" />
                  )}
                  Add Catchy Hook
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => runAiHelper("cta")}
                  disabled={Boolean(generatingHelper) || !content.trim()}
                >
                  {generatingHelper === "cta" ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : (
                    <MessageCircle className="size-3 mr-1 text-blue-600" />
                  )}
                  Add CTA
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => runAiHelper("hashtags")}
                  disabled={Boolean(generatingHelper) || !content.trim()}
                >
                  {generatingHelper === "hashtags" ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="size-3 mr-1 text-amber-600" />
                  )}
                  Generate Tags
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Media & Poster Selector Card */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Media & Graphic Design</CardTitle>
                  <CardDescription className="text-xs">
                    Choose an AI-designed poster, upload custom media, or select a template.
                  </CardDescription>
                </div>
                <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
                  <button
                    type="button"
                    onClick={() => setMediaType("ai_poster")}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition-all",
                      mediaType === "ai_poster" ? "bg-white text-purple-700 shadow-xs font-semibold" : ""
                    )}
                  >
                    AI Poster
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaType("custom_url")}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition-all",
                      mediaType === "custom_url" ? "bg-white text-purple-700 shadow-xs font-semibold" : ""
                    )}
                  >
                    Custom URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaType("template")}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition-all",
                      mediaType === "template" ? "bg-white text-purple-700 shadow-xs font-semibold" : ""
                    )}
                  >
                    Templates
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaType("none")
                      setMedia("")
                    }}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition-all",
                      mediaType === "none" ? "bg-white text-slate-900 shadow-xs font-semibold" : ""
                    )}
                  >
                    Text Only
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 grid gap-4">
              {/* Option 1: AI Graphic Poster */}
              {mediaType === "ai_poster" && (
                <div className="grid gap-3">
                  {posterVariants.length > 0 ? (
                    <div className="grid gap-3 rounded-lg border border-purple-100 bg-purple-50/40 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
                          Generated Design Variations ({posterVariants.length})
                        </span>
                        {graphicConcept && (
                          <span className="text-xs text-purple-700">
                            Headline: <strong className="font-semibold">"{graphicConcept.headline}"</strong>
                          </span>
                        )}
                      </div>

                      {/* Variant Selector Tabs */}
                      <div className="grid grid-cols-3 gap-2">
                        {posterVariants.map((v, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSelectVariant(i)}
                            className={cn(
                              "relative flex flex-col items-center rounded-lg border p-2 transition-all text-left",
                              selectedVariantIndex === i
                                ? "border-purple-600 bg-white ring-2 ring-purple-600/20 shadow-xs"
                                : "border-slate-200 bg-white/70 hover:bg-white"
                            )}
                          >
                            <span className="text-xs font-bold text-slate-800">
                              {i === 0 ? "★ Variant 1 (Best)" : `Variant ${i + 1}`}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Score: {(v.composite_score || v.aesthetic_score || 0.8).toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Quick Action to Open Workbench */}
                      <div className="flex items-center justify-between pt-2 border-t border-purple-200/60">
                        <span className="text-xs text-slate-600">Want to drag, resize, or replace icons?</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 border-purple-300 text-purple-800 hover:bg-purple-100 text-xs font-semibold"
                          onClick={() => setIsCanvasModalOpen(true)}
                        >
                          <Edit3 className="size-3.5 mr-1.5" />
                          Customize in Interactive Canvas
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 p-6 text-center">
                      <ImageIcon className="size-8 text-slate-400 mb-2" />
                      <p className="text-sm font-medium text-slate-700">No AI graphic generated yet</p>
                      <p className="text-xs text-slate-500 mb-3">
                        Use the Campaign Autopilot bar above, or generate a poster from your current text.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (content.trim()) setCampaignPrompt(content.slice(0, 80))
                          handleGenerateUnifiedCampaign()
                        }}
                        disabled={generatingCampaign}
                        className="text-xs text-purple-700 border-purple-300 hover:bg-purple-50"
                      >
                        <Sparkles className="size-3.5 mr-1.5" />
                        Generate Poster for Current Post
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Option 2: Custom URL / Upload */}
              {mediaType === "custom_url" && (
                <div className="grid gap-2">
                  <Label className="text-xs font-medium">Image or Video URL</Label>
                  <Input
                    value={media}
                    onChange={(e) => setMedia(e.target.value)}
                    placeholder="https://images.unsplash.com/... or Supabase URL"
                    className="text-sm"
                  />
                </div>
              )}

              {/* Option 3: Templates */}
              {mediaType === "template" && (
                <div className="grid gap-3">
                  <Label className="text-xs font-medium">Select Image Template</Label>
                  <Select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                    <option value="">Choose a Template...</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </Select>
                  {selectedTemplateId && (
                    <div className="grid gap-2">
                      <Input
                        value={visualTopic}
                        onChange={(e) => setVisualTopic(e.target.value)}
                        placeholder="Graphic Topic (e.g. Minimalist Workspace)"
                        className="text-sm"
                      />
                      <Button
                        type="button"
                        className="bg-purple-700 text-white hover:bg-purple-800 text-xs"
                        onClick={generateLayeredGraphic}
                        disabled={generatingLayered}
                      >
                        {generatingLayered ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Sparkles className="size-3.5 mr-1" />}
                        Generate & Composite Layered Graphic
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scheduling & Publish Action Bar Card */}
          <Card className="shadow-xs">
            <CardContent className="p-4 grid gap-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex items-center gap-2.5">
                  <Calendar className="size-5 text-slate-600" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Schedule Post for Later</p>
                    <p className="text-[11px] text-slate-500">Auto-publish in timezone: {timezone}</p>
                  </div>
                </div>
                <Switch checked={scheduleLater} onCheckedChange={setScheduleLater} />
              </div>

              {scheduleLater && (
                <div className="grid gap-1.5 animate-in fade-in duration-200">
                  <Label className="text-xs font-medium text-slate-600">Select Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="text-sm"
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => submit(true)}
                  disabled={saving || !content.trim()}
                  className="flex-1 text-slate-700"
                >
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  onClick={() => submit(false)}
                  disabled={saving || remaining < 0 || !content.trim() || !publishablePages.length}
                  className="flex-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Publishing...
                    </>
                  ) : scheduleLater ? (
                    <>
                      <Calendar className="size-4 mr-2" />
                      Schedule Post
                    </>
                  ) : (
                    <>
                      <Send className="size-4 mr-2" />
                      Publish to Facebook Now
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Live Facebook Feed Mockup (5 Cols) */}
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
              {content ? (
                <span>
                  {content.split(" ").map((word, i) => {
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
                <span className="text-slate-400 italic">Your post copy will appear live here...</span>
              )}
            </div>

            {/* Facebook Graphic / Media Container */}
            {mediaType !== "none" && media && (
              <div className="relative border-y border-slate-100 bg-slate-950 overflow-hidden group">
                <img
                  src={media}
                  alt="Post Graphic"
                  className="w-full max-h-[420px] object-contain mx-auto bg-slate-900"
                />

                {/* Direct Variant Switcher Bar on Top of Image */}
                {posterVariants.length > 1 && (
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-auto">
                    <div className="flex gap-1 bg-black/70 backdrop-blur-xs p-1 rounded-lg">
                      {posterVariants.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectVariant(idx)}
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-bold rounded transition-all",
                            selectedVariantIndex === idx
                              ? "bg-purple-600 text-white shadow-xs"
                              : "text-slate-300 hover:text-white"
                          )}
                        >
                          {idx === 0 ? "★ Best" : `V${idx + 1}`}
                        </button>
                      ))}
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2 bg-white/90 hover:bg-white text-[10px] font-semibold text-slate-800 backdrop-blur-xs shadow-xs"
                      onClick={() => setIsCanvasModalOpen(true)}
                    >
                      <Edit3 className="size-3 mr-1" />
                      Edit Canvas
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Detected Link Preview Card (if no image but URL present) */}
            {mediaType === "none" && detectedUrl && (
              <div className="mx-3.5 mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                <p className="font-semibold text-slate-800 truncate">{detectedUrl}</p>
                <p className="text-[10px] text-slate-500">Facebook rich web card preview</p>
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
                <MessageCircle className="size-4" />
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

      {/* --- Interactive Canvas Workbench Modal --- */}
      {isCanvasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-md bg-purple-600 text-white">
                  <Edit3 className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Direct Manipulation Poster Workbench</h3>
                  <p className="text-xs text-slate-500">Drag, scale, and reposition elements directly on the canvas.</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0 text-slate-500 hover:text-slate-900"
                onClick={() => setIsCanvasModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Modal Canvas Body */}
            <div className="p-6 overflow-auto flex items-center justify-center bg-slate-100 min-h-[500px]">
              {activeTrace ? (
                <div className="shadow-lg border border-slate-300 rounded-lg overflow-hidden bg-white">
                  <InteractiveCanvas
                    trace={activeTrace}
                    onUpdateElement={(index: number, newProps: any) => {
                      const updatedAssets = [...(activeTrace.resolved_assets || [])]
                      updatedAssets[index] = newProps
                      setActiveTrace({
                        ...activeTrace,
                        resolved_assets: updatedAssets,
                      })
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-500">No active poster loaded into the workbench.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 bg-slate-50">
              <p className="text-xs text-slate-500">
                Changes made here synchronize directly with your Facebook post preview.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsCanvasModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-purple-700 hover:bg-purple-800 text-white font-semibold"
                  onClick={() => {
                    setIsCanvasModalOpen(false)
                    toast.success("Workbench changes applied to your post!")
                  }}
                >
                  <Check className="size-4 mr-1.5" />
                  Apply to Post
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
