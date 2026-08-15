"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
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
} from "lucide-react"
import { toast } from "sonner"

import { PageConnection } from "@/types/models"
import { PageTitle } from "@/components/dashboard/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { axiosInstance } from "@/lib/axios"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

export function MemeStudioView({
  pages = [],
}: {
  pages?: PageConnection[]
}) {
  const router = useRouter()
  const [selectedPageId, setSelectedPageId] = useState<number | null>(
    pages.find((p) => p.connection_status === "connected")?.id ?? pages[0]?.id ?? null
  )
  const selectedPage = pages.find((p) => p.id === selectedPageId) || pages[0]

  // Themes state
  const [builtinThemes, setBuiltinThemes] = useState<any[]>([])
  const [customThemes, setCustomThemes] = useState<any[]>([])
  const [selectedThemeId, setSelectedThemeId] = useState<string>("cat-humor")
  const [isCustomTheme, setIsCustomTheme] = useState(false)
  const [loadingThemes, setLoadingThemes] = useState(true)

  // Meme generation form
  const [customPrompt, setCustomPrompt] = useState("")
  const [formatStyle, setFormatStyle] = useState<"modern_card" | "classic">("modern_card")
  const [generating, setGenerating] = useState(false)

  // Generated meme output
  const [memeResult, setMemeResult] = useState<any>(null)
  const [editableCaption, setEditableCaption] = useState("")
  const [editableHeadline, setEditableHeadline] = useState("")
  const [editableTopText, setEditableTopText] = useState("")
  const [editableBottomText, setEditableBottomText] = useState("")
  const [reRendering, setReRendering] = useState(false)

  // Publishing state
  const [publishing, setPublishing] = useState(false)
  const [scheduling, setScheduling] = useState(false)
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

  // --- 1-Click Generate Meme ---
  async function handleGenerateMeme() {
    setGenerating(true)
    try {
      const res = await axiosInstance.post("/api/meme/generate", {
        theme_id: !isCustomTheme ? selectedThemeId : undefined,
        custom_theme_id: isCustomTheme ? selectedThemeId : undefined,
        custom_prompt: customPrompt.trim() || undefined,
        format_style: formatStyle,
        page_connection_id: selectedPage?.id || undefined,
      })

      const data = res.data
      setMemeResult(data)
      setEditableCaption(data.post_caption || "")
      setEditableHeadline(data.headline_setup || "")
      setEditableTopText(data.top_text || "")
      setEditableBottomText(data.bottom_text || "")
      toast.success("Meme & caption generated successfully!")
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Meme generation failed.")
    } finally {
      setGenerating(false)
    }
  }

  // --- Live Re-render on Text Edit ---
  async function handleReRender(newFormat?: "modern_card" | "classic") {
    if (!memeResult?.source_image_url) return
    const activeFormat = newFormat || formatStyle

    setReRendering(true)
    try {
      const res = await axiosInstance.post("/api/meme/render-preview", {
        image_url: memeResult.source_image_url,
        format_style: activeFormat,
        headline_text: editableHeadline,
        top_text: editableTopText,
        bottom_text: editableBottomText,
        brand_name: selectedPage?.page_name || "Creator",
        handle: "@" + (selectedPage?.page_name || "creator").toLowerCase().replace(" ", ""),
        avatar_url: selectedPage?.page_picture_url,
      })
      setMemeResult((prev: any) => ({
        ...prev,
        base64_image: res.data.base64_image,
        format_style: activeFormat,
      }))
    } catch (err: any) {
      toast.error("Failed to re-render preview.")
    } finally {
      setReRendering(false)
    }
  }

  // --- Direct Publish Now to Facebook ---
  async function handlePublishNow() {
    if (!selectedPage) return toast.error("Please connect a Facebook page first.")
    if (!memeResult?.base64_image) return toast.error("Generate a meme first.")

    setPublishing(true)
    try {
      await api.post("/posts", {
        page_connection_id: selectedPage.id,
        content: editableCaption,
        media_urls: [memeResult.base64_image],
        publish_immediately: true,
      })
      toast.success("Meme post published directly to Facebook!")
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Publishing failed.")
    } finally {
      setPublishing(false)
    }
  }

  // --- Schedule Meme Post ---
  async function handleSchedulePost() {
    if (!selectedPage) return toast.error("Please connect a Facebook page first.")
    if (!memeResult?.base64_image) return toast.error("Generate a meme first.")

    const schedDt = scheduleDate || new Date(Date.now() + 3600 * 4 * 1000).toISOString()

    setScheduling(true)
    try {
      await api.post("/posts", {
        page_connection_id: selectedPage.id,
        content: editableCaption,
        media_urls: [memeResult.base64_image],
        scheduled_at: schedDt,
        status: "scheduled",
      })
      toast.success("Meme post scheduled to your content calendar!")
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Scheduling failed.")
    } finally {
      setScheduling(false)
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
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageTitle
          title="Viral Meme & Scenario Studio"
          subtitle="Generate high-shareability memes, witty workplace scenarios, and viral Facebook posts."
        />
        <div className="flex items-center gap-2">
          {pages.length > 0 && (
            <select
              aria-label="Select Facebook Page"
              value={selectedPageId || ""}
              onChange={(e) => setSelectedPageId(Number(e.target.value))}
              className="text-xs font-semibold rounded-md border border-slate-200 bg-white px-2.5 py-1.5 shadow-xs"
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.page_name}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateThemeOpen(true)}
            className="text-xs h-8"
          >
            <FolderPlus className="size-3.5 mr-1.5 text-purple-600" />
            New Custom Theme Bucket
          </Button>
        </div>
      </div>

      {/* Main Studio 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Theme Picker & Generation Controls */}
        <div className="lg:col-span-5 grid gap-5">
          {/* Viral Themes Selector */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Flame className="size-4 text-orange-500" />
                  Select Viral Theme Pillar
                </CardTitle>
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-500">
                  {builtinThemes.length + customThemes.length} Themes
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 grid gap-2.5">
              {/* Built-in Themes Grid */}
              <div className="grid grid-cols-2 gap-2">
                {builtinThemes.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      setSelectedThemeId(theme.id)
                      setIsCustomTheme(false)
                    }}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all flex flex-col justify-between",
                      selectedThemeId === theme.id && !isCustomTheme
                        ? "bg-purple-50 border-purple-600 ring-2 ring-purple-600/20 shadow-xs"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <span className="text-xs font-bold text-slate-900 line-clamp-1">{theme.name}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-2 mt-1">{theme.description}</span>
                  </button>
                ))}
              </div>

              {/* Custom Themes (if any) */}
              {customThemes.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Your Custom Asset Buckets
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {customThemes.map((ct) => (
                      <button
                        key={ct.id}
                        type="button"
                        onClick={() => {
                          setSelectedThemeId(ct.id)
                          setIsCustomTheme(true)
                        }}
                        className={cn(
                          "p-2.5 rounded-lg border text-left transition-all",
                          selectedThemeId === ct.id && isCustomTheme
                            ? "bg-purple-50 border-purple-600 ring-2 ring-purple-600/20 shadow-xs"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <span className="text-xs font-bold text-purple-900 line-clamp-1">{ct.name}</span>
                        <span className="text-[10px] text-slate-500">{ct.asset_count} assets</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Autopilot Generator Box */}
          <Card className="shadow-xs border-purple-200 bg-gradient-to-b from-purple-50/40 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="size-4 text-purple-600" />
                Meme Format & Context
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
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

              {/* Optional Custom Joke Prompt */}
              <div className="grid gap-1.5">
                <Label className="text-xs font-bold uppercase text-slate-600">
                  Custom Angle or Joke Scenario (Optional)
                </Label>
                <Input
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. When the client approves the first draft without changes..."
                  className="text-xs bg-white"
                />
              </div>

              <Button
                onClick={handleGenerateMeme}
                disabled={generating}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold h-10 shadow-xs"
              >
                {generating ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Generating Witty Meme...
                  </>
                ) : (
                  <>
                    <Laugh className="size-4 mr-2" />
                    Generate Witty Meme & Caption
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Mockup, Preview & Direct Publishing */}
        <div className="lg:col-span-7 grid gap-5">
          {memeResult?.base64_image ? (
            <Card className="shadow-xs overflow-hidden">
              <CardHeader className="pb-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Meme Studio Canvas</span>
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-[10px] font-bold border-none">
                      Ready to Publish
                    </Badge>
                  </div>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    Format: {formatStyle === "modern_card" ? "Modern Headline Card" : "Classic Impact"}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-5 grid gap-5">
                {/* 1. Live Rendered Graphic */}
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 max-h-[460px] flex items-center justify-center">
                  <img
                    src={memeResult.base64_image}
                    alt="Generated viral meme"
                    className="max-h-[460px] w-auto object-contain"
                  />
                  {reRendering && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold">
                      <Loader2 className="size-5 animate-spin mr-2" />
                      Updating Live Preview...
                    </div>
                  )}
                </div>

                {/* 2. Text Tuning Form */}
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 grid gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Tune Meme Overlay Text</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReRender()}
                      className="h-7 text-xs text-purple-700 hover:text-purple-900"
                    >
                      <RefreshCw className="size-3 mr-1" />
                      Re-render
                    </Button>
                  </div>

                  {formatStyle === "modern_card" ? (
                    <div className="grid gap-1">
                      <Label className="text-[11px] text-slate-600 font-semibold">Headline Setup Joke</Label>
                      <Input
                        value={editableHeadline}
                        onChange={(e) => setEditableHeadline(e.target.value)}
                        onBlur={() => handleReRender()}
                        className="text-xs bg-white"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid gap-1">
                        <Label className="text-[11px] text-slate-600 font-semibold">Top Text</Label>
                        <Input
                          value={editableTopText}
                          onChange={(e) => setEditableTopText(e.target.value)}
                          onBlur={() => handleReRender()}
                          className="text-xs bg-white uppercase font-bold"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[11px] text-slate-600 font-semibold">Bottom Text</Label>
                        <Input
                          value={editableBottomText}
                          onChange={(e) => setEditableBottomText(e.target.value)}
                          onBlur={() => handleReRender()}
                          className="text-xs bg-white uppercase font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Facebook Post Caption */}
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase text-slate-700">Facebook Caption</Label>
                  <Textarea
                    value={editableCaption}
                    onChange={(e) => setEditableCaption(e.target.value)}
                    rows={4}
                    className="text-xs resize-y"
                  />
                  <div className="flex flex-wrap gap-1">
                    {(memeResult.hashtags || []).map((tag: string, tIdx: number) => (
                      <span key={tIdx} className="text-[11px] font-medium text-blue-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 4. Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Input
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="text-xs h-9 w-48"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSchedulePost}
                      disabled={scheduling}
                      className="text-xs h-9"
                    >
                      <Calendar className="size-3.5 mr-1.5 text-purple-600" />
                      Schedule
                    </Button>
                  </div>

                  <Button
                    onClick={handlePublishNow}
                    disabled={publishing}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 px-4 text-xs shadow-xs"
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Send className="size-3.5 mr-1.5" />
                        Publish to Facebook Now
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed p-12 text-center flex flex-col items-center justify-center min-h-[420px]">
              <div className="size-14 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mb-3">
                <Laugh className="size-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Your Meme Canvas is Ready</h4>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                Select a viral theme on the left and click "Generate Witty Meme & Caption" to create instant shareable content.
              </p>
              <Button
                onClick={handleGenerateMeme}
                disabled={generating}
                className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold"
              >
                <Sparkles className="size-3.5 mr-1.5" />
                Generate Meme Now
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* --- Create Custom Theme Modal --- */}
      {isCreateThemeOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-4 flex items-center justify-center animate-in fade-in">
          <Card className="w-full max-w-md shadow-xl border bg-white">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold">New Custom Theme Bucket</CardTitle>
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
                  placeholder="e.g. Sarcastic client requests and funny agency moments"
                  className="text-xs"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-bold">Initial Asset Image URL (Optional)</Label>
                <Input
                  value={newThemeImageUrl}
                  onChange={(e) => setNewThemeImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or Pexels URL"
                  className="text-xs"
                />
              </div>

              <Button
                onClick={handleCreateCustomTheme}
                className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs mt-2"
              >
                Save Theme Bucket
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
