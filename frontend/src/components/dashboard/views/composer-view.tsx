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
  PenLine,
  Search,
  Radar,
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
import { AISettingsView } from "./ai-settings-view"
import { StyleAnalyzerView } from "./style-analyzer-view"
import { PageTrackerView } from "./page-tracker-view"

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

  // --- Unified Studio Tab State ---
  const [activeStudioTab, setActiveStudioTab] = useState<"composer" | "personas" | "style" | "tracker">("composer")

  // --- AI Personas State ---
  const [personas, setPersonas] = useState<AIPersona[]>([])
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(null)
  const activePersona = personas.find((p) => p.id === selectedPersonaId) || personas.find((p) => p.is_active) || personas[0]

  // Load handoff parameters & templates on mount
  useEffect(() => {
    const tabParam = searchParams?.get("tab")
    if (tabParam === "personas" || tabParam === "style" || tabParam === "tracker" || tabParam === "composer") {
      setActiveStudioTab(tabParam)
    }

    const topicParam = searchParams?.get("topic")
    const inspParam = searchParams?.get("inspiration")
    if (topicParam) {
      setCampaignPrompt(topicParam)
      setVisualTopic(topicParam)
      setSourceBadge(`Imported Topic: "${topicParam}"`)
      setActiveStudioTab("composer")
    }
    if (inspParam) {
      setContent(inspParam)
      setSourceBadge("Imported Inspiration Draft")
      setActiveStudioTab("composer")
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
        setActiveStudioTab("composer")
        toast.success("Graphic from Poster Lab loaded into Composer!")
      }
      if (storedTopic) {
        setCampaignPrompt(storedTopic)
        setVisualTopic(storedTopic)
        sessionStorage.removeItem("composer_prefill_topic")
        setActiveStudioTab("composer")
      }
      if (storedContent) {
        setContent(storedContent)
        sessionStorage.removeItem("composer_prefill_content")
        setActiveStudioTab("composer")
      }
    } catch {
      // ignore
    }
  }, [searchParams])

  function handleUseStyleInComposer(promptText: string) {
    setCampaignPrompt(promptText)
    setSourceBadge("Applied Extracted Style Prompt")
    setActiveStudioTab("composer")
    toast.success("Applied style to Post Composer! Ready to generate.")
  }

  function handleRemixInComposer(postContent: string, topic?: string) {
    if (topic) {
      setCampaignPrompt(`Create a high-converting post inspired by: ${topic}`)
      setVisualTopic(topic)
    }
    setContent(postContent)
    setSourceBadge(topic ? `Remixing: "${topic}"` : "Remixing Tracked Post")
    setActiveStudioTab("composer")
    toast.success("Tracked post loaded into Composer! Ready to customize or generate posters.")
  }

  function handleTestPersona(persona: AIPersona) {
    setSelectedPersonaId(persona.id ?? null)
    if (persona.niche || persona.persona_name) {
      setCampaignPrompt(persona.niche || persona.persona_name)
      setVisualTopic(persona.niche || persona.persona_name)
    }
    setSourceBadge(`Testing Persona Voice: "${persona.persona_name}" (${persona.niche || "Custom Tone"})`)
    setActiveStudioTab("composer")
    toast.success(`Loaded "${persona.persona_name}" persona into Composer! Ready to test.`)
  }

  useEffect(() => {
    api.get<any[]>("/api/image-templates")
      .then((res) => setTemplates(res.data))
      .catch((err) => console.error("Error loading templates:", err))
  }, [])

  useEffect(() => {
    if (!selectedPage?.id) {
      setPersonas([])
      setAiSettingsReady(false)
      return
    }
    api.get<AIPersona[]>(`/api/ai/personas/${selectedPage.id}`)
      .then((response) => {
        const list = response.data || []
        setPersonas(list)
        setAiSettingsReady(list.some((p) => Boolean(p.niche)))
        
        const personaParam = searchParams?.get("persona_id")
        if (personaParam) {
          const matched = list.find((p) => String(p.id) === personaParam)
          if (matched) {
            setSelectedPersonaId(matched.id ?? null)
            setSourceBadge(`Testing Persona Voice: "${matched.persona_name}"`)
            if (!campaignPrompt.trim() && (matched.niche || matched.persona_name)) {
              setCampaignPrompt(matched.niche || matched.persona_name)
            }
          }
        } else if (list.length > 0 && selectedPersonaId === null) {
          const active = list.find((p) => p.is_active) || list[0]
          setSelectedPersonaId(active.id ?? null)
        }
      })
      .catch(() => {
        setPersonas([])
        setAiSettingsReady(false)
      })
  }, [selectedPage?.id, searchParams])

  // --- Canva-Grade Interactive Archetype State ---
  const [currentArchetype, setCurrentArchetype] = useState<string>("social-card")
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "4:5" | "9:16" | "16:9">("1:1")
  const [editableHeadline, setEditableHeadline] = useState<string>("")
  const [editableSubheadline, setEditableSubheadline] = useState<string>("")
  const [editableBadge, setEditableBadge] = useState<string>("PRO TIP")
  const [editableStat, setEditableStat] = useState<string>("+4.5X")
  const [editableItems, setEditableItems] = useState<string[]>([])
  const [editableCta, setEditableCta] = useState<string>("READ GUIDE →")
  const [currentImageUrl, setCurrentImageUrl] = useState<string>("")
  const [imageCandidates, setImageCandidates] = useState<string[]>([])
  const [paletteId, setPaletteId] = useState<string>("midnight-mint")
  const [isReRendering, setIsReRendering] = useState<boolean>(false)
  const [isFineTuningOpen, setIsFineTuningOpen] = useState<boolean>(true)

  // --- Sub-100ms Live Re-render Handler ---
  async function triggerLiveReRender(overrides?: {
    archetype?: string
    aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9"
    headline?: string
    subheadline?: string
    badge?: string
    stat?: string
    items?: string[]
    cta?: string
    imageUrl?: string
    palette?: string
  }) {
    const arch = overrides?.archetype ?? currentArchetype
    const ar = overrides?.aspectRatio ?? aspectRatio
    const hl = overrides?.headline ?? editableHeadline
    const sub = overrides?.subheadline ?? editableSubheadline
    const bdg = overrides?.badge ?? editableBadge
    const st = overrides?.stat ?? editableStat
    const itms = overrides?.items ?? editableItems
    const cta = overrides?.cta ?? editableCta
    const img = overrides?.imageUrl ?? currentImageUrl
    const pal = overrides?.palette ?? paletteId

    if (!hl && !img) return

    setIsReRendering(true)
    try {
      const res = await axiosInstance.post("/api/poster/render-preview", {
        archetype_id: arch,
        aspect_ratio: ar,
        headline: hl,
        subheadline: sub || undefined,
        badge_text: bdg || undefined,
        stat_number: st || undefined,
        items: itms?.length ? itms : undefined,
        cta_text: cta || undefined,
        image_url: img || undefined,
        brand_name: selectedPage?.page_name || "Creator",
        handle: "@" + (selectedPage?.page_name || "creator").toLowerCase().replace(/\s+/g, ""),
        avatar_url: selectedPage?.page_picture_url,
        palette_id: pal,
      })

      if (res.data?.base64_image) {
        setMedia(res.data.base64_image)
      }
    } catch (err) {
      console.error("Live preview re-render failed:", err)
    } finally {
      setIsReRendering(false)
    }
  }

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
        persona_id: selectedPersonaId || undefined,
        candidate_count: candidateCount,
        allow_pexels_bg: allowPexelsBg,
        aspect_ratio: aspectRatio,
      })

      const data = res.data
      setCampaignTheme(data.campaign_theme || campaignPrompt)
      setContent(data.post_content || "")
      setHashtags(data.hashtags || [])
      setGraphicConcept(data.graphic_concept || null)

      if (data.graphic_concept) {
        const gc = data.graphic_concept
        setCurrentArchetype(gc.archetype_id || "social-card")
        setEditableHeadline(gc.headline || "")
        setEditableSubheadline(gc.subheadline || "")
        setEditableBadge(gc.badge_text || "PRO TIP")
        setEditableStat(gc.stat_number || "+4.5X")
        setEditableItems(gc.items || [])
        setEditableCta(gc.cta_text || "READ GUIDE →")
        setCurrentImageUrl(data.poster_winner?.image_url || data.image_candidates?.[0] || "")
        setImageCandidates(data.image_candidates || [])
      }

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

      toast.success("Unified Campaign & Canva-Grade Poster generated successfully!")
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
      if (variant.archetype_id) {
        setCurrentArchetype(variant.archetype_id)
      }
      if (variant.image_url) {
        setCurrentImageUrl(variant.image_url)
      }
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
      {/* Top Header & Unified Studio Navigation Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <PageTitle
            title="Create Post Studio"
            subtitle="Generate high-converting Facebook campaigns, configure AI personas, analyze writing styles, and discover competitor ideas."
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
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 shadow-xs">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-700">{publishablePages[0].page_name}</span>
            </div>
          ) : null}
        </div>

        {/* Studio Sub-Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveStudioTab("composer")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0",
                activeStudioTab === "composer"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <PenLine className="size-3.5" />
              Post Composer &amp; Posters
            </button>
            <button
              type="button"
              onClick={() => setActiveStudioTab("personas")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0",
                activeStudioTab === "personas"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Sparkles className="size-3.5 text-purple-600" />
              AI Personas &amp; Prompts
            </button>
            <button
              type="button"
              onClick={() => setActiveStudioTab("style")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0",
                activeStudioTab === "style"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Search className="size-3.5 text-blue-600" />
              Style Analyzer
            </button>
            <button
              type="button"
              onClick={() => setActiveStudioTab("tracker")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0",
                activeStudioTab === "tracker"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Radar className="size-3.5 text-emerald-600" />
              Page Inspo Tracker
            </button>
          </div>
        </div>
      </div>

      {/* --- SUB-VIEW 1: AI PERSONAS & PROMPTS --- */}
      {activeStudioTab === "personas" && (
        <AISettingsView pages={pages} onTestPersona={handleTestPersona} />
      )}

      {/* --- SUB-VIEW 2: STYLE ANALYZER --- */}
      {activeStudioTab === "style" && (
        <StyleAnalyzerView
          pages={pages}
          onUseInComposer={handleUseStyleInComposer}
          onOpenPromptStudio={() => setActiveStudioTab("personas")}
        />
      )}

      {/* --- SUB-VIEW 3: PAGE INSPO TRACKER --- */}
      {activeStudioTab === "tracker" && (
        <PageTrackerView
          pages={pages}
          onRemixPost={handleRemixInComposer}
        />
      )}

      {/* --- SUB-VIEW 4: POST COMPOSER & POSTER STUDIO --- */}
      {activeStudioTab === "composer" && (
        <>
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
                <div className="flex items-center gap-1 bg-white/90 p-0.5 rounded-lg border border-purple-200 shadow-xs">
                  {[
                    { id: "1:1", label: "1:1 Square" },
                    { id: "4:5", label: "4:5 Feed" },
                    { id: "9:16", label: "9:16 Story" },
                    { id: "16:9", label: "16:9 Banner" },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setAspectRatio(r.id as any)
                        triggerLiveReRender({ aspectRatio: r.id as any })
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                        aspectRatio === r.id
                          ? "bg-purple-600 text-white font-semibold shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Switch checked={allowPexelsBg} onCheckedChange={setAllowPexelsBg} />
                  <span>Stock Photos</span>
                </label>
              </div>
            </div>

            {/* Persona Voice Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-purple-100/80">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
                  <Sparkles className="size-3.5 text-purple-600" />
                  Target Persona:
                </span>
                <div className="w-56 sm:w-64">
                  <Select
                    value={selectedPersonaId ? String(selectedPersonaId) : ""}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null
                      setSelectedPersonaId(val)
                      if (val) {
                        const p = personas.find((item) => item.id === val)
                        if (p) {
                          setSourceBadge(`Active Persona Voice: "${p.persona_name}"`)
                          if (!campaignPrompt.trim() && (p.niche || p.persona_name)) {
                            setCampaignPrompt(p.niche || p.persona_name)
                          }
                        }
                      }
                    }}
                    className="h-8 text-xs font-semibold bg-white border-purple-200"
                  >
                    <option value="">Auto (Default Page Voice)</option>
                    {personas.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.persona_name} {p.content_mode === "meme" ? "😂 (Meme)" : ""} {p.niche ? `· ${p.niche}` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                {activePersona && (
                  <span className={cn(
                    "hidden md:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded",
                    activePersona.content_mode === "meme"
                      ? "text-pink-800 bg-pink-100/90 font-bold"
                      : "text-purple-700 bg-purple-100/70"
                  )}>
                    {activePersona.content_mode === "meme" ? "😂 Meme Mode: " : "Tone: "}
                    {Array.isArray(activePersona.tone_tags) && activePersona.tone_tags.length ? activePersona.tone_tags.slice(0, 2).join(", ") : "Engaging"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {activePersona?.content_mode === "meme" && (
                  <Link
                    href={`/dashboard/memes?persona_id=${activePersona.id}`}
                    className="text-xs font-semibold text-pink-700 hover:text-pink-900 hover:underline flex items-center gap-1"
                  >
                    <span>😂</span>
                    Open in Meme Studio →
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setActiveStudioTab("personas")}
                  className="text-xs font-semibold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1"
                >
                  Manage Personas →
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Input
                  value={campaignPrompt}
                  onChange={(e) => setCampaignPrompt(e.target.value)}
                  placeholder={
                    activePersona?.content_mode === "meme"
                      ? "e.g. That moment when a client asks for a quick redesign on Friday at 5 PM..."
                      : "e.g. 5 Time Management Hacks for Startup Founders, or Tips for First-Time Homebuyers..."
                  }
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
              {/* Option 1: Canva-Grade AI Graphic Poster */}
              {mediaType === "ai_poster" && (
                <div className="grid gap-4">
                  {/* Archetype Selector Bar */}
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Layers className="size-3.5 text-purple-600" />
                        Design Archetype (1-Click Transform)
                      </Label>
                      {isReRendering && (
                        <span className="flex items-center text-[10px] text-purple-600 font-semibold animate-pulse">
                          <Loader2 className="size-3 animate-spin mr-1" />
                          Rendering live preview...
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      {[
                        { id: "social-card", label: "Social Card", emoji: "🗂️" },
                        { id: "editorial-hero", label: "Editorial", emoji: "📰" },
                        { id: "metric-callout", label: "Stat Callout", emoji: "📊" },
                        { id: "checklist-framework", label: "Checklist", emoji: "✅" },
                        { id: "promo-banner", label: "Promo Banner", emoji: "🏷️" },
                        { id: "minimal-quote", label: "Quote", emoji: "💬" },
                      ].map((arch) => {
                        const isActive = currentArchetype === arch.id
                        return (
                          <button
                            key={arch.id}
                            type="button"
                            onClick={() => {
                              setCurrentArchetype(arch.id)
                              triggerLiveReRender({ archetype: arch.id })
                            }}
                            className={cn(
                              "flex flex-col items-center justify-center rounded-lg border py-2 px-1 text-center transition-all text-xs font-medium",
                              isActive
                                ? "border-purple-600 bg-purple-50 text-purple-900 shadow-xs font-bold ring-1 ring-purple-600/30"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            )}
                          >
                            <span className="text-base mb-0.5">{arch.emoji}</span>
                            <span className="text-[11px] leading-tight truncate w-full">{arch.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Direct Fine-Tuning Controls Accordion */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 grid gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Sliders className="size-3.5 text-purple-600" />
                        Poster Fine-Tuning (Live Sub-100ms Preview)
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-slate-500 hover:text-slate-800"
                        onClick={() => setIsFineTuningOpen(!isFineTuningOpen)}
                      >
                        {isFineTuningOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </Button>
                    </div>

                    {isFineTuningOpen && (
                      <div className="grid gap-3 pt-1 border-t border-slate-200/60 animate-in fade-in duration-150">
                        {/* Headline */}
                        <div className="grid gap-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                            <Label htmlFor="fine-headline" className="text-[11px]">Poster Headline</Label>
                            <span>{editableHeadline.length} chars</span>
                          </div>
                          <Input
                            id="fine-headline"
                            value={editableHeadline}
                            onChange={(e) => {
                              setEditableHeadline(e.target.value)
                              triggerLiveReRender({ headline: e.target.value })
                            }}
                            placeholder="Punchy visual headline..."
                            className="h-8 text-xs bg-white"
                          />
                        </div>

                        {/* Subheadline & Badge */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-1">
                            <Label htmlFor="fine-sub" className="text-[11px] font-medium text-slate-600">Subheadline / Context</Label>
                            <Input
                              id="fine-sub"
                              value={editableSubheadline}
                              onChange={(e) => {
                                setEditableSubheadline(e.target.value)
                                triggerLiveReRender({ subheadline: e.target.value })
                              }}
                              placeholder="Subtitle or takeaway..."
                              className="h-8 text-xs bg-white"
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label htmlFor="fine-badge" className="text-[11px] font-medium text-slate-600">Category Badge</Label>
                            <Input
                              id="fine-badge"
                              value={editableBadge}
                              onChange={(e) => {
                                setEditableBadge(e.target.value)
                                triggerLiveReRender({ badge: e.target.value })
                              }}
                              placeholder="e.g. PRO TIP, CHEAT SHEET"
                              className="h-8 text-xs bg-white"
                            />
                          </div>
                        </div>

                        {/* Stat Number (If metric-callout) */}
                        {currentArchetype === "metric-callout" && (
                          <div className="grid gap-1">
                            <Label htmlFor="fine-stat" className="text-[11px] font-medium text-slate-600">Hero Stat Number</Label>
                            <Input
                              id="fine-stat"
                              value={editableStat}
                              onChange={(e) => {
                                setEditableStat(e.target.value)
                                triggerLiveReRender({ stat: e.target.value })
                              }}
                              placeholder="e.g. +4.5X or 85%"
                              className="h-8 text-xs bg-white"
                            />
                          </div>
                        )}

                        {/* CTA Text (If promo-banner or editorial-hero) */}
                        {(currentArchetype === "promo-banner" || currentArchetype === "editorial-hero") && (
                          <div className="grid gap-1">
                            <Label htmlFor="fine-cta" className="text-[11px] font-medium text-slate-600">CTA Button Text</Label>
                            <Input
                              id="fine-cta"
                              value={editableCta}
                              onChange={(e) => {
                                setEditableCta(e.target.value)
                                triggerLiveReRender({ cta: e.target.value })
                              }}
                              placeholder="e.g. GET 50% OFF NOW →"
                              className="h-8 text-xs bg-white"
                            />
                          </div>
                        )}

                        {/* 1-Click Photo Swapper Strip */}
                        {imageCandidates.length > 0 && (
                          <div className="grid gap-1.5 pt-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                              <span>1-Click Stock Photography Swapper</span>
                              <span>{imageCandidates.length} Photos Found</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              {imageCandidates.map((url, i) => {
                                const isCurrent = currentImageUrl === url
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                      setCurrentImageUrl(url)
                                      triggerLiveReRender({ imageUrl: url })
                                    }}
                                    className={cn(
                                      "relative h-14 rounded-md overflow-hidden border transition-all group",
                                      isCurrent
                                        ? "ring-2 ring-purple-600 border-purple-600 shadow-xs"
                                        : "border-slate-300 hover:border-slate-400 opacity-80 hover:opacity-100"
                                    )}
                                  >
                                    <img src={url} alt={`Option ${i + 1}`} className="size-full object-cover" />
                                    {isCurrent && (
                                      <div className="absolute inset-0 bg-purple-600/30 flex items-center justify-center">
                                        <Check className="size-4 text-white drop-shadow-xs" />
                                      </div>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Color Palette Quick Selector */}
                        <div className="grid gap-1.5 pt-1">
                          <Label className="text-[11px] font-medium text-slate-600">Brand Color Mood</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { id: "midnight-mint", label: "Midnight Mint", color: "#2DD4BF" },
                              { id: "ink-sun", label: "Ink & Sun", color: "#F8C630" },
                              { id: "paper-tomato", label: "Paper Tomato", color: "#E63946" },
                              { id: "forest-lime", label: "Forest Lime", color: "#D9ED92" },
                              { id: "plum-gold", label: "Plum & Gold", color: "#D4AF37" },
                            ].map((pal) => (
                              <button
                                key={pal.id}
                                type="button"
                                onClick={() => {
                                  setPaletteId(pal.id)
                                  triggerLiveReRender({ palette: pal.id })
                                }}
                                className={cn(
                                  "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition-all font-medium",
                                  paletteId === pal.id
                                    ? "bg-white border-purple-600 text-purple-900 shadow-xs font-semibold"
                                    : "bg-white/80 border-slate-200 text-slate-700 hover:bg-white"
                                )}
                              >
                                <span className="size-2.5 rounded-full" style={{ backgroundColor: pal.color }} />
                                {pal.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Aspect Ratio Live Transform */}
                        <div className="grid gap-1.5 pt-1">
                          <Label className="text-[11px] font-medium text-slate-600">Canvas Ratio (1-Click Reformat)</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { id: "1:1", label: "1:1 Square (1080×1080)" },
                              { id: "4:5", label: "4:5 Feed Portrait (1080×1350)" },
                              { id: "9:16", label: "9:16 Story / Reel (1080×1920)" },
                              { id: "16:9", label: "16:9 Banner (1920×1080)" },
                            ].map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  setAspectRatio(r.id as any)
                                  triggerLiveReRender({ aspectRatio: r.id as any })
                                }}
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-[11px] border transition-all font-medium",
                                  aspectRatio === r.id
                                    ? "bg-purple-600 text-white border-purple-600 font-semibold shadow-xs"
                                    : "bg-white/80 border-slate-200 text-slate-700 hover:bg-white"
                                )}
                              >
                                {r.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
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
      </>
    )}

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
