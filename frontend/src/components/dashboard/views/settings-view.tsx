"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import {
  Sparkles,
  Loader2,
  Check,
  Plus,
  Trash2,
  X,
  RotateCcw,
  Palette,
  Type,
  Globe,
  Sliders,
  ChevronDown,
  ChevronUp,
  LayoutTemplate,
  Wand2,
  Calendar,
  Layers,
  Award,
  Settings2,
  Upload,
  Download,
  Search,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  User,
  Cpu,
  Bookmark,
} from "lucide-react"
import { toast } from "sonner"

import { PageConnection, GlobalModelSettings } from "@/types/models"
import { PageConnectionCard, PageTitle } from "@/components/dashboard/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { api } from "@/lib/api"
import { axiosInstance } from "@/lib/axios"
import { cn } from "@/lib/utils"

const POPULAR_GOOGLE_FONTS = [
  "Outfit",
  "Plus Jakarta Sans",
  "Cabinet Grotesk",
  "Syne",
  "Space Grotesk",
  "DM Sans",
  "Inter",
  "Montserrat",
  "Playfair Display",
  "Cinzel",
  "Bebas Neue",
  "Clash Display",
  "Satoshi",
  "General Sans",
]

export function SettingsView({
  pages,
  timezone,
  onChanged,
}: {
  pages: PageConnection[]
  timezone: string
  onChanged: () => void
}) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<"general" | "ai-models" | "typography">("general")
  const [email, setEmail] = useState(user?.email || "")
  const [tz, setTz] = useState(timezone)
  const [manualPageId, setManualPageId] = useState("")
  const [manualToken, setManualToken] = useState("")
  const [syncingPageId, setSyncingPageId] = useState<number | null>(null)

  async function saveAccount() {
    try {
      await api.patch("/users/me", { email, timezone: tz })
      toast.success("Account settings updated successfully.")
    } catch {
      toast.error("Failed to update account settings.")
    }
  }

  async function manualConnect() {
    if (!manualPageId.trim() || !manualToken.trim()) {
      toast.error("Please enter both Page ID and Access Token.")
      return
    }
    try {
      await api.post("/facebook/manual-connect", {
        page_id: manualPageId.trim(),
        page_access_token: manualToken.trim(),
      })
      setManualPageId("")
      setManualToken("")
      toast.success("Facebook Page connected successfully.")
      onChanged()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not validate Facebook Page.")
    }
  }

  async function disconnect(id: number) {
    if (!window.confirm("Are you sure? Your post history will be preserved.")) return
    try {
      const response = await api.delete<{ success: boolean; message: string; paused_posts: number }>(
        `/api/pages/${id}/disconnect`
      )
      toast.success(response.data.message)
      onChanged()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not disconnect page.")
    }
  }

  async function syncHistory(id: number) {
    setSyncingPageId(id)
    const toastId = toast.loading("Syncing your post history from Facebook...")
    try {
      const response = await api.post<{ success: boolean; synced_posts_count: number }>(
        `/facebook/pages/recover-history/${id}`
      )
      toast.success(`Synced ${response.data.synced_posts_count} historical posts to your dashboard.`, { id: toastId })
      onChanged()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not sync history. Backend error.", { id: toastId })
    } finally {
      setSyncingPageId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <PageTitle
          title="System Settings & Typography"
          subtitle="Configure connected accounts, AI providers, custom typography, and posting preferences."
        />
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="general" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <User className="size-3.5" />
              General & Pages
            </TabsTrigger>
            <TabsTrigger value="ai-models" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Cpu className="size-3.5" />
              AI Models
            </TabsTrigger>
            <TabsTrigger value="typography" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-purple-700 data-[state=active]:text-white data-[state=active]:shadow-sm">
              <Type className="size-3.5" />
              Typography Studio
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* --- TAB 1: GENERAL & PAGES --- */}
      {activeTab === "general" && (
        <div className="grid gap-6">
          {/* Account Profile */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="size-4 text-blue-600" />
                Account Profile & Timezone
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Manage your credentials and local publishing timezone.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs font-bold text-slate-700">Account Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-bold text-slate-700">Timezone (detected from browser)</Label>
                <Input
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end pt-1">
                <Button className="bg-blue-700 hover:bg-blue-800 text-white text-xs h-8" onClick={saveAccount}>
                  Save Profile Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Connected Facebook Pages */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Globe className="size-4 text-blue-600" />
                Connected Social Pages ({pages.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Connected Facebook Pages receiving scheduled and manual posts.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {pages.map((page) => (
                <PageConnectionCard
                  key={page.id}
                  page={page}
                  isSyncing={syncingPageId === page.id}
                  onSyncHistory={() => syncHistory(page.id)}
                  onDisconnect={() => disconnect(page.id)}
                  onChanged={onChanged}
                />
              ))}

              {/* Manual Connection Option */}
              <div className="rounded-xl border border-dashed border-slate-300 p-4 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Manual Facebook Page Connection</span>
                  <Badge variant="outline" className="text-[10px] text-slate-500">Developer / Direct Token</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Facebook Page ID"
                    value={manualPageId}
                    onChange={(e) => setManualPageId(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <Textarea
                    placeholder="Long-lived Page Access Token"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    className="min-h-[38px] h-9 text-xs py-2"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-8"
                    onClick={manualConnect}
                  >
                    Validate & Connect Page
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- TAB 2: AI MODELS CONFIGURATION --- */}
      {activeTab === "ai-models" && <AIModelsSettingsCard />}

      {/* --- TAB 3: TYPOGRAPHY & BRAND FONTS STUDIO --- */}
      {activeTab === "typography" && <TypographySettingsCard pages={pages} />}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Typography & Font Manager Studio Card                                      */
/* -------------------------------------------------------------------------- */

function TypographySettingsCard({ pages }: { pages: PageConnection[] }) {
  const [installedFonts, setInstalledFonts] = useState<any[]>([])
  const [fontPairs, setFontPairs] = useState<any[]>([])
  const [loadingFonts, setLoadingFonts] = useState(true)
  const [googleFontInput, setGoogleFontInput] = useState("")
  const [downloadingFont, setDownloadingFont] = useState(false)
  const [uploadingFont, setUploadingFont] = useState(false)
  const [previewText, setPreviewText] = useState("Crafting Viral Social Posters 2026")
  const [brandProfile, setBrandProfile] = useState<any>({
    font_pair_id: "space-grotesk-dm-sans",
    palette_id: "ink-sun",
  })
  const [savingBrand, setSavingBrand] = useState(false)

  // Load installed fonts
  const loadFonts = useCallback(async () => {
    setLoadingFonts(true)
    try {
      const res = await axiosInstance.get("/api/fonts")
      setInstalledFonts(res.data.installed_fonts || [])
      setFontPairs(res.data.font_pairs || [])
    } catch {
      toast.error("Could not load installed fonts.")
    } finally {
      setLoadingFonts(false)
    }
  }, [])

  // Load Brand profile
  const loadBrandProfile = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/api/brand/profile")
      if (res.data && Object.keys(res.data).length > 0) {
        setBrandProfile(res.data)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadFonts()
    loadBrandProfile()
  }, [loadFonts, loadBrandProfile])

  async function handleDownloadGoogleFont(fontName?: string) {
    const target = (fontName || googleFontInput).trim()
    if (!target) {
      toast.error("Please enter a Google Font name.")
      return
    }
    setDownloadingFont(true)
    try {
      const res = await axiosInstance.post("/api/fonts/download-google-font", {
        font_family: target,
      })
      toast.success(res.data.message || `Downloaded Google Font: "${target}"!`)
      setGoogleFontInput("")
      loadFonts()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || `Could not download font "${target}". Check the family name.`)
    } finally {
      setDownloadingFont(false)
    }
  }

  async function handleUploadFontFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    setUploadingFont(true)
    try {
      const res = await axiosInstance.post("/api/fonts/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      toast.success(res.data.message || "Font file uploaded and installed successfully!")
      loadFonts()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Font upload failed. Only .ttf, .otf, .woff, .woff2 are supported.")
    } finally {
      setUploadingFont(false)
      e.target.value = ""
    }
  }

  async function handleDeleteFont(filename: string) {
    if (!confirm(`Remove font "${filename}" from your system?`)) return
    try {
      await axiosInstance.delete(`/api/fonts/${filename}`)
      toast.success(`Font "${filename}" removed.`)
      loadFonts()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to remove font.")
    }
  }

  async function handleSaveBrandFont(fontPairId: string) {
    setSavingBrand(true)
    try {
      await axiosInstance.post("/api/brand/profile", {
        ...brandProfile,
        font_pair_id: fontPairId,
      })
      setBrandProfile((prev: any) => ({ ...prev, font_pair_id: fontPairId }))
      toast.success("Active Brand Kit typography updated!")
    } catch {
      toast.error("Failed to save brand font pair.")
    } finally {
      setSavingBrand(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview & Quick Installer */}
      <Card className="border-purple-200/80 bg-linear-to-br from-white via-purple-50/20 to-slate-50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Type className="size-5 text-purple-600" />
              Typography & Custom Fonts Studio
            </CardTitle>
            <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50 text-[11px] font-semibold">
              {installedFonts.length} Fonts Installed
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-600">
            Install and manage Google fonts and custom typeface files. All installed fonts are immediately available across Manual Templates, AI Campaign Posters, and the Interactive Canvas Workbench.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Download & Upload Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Google Fonts Downloader */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
              <div>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Download className="size-3.5 text-purple-600" />
                  Install from Google Fonts
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Auto-fetch official TTF weights from Google's font repository.
                </p>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Outfit, Syne, Clash Display..."
                  value={googleFontInput}
                  onChange={(e) => setGoogleFontInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDownloadGoogleFont()}
                  className="h-9 text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => handleDownloadGoogleFont()}
                  disabled={downloadingFont}
                  className="bg-purple-700 hover:bg-purple-800 text-white text-xs h-9 px-3 shrink-0"
                >
                  {downloadingFont ? <Loader2 className="size-3.5 animate-spin" /> : "Install"}
                </Button>
              </div>

              {/* Popular Font Chips */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                  Trending Google Fonts:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_GOOGLE_FONTS.slice(0, 8).map((font) => (
                    <button
                      key={font}
                      type="button"
                      onClick={() => handleDownloadGoogleFont(font)}
                      disabled={downloadingFont}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-purple-100 hover:text-purple-800 border border-slate-200 text-slate-700 transition-all font-medium"
                    >
                      + {font}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Font File Uploader */}
            <div className="p-4 rounded-xl border border-dashed border-purple-300 bg-purple-50/30 flex flex-col justify-between items-center text-center">
              <div>
                <div className="size-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mx-auto mb-2">
                  <Upload className="size-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 block">Upload Font Binary</span>
                <span className="text-[11px] text-slate-500">Supports .ttf, .otf, .woff, and .woff2 format</span>
              </div>

              <label className="mt-3 cursor-pointer">
                <input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  onChange={handleUploadFontFile}
                  disabled={uploadingFont}
                  className="hidden"
                />
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 shadow-xs text-xs font-bold text-slate-800 transition-all">
                  {uploadingFont ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-purple-600" />
                      Uploading & Registering...
                    </>
                  ) : (
                    <>
                      <Plus className="size-3.5 text-purple-600" />
                      Choose Local Font File
                    </>
                  )}
                </span>
              </label>
            </div>
          </div>

          {/* Interactive Specimen Test Input */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1.5">
              <Search className="size-3.5 text-slate-400" />
              Live Preview Text:
            </span>
            <Input
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              placeholder="Type custom text to preview with all installed fonts..."
              className="h-8 text-xs bg-slate-50/80"
            />
          </div>
        </CardContent>
      </Card>

      {/* Installed Fonts Directory Gallery */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Installed Fonts Directory ({installedFonts.length})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Typefaces ready for manual template blueprints and poster rendering.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadFonts} className="h-8 text-xs gap-1">
            <RefreshCw className="size-3" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loadingFonts ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-purple-600" />
            </div>
          ) : installedFonts.length === 0 ? (
            <div className="py-8 text-center border border-dashed rounded-xl p-6">
              <Type className="size-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No custom fonts installed yet.</p>
              <p className="text-[11px] text-slate-400 mt-1">Download a Google Font above or upload your brand font.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {installedFonts.map((f) => {
                const isBrandFont = brandProfile.font_pair_id?.includes(f.family.toLowerCase())
                return (
                  <div
                    key={f.filename}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-purple-300 transition-all flex flex-col justify-between shadow-2xs group"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 truncate">{f.name}</span>
                        <div className="flex items-center gap-1">
                          {isBrandFont && (
                            <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-[9px] px-1.5 py-0 font-bold">
                              Brand Kit
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFont(f.filename)}
                            className="size-6 p-0 text-slate-400 hover:text-red-600 opacity-60 group-hover:opacity-100 transition-opacity"
                            title="Delete Font"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        {f.size_kb} KB · {f.filename}
                      </span>
                    </div>

                    {/* Live Preview Sample */}
                    <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-sm font-semibold text-slate-800 truncate tracking-tight">
                        {previewText || f.name}
                      </p>
                      <div className="mt-2 flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                        <span className="text-[10px] text-slate-400 font-mono">1234567890 !?</span>
                        <button
                          type="button"
                          onClick={() => handleSaveBrandFont(f.family.toLowerCase())}
                          disabled={savingBrand}
                          className="text-[10px] font-bold text-purple-700 hover:text-purple-900 hover:underline"
                        >
                          Use as Brand Kit Font
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Brand Font Pairings */}
      {fontPairs.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bookmark className="size-4 text-purple-600" />
              Pre-Configured Font Pairings ({fontPairs.length})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Curated Headline & Body typographic combinations optimized for readability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fontPairs.map((pair) => {
                const isSelected = brandProfile.font_pair_id === pair.id
                return (
                  <div
                    key={pair.id}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all flex flex-col justify-between",
                      isSelected
                        ? "border-purple-600 bg-purple-50/40 ring-1 ring-purple-600"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{pair.heading_font} + {pair.body_font}</span>
                        {isSelected && (
                          <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0 font-bold">Active</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(pair.mood || []).map((m: string) => (
                          <Badge key={m} variant="outline" className="text-[9px] px-1 py-0 text-slate-500">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">ID: {pair.id}</span>
                      {!isSelected && (
                        <button
                          type="button"
                          onClick={() => handleSaveBrandFont(pair.id)}
                          className="text-[10px] font-bold text-purple-700 hover:underline"
                        >
                          Select Pairing
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* AI Models Configuration Card                                               */
/* -------------------------------------------------------------------------- */

const postModelOptions: Record<GlobalModelSettings["post_generation_provider"], string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  gemini: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
  anthropic: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
  mistral: ["mistral-large-latest", "mistral-small-latest"],
}

const imageModelOptions: Record<GlobalModelSettings["image_generation_provider"], string[]> = {
  gemini: ["imagen-3.0-generate-001", "imagen-2.0"],
  openai: ["dall-e-3", "dall-e-2"],
  stability: ["stable-diffusion-3", "stable-diffusion-xl"],
}

function providerLabel(provider: string) {
  if (provider === "openai") return "OpenAI"
  if (provider === "gemini") return "Gemini"
  if (provider === "anthropic") return "Anthropic"
  if (provider === "mistral") return "Mistral"
  if (provider === "stability") return "Stability AI"
  return provider
}

function AIModelsSettingsCard() {
  const [value, setValue] = React.useState<GlobalModelSettings>({
    post_generation_provider: "openai",
    post_generation_model: "gpt-4o",
    image_generation_provider: "gemini",
    image_generation_model: "imagen-3.0-generate-001",
  })
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    api.get<GlobalModelSettings>("/api/settings/models")
      .then((res) => setValue(res.data))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  function changePostProvider(next: GlobalModelSettings["post_generation_provider"]) {
    const firstModel = postModelOptions[next][0]
    setValue((prev) => ({
      ...prev,
      post_generation_provider: next,
      post_generation_model: firstModel,
    }))
  }

  function changeImageProvider(next: GlobalModelSettings["image_generation_provider"]) {
    const firstModel = imageModelOptions[next][0]
    setValue((prev) => ({
      ...prev,
      image_generation_provider: next,
      image_generation_model: firstModel,
    }))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await api.put<GlobalModelSettings>("/api/settings/models", value)
      setValue(res.data)
      toast.success("AI model configuration updated successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not save model settings.")
    } finally {
      setSaving(false)
    }
  }

  const postModels = postModelOptions[value.post_generation_provider]
  const imageModels = imageModelOptions[value.image_generation_provider]

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Cpu className="size-4 text-blue-600" />
          AI Generation Engines & Model Selection
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Specify which foundational LLM and Image Diffusion providers execute post copy and poster background rendering.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="rounded-xl border bg-slate-50/80 p-3.5 text-xs text-slate-700">
          <p className="font-bold text-slate-900 mb-1">Provider Engine Mapping:</p>
          <ul className="grid gap-1 text-slate-600 list-disc list-inside">
            <li><span className="font-semibold text-slate-800">OpenAI</span>: Post copy generation and DALL-E 3 image generation</li>
            <li><span className="font-semibold text-slate-800">Gemini</span>: Multi-modal post generation, Imagen 3, and Image Vision Analysis</li>
            <li><span className="font-semibold text-slate-800">Anthropic Claude</span>: Nuanced long-form copy generation</li>
            <li><span className="font-semibold text-slate-800">Stability AI</span>: High-fidelity photorealistic backgrounds</li>
            <li><span className="font-semibold text-slate-800">Mistral</span>: Open-weight text completion engine</li>
          </ul>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-blue-600" />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Post Generation Model */}
          <div className="grid gap-3 rounded-xl border border-slate-200 p-4 bg-white shadow-2xs">
            <span className="text-xs font-bold text-slate-800">Post Copy Generation Model</span>
            <div className="grid gap-2">
              <Label className="text-[11px] font-semibold text-slate-600">Provider</Label>
              <Select value={value.post_generation_provider} onChange={(e) => changePostProvider(e.target.value as any)}>
                {Object.keys(postModelOptions).map((p) => (
                  <option key={p} value={p}>{providerLabel(p)}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-[11px] font-semibold text-slate-600">Model</Label>
              <Select value={value.post_generation_model} onChange={(e) => setValue((prev) => ({ ...prev, post_generation_model: e.target.value }))}>
                {postModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
          </div>

          {/* Image Generation Model */}
          <div className="grid gap-3 rounded-xl border border-slate-200 p-4 bg-white shadow-2xs">
            <span className="text-xs font-bold text-slate-800">Image / Poster Diffusion Model</span>
            <div className="grid gap-2">
              <Label className="text-[11px] font-semibold text-slate-600">Provider</Label>
              <Select value={value.image_generation_provider} onChange={(e) => changeImageProvider(e.target.value as any)}>
                {Object.keys(imageModelOptions).map((p) => (
                  <option key={p} value={p}>{p === "openai" ? "OpenAI / DALL-E" : providerLabel(p)}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-[11px] font-semibold text-slate-600">Model</Label>
              <Select value={value.image_generation_model} onChange={(e) => setValue((prev) => ({ ...prev, image_generation_model: e.target.value }))}>
                {imageModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button className="bg-blue-700 hover:bg-blue-800 text-white text-xs h-9 px-4" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
            Save Model Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
