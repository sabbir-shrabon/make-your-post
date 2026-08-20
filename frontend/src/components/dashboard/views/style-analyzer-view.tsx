"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Save,
  RotateCcw,
  Target,
  BookOpen,
  Layers,
  MessageSquareQuote,
  Send,
  Calendar,
  Globe,
  MoreHorizontal,
  ThumbsUp,
  MessageSquare,
  Share2,
  Settings2,
  Zap,
  Edit3,
  Sliders,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { api, getApiErrorMessage } from "@/lib/api"
import { PageConnection } from "@/types/models"
import { toast } from "sonner"

const SAMPLE_PRESETS = [
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

export function StyleAnalyzerView({
  pages = [],
  onUseInComposer,
  onOpenPromptStudio,
}: {
  pages?: PageConnection[]
  onUseInComposer?: (promptText: string) => void
  onOpenPromptStudio?: () => void
}) {
  const router = useRouter()
  const [selectedPageId, setSelectedPageId] = useState<number | null>(
    pages.find((p) => p.connection_status === "connected")?.id ?? pages[0]?.id ?? null
  )
  const selectedPage = pages.find((p) => p.id === selectedPageId) || pages[0]

  const [primaryPost, setPrimaryPost] = useState("")
  const [extraPosts, setExtraPosts] = useState("")
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [loadingStep, setLoadingStep] = useState("")
  const [analysisResult, setAnalysisResult] = useState<any | null>(null)
  const [savingQuick, setSavingQuick] = useState(false)

  // Animated loading step ticker
  useEffect(() => {
    if (!analyzing) {
      setLoadingStep("")
      return
    }
    const steps = [
      "Reading writing rhythm and structure...",
      "Detecting vocabulary, tone, and formatting...",
      "Mapping core topics & audience signals...",
      "Synthesizing unique Persona DNA profile...",
    ]
    let i = 0
    setLoadingStep(steps[0])
    const interval = setInterval(() => {
      i = (i + 1) % steps.length
      setLoadingStep(steps[i])
    }, 2000)
    return () => clearInterval(interval)
  }, [analyzing])

  async function handleAnalyze() {
    if (!primaryPost.trim()) {
      return toast.error("Please paste at least one sample post first.")
    }

    setAnalyzing(true)
    setAnalysisResult(null)

    try {
      const allPosts = [primaryPost.trim()]
      if (extraPosts.trim()) {
        const extras = extraPosts.split(/\n\n+/).filter((p) => p.trim())
        allPosts.push(...extras)
      }

      const response = await api.post("/api/ai/generate-persona-from-posts", { posts: allPosts })
      setAnalysisResult(response.data)
      localStorage.setItem("ai_persona_prefill", JSON.stringify(response.data))
      toast.success("Persona DNA analyzed & extracted successfully!")
    } catch (err: any) {
      toast.error(
        getApiErrorMessage(err, "Could not analyze style. Please verify your AI API key and try again.")
      )
    } finally {
      setAnalyzing(false)
    }
  }

  async function quickSavePersona() {
    if (!selectedPage?.id) {
      return toast.error("Connect a Facebook Page before saving personas.")
    }
    if (!analysisResult) return

    setSavingQuick(true)
    try {
      const payload = {
        persona_name: analysisResult.persona_name || "Style Analyzer Persona",
        niche: analysisResult.niche || "General Content",
        tone_tags:
          Array.isArray(analysisResult.tone_tags) && analysisResult.tone_tags.length
            ? analysisResult.tone_tags
            : ["Professional"],
        custom_instructions: analysisResult.custom_instructions || null,
        hashtags_enabled:
          typeof analysisResult.hashtags_enabled === "boolean"
            ? analysisResult.hashtags_enabled
            : false,
        hashtag_count:
          typeof analysisResult.hashtag_count === "number" ? analysisResult.hashtag_count : 3,
        always_include_engagement_hook:
          typeof analysisResult.always_include_engagement_hook === "boolean"
            ? analysisResult.always_include_engagement_hook
            : false,
        creativity_level:
          typeof analysisResult.creativity_level === "number"
            ? analysisResult.creativity_level
            : 7,
        language: analysisResult.language || "English",
        assigned_days: ["Mon", "Wed", "Fri"],
        posting_time_slots: ["09:00"],
        prompt_config: analysisResult.prompt_config || {},
      }
      await api.post(`/api/ai/personas/${selectedPage.id}`, payload)
      localStorage.removeItem("ai_persona_prefill")
      toast.success("Persona saved to page successfully!")
      router.push("/dashboard/ai-settings")
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Could not save persona automatically."))
    } finally {
      setSavingQuick(false)
    }
  }

  function handleUseInComposer() {
    if (!analysisResult) return
    const tones = Array.isArray(analysisResult.tone_tags) ? analysisResult.tone_tags.join(", ") : ""
    const niche = analysisResult.niche || ""
    const promptSummary = `Write an engaging post about ${niche}. Tone: ${tones}. Style: ${
      analysisResult.custom_instructions || "Direct, clear, high-value"
    }`
    if (onUseInComposer) {
      onUseInComposer(promptSummary)
    } else {
      router.push(`/dashboard/create?topic=${encodeURIComponent(niche)}`)
    }
  }

  function openInPromptStudio() {
    if (analysisResult) {
      localStorage.setItem("ai_persona_prefill", JSON.stringify(analysisResult))
    }
    if (onOpenPromptStudio) {
      onOpenPromptStudio()
    } else {
      router.push("/dashboard/ai-settings")
    }
  }

  function resetAnalysis() {
    setAnalysisResult(null)
    setPrimaryPost("")
    setExtraPosts("")
  }

  const wordCount = primaryPost.trim() ? primaryPost.trim().split(/\s+/).length : 0
  const postCount = primaryPost.trim()
    ? primaryPost.split(/\n\n+/).filter((p) => p.trim()).length
    : 0

  // Mock sample post preview text based on detected DNA
  const sampleSimulatedCopy = analysisResult
    ? `${analysisResult.prompt_config?.examples || primaryPost.trim() || `Here is a high-converting sample post crafted specifically for ${analysisResult.niche || "your audience"}.\n\nIt follows the ${analysisResult.prompt_config?.structure || "Hook -> Value -> CTA"} framework with a ${Array.isArray(analysisResult.tone_tags) ? analysisResult.tone_tags.join(" & ") : "distinct"} tone.`}\n\n${
        analysisResult.hashtags_enabled
          ? (analysisResult.prompt_config?.always_topics || ["Strategy", "Growth"])
              .slice(0, analysisResult.hashtag_count || 3)
              .map((t: string) => `#${t.replace(/[^a-zA-Z0-9]/g, "")}`)
              .join(" ")
          : ""
      }`
    : ""

  return (
    <div className="grid gap-6">
      {/* Main Studio 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column (7 cols): Input, Analysis & Persistent 1-Line Action Bar */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* 1. Writing Samples Input Card */}
          <Card className="shadow-xs border border-purple-200 bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50 rounded-t-xl">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-purple-600" />
                  Writing Samples &amp; Style Input
                </Label>
                <div className="w-44">
                  <Select
                    value={selectedPageId ? String(selectedPageId) : ""}
                    onChange={(e) => setSelectedPageId(e.target.value ? Number(e.target.value) : null)}
                    className="h-8 text-xs font-semibold bg-white border-slate-200"
                  >
                    <option value="">Auto (Default Page)</option>
                    {pages.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.page_name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 grid gap-4">
              <div className="relative">
                <Textarea
                  value={primaryPost}
                  onChange={(e) => setPrimaryPost(e.target.value)}
                  placeholder="Paste 1 or more real posts here... (Separate multiple posts with a blank line)"
                  className="w-full min-h-[140px] text-sm p-3 rounded-md border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 resize-none shadow-inner"
                  disabled={analyzing}
                />
              </div>

              {/* Quick Sample Preset Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                  <Zap className="size-3 text-purple-500" />
                  Try Samples:
                </span>
                {SAMPLE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrimaryPost(preset.content)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                    className="text-xs text-slate-600 font-semibold"
                  >
                    <Settings2 className="size-3.5 mr-1.5" />
                    Advanced Samples
                  </Button>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {primaryPost.trim()
                      ? `${wordCount} words · ${postCount} post${postCount > 1 ? "s" : ""}`
                      : "Paste writing samples above"}
                  </span>
                </div>

                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing || !primaryPost.trim()}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold h-9 shadow-xs px-5 text-xs"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      Analyzing Style...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5 mr-1.5" />
                      Extract Persona DNA
                    </>
                  )}
                </Button>
              </div>

              {/* Advanced Samples Collapsible */}
              {isAdvancedOpen && (
                <div className="pt-3 border-t border-slate-100 grid gap-2 animate-in fade-in duration-200 slide-in-from-top-3">
                  <Label className="text-xs font-bold uppercase text-slate-600">
                    Additional Context / Extra Posts (Optional)
                  </Label>
                  <Textarea
                    value={extraPosts}
                    onChange={(e) => setExtraPosts(e.target.value)}
                    placeholder="Paste additional sample posts, comments, or emails for a richer sample profile..."
                    className="min-h-[90px] text-xs"
                    disabled={analyzing}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Extracted Persona DNA Profile Card (When analyzed) */}
          {analysisResult && (
            <Card className="shadow-xs border border-purple-200 bg-white animate-in fade-in duration-300">
              <CardHeader className="py-3 px-4 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-md bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <Sparkles className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold leading-5 text-slate-900">
                        {analysisResult.persona_name || "Custom Style Persona"}
                      </CardTitle>
                      <CardDescription className="text-xs text-purple-700 font-medium">
                        {analysisResult.niche || "General Content Strategy"}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-purple-700 text-white text-[10px]">
                    Creativity: {analysisResult.creativity_level || 7}/10
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 grid gap-4">
                {/* Tone Tags */}
                <div className="grid gap-1.5">
                  <Label className="text-[11px] font-bold uppercase text-slate-600">Detected Tone &amp; Voice</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(analysisResult.tone_tags || []).map((tone: string) => (
                      <span
                        key={tone}
                        className="rounded-full bg-purple-100 border border-purple-200 px-2.5 py-0.5 text-xs font-semibold text-purple-800 shadow-xs"
                      >
                        {tone}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Custom Stylistic Directives */}
                {analysisResult.custom_instructions && (
                  <div className="grid gap-1.5">
                    <Label className="text-[11px] font-bold uppercase text-slate-600">Style &amp; Formatting Habits</Label>
                    <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 italic leading-relaxed">
                      "{analysisResult.custom_instructions}"
                    </p>
                  </div>
                )}

                {/* Strategy Breakdown Grid */}
                <div className="grid sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100 text-xs text-slate-600">
                  <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <Target className="size-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-800 block">Audience &amp; Goal:</span>
                      <span className="text-[11px] text-slate-500">
                        {analysisResult.prompt_config?.audience || "Social followers"} ·{" "}
                        {analysisResult.prompt_config?.goal || "Engagement"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <Layers className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-800 block">Content Structure:</span>
                      <span className="text-[11px] text-slate-500">
                        {analysisResult.prompt_config?.structure || "Hook -> Value -> CTA"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Core Topics */}
                {analysisResult.prompt_config?.always_topics && (
                  <div className="grid gap-1.5 pt-1 border-t border-slate-100">
                    <Label className="text-[11px] font-bold uppercase text-slate-600">Core Content Pillars</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {analysisResult.prompt_config.always_topics.map((t: string) => (
                        <span
                          key={t}
                          className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 3. Always Visible 1-Line Sticky Action Bar */}
          <div className="sticky bottom-4 z-40 mt-auto bg-white/95 backdrop-blur-md border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.12)] px-4 py-2.5 rounded-xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetAnalysis}
                disabled={!primaryPost.trim() && !analysisResult}
                className="text-slate-700 bg-white shadow-xs text-xs h-8"
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                Clear
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openInPromptStudio}
                className="text-slate-700 bg-white shadow-xs text-xs h-8"
              >
                <Edit3 className="size-3.5 mr-1.5" />
                Personas
              </Button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={quickSavePersona}
                disabled={savingQuick || !analysisResult}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold shadow-xs text-xs h-8"
              >
                {savingQuick ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="size-3.5 mr-1.5" />
                    Save as Persona
                  </>
                )}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleUseInComposer}
                disabled={!analysisResult}
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold shadow-xs text-xs h-8"
              >
                <Send className="size-3.5 mr-1.5" />
                Use in Create Post
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Pure Live Facebook Feed Mockup */}
        <div className="lg:col-span-5 sticky top-6 grid gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Globe className="size-3.5 text-blue-600" />
              Live Style Simulation Mockup
            </span>
            <Badge variant="outline" className="text-[10px] text-slate-500 font-normal">
              Persona Voice Simulation
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
            <div className="px-3.5 py-2 text-xs leading-relaxed text-slate-900 whitespace-pre-wrap min-h-[140px]">
              {analyzing ? (
                <div className="py-6 text-center flex flex-col items-center justify-center gap-2">
                  <Loader2 className="size-5 animate-spin text-purple-600" />
                  <p className="text-xs font-semibold text-slate-700">{loadingStep}</p>
                  <p className="text-[10px] text-slate-400">Synthesizing writing DNA &amp; generating simulation...</p>
                </div>
              ) : sampleSimulatedCopy ? (
                <span>
                  {sampleSimulatedCopy.split(" ").map((word, i) => {
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
                <span className="text-slate-400 italic">
                  Paste sample posts on the left and click "Extract Persona DNA" to see a live simulated post in your writing style...
                </span>
              )}
            </div>

            {/* Simulated Visual Placeholder if Analyzed */}
            {analysisResult && (
              <div className="border-t border-slate-100 bg-gradient-to-r from-purple-50 to-indigo-50/70 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-purple-600 shrink-0" />
                  <span className="text-[11px] font-bold text-purple-900">
                    Style Match: {analysisResult.persona_name}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200">
                  98% DNA Match
                </span>
              </div>
            )}

            {/* Facebook Engagement Counters */}
            <div className="flex items-center justify-between px-3.5 py-2 text-[11px] text-slate-500 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="flex size-4 items-center justify-center rounded-full bg-blue-500 text-white text-[9px]">
                  👍
                </span>
                <span>142</span>
              </div>
              <div className="flex items-center gap-3">
                <span>28 comments</span>
                <span>14 shares</span>
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
