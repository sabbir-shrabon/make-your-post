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
  Settings2,
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
import { useAuth } from "@/contexts/auth-context"
import { useApp } from "@/contexts/app-context"
import { PageSelector } from "@/components/dashboard/shared/page-selector"
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
  const { activePageId, setActivePageId } = useApp()

  const publishablePages = pages.filter((page) => page.connection_status === "connected")
  const [selectedPageId, setSelectedPageId] = useState<number | null>(
    activePageId ?? publishablePages[0]?.id ?? pages[0]?.id ?? null
  )
  const selectedPage = publishablePages.find((page) => page.id === selectedPageId) || publishablePages[0] || pages[0]

  // --- Campaign / Generation State ---
  const [campaignPrompt, setCampaignPrompt] = useState("")
  const [candidateCount, setCandidateCount] = useState<number>(3)
  const [allowPexelsBg, setAllowPexelsBg] = useState<boolean>(true)
  const [generatingCampaign, setGeneratingCampaign] = useState(false)


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



  // --- AI Personas State ---
  const [personas, setPersonas] = useState<AIPersona[]>([])
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(null)
  const activePersona = personas.find((p) => p.id === selectedPersonaId) || personas.find((p) => p.is_active) || personas[0]

  // --- Business Suite Redesign State ---
  const [isCaptionGenerateOn, setIsCaptionGenerateOn] = useState(false)
  const [isMediaGenerateOn, setIsMediaGenerateOn] = useState(false)
  const [mediaGenerateSource, setMediaGenerateSource] = useState<"archetype" | "template">("archetype")
  const [isAdvancedMediaOpen, setIsAdvancedMediaOpen] = useState(false)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

  // Load handoff parameters & templates on mount
  useEffect(() => {
    const topicParam = searchParams?.get("topic")
    const inspParam = searchParams?.get("inspiration")
    if (topicParam) {
      setCampaignPrompt(topicParam)
      setVisualTopic(topicParam)
    }
    if (inspParam) {
      setContent(inspParam)
    }

    try {
      const storedImage = sessionStorage.getItem("composer_prefill_image")
      const storedTopic = sessionStorage.getItem("composer_prefill_topic")
      const storedContent = sessionStorage.getItem("composer_prefill_content")

      if (storedImage) {
        setMedia(storedImage)
        setMediaType("ai_poster")
        sessionStorage.removeItem("composer_prefill_image")
        toast.success("Graphic from Poster Lab loaded into Composer!")
      }
      if (storedTopic) {
        setCampaignPrompt(storedTopic)
        setVisualTopic(storedTopic)
        sessionStorage.removeItem("composer_prefill_topic")
      }
      const editId = searchParams?.get("edit_id") || searchParams?.get("post_id")
      if (editId) {
        api.get(`/posts`, { params: { limit: 100 } }).then((res) => {
          const found = (res.data || []).find((p: any) => String(p.id) === String(editId))
          if (found) {
            if (found.content) setContent(found.content)
            const img = found.image_url || found.media_urls?.[0]
            if (img) {
              setMedia(img)
              setMediaType("ai_poster")
            }
            if (found.page_connection_id || found.facebook_connection_id) {
              setSelectedPageId(found.page_connection_id || found.facebook_connection_id)
            }
            if (found.scheduled_at) {
              setScheduleLater(true)
              try {
                setScheduledAt(new Date(found.scheduled_at).toISOString().slice(0, 16))
              } catch {
                // ignore
              }
            }
            toast.success("Post loaded for editing.")
          }
        }).catch(() => null)
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
    const targetTopic = (content || campaignPrompt).trim()
    if (!targetTopic) {
      return toast.error("Please enter a campaign topic, notes, or prompt.")
    }

    setGeneratingCampaign(true)
    try {
      const res = await axiosInstance.post("/api/campaign/generate-unified", {
        topic_or_niche: targetTopic,
        page_connection_id: selectedPage?.id || undefined,
        persona_id: selectedPersonaId || undefined,
        candidate_count: candidateCount,
        allow_pexels_bg: allowPexelsBg,
        aspect_ratio: aspectRatio,
      })

      const data = res.data
      setCampaignTheme(data.campaign_theme || targetTopic)
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

      toast.success("Post copy & poster generated with Persona!")
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



      {/* --- Main Studio Workspace (Side-by-Side) --- */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* LEFT COLUMN: Business Suite Layout (7 Cols) */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {/* Caption Section */}
          {/* Caption Section */}
          <Card className="shadow-xs overflow-hidden border border-slate-200 bg-white">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base font-semibold leading-5 text-slate-800">Post Details</CardTitle>
                  <PageSelector
                    pages={publishablePages.length > 0 ? publishablePages : pages}
                    selectedPageId={selectedPageId}
                    onSelectPageId={(id) => {
                      setSelectedPageId(id)
                      setActivePageId(id)
                      setSelectedPersonaId(null)
                    }}
                    size="sm"
                  />
                </div>

                <div className="flex items-center gap-3">
                  {/* When toggle is ON: compact Persona Selector in the header */}
                  {isCaptionGenerateOn && (
                    <div className="w-40 sm:w-48 animate-in fade-in duration-200">
                      <Select
                        value={selectedPersonaId ? String(selectedPersonaId) : ""}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null
                          setSelectedPersonaId(val)
                        }}
                        className="h-8 text-xs font-semibold bg-white border-purple-200 shadow-xs"
                      >
                        <option value="">Auto (Default Voice)</option>
                        {personas.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.persona_name} {p.content_mode === "meme" ? "😂" : ""}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Label htmlFor="generate-persona-toggle" className="text-xs font-medium text-purple-700 cursor-pointer">
                      Generate with Persona
                    </Label>
                    <Switch
                      id="generate-persona-toggle"
                      checked={isCaptionGenerateOn}
                      onCheckedChange={setIsCaptionGenerateOn}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 grid gap-3">
              <div className="relative">
                <Textarea
                  className="min-h-[140px] resize-y text-sm border border-slate-200 rounded-md p-3 focus-visible:ring-2 focus-visible:ring-purple-500/20 placeholder:text-slate-400 bg-white shadow-inner"
                  placeholder={
                    isCaptionGenerateOn
                      ? activePersona?.content_mode === "meme"
                        ? "Describe your meme angle or joke scenario... (e.g. When the client approves the first draft without changes)"
                        : "Describe your post topic, hook, or bullet points... (e.g. 5 Time Management Hacks for Startup Founders)"
                      : "What's on your mind? Write your post copy here..."
                  }
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>

              {/* Bottom Toolbar */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {isCaptionGenerateOn && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                      className="text-xs text-slate-600 font-semibold"
                    >
                      <Settings2 className="size-3.5 mr-1.5" />
                      Advanced
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 p-0 font-bold"
                    onClick={() => {
                      const tag = prompt("Enter a hashtag (without #):")
                      if (tag && tag.trim()) {
                        toggleHashtagInContent(tag.trim())
                      }
                    }}
                    title="Add Hashtag"
                  >
                    #
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {remaining}
                  </span>

                  {isCaptionGenerateOn && (
                    <Button
                      type="button"
                      onClick={(e) => handleGenerateUnifiedCampaign(e)}
                      disabled={generatingCampaign || !content.trim()}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold h-9 shadow-xs px-4 text-xs"
                    >
                      {generatingCampaign ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin mr-1.5" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-3.5 mr-1.5" />
                          Generate Post & Poster
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Advanced Settings Collapsible (When toggle ON & Advanced clicked) */}
              {isCaptionGenerateOn && isAdvancedOpen && (
                <div className="pt-3 border-t border-slate-100 grid gap-3 animate-in fade-in duration-200 slide-in-from-top-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="grid gap-1.5">
                      <Label className="text-[11px] font-bold uppercase text-slate-600">Post Size / Aspect Ratio</Label>
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-xs">
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
                    </div>

                    <div className="flex items-center gap-2 pt-2 sm:pt-0">
                      <Switch id="composer-pexels-bg" checked={allowPexelsBg} onCheckedChange={setAllowPexelsBg} />
                      <Label htmlFor="composer-pexels-bg" className="text-xs font-medium text-slate-700 cursor-pointer">
                        Stock Photo Backgrounds
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Hashtags list if attached */}
              {hashtags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Hashtags:</span>
                  {hashtags.map((tag, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleHashtagInContent(tag)}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors border",
                        content.includes(tag)
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Media Section */}
          <Card className="shadow-xs border border-slate-200">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold leading-5 text-slate-800">Media</CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="generate-media-toggle" className="text-xs font-medium text-blue-700 cursor-pointer">
                    Generate Graphic
                  </Label>
                  <Switch
                    id="generate-media-toggle"
                    checked={isMediaGenerateOn}
                    onCheckedChange={(val) => {
                      setIsMediaGenerateOn(val)
                      if (!val) setMediaType("custom_url")
                      else setMediaType("ai_poster")
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 grid gap-4">
              {!isMediaGenerateOn ? (
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100/50 transition-colors">
                  <div className="size-10 rounded-full bg-white shadow-sm flex items-center justify-center mb-3">
                    <ImageIcon className="size-5 text-slate-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">Add Photo or Video</h4>
                  <p className="text-xs text-slate-500 mb-4">Paste an image URL or Supabase link</p>
                  <div className="w-full max-w-sm">
                    <Input
                      value={media}
                      onChange={(e) => {
                        setMedia(e.target.value)
                        setMediaType("custom_url")
                      }}
                      placeholder="https://..."
                      className="text-sm text-center bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-medium text-slate-600 w-fit mx-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setMediaGenerateSource("archetype")
                        setMediaType("ai_poster")
                      }}
                      className={cn(
                        "rounded-md px-4 py-1.5 transition-all",
                        mediaGenerateSource === "archetype" ? "bg-white text-blue-700 shadow-xs font-semibold" : ""
                      )}
                    >
                      From Archetype
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMediaGenerateSource("template")
                        setMediaType("template")
                      }}
                      className={cn(
                        "rounded-md px-4 py-1.5 transition-all",
                        mediaGenerateSource === "template" ? "bg-white text-blue-700 shadow-xs font-semibold" : ""
                      )}
                    >
                      From Template
                    </button>
                  </div>

                  {mediaGenerateSource === "archetype" && (
                    <div className="grid gap-3 animate-in fade-in duration-200">
                      <div className="grid gap-1">
                        <Label className="text-xs font-medium">Headline</Label>
                        <Input
                          value={editableHeadline}
                          onChange={(e) => {
                            setEditableHeadline(e.target.value)
                            triggerLiveReRender({ headline: e.target.value })
                          }}
                          placeholder="Punchy visual headline..."
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs font-medium">Subheadline / Context</Label>
                        <Input
                          value={editableSubheadline}
                          onChange={(e) => {
                            setEditableSubheadline(e.target.value)
                            triggerLiveReRender({ subheadline: e.target.value })
                          }}
                          placeholder="Subtitle or takeaway..."
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setIsAdvancedMediaOpen(!isAdvancedMediaOpen)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <Sliders className="size-3.5" />
                            Advanced Layout & Colors
                          </span>
                          {isAdvancedMediaOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        </button>

                        {isAdvancedMediaOpen && (
                          <div className="p-3 grid gap-4 bg-white border-t border-slate-200">
                            <div className="grid gap-2">
                              <Label className="text-[11px] font-bold uppercase text-slate-500">Design Archetype</Label>
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                {[
                                  { id: "social-card", label: "Card", emoji: "🗂️" },
                                  { id: "editorial-hero", label: "Editorial", emoji: "📰" },
                                  { id: "metric-callout", label: "Stat", emoji: "📊" },
                                  { id: "checklist-framework", label: "List", emoji: "✅" },
                                  { id: "promo-banner", label: "Promo", emoji: "🏷️" },
                                  { id: "minimal-quote", label: "Quote", emoji: "💬" },
                                ]?.map((arch) => (
                                  <button
                                    key={arch.id}
                                    type="button"
                                    onClick={() => {
                                      setCurrentArchetype(arch.id)
                                      triggerLiveReRender({ archetype: arch.id })
                                    }}
                                    className={cn(
                                      "flex flex-col items-center justify-center rounded-lg border py-1.5 px-1 text-center transition-all text-[10px] font-medium",
                                      currentArchetype === arch.id
                                        ? "border-blue-600 bg-blue-50 text-blue-900 shadow-xs font-bold"
                                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    )}
                                  >
                                    <span className="text-sm mb-0.5">{arch.emoji}</span>
                                    <span className="truncate w-full">{arch.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid gap-2">
                              <Label className="text-[11px] font-bold uppercase text-slate-500">Brand Color Mood</Label>
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
                                      "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] border transition-all font-medium",
                                      paletteId === pal.id
                                        ? "bg-blue-50 border-blue-600 text-blue-900 shadow-xs"
                                        : "bg-white border-slate-200 text-slate-700"
                                    )}
                                  >
                                    <span className="size-2 rounded-full" style={{ backgroundColor: pal.color }} />
                                    {pal.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {mediaGenerateSource === "template" && (
                    <div className="grid gap-3 animate-in fade-in duration-200">
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
                            className="bg-blue-600 text-white hover:bg-blue-700 text-xs shadow-xs"
                            onClick={generateLayeredGraphic}
                            disabled={generatingLayered}
                          >
                            {generatingLayered ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Sparkles className="size-3.5 mr-1" />}
                            Generate Layered Graphic
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Always Visible 1-Line Scheduling & Publish Action Bar */}
          <div className="sticky bottom-4 z-40 mt-2 bg-white/95 backdrop-blur-md border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.12)] px-4 py-2.5 rounded-xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => submit(true)}
                disabled={saving || !content.trim()}
                className="text-slate-700 bg-white shadow-xs text-xs h-8"
              >
                Save as Draft
              </Button>

              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <Switch checked={scheduleLater} onCheckedChange={setScheduleLater} id="schedule-switch" />
                <Label htmlFor="schedule-switch" className="text-xs font-semibold cursor-pointer text-slate-700 whitespace-nowrap">
                  Schedule
                </Label>
                {scheduleLater && (
                  <div className="flex items-center gap-1 animate-in fade-in duration-200">
                    <Input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
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
                disabled={saving || remaining < 0 || (!content.trim() && !isCaptionGenerateOn) || !publishablePages.length}
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
                disabled={saving || remaining < 0 || (!content.trim() && !isCaptionGenerateOn) || !publishablePages.length}
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
