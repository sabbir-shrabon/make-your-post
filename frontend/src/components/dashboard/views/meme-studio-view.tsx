"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Sparkles,
  Laugh,
  Send,
  Calendar,
  Save,
  Loader2,
  RefreshCw,
  FolderPlus,
  Image as ImageIcon,
  Check,
  Flame,
  MessageSquare,
  Share2,
  ThumbsUp,
  Sliders,
  Plus,
  Trash2,
  X,
  Settings2,
  Globe,
  MoreHorizontal,
} from "lucide-react"
import { toast } from "sonner"

import { PageConnection, AIPersona } from "@/types/models"
import { formatDate } from "@/components/dashboard/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/contexts/auth-context"
import { useApp } from "@/contexts/app-context"
import { PageSelector } from "@/components/dashboard/shared/page-selector"
import { axiosInstance } from "@/lib/axios"
import { api, getApiErrorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

export function MemeStudioView({
  pages = [],
}: {
  pages?: PageConnection[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { activePageId, setActivePageId } = useApp()
  const timezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

  const [selectedPageId, setSelectedPageId] = useState<number | null>(
    activePageId ?? pages.find((p) => p.connection_status === "connected")?.id ?? pages[0]?.id ?? null
  )
  const selectedPage = pages.find((p) => p.id === selectedPageId) || pages[0]

  // Personas state
  const [personas, setPersonas] = useState<AIPersona[]>([])
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(null)
  const activePersona = personas.find((p) => p.id === selectedPersonaId) || personas.find((p) => p.content_mode === "meme") || personas[0]

  // Themes state
  const [builtinThemes, setBuiltinThemes] = useState<any[]>([])
  const [customThemes, setCustomThemes] = useState<any[]>([])
  const [selectedThemeId, setSelectedThemeId] = useState<string>("tech-startups")
  const [isCustomTheme, setIsCustomTheme] = useState(false)
  const [loadingThemes, setLoadingThemes] = useState(true)

  // Meme generation form
  const [customPrompt, setCustomPrompt] = useState("")
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [formatStyle, setFormatStyle] = useState<"modern_card" | "classic">("modern_card")
  const [generating, setGenerating] = useState(false)

  // Generated meme output
  const [memeResult, setMemeResult] = useState<any>(null)
  const [editableCaption, setEditableCaption] = useState("")
  const [editableHeadline, setEditableHeadline] = useState("")
  const [editableTopText, setEditableTopText] = useState("")
  const [editableBottomText, setEditableBottomText] = useState("")
  const [reRendering, setReRendering] = useState(false)

  // Publishing & Scheduling state
  const [saving, setSaving] = useState(false)
  const [scheduleLater, setScheduleLater] = useState(false)
  const [scheduleDate, setScheduleDate] = useState("")

  // Custom Theme Creation Modal
  const [isCreateThemeOpen, setIsCreateThemeOpen] = useState(false)
  const [newThemeName, setNewThemeName] = useState("")
  const [newThemeDesc, setNewThemeDesc] = useState("")
  const [newThemeCategory, setNewThemeCategory] = useState("meme")
  const [newThemeImageUrl, setNewThemeImageUrl] = useState("")

  const loadThemes = useCallback(async () => {
    setLoadingThemes(true)
    try {
      const res = await axiosInstance.get("/api/meme/themes")
      setBuiltinThemes(res.data.builtin_themes || [])
      setCustomThemes(res.data.custom_themes || [])
    } catch {
      // Fallback defaults
    } finally {
      setLoadingThemes(false)
    }
  }, [])

  useEffect(() => {
    loadThemes()
  }, [loadThemes])

  // Load Personas for active page
  useEffect(() => {
    if (!selectedPage?.id) {
      setPersonas([])
      return
    }
    api.get<AIPersona[]>(`/api/ai/personas/${selectedPage.id}`)
      .then((res) => {
        const list = res.data || []
        setPersonas(list)
        const personaParam = searchParams?.get("persona_id")
        if (personaParam) {
          const matched = list.find((p) => String(p.id) === personaParam)
          if (matched) {
            setSelectedPersonaId(matched.id ?? null)
            if (matched.meme_format_preference) setFormatStyle(matched.meme_format_preference as any)
            if (matched.meme_theme_id) setSelectedThemeId(matched.meme_theme_id)
          }
        } else if (list.length > 0 && selectedPersonaId === null) {
          const memeP = list.find((p) => p.content_mode === "meme") || list.find((p) => p.is_active) || list[0]
          setSelectedPersonaId(memeP.id ?? null)
          if (memeP.meme_format_preference) setFormatStyle(memeP.meme_format_preference as any)
          if (memeP.meme_theme_id) setSelectedThemeId(memeP.meme_theme_id)
        }
      })
      .catch(() => setPersonas([]))
  }, [selectedPage?.id, searchParams])

  // --- 1-Click Generate Meme ---
  async function handleGenerateMeme() {
    setGenerating(true)
    try {
      const res = await axiosInstance.post("/api/meme/generate", {
        theme_id: !isCustomTheme ? selectedThemeId : undefined,
        custom_theme_id: isCustomTheme ? selectedThemeId : undefined,
        format_style: formatStyle,
        custom_prompt: customPrompt.trim() || undefined,
        persona_id: selectedPersonaId || undefined,
      })

      setMemeResult(res.data)
      setEditableCaption(res.data.caption || "")
      setEditableHeadline(res.data.headline || "")
      setEditableTopText(res.data.top_text || "")
      setEditableBottomText(res.data.bottom_text || "")
      toast.success("Meme generated successfully!")
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to generate meme. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  // --- Live Re-render with Custom Text ---
  async function handleReRender(overrideFormat?: "modern_card" | "classic") {
    if (!memeResult?.selected_asset?.id && !memeResult?.selected_asset?.local_path) {
      return
    }

    setReRendering(true)
    try {
      const activeFormat = overrideFormat || formatStyle
      const res = await axiosInstance.post("/api/meme/render", {
        asset_id: memeResult.selected_asset.id,
        format_style: activeFormat,
        headline: activeFormat === "modern_card" ? editableHeadline : undefined,
        top_text: activeFormat === "classic" ? editableTopText : undefined,
        bottom_text: activeFormat === "classic" ? editableBottomText : undefined,
      })

      setMemeResult((prev: any) => ({
        ...prev,
        base64_image: res.data.base64_image,
        format_style: activeFormat,
      }))
      toast.success("Meme preview updated!")
    } catch (err: any) {
      toast.error("Failed to update preview.")
    } finally {
      setReRendering(false)
    }
  }

  // --- Save / Publish / Schedule Submission (Calls /posts/publish) ---
  async function submit(saveAsDraft = false) {
    if (!selectedPage) return toast.error("Connect a page before publishing.")
    if (!editableCaption.trim() && !memeResult?.base64_image) return toast.error("Generate a meme or enter a caption first.")

    const isScheduling = !saveAsDraft && scheduleLater
    setSaving(true)
    try {
      const mediaUrls = memeResult?.base64_image ? [memeResult.base64_image] : []
      const response = await api.post<{ success: boolean; error_message?: string }>("/posts/publish", {
        message: editableCaption.trim() || " ",
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
            ? `Meme post scheduled for ${formatDate(new Date(scheduleDate).toISOString(), timezone)}.`
            : "Meme post published to Facebook successfully!"
      )

      if (!saveAsDraft && !scheduleLater) {
        setEditableCaption("")
        setMemeResult(null)
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

  // --- Create Custom Theme Bucket ---
  async function handleCreateCustomTheme() {
    if (!newThemeName.trim()) return toast.error("Theme name is required.")

    try {
      const res = await axiosInstance.post("/api/meme/themes", {
        name: newThemeName.trim(),
        description: newThemeDesc.trim() || undefined,
        category: newThemeCategory,
      })

      if (newThemeImageUrl.trim()) {
        await axiosInstance.post(`/api/meme/themes/${res.data.theme_id}/assets`, {
          image_url: newThemeImageUrl.trim(),
        })
      }

      toast.success(`Theme "${newThemeName}" created!`)
      setIsCreateThemeOpen(false)
      setNewThemeName("")
      setNewThemeDesc("")
      setNewThemeImageUrl("")
      loadThemes()
    } catch (err: any) {
      toast.error("Failed to create theme.")
    }
  }

  return (
    <div className="grid gap-6">
      {/* Main Studio 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column (7 cols): Controls, Form & Publish Bar */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* 1. Custom Angle / Meme Generator Card */}
          <Card className="shadow-xs border border-purple-200 bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50 rounded-t-xl">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Laugh className="size-3.5 text-purple-600" />
                  Custom Angle or Joke Scenario
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
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null
                        setSelectedPersonaId(val)
                        if (val) {
                          const p = personas.find((item) => item.id === val)
                          if (p) {
                            if (p.meme_format_preference) setFormatStyle(p.meme_format_preference as any)
                            if (p.meme_theme_id) setSelectedThemeId(p.meme_theme_id)
                          }
                        }
                      }}
                      className="h-8 text-xs font-semibold bg-white border-slate-200"
                    >
                      <option value="">Auto (Default Tone)</option>
                      {personas.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.persona_name} {p.content_mode === "meme" ? "😂" : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 grid gap-4">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. When the client approves the first draft without changes..."
                className="w-full min-h-[120px] text-sm p-3 rounded-md border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 resize-none shadow-inner"
              />

              {/* Theme Pillar Shortcut Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {(builtinThemes.length > 0
                  ? builtinThemes
                  : [
                    { id: "cat-humor", name: "🐱 Cat & Pet Chaos" },
                    { id: "tech-dev", name: "💻 Tech & Dev Life" },
                    { id: "startup-founder", name: "🚀 Startup & Founder" },
                    { id: "fitness-gym", name: "💪 Fitness & Gym" },
                  ]
                ).map((theme) => {
                  const isSelected = selectedThemeId === theme.id && !isCustomTheme
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        setSelectedThemeId(theme.id)
                        setIsCustomTheme(false)
                      }}
                      className={cn(
                        "text-[11px] font-medium px-2.5 py-1 rounded-full transition-all border",
                        isSelected
                          ? "bg-purple-600 text-white border-purple-600 font-semibold shadow-xs"
                          : "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                      )}
                    >
                      {theme.name}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between pt-1">
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
                  onClick={handleGenerateMeme}
                  disabled={generating}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold h-9 shadow-xs px-5"
                >
                  {generating ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Laugh className="size-4 mr-2" />
                      Generate Meme
                    </>
                  )}
                </Button>
              </div>

              {isAdvancedOpen && (
                <div className="pt-4 mt-2 border-t border-slate-100 grid gap-5 animate-in fade-in duration-200 slide-in-from-top-4">
                  {/* Format Switcher */}
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-bold uppercase text-slate-600">Layout Format</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFormatStyle("modern_card")
                          if (memeResult) handleReRender("modern_card")
                        }}
                        className={cn(
                          "p-2.5 rounded-lg border text-xs font-bold text-center transition-all",
                          formatStyle === "modern_card"
                            ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        🖼️ Modern Card
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormatStyle("classic")
                          if (memeResult) handleReRender("classic")
                        }}
                        className={cn(
                          "p-2.5 rounded-lg border text-xs font-bold text-center transition-all",
                          formatStyle === "classic"
                            ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        💥 Classic Impact
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Post Caption & Text Tuning (When meme generated) */}
          {memeResult && (
            <Card className="shadow-xs border border-slate-200 bg-white animate-in fade-in duration-300">
              <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50">
                <CardTitle className="text-base font-semibold leading-5 text-slate-800">Post Caption & Graphic Tuning</CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid gap-4">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Facebook Post Copy</Label>
                  <Textarea
                    value={editableCaption}
                    onChange={(e) => setEditableCaption(e.target.value)}
                    rows={3}
                    placeholder="Write or edit the post caption..."
                    className="text-xs resize-y"
                  />
                  {memeResult.hashtags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {memeResult.hashtags.map((tag: string, tIdx: number) => (
                        <span key={tIdx} className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">Tune Meme Overlay Text</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReRender()}
                      className="h-6 text-[11px] text-purple-700 hover:text-purple-900 px-2"
                    >
                      <RefreshCw className="size-3 mr-1" />
                      Re-render Graphic
                    </Button>
                  </div>
                  {formatStyle === "modern_card" ? (
                    <Input
                      value={editableHeadline}
                      onChange={(e) => setEditableHeadline(e.target.value)}
                      onBlur={() => handleReRender()}
                      className="text-xs bg-white h-8"
                      placeholder="Headline Setup Joke"
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={editableTopText}
                        onChange={(e) => setEditableTopText(e.target.value)}
                        onBlur={() => handleReRender()}
                        className="text-xs bg-white uppercase font-bold h-8"
                        placeholder="Top Text"
                      />
                      <Input
                        value={editableBottomText}
                        onChange={(e) => setEditableBottomText(e.target.value)}
                        onBlur={() => handleReRender()}
                        className="text-xs bg-white uppercase font-bold h-8"
                        placeholder="Bottom Text"
                      />
                    </div>
                  )}
                </div>
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
                disabled={saving || (!editableCaption.trim() && !memeResult?.base64_image)}
                className="text-slate-700 bg-white shadow-xs text-xs h-8"
              >
                Save as Draft
              </Button>

              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <Switch checked={scheduleLater} onCheckedChange={setScheduleLater} id="meme-schedule-switch" />
                <Label htmlFor="meme-schedule-switch" className="text-xs font-semibold cursor-pointer text-slate-700 whitespace-nowrap">
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
                disabled={saving || (!editableCaption.trim() && !memeResult?.base64_image)}
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
                disabled={saving || (!editableCaption.trim() && !memeResult?.base64_image)}
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
              {editableCaption ? (
                <span>
                  {editableCaption.split(" ").map((word, i) => {
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
                <span className="text-slate-400 italic">Your meme post caption will appear live here...</span>
              )}
            </div>

            {/* Facebook Graphic / Media Container */}
            {memeResult?.base64_image ? (
              <div className="relative border-y border-slate-100 bg-slate-950 overflow-hidden">
                <img
                  src={memeResult.base64_image}
                  alt="Generated Meme Graphic"
                  className="w-full max-h-[460px] object-contain mx-auto bg-slate-900"
                />
                {reRendering && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold">
                    <Loader2 className="size-5 animate-spin mr-2" />
                    Updating Live Preview...
                  </div>
                )}
              </div>
            ) : (
              <div className="border-y border-dashed border-slate-200 bg-slate-50/50 p-12 text-center flex flex-col items-center justify-center">
                <div className="size-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mb-2">
                  <Laugh className="size-6" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Generated meme poster will appear live here</p>
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

      {/* --- Create Custom Theme Modal --- */}
      {isCreateThemeOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-4 flex items-center justify-center animate-in fade-in">
          <Card className="w-full max-w-md shadow-xl border bg-white">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold leading-5 text-slate-900">New Custom Theme Bucket</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreateThemeOpen(false)}
                  className="size-8 p-0"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 grid gap-3.5">
              <div className="grid gap-1.5">
                <Label className="text-xs font-bold">Theme Name</Label>
                <Input
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  placeholder="e.g. Agency Humor, Real Estate Fails, Tech Comics"
                  className="text-xs"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-bold">Description / Tone</Label>
                <Input
                  value={newThemeDesc}
                  onChange={(e) => setNewThemeDesc(e.target.value)}
                  placeholder="Brief description of what makes this theme funny..."
                  className="text-xs"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-bold">Optional Reference Image URL</Label>
                <Input
                  value={newThemeImageUrl}
                  onChange={(e) => setNewThemeImageUrl(e.target.value)}
                  placeholder="https://example.com/meme-template.jpg"
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateThemeOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateCustomTheme}
                  className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold"
                >
                  Create Theme Bucket
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
