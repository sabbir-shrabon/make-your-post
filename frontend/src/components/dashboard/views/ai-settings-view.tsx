"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Send,
  Calendar,
  Globe,
  MoreHorizontal,
  ThumbsUp,
  MessageSquare,
  Share2,
  Settings2,
  RotateCcw,
  Save,
  Check,
  Zap,
  Target,
  Sliders,
  Laugh,
  Layers,
  Wand2,
  BookOpen,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { PageConnection, AIPersona } from "@/types/models"
import { api, getApiErrorMessage } from "@/lib/api"
import { useApp } from "@/contexts/app-context"
import { PageSelector } from "@/components/dashboard/shared/page-selector"
import { cn } from "@/lib/utils"

const AVAILABLE_TONES = [
  "Authoritative",
  "Calm",
  "Friendly",
  "Bold",
  "Witty",
  "Empathetic",
  "Humorous",
  "Relatable",
  "Casual",
  "Luxury",
  "Minimalist",
  "Energetic",
]

const QUICK_PRESETS = [
  {
    name: "Tech Founder & Builder",
    niche: "SaaS growth, product engineering, shipping fast, and bootstrapping lessons",
    tones: ["Authoritative", "Bold", "Energetic"],
    mode: "standard",
  },
  {
    name: "Nature & Science Educator",
    niche: "Wildlife adaptations, natural phenomena, and scientific discoveries explained simply",
    tones: ["Calm", "Authoritative", "Empathetic"],
    mode: "standard",
  },
  {
    name: "Viral Workplace Satirist",
    niche: "Relatable client struggles, corporate humor, Monday blues, and dev realities",
    tones: ["Humorous", "Witty", "Relatable"],
    mode: "meme",
  },
  {
    name: "Direct-Response Growth Marketer",
    niche: "Actionable marketing frameworks, copywriting secrets, and revenue scaling",
    tones: ["Bold", "Energetic", "Friendly"],
    mode: "hybrid",
  },
]

const SAMPLE_POST_PRESETS = [
  {
    label: "🚀 Tech & Startup Insights",
    content:
      "Most startups fail not because they couldn't build the product, but because they built something nobody wanted.\n\nTalk to 10 customers before writing a single line of code. Ship an ugly MVP in 2 weeks instead of a polished app in 6 months.\n\nSpeed of iteration > perfection. What was your biggest lesson launching your first product? #StartupGrind #TechFounders",
  },
  {
    label: "🌿 Nature & Science Facts",
    content:
      "Did you know that trees in a forest communicate and share nutrients through an underground fungal network nicknamed the 'Wood Wide Web'?\n\nWhen a tree is attacked by pests, it sends chemical warning signals to neighboring trees so they can mount defenses.\n\nNature's cooperative intelligence is far more advanced than we realize. What's your favorite natural phenomenon? #NatureFacts #ScienceWonder",
  },
  {
    label: "💼 Direct-Response Value",
    content:
      "Stop wasting 4 hours a day on manual social media scheduling.\n\nHere is our 3-step automation blueprint to 10x your organic reach:\n1. Curate high-performing content angles\n2. Batch produce visual posters with AI\n3. Schedule across peak engagement hours\n\nDrop a 'BLUEPRINT' in the comments and I'll DM you the free checklist! #SocialMediaStrategy #GrowthHacks",
  },
  {
    label: "🔥 Relatable Storytelling",
    content:
      "I almost quit 3 years ago.\n\nNo clients, $200 in the bank account, and everyone telling me to get a 'real job'.\n\nThe turning point? I stopped trying to please everyone and focused on one specific problem for one specific group of people.\n\nIf you're in the messy middle right now, keep pushing. The breakthrough happens right after you feel like giving up. #FounderStory #KeepGoing",
  },
]

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function createBlankPersona(): Partial<AIPersona> {
  return {
    persona_name: "New AI Persona",
    niche: "",
    tone_tags: ["Friendly", "Professional"],
    custom_instructions: "",
    content_mode: "standard",
    hashtags_enabled: true,
    hashtag_count: 3,
    always_include_engagement_hook: true,
    creativity_level: 7,
    assigned_days: ["Mon", "Wed", "Fri"],
    posting_time_slots: ["09:00"],
    prompt_config: {
      template: "Custom (blank)",
      audience: "Social Media Followers",
      goal: "Engagement & Community",
      brand_personality: ["Friendly", "Professional"],
      always_topics: [],
      never_topics: [],
      every_post_includes: ["A question at the end"],
      never_do: ["Make promises"],
      length: "Medium",
      structure: "Hook -> Value -> CTA",
      examples: "",
    },
    meme_theme_id: "tech-startups",
    meme_format_preference: "modern_card",
    is_active: true,
  }
}

export function AISettingsView({
  pages = [],
  onChanged,
  onTestPersona,
}: {
  pages?: PageConnection[]
  onChanged?: () => void
  onTestPersona?: (persona: AIPersona) => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { activePageId, setActivePageId } = useApp()

  const [selectedPageId, setSelectedPageId] = useState<number | null>(
    activePageId ?? pages.find((p) => p.connection_status === "connected")?.id ?? pages[0]?.id ?? null
  )
  const selectedPage = pages.find((p) => p.id === selectedPageId) || pages[0] || pages[0]

  const [personas, setPersonas] = useState<AIPersona[]>([])
  const [loadingPersonas, setLoadingPersonas] = useState(true)
  const [selectedPersonaIndex, setSelectedPersonaIndex] = useState<number>(0)
  const [activeDraft, setActiveDraft] = useState<Partial<AIPersona>>(createBlankPersona())
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Style Analyzer In-Place Extractor State
  const [showStyleExtractor, setShowStyleExtractor] = useState(false)
  const [samplePostsInput, setSamplePostsInput] = useState("")
  const [extractingStyle, setExtractingStyle] = useState(false)

  // Open style extractor if URL contains ?mode=extract
  useEffect(() => {
    if (searchParams?.get("mode") === "extract") {
      setShowStyleExtractor(true)
      setSelectedPersonaIndex(-1)
      setActiveDraft(createBlankPersona())
    }

    try {
      const prefillRaw = localStorage.getItem("ai_persona_prefill")
      if (prefillRaw) {
        const data = JSON.parse(prefillRaw)
        localStorage.removeItem("ai_persona_prefill")
        setSelectedPersonaIndex(-1)
        const blank = createBlankPersona()
        setActiveDraft({
          ...blank,
          persona_name: data.persona_name || blank.persona_name || "Style Analyzer Persona",
          niche: data.niche || blank.niche || "",
          tone_tags: Array.isArray(data.tone_tags) && data.tone_tags.length ? data.tone_tags : ["Professional"],
          custom_instructions: data.custom_instructions || "",
          creativity_level: data.creativity_level ? Number(data.creativity_level) : 7,
          prompt_config: {
            template: data.template || "Custom (blank)",
            audience: data.audience || "Social Media Followers",
            goal: data.goal || "Engagement & Community",
            brand_personality: data.tone_tags || ["Friendly", "Professional"],
            always_topics: data.always_topics || [],
            never_topics: data.never_topics || [],
            every_post_includes: data.every_post_includes || ["A question at the end"],
            never_do: data.never_do || ["Make promises"],
            length: (data.length as any) || "Medium",
            structure: data.structure || "Hook -> Value -> CTA",
            examples: data.examples || "",
          },
        })
        toast.success("Persona DNA loaded from Style Analyzer!")
      }
    } catch {
      // ignore
    }
  }, [searchParams])

  // Load personas for selected page
  const loadPersonas = useCallback(async () => {
    if (!selectedPage?.id) {
      setPersonas([])
      setLoadingPersonas(false)
      return
    }
    setLoadingPersonas(true)
    try {
      const res = await api.get<AIPersona[]>(`/api/ai/personas/${selectedPage.id}`)
      const list = res.data || []
      setPersonas(list)
      if (list.length > 0) {
        setSelectedPersonaIndex(0)
        setActiveDraft(list[0])
      } else {
        const blank = createBlankPersona()
        setActiveDraft(blank)
      }
    } catch (e) {
      setPersonas([])
    } finally {
      setLoadingPersonas(false)
    }
  }, [selectedPage?.id])

  useEffect(() => {
    loadPersonas()
  }, [loadPersonas])

  function handleSelectPersona(p: AIPersona, index: number) {
    setSelectedPersonaIndex(index)
    setActiveDraft(p)
    setShowStyleExtractor(false)
  }

  function handleNewPersona() {
    const blank = createBlankPersona()
    setSelectedPersonaIndex(-1)
    setActiveDraft(blank)
    toast.info("Drafting a new AI Persona. Configure details below or use Style Analyzer.")
  }

  function toggleTone(tone: string) {
    const current = Array.isArray(activeDraft.tone_tags) ? activeDraft.tone_tags : []
    const next = current.includes(tone)
      ? current.filter((t) => t !== tone)
      : [...current, tone].slice(0, 4)
    setActiveDraft({ ...activeDraft, tone_tags: next })
  }

  function toggleDay(day: string) {
    const current = Array.isArray(activeDraft.assigned_days) ? activeDraft.assigned_days : []
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day]
    setActiveDraft({ ...activeDraft, assigned_days: next })
  }

  function applyPreset(preset: (typeof QUICK_PRESETS)[0]) {
    setActiveDraft({
      ...activeDraft,
      persona_name: preset.name,
      niche: preset.niche,
      tone_tags: preset.tones,
      content_mode: preset.mode as any,
    })
    toast.success(`Applied "${preset.name}" preset!`)
  }

  // --- Extract Persona DNA from Sample Posts (Integrated Style Analyzer) ---
  async function handleExtractFromPosts() {
    if (!samplePostsInput.trim()) {
      return toast.error("Please paste at least one sample post or select a preset.")
    }

    setExtractingStyle(true)
    try {
      const posts = samplePostsInput.split(/\n\n+/).filter((p) => p.trim())
      const res = await api.post("/api/ai/generate-persona-from-posts", { posts })
      const data = res.data

      setActiveDraft((prev) => ({
        ...prev,
        persona_name: data.persona_name || prev.persona_name || "Custom Style Persona",
        niche: data.niche || prev.niche || "",
        tone_tags: Array.isArray(data.tone_tags) && data.tone_tags.length ? data.tone_tags : prev.tone_tags,
        custom_instructions: data.custom_instructions || prev.custom_instructions || "",
        hashtags_enabled: typeof data.hashtags_enabled === "boolean" ? data.hashtags_enabled : true,
        hashtag_count: typeof data.hashtag_count === "number" ? data.hashtag_count : 3,
        always_include_engagement_hook: typeof data.always_include_engagement_hook === "boolean" ? data.always_include_engagement_hook : true,
        creativity_level: typeof data.creativity_level === "number" ? data.creativity_level : 7,
        prompt_config: data.prompt_config || prev.prompt_config,
      }))

      setShowStyleExtractor(false)
      setSamplePostsInput("")
      toast.success("Style analyzed! Persona DNA and voice directives auto-filled below.")
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to analyze writing style."))
    } finally {
      setExtractingStyle(false)
    }
  }

  async function handleSavePersona() {
    if (!selectedPage?.id) {
      return toast.error("Connect a Facebook Page first before saving.")
    }
    if (!activeDraft.niche?.trim()) {
      return toast.error("Please enter a niche or audience focus.")
    }

    setSaving(true)
    try {
      const payload = {
        ...activeDraft,
        persona_name: activeDraft.persona_name?.trim() || "Untitled Persona",
        niche: activeDraft.niche.trim(),
        tone_tags: Array.isArray(activeDraft.tone_tags) && activeDraft.tone_tags.length ? activeDraft.tone_tags : ["Professional"],
        assigned_days: activeDraft.assigned_days || ["Mon", "Wed", "Fri"],
        posting_time_slots: activeDraft.posting_time_slots || ["09:00"],
      }

      if (activeDraft.id) {
        await api.put(`/api/ai/personas/${activeDraft.id}`, payload)
        toast.success("Persona updated successfully!")
      } else {
        await api.post(`/api/ai/personas/${selectedPage.id}`, payload)
        toast.success("New Persona created and assigned to page!")
      }

      await loadPersonas()
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to save persona."))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePersona() {
    if (!activeDraft.id) {
      // Discarding new draft
      if (personas.length > 0) {
        setSelectedPersonaIndex(0)
        setActiveDraft(personas[0])
      } else {
        setActiveDraft(createBlankPersona())
      }
      return
    }

    if (!window.confirm(`Delete persona "${activeDraft.persona_name}"?`)) return

    setDeleting(true)
    try {
      await api.delete(`/api/ai/personas/${activeDraft.id}`)
      toast.success("Persona deleted.")
      await loadPersonas()
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to delete persona."))
    } finally {
      setDeleting(false)
    }
  }

  function handleTestInCreatePost() {
    if (!activeDraft) return
    if (onTestPersona) {
      onTestPersona(activeDraft as AIPersona)
    } else {
      router.push(
        `/dashboard/create?persona_id=${activeDraft.id || ""}&topic=${encodeURIComponent(
          activeDraft.niche || activeDraft.persona_name || "Trending Topic"
        )}`
      )
    }
  }

  function handleTestInMemeStudio() {
    router.push(`/dashboard/memes?persona_id=${activeDraft.id || ""}`)
  }

  // Simulated copy for the Live Facebook Mockup
  const simulatedPostText = React.useMemo(() => {
    const tones = Array.isArray(activeDraft.tone_tags) && activeDraft.tone_tags.length
      ? activeDraft.tone_tags.join(" & ")
      : "Engaging"
    const niche = activeDraft.niche?.trim() || "modern business, social strategy, and value delivery"

    if (activeDraft.content_mode === "meme") {
      return `That moment when you apply the "${activeDraft.persona_name || "Viral Persona"}" strategy and the post gets 10x more reach than expected 🚀\n\nWhen the audience finally connects with your content:\n\n#${(activeDraft.persona_name || "Meme").replace(/[^a-zA-Z0-9]/g, "")} #Relatable`
    }

    return `Here is what nobody tells you about ${niche}:\n\n1. Focus on relentless consistency over sporadic perfection.\n2. Speak directly to one person with a ${tones.toLowerCase()} voice.\n3. Always deliver tangible value before asking for action.\n\nWhat has been your biggest breakthrough with this? Drop your thoughts below! 👇\n\n#${(activeDraft.persona_name || "Growth").replace(/[^a-zA-Z0-9]/g, "")} #Strategy #ContentCreator`
  }, [activeDraft])

  return (
    <div className="grid gap-6">
      {/* Main Studio 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column (7 cols): Persona Tabs, Editor & Sticky Action Bar */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Top Persona Switcher Bar */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              {loadingPersonas ? (
                <div className="flex items-center gap-2 py-1 px-3 text-xs text-slate-400">
                  <Loader2 className="size-3.5 animate-spin" /> Loading Personas...
                </div>
              ) : (
                personas.map((p, idx) => {
                  const isSelected = selectedPersonaIndex === idx
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPersona(p, idx)}
                      className={cn(
                        "text-xs font-semibold px-3 py-1.5 rounded-full transition-all border shrink-0 flex items-center gap-1.5 shadow-2xs",
                        isSelected
                          ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                          : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                      )}
                    >
                      <span>{p.content_mode === "meme" ? "😂" : (p.content_mode === "hybrid" ? "⚡" : "📝")}</span>
                      <span>{p.persona_name}</span>
                    </button>
                  )
                })
              )}
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleNewPersona}
              className={cn(
                "h-8 text-xs font-bold shrink-0 shadow-xs",
                selectedPersonaIndex === -1
                  ? "bg-purple-700 text-white"
                  : "bg-white text-purple-700 border border-purple-200 hover:bg-purple-50"
              )}
            >
              <Plus className="size-3.5 mr-1" />
              New Persona
            </Button>
          </div>

          {/* 1. Persona Identity & Mode Card / Style Analyzer */}
          {showStyleExtractor ? (
            /* Dedicated Style Analyzer Screen UI */
            <Card className="shadow-xs border border-purple-300 bg-white animate-in fade-in duration-200">
              <CardHeader className="pb-3 border-b border-purple-100 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-purple-50 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-md bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <Wand2 className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">
                        Style Analyzer — Extract Persona from Posts
                      </CardTitle>
                      <CardDescription className="text-xs text-purple-700 font-medium">
                        Paste your sample writing to automatically clone your voice, tone, and formatting habits.
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowStyleExtractor(false)}
                    className="text-xs text-slate-500 h-7"
                  >
                    Back to Manual Form
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 grid gap-4">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700">Your Sample Writing</Label>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {samplePostsInput.trim()
                        ? `${samplePostsInput.trim().split(/\s+/).length} words · ${samplePostsInput.split(/\n\n+/).filter((p) => p.trim()).length} post(s)`
                        : "Paste 1 or more posts separated by a blank line"}
                    </span>
                  </div>
                  <Textarea
                    value={samplePostsInput}
                    onChange={(e) => setSamplePostsInput(e.target.value)}
                    placeholder="Paste 1 or more of your real social-media posts or articles here..."
                    className="min-h-[160px] text-xs bg-white resize-y shadow-inner"
                    disabled={extractingStyle}
                  />
                </div>

                {/* Sample Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                    <Zap className="size-3 text-purple-600" />
                    Try Samples:
                  </span>
                  {SAMPLE_POST_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSamplePostsInput(preset.content)}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowStyleExtractor(false)}
                    className="text-xs text-slate-600 h-8"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="button"
                    onClick={handleExtractFromPosts}
                    disabled={extractingStyle || !samplePostsInput.trim()}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold h-9 text-xs shadow-xs px-5"
                  >
                    {extractingStyle ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        Analyzing Style &amp; Building Persona...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5 mr-1.5" />
                        Analyze &amp; Auto-Fill Persona
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Manual Persona Form Card */}
              <Card className="shadow-xs border border-purple-200 bg-white">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-purple-600" />
                      Persona Identity &amp; Voice
                    </Label>
                    <PageSelector
                      pages={pages}
                      selectedPageId={selectedPageId}
                      onSelectPageId={(id) => {
                        setSelectedPageId(id)
                        setActivePageId(id)
                      }}
                      size="sm"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 grid gap-4">
                  {/* Style Extractor Button (Only visible when creating a new persona) */}
                  {!activeDraft.id && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r from-purple-50 via-indigo-50/60 to-purple-50 border border-purple-200 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <Wand2 className="size-4 text-purple-600" />
                        <span className="text-xs font-bold text-purple-950">
                          Want to clone your writing style automatically?
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowStyleExtractor(true)}
                        className="h-7 text-xs bg-white text-purple-700 border-purple-300 hover:bg-purple-100 font-semibold"
                      >
                        <Sparkles className="size-3 mr-1" />
                        Extract from Posts
                      </Button>
                    </div>
                  )}

                  {/* Persona Name */}
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Persona Name</Label>
                    <Input
                      value={activeDraft.persona_name || ""}
                      onChange={(e) => setActiveDraft({ ...activeDraft, persona_name: e.target.value })}
                      placeholder="e.g. Nature Science Communicator, Tech Founder..."
                      className="h-9 text-xs"
                    />
                  </div>

                  {/* Content Type Selector */}
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Generation Content Mode</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "standard", label: "📝 Standard Posts", desc: "Thought leadership & posters" },
                        { id: "meme", label: "😂 Viral Memes", desc: "Workplace satire & scenarios" },
                        { id: "hybrid", label: "⚡ Hybrid (50/50)", desc: "Mix of posters & memes" },
                      ].map((mode) => {
                        const isSelected = (activeDraft.content_mode || "standard") === mode.id
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setActiveDraft({ ...activeDraft, content_mode: mode.id as any })}
                            className={cn(
                              "p-2.5 rounded-lg border text-left transition-all",
                              isSelected
                                ? "bg-purple-50 border-purple-600 ring-2 ring-purple-600/20 shadow-xs"
                                : "bg-white border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            <span className="text-xs font-bold text-slate-900 block">{mode.label}</span>
                            <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{mode.desc}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Niche / Topic Focus */}
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Niche &amp; Audience Focus</Label>
                    <Textarea
                      value={activeDraft.niche || ""}
                      onChange={(e) => setActiveDraft({ ...activeDraft, niche: e.target.value })}
                      placeholder="e.g. Educational content about wildlife adaptations and natural phenomena, blending scientific facts with engaging storytelling."
                      className="min-h-[85px] text-xs resize-y"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 2. Voice, Tone & Quick Presets Card */}
              <Card className="shadow-xs border border-slate-200 bg-white">
                <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold text-slate-800">Tone Tags &amp; Quick Presets</CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                      className="text-xs text-slate-600 font-semibold h-7"
                    >
                      <Settings2 className="size-3 mr-1" />
                      Advanced Rules
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 grid gap-4">
                  {/* Quick Preset Chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                      <Zap className="size-3 text-purple-600" />
                      Presets:
                    </span>
                    {QUICK_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>

                  {/* Selectable Tone Chips */}
                  <div className="grid gap-1.5 pt-1 border-t border-slate-100">
                    <Label className="text-xs font-semibold text-slate-700">Voice Tone Tags (Select up to 4)</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {AVAILABLE_TONES.map((tone) => {
                        const isSelected = Array.isArray(activeDraft.tone_tags) && activeDraft.tone_tags.includes(tone)
                        return (
                          <button
                            key={tone}
                            type="button"
                            onClick={() => toggleTone(tone)}
                            className={cn(
                              "text-xs font-medium px-2.5 py-1 rounded-full border transition-all",
                              isSelected
                                ? "bg-purple-600 text-white border-purple-600 font-semibold shadow-xs"
                                : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                            )}
                          >
                            {tone}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Advanced Settings Collapsible */}
                  {isAdvancedOpen && (
                    <div className="pt-3 mt-1 border-t border-slate-100 grid gap-4 animate-in fade-in duration-200 slide-in-from-top-3">
                      {/* Custom Directives */}
                      <div className="grid gap-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Custom Stylistic Instructions</Label>
                        <Textarea
                          value={activeDraft.custom_instructions || ""}
                          onChange={(e) => setActiveDraft({ ...activeDraft, custom_instructions: e.target.value })}
                          placeholder="e.g. Always use bullet points, avoid corporate jargon, open with a provocative question..."
                          className="min-h-[75px] text-xs resize-y"
                        />
                      </div>

                      {/* Posting Days */}
                      <div className="grid gap-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Assigned Autonomous Posting Days</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {WEEK_DAYS.map((day) => {
                            const isDayActive = Array.isArray(activeDraft.assigned_days) && activeDraft.assigned_days.includes(day)
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleDay(day)}
                                className={cn(
                                  "text-xs font-medium px-2.5 py-1 rounded-md border transition-all",
                                  isDayActive
                                    ? "bg-purple-700 text-white border-purple-700 font-semibold"
                                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                                )}
                              >
                                {day}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Switches */}
                      <div className="grid sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="persona-hashtags" className="text-xs font-medium cursor-pointer">
                            Enable Automatic Hashtags
                          </Label>
                          <Switch
                            id="persona-hashtags"
                            checked={activeDraft.hashtags_enabled ?? true}
                            onCheckedChange={(val) => setActiveDraft({ ...activeDraft, hashtags_enabled: val })}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="persona-cta" className="text-xs font-medium cursor-pointer">
                            Always Include CTA Hook
                          </Label>
                          <Switch
                            id="persona-cta"
                            checked={activeDraft.always_include_engagement_hook ?? true}
                            onCheckedChange={(val) => setActiveDraft({ ...activeDraft, always_include_engagement_hook: val })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* 3. Sticky Action Bar: Delete, Test in Create, Save Persona */}
          <div className="sticky bottom-4 z-40 mt-auto bg-white/95 backdrop-blur-md border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.12)] px-4 py-2.5 rounded-xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeletePersona}
                disabled={deleting}
                className="text-red-600 hover:bg-red-50 hover:border-red-200 shadow-xs text-xs h-8"
              >
                <Trash2 className="size-3.5 mr-1" />
                {activeDraft.id ? "Delete" : "Discard"}
              </Button>

              {(activeDraft.content_mode === "meme" || activeDraft.content_mode === "hybrid") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestInMemeStudio}
                  className="text-pink-700 border-pink-200 hover:bg-pink-50 shadow-xs text-xs h-8"
                >
                  <Laugh className="size-3.5 mr-1 text-pink-600" />
                  Meme Studio
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleTestInCreatePost}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold shadow-xs text-xs h-8"
              >
                <Send className="size-3.5 mr-1.5" />
                Test in Create Post
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleSavePersona}
                disabled={saving}
                className="bg-purple-700 hover:bg-purple-800 text-white font-semibold shadow-xs text-xs h-8"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="size-3.5 mr-1.5" />
                    Save AI Persona
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
              Live Persona Voice Simulation
            </span>
            <Badge variant="outline" className="text-[10px] text-slate-500 font-normal">
              Voice Simulation
            </Badge>
          </div>

          {/* Genuine Facebook Post Card */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all">
            {/* Facebook Post Header */}
            <div className="flex items-center justify-between p-3.5 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden ring-1 ring-slate-100 shrink-0">
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
            <div className="px-3.5 py-2 text-xs leading-relaxed text-slate-900 whitespace-pre-wrap min-h-[120px]">
              {simulatedPostText.split(" ").map((word, i) => {
                if (word.startsWith("#")) {
                  return (
                    <span key={i} className="text-[#1877F2] font-medium hover:underline cursor-pointer">
                      {word}{" "}
                    </span>
                  )
                }
                return word + " "
              })}
            </div>

            {/* Persona Traits Match Footer */}
            <div className="border-t border-slate-100 bg-gradient-to-r from-purple-50 to-indigo-50/70 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-purple-600 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-purple-900 block leading-tight">
                    {activeDraft.persona_name || "Custom Persona"}
                  </span>
                  <span className="text-[10px] text-purple-700">
                    {activeDraft.content_mode === "meme" ? "Viral Humor Satire" : (activeDraft.content_mode === "hybrid" ? "Hybrid Mixed Mode" : "High-Converting Standard")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {(Array.isArray(activeDraft.tone_tags) ? activeDraft.tone_tags : []).slice(0, 2).map((tone) => (
                  <span key={tone} className="text-[10px] font-semibold text-purple-800 bg-white px-2 py-0.5 rounded border border-purple-200 shadow-2xs">
                    {tone}
                  </span>
                ))}
              </div>
            </div>

            {/* Facebook Engagement Counters */}
            <div className="flex items-center justify-between px-3.5 py-2 text-[11px] text-slate-500 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="flex size-4 items-center justify-center rounded-full bg-blue-500 text-white text-[9px]">
                  👍
                </span>
                <span>218</span>
              </div>
              <div className="flex items-center gap-3">
                <span>46 comments</span>
                <span>19 shares</span>
              </div>
            </div>

            {/* Facebook Action Buttons */}
            <div className="grid grid-cols-3 p-1 text-slate-600 text-xs font-semibold border-t border-slate-100">
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
    </div>
  )
}
