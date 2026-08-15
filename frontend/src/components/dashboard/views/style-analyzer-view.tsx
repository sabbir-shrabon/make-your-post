"use client"

import * as React from "react"

import {
  PageConnection, Post, AIPersona, PromptStudioConfig, PerformanceInsights,
  Analytics, DashboardIntelligence, StyleAnalysis, TrackerDashboard, ScheduledSlotItem, GlobalModelSettings
} from "@/types/models"
import { PageTitle, PageMini, PageStatusBadge, formatDate, todayLabel, isPastScheduledSlot, slotStatusClass, MiniBars, emptySchedule, scheduleDayLabel, activeDaysToAbbrev, abbrevDaysToFull, scheduleFromLegacyPersona, LearnedInsightsPanel, ConnectEmpty, FacebookConnectButton, Stat, PostRow, Empty, SkeletonPage, badgeClass } from "@/components/dashboard/shared/dashboard-ui"

import { useRouter } from "next/navigation"
import { Sparkles, CheckCircle2, ArrowRight, Save, RotateCcw, Target, BookOpen, Layers, MessageSquareQuote } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"


export function StyleAnalyzerView({ pages }: { pages: PageConnection[] }) {
  const router = useRouter()
  const [step, setStep] = StepState()
  const [primaryPost, setPrimaryPost] = React.useState("")
  const [extraPosts, setExtraPost] = React.useState("")
  const [loadingStep, setLoadingStep] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = React.useState<any | null>(null)
  const [savingQuick, setSavingQuick] = React.useState(false)

  const activePage = pages.find((p) => p.connection_status === "connected") || pages[0]

  function StepState() {
    return React.useState<"input" | "more_posts" | "analyzing" | "result">("input")
  }

  React.useEffect(() => {
    if (step !== "analyzing") { setLoadingStep(""); return }
    const steps = [
      "Reading your writing style...",
      "Detecting tone and patterns...",
      "Identifying your content topics...",
      "Mapping your audience signals...",
      "Building your persona profile...",
    ]
    let i = 0
    setLoadingStep(steps[0])
    const interval = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1)
      setLoadingStep(steps[i])
    }, 2200)
    return () => clearInterval(interval)
  }, [step])

  async function startAnalysis() {
    if (!primaryPost.trim()) return toast.error("Please paste at least one post first.")
    setStep("more_posts")
  }

  async function runAnalysis(skipExtra = false) {
    setStep("analyzing")
    setError(null)
    try {
      const allPosts = [primaryPost.trim()]
      if (!skipExtra && extraPosts.trim()) {
        const extras = extraPosts.split(/\n\n+/).filter((p) => p.trim())
        allPosts.push(...extras)
      }
      const response = await api.post("/api/ai/generate-persona-from-posts", { posts: allPosts })
      setAnalysisResult(response.data)
      localStorage.setItem("ai_persona_prefill", JSON.stringify(response.data))
      setStep("result")
      toast.success("Persona DNA successfully generated!")
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Could not generate persona. Check your AI model in Settings and try again.")
      setStep("input")
    }
  }

  async function quickSavePersona() {
    if (!activePage?.id) {
      toast.error("Please connect a Facebook Page first in Settings.")
      return
    }
    if (!analysisResult) return
    setSavingQuick(true)
    try {
      const payload = {
        persona_name: analysisResult.persona_name || "Style Analyzer Persona",
        niche: analysisResult.niche || "General Content",
        tone_tags: Array.isArray(analysisResult.tone_tags) && analysisResult.tone_tags.length ? analysisResult.tone_tags : ["Professional"],
        custom_instructions: analysisResult.custom_instructions || null,
        hashtags_enabled: typeof analysisResult.hashtags_enabled === "boolean" ? analysisResult.hashtags_enabled : false,
        hashtag_count: typeof analysisResult.hashtag_count === "number" ? analysisResult.hashtag_count : 3,
        always_include_engagement_hook: typeof analysisResult.always_include_engagement_hook === "boolean" ? analysisResult.always_include_engagement_hook : false,
        creativity_level: typeof analysisResult.creativity_level === "number" ? analysisResult.creativity_level : 7,
        language: analysisResult.language || "English",
        assigned_days: ["Mon", "Wed", "Fri"],
        posting_time_slots: ["09:00"],
        prompt_config: analysisResult.prompt_config || {},
      }
      await api.post(`/api/ai/personas/${activePage.id}`, payload)
      localStorage.removeItem("ai_persona_prefill")
      toast.success("Persona created & saved to your page schedule (Mon, Wed, Fri at 9:00 AM)!")
      router.push("/dashboard/ai-settings")
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not save persona automatically.")
    } finally {
      setSavingQuick(false)
    }
  }

  function openInPromptStudio() {
    if (analysisResult) {
      localStorage.setItem("ai_persona_prefill", JSON.stringify(analysisResult))
    }
    router.push("/dashboard/ai-settings")
  }

  if (step === "analyzing") {
    return (
      <>
        <PageTitle title="Style Analyzer" subtitle="Analyzing your posts and building your AI persona…" aiPowered />
        <Card>
          <CardContent className="flex flex-col items-center gap-8 py-16">
            <div className="size-20 rounded-full bg-purple-100 flex items-center justify-center">
              <Sparkles className="size-9 text-purple-600 animate-pulse" />
            </div>
            <div className="text-center grid gap-2">
              <p className="text-lg font-semibold text-slate-800">{loadingStep}</p>
              <p className="text-sm text-slate-500">This usually takes 10–20 seconds…</p>
            </div>
            <div className="w-full max-w-xs h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-2 bg-purple-600 rounded-full animate-pulse" style={{ width: "65%" }} />
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  if (step === "result" && analysisResult) {
    const config = analysisResult.prompt_config || {}
    return (
      <>
        <PageTitle 
          title="Persona DNA Extracted" 
          subtitle="Your writing style has been analyzed. You can fine-tune it in Prompt Studio or save it directly." 
          aiPowered 
        />

        <div className="grid gap-6">
          {/* Main Summary Header */}
          <Card className="border-purple-200 bg-purple-50/50">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">Generated Profile</span>
                  <CardTitle className="text-2xl mt-1 flex items-center gap-2">
                    <Sparkles className="size-6 text-purple-600" />
                    {analysisResult.persona_name}
                  </CardTitle>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setStep("input")}>
                    <RotateCcw className="size-4 mr-2" />
                    Analyze Another
                  </Button>
                  <Button variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-100" onClick={openInPromptStudio}>
                    <ArrowRight className="size-4 mr-2" />
                    Open in Prompt Studio
                  </Button>
                  <Button className="bg-purple-700 hover:bg-purple-800" onClick={quickSavePersona} disabled={savingQuick}>
                    <Save className="size-4 mr-2" />
                    {savingQuick ? "Saving..." : "Quick-Save to Page"}
                  </Button>
                </div>
              </div>
              <CardDescription className="text-slate-600 text-sm mt-2">
                {analysisResult.niche}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* DNA Traits Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Tone Traits */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                  <Sparkles className="size-4 text-purple-600" />
                  Detected Tone & Style
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {(analysisResult.tone_tags || []).map((tone: string) => (
                    <span key={tone} className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-800">
                      {tone}
                    </span>
                  ))}
                </div>
                {analysisResult.custom_instructions && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100 italic">
                    "{analysisResult.custom_instructions}"
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Target Audience & Goal */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                  <Target className="size-4 text-blue-600" />
                  Audience & Strategy
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm text-slate-600">
                <p><strong>Audience:</strong> {config.audience || "General Social Audience"}</p>
                <p><strong>Goal:</strong> {config.goal || "Engagement & Community"}</p>
                <p><strong>Creativity:</strong> {analysisResult.creativity_level || 7}/10</p>
              </CardContent>
            </Card>

            {/* Structure & Content */}
            <Card className="md:col-span-2 lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                  <Layers className="size-4 text-emerald-600" />
                  Content Pattern
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm text-slate-600">
                <p><strong>Structure:</strong> {config.structure || "Hook -> Value -> CTA"}</p>
                <p><strong>Hashtags:</strong> {analysisResult.hashtags_enabled ? `${analysisResult.hashtag_count || 3} relevant tags` : "Disabled"}</p>
                <p><strong>Engagement Hook:</strong> {analysisResult.always_include_engagement_hook ? "Always included" : "Optional"}</p>
              </CardContent>
            </Card>
          </div>

          {/* Topics & Elements */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                  <BookOpen className="size-4 text-indigo-600" />
                  Core Content Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(config.always_topics || []).map((topic: string) => (
                    <span key={topic} className="rounded-md bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
                      {topic}
                    </span>
                  ))}
                  {(!config.always_topics || !config.always_topics.length) && (
                    <p className="text-xs text-slate-500">Universal niche topics identified.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                  <MessageSquareQuote className="size-4 text-amber-600" />
                  Post Elements Included
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(config.every_post_includes || []).map((item: string) => (
                    <span key={item} className="rounded-md bg-amber-50 border border-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                      {item}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageTitle title="Style Analyzer" subtitle="Paste your posts and let the AI build a persona that perfectly matches your writing style." aiPowered />

      {step === "more_posts" ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-purple-600" />
                Want a more accurate persona?
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="text-sm text-slate-600">
                Your first post is ready. Add more sample posts below (optional) — the more examples you provide, the sharper and more tailored your generated persona will be.
              </p>
              <p className="text-xs text-slate-400">Tip: Separate each post with a blank line.</p>
              <Textarea
                className="min-h-44"
                placeholder={"Post 2 content...\n\nPost 3 content...\n\nPost 4 content..."}
                value={extraPosts}
                onChange={(e) => setExtraPost(e.target.value)}
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button id="run-analysis-btn" className="flex-1 bg-purple-700 hover:bg-purple-800" onClick={() => runAnalysis(false)}>
                  <Sparkles className="size-4 mr-2" />
                  {extraPosts.trim() ? "Add More & Analyze" : "Analyze Now"}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => runAnalysis(true)}>
                  Skip, Analyze with 1 Post
                </Button>
                <Button variant="ghost" onClick={() => setStep("input")}>Back</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Paste Your Post(s)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-slate-500">
            Paste one or more of your real social-media posts. The AI will analyze tone, topics, audience, structure, and writing patterns — then automatically build a complete AI persona in Prompt Studio.
          </p>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}
          <Textarea
            id="style-analyzer-input"
            className="min-h-52"
            placeholder={"Paste your post here…\n\nYou can also paste multiple posts — just leave a blank line between each one."}
            value={primaryPost}
            onChange={(e) => setPrimaryPost(e.target.value)}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              {primaryPost.trim()
                ? `${primaryPost.trim().split(/\s+/).length} words · ${primaryPost.split(/\n\n+/).filter((p) => p.trim()).length} post(s) detected`
                : "Paste your content above to get started"}
            </p>
            <Button
              id="analyze-style-btn"
              className="bg-purple-700 hover:bg-purple-800"
              onClick={startAnalysis}
              disabled={!primaryPost.trim()}
            >
              <Sparkles className="size-4 mr-2" />
              Analyze &amp; Build Persona
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-4 text-sm text-slate-600">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 size-6 rounded-full bg-purple-100 text-purple-700 font-semibold text-xs flex items-center justify-center mt-0.5">1</span>
              <span>Paste one or more of your real posts. The AI reads the tone, rhythm, topics, and patterns across everything you share.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 size-6 rounded-full bg-purple-100 text-purple-700 font-semibold text-xs flex items-center justify-center mt-0.5">2</span>
              <span>Optionally add more posts for a richer sample — more examples = sharper persona with better audience targeting.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 size-6 rounded-full bg-purple-100 text-purple-700 font-semibold text-xs flex items-center justify-center mt-0.5">3</span>
              <span>A complete AI persona is generated with full DNA breakdown. Fine-tune in Prompt Studio or assign directly to your posting calendar.</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </>
  )
}
