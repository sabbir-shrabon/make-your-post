"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
} from "lucide-react"
import { toast } from "sonner"

import {
  templateNames,
  goalOptions,
  toneOptions,
  languages,
  dayOptions,
  personaColors,
  scheduleDayKeys,
  dayFullToAbbrev,
  PersonaScheduleData,
  PageTitle,
  PageMini,
  formatDate,
  scheduleDayLabel,
  activeDaysToAbbrev,
  scheduleFromLegacyPersona,
  Empty,
} from "@/components/dashboard/shared/dashboard-ui"
import {
  includeOptions,
  neverOptions,
  structureOptions,
  llmProviderModels,
  ModelPreference,
  ModelProviderOption,
  emptyPersona,
  promptConfig,
  buildSimplePrompt,
  buildRawPrompt,
  applyTemplate,
} from "@/lib/persona-utils"
import { PageConnection, AIPersona, PromptStudioConfig, PerformanceInsights } from "@/types/models"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { api, getApiErrorMessage } from "@/lib/api"
import { axiosInstance } from "@/lib/axios"
import { cn } from "@/lib/utils"

export function AISettingsView({ pages }: { pages: PageConnection[] }) {
  const router = useRouter()
  const { user } = useAuth()
  const userTimezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  const [selectedPageId, setSelectedPageId] = useState<number | null>(
    pages.find((p) => p.connection_status === "connected")?.id ?? pages[0]?.id ?? null
  )
  const [personas, setPersonas] = useState<AIPersona[]>([])
  const [loadingPersonas, setLoadingPersonas] = useState(true)
  const [editing, setEditing] = useState<AIPersona | null>(null)
  const [scheduleDraft, setScheduleDraft] = useState<PersonaScheduleData>({
    timezone: userTimezone,
    active_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    default_times: ["09:00"],
    day_overrides: {},
  })
  const [saving, setSaving] = useState(false)
  const [sample, setSample] = useState("")
  const [previewTab, setPreviewTab] = useState<"simple" | "raw">("simple")
  const [insights, setInsights] = useState<PerformanceInsights | null>(null)
  const [strategy, setStrategy] = useState<any>(null)
  const [prefilled, setPrefilled] = useState(false)

  // Brand Profile state
  const [brandProfile, setBrandProfile] = useState<any>({
    brand_name: "",
    logo_url: "",
    primary_color_hex: "#1a1a2e",
    secondary_color_hex: "#ff6b6b",
    font_pair_id: "space-grotesk-dm-sans",
    palette_id: "ink-sun",
    niche_description: "",
  })
  const [extractingBrand, setExtractingBrand] = useState(false)
  const [savingBrand, setSavingBrand] = useState(false)

  // Custom Fonts state
  const [installedFonts, setInstalledFonts] = useState<any[]>([])
  const [fontPairs, setFontPairs] = useState<any[]>([])
  const [loadingFonts, setLoadingFonts] = useState(false)
  const [customGoogleFontName, setCustomGoogleFontName] = useState("")
  const [downloadingFont, setDownloadingFont] = useState(false)
  const [uploadingFont, setUploadingFont] = useState(false)

  const selectedPage = pages.find((page) => page.id === selectedPageId) || pages[0]

  // Load Brand Kit Profile
  const loadBrandProfile = useCallback(() => {
    api.get("/api/brand/profile")
      .then((res) => {
        if (res.data && Object.keys(res.data).length > 0) {
          setBrandProfile((prev: any) => ({
            ...prev,
            ...res.data,
            logo_url: res.data.logo_url || selectedPage?.page_picture_url || "",
            brand_name: res.data.brand_name || selectedPage?.page_name || "My Brand",
          }))
        } else if (selectedPage) {
          setBrandProfile((prev: any) => ({
            ...prev,
            brand_name: selectedPage.page_name,
            logo_url: selectedPage.page_picture_url || "",
          }))
        }
      })
      .catch(() => null)
  }, [selectedPage])

  const loadPersonas = useCallback(() => {
    if (!selectedPage?.id) {
      setLoadingPersonas(false)
      return
    }
    setLoadingPersonas(true)
    api.get<AIPersona[]>(`/api/ai/personas/${selectedPage.id}`)
      .then((response) => {
        setPersonas(response.data)
      })
      .catch((err) => {
        console.error("Failed to load personas:", err)
        toast.error("Failed to load AI personas. Please try again.")
      })
      .finally(() => setLoadingPersonas(false))

    api.get<PerformanceInsights>(`/api/ai/performance/${selectedPage.id}`)
      .then((response) => setInsights(response.data))
      .catch(() => setInsights(null))
  }, [selectedPage?.id])

  useEffect(() => {
    if (!pages.length) return
    const connectedId = pages.find((p) => p.connection_status === "connected")?.id ?? pages[0]?.id ?? null
    if (connectedId !== selectedPageId) setSelectedPageId(connectedId)
    loadPersonas()
    loadBrandProfile()
  }, [loadPersonas, loadBrandProfile, pages, selectedPageId])

  useEffect(() => {
    if (editing?.id) {
      api.get(`/api/ai/personas/${editing.id}/strategy`).then((res) => setStrategy(res.data)).catch(() => setStrategy(null))
    } else {
      setStrategy(null)
    }
  }, [editing?.id])

  // --- Auto-Extract Brand Kit ---
  async function handleAutoExtractBrandKit() {
    if (!selectedPage) return toast.error("Connect a Facebook page first.")
    setExtractingBrand(true)
    try {
      const res = await axiosInstance.post("/api/brand/auto-extract", {
        page_connection_id: selectedPage.id,
        logo_url: selectedPage.page_picture_url || undefined,
      })
      if (res.data.success) {
        setBrandProfile((prev: any) => ({
          ...prev,
          brand_name: res.data.brand_name || prev.brand_name,
          logo_url: res.data.logo_url || prev.logo_url,
          primary_color_hex: res.data.primary_color_hex || prev.primary_color_hex,
          secondary_color_hex: res.data.secondary_color_hex || prev.secondary_color_hex,
          palette_id: res.data.palette_id || prev.palette_id,
          font_pair_id: res.data.font_pair_id || prev.font_pair_id,
          tone: res.data.tone || prev.tone,
        }))
        toast.success("Brand Identity & Colors extracted from your Facebook Page!")
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Brand Kit extraction failed.")
    } finally {
      setExtractingBrand(false)
    }
  }

  // --- Custom Fonts Handlers ---
  const loadFonts = useCallback(async () => {
    setLoadingFonts(true)
    try {
      const res = await axiosInstance.get("/api/fonts")
      setInstalledFonts(res.data.installed_fonts || [])
      setFontPairs(res.data.font_pairs || [])
    } catch {
      // ignore
    } finally {
      setLoadingFonts(false)
    }
  }, [])

  useEffect(() => {
    loadFonts()
  }, [loadFonts])

  async function handleDownloadGoogleFont(fontName?: string) {
    const target = fontName || customGoogleFontName
    if (!target?.trim()) return toast.error("Enter a Google Font name.")
    setDownloadingFont(true)
    try {
      const res = await axiosInstance.post("/api/fonts/download-google-font", {
        font_family: target.trim(),
      })
      toast.success(res.data.message || `Downloaded font ${target}!`)
      setCustomGoogleFontName("")
      loadFonts()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Could not download Google Font.")
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
      toast.success(res.data.message || "Custom font uploaded successfully!")
      loadFonts()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Font upload failed.")
    } finally {
      setUploadingFont(false)
      e.target.value = ""
    }
  }

  async function handleDeleteFont(filename: string) {
    if (!window.confirm(`Delete font file "${filename}"?`)) return
    try {
      await axiosInstance.delete(`/api/fonts/${filename}`)
      toast.success("Font removed.")
      loadFonts()
    } catch (err: any) {
      toast.error("Failed to delete font.")
    }
  }

  // --- Save Brand Kit ---
  async function handleSaveBrandKit() {
    setSavingBrand(true)
    try {
      await api.post("/api/brand/profile", brandProfile)
      toast.success("Brand Kit saved successfully!")
    } catch (err: any) {
      toast.error("Failed to save Brand Kit.")
    } finally {
      setSavingBrand(false)
    }
  }

  return (
    <div className="grid gap-6">
      {/* Title & Page Selector */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <PageTitle
          title="Brand Kit & AI Personas"
          subtitle="Configure your brand identity once, and craft tailored AI content personas."
        />
        {pages.length > 1 && (
          <div className="w-full sm:w-64">
            <Select
              value={String(selectedPageId ?? pages[0].id)}
              onChange={(e) => setSelectedPageId(Number(e.target.value))}
            >
              {pages.map((page) => (
                <option key={page.id} value={String(page.id)}>
                  {page.page_name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* --- 1-Click Brand Kit Profile Card --- */}
      <Card className="border-indigo-100 bg-gradient-to-r from-purple-50/60 via-white to-blue-50/60 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xs">
                <Palette className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Brand Kit Autopilot</CardTitle>
                <CardDescription className="text-xs">
                  Your logo, brand palette, and typography automatically applied to every generated poster.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-purple-300 text-purple-800 hover:bg-purple-50 text-xs font-semibold"
                onClick={handleAutoExtractBrandKit}
                disabled={extractingBrand || !selectedPage}
              >
                {extractingBrand ? (
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                ) : (
                  <Sparkles className="size-3.5 mr-1.5 text-purple-600" />
                )}
                Auto-Extract from Page
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold"
                onClick={handleSaveBrandKit}
                disabled={savingBrand}
              >
                {savingBrand ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Check className="size-3.5 mr-1.5" />}
                Save Brand Kit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-center">
          {/* Brand Identity / Logo Preview */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <div className="size-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
              {brandProfile.logo_url ? (
                <img src={brandProfile.logo_url} alt="Brand Logo" className="size-full object-cover" />
              ) : (
                <Palette className="size-6 text-slate-400" />
              )}
            </div>
            <div className="grid gap-0.5 overflow-hidden">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Brand Name</span>
              <Input
                value={brandProfile.brand_name || ""}
                onChange={(e) => setBrandProfile({ ...brandProfile, brand_name: e.target.value })}
                className="h-7 text-xs font-semibold text-slate-800 px-1.5"
                placeholder="Brand Name"
              />
            </div>
          </div>

          {/* Brand Colors */}
          <div className="grid gap-1.5 rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Primary & Secondary</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={brandProfile.primary_color_hex || "#1877F2"}
                  onChange={(e) => setBrandProfile({ ...brandProfile, primary_color_hex: e.target.value })}
                  className="size-6 rounded cursor-pointer border border-slate-300 p-0"
                />
                <span className="text-xs font-mono text-slate-600">{brandProfile.primary_color_hex}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={brandProfile.secondary_color_hex || "#42B72A"}
                  onChange={(e) => setBrandProfile({ ...brandProfile, secondary_color_hex: e.target.value })}
                  className="size-6 rounded cursor-pointer border border-slate-300 p-0"
                />
                <span className="text-xs font-mono text-slate-600">{brandProfile.secondary_color_hex}</span>
              </div>
            </div>
          </div>

          {/* Design System Palette */}
          <div className="grid gap-1.5 rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Design System Palette</span>
            <Select
              value={brandProfile.palette_id || "ink-sun"}
              onChange={(e) => setBrandProfile({ ...brandProfile, palette_id: e.target.value })}
              className="h-7 text-xs"
            >
              <option value="ink-sun">Ink Sun (Bold Tech)</option>
              <option value="cream-berry">Cream Berry (Warm Food)</option>
              <option value="midnight-mint">Midnight Mint (Fresh Tech)</option>
              <option value="paper-tomato">Paper Tomato (Retail & Energetic)</option>
              <option value="forest-lime">Forest Lime (Organic & Natural)</option>
              <option value="cobalt-coral">Cobalt Coral (Social & Playful)</option>
              <option value="charcoal-lilac">Charcoal Lilac (Premium Beauty)</option>
              <option value="white-emerald">White Emerald (Clean Wellness)</option>
            </Select>
          </div>

          {/* Typography Font Pair */}
          <div className="grid gap-1.5 rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Typography Font Pair</span>
            <Select
              value={brandProfile.font_pair_id || "space-grotesk-dm-sans"}
              onChange={(e) => setBrandProfile({ ...brandProfile, font_pair_id: e.target.value })}
              className="h-7 text-xs"
            >
              <option value="space-grotesk-dm-sans">Space Grotesk / DM Sans</option>
              <option value="playfair-montserrat">Playfair Display / Montserrat</option>
              <option value="oswald-inter">Oswald / Inter</option>
              <option value="merriweather-roboto">Merriweather / Roboto</option>
              <option value="syne-plus-jakarta">Syne / Plus Jakarta Sans</option>
              {installedFonts.map((f) => (
                <option key={f.filename} value={f.family.toLowerCase()}>
                  {f.family} (Custom Installed)
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* --- Custom Fonts & Typography Manager Card --- */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-xs">
                <Type className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Custom Typography & Font Manager</CardTitle>
                <CardDescription className="text-xs">
                  Install Google Fonts or upload custom downloaded font files (.ttf, .otf, .woff2) to use in poster rendering.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-bold text-purple-700 border-purple-200">
              {installedFonts.length} Fonts Installed
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 grid gap-5">
          {/* 1-Click Installers */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Google Font Quick Installer */}
            <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-b from-purple-50/30 to-white grid gap-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Globe className="size-3.5 text-purple-600" />
                1-Click Google Font Downloader
              </span>
              <div className="flex gap-2">
                <Input
                  value={customGoogleFontName}
                  onChange={(e) => setCustomGoogleFontName(e.target.value)}
                  placeholder="e.g. Outfit, Plus Jakarta Sans, Syne, Cabinet Grotesk"
                  className="text-xs h-8 bg-white"
                />
                <Button
                  onClick={() => handleDownloadGoogleFont()}
                  disabled={downloadingFont}
                  size="sm"
                  className="bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs h-8 px-3 shrink-0"
                >
                  {downloadingFont ? <Loader2 className="size-3 animate-spin" /> : "Install"}
                </Button>
              </div>

              {/* Trending Google Font Quick Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {["Outfit", "Plus Jakarta Sans", "Cabinet Grotesk", "Clash Display", "Playfair Display", "Poppins", "Montserrat", "Bebas Neue"].map((font) => (
                  <button
                    key={font}
                    type="button"
                    onClick={() => handleDownloadGoogleFont(font)}
                    disabled={downloadingFont}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-slate-700 transition-all font-medium"
                  >
                    + {font}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Font File Uploader */}
            <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex flex-col justify-between items-center text-center">
              <div>
                <Type className="size-6 text-slate-400 mx-auto mb-1.5" />
                <span className="text-xs font-bold text-slate-800 block">Upload Downloaded Font File</span>
                <span className="text-[11px] text-slate-500">Supports .ttf, .otf, .woff, .woff2 files</span>
              </div>
              <label className="mt-3 cursor-pointer">
                <input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  onChange={handleUploadFontFile}
                  disabled={uploadingFont}
                  className="hidden"
                />
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 border border-slate-200 shadow-xs text-xs font-semibold text-slate-700 transition-all">
                  {uploadingFont ? (
                    <>
                      <Loader2 className="size-3 animate-spin mr-1" /> Uploading...
                    </>
                  ) : (
                    <>
                      <Plus className="size-3.5 text-blue-600" /> Choose Font File
                    </>
                  )}
                </span>
              </label>
            </div>
          </div>

          {/* Installed Fonts Gallery */}
          <div className="grid gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Installed Fonts Directory</span>
            {loadingFonts ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-5 animate-spin text-purple-600" />
              </div>
            ) : installedFonts.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No custom fonts installed yet.</p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {installedFonts.map((f) => (
                  <div
                    key={f.filename}
                    className="p-3 rounded-lg border border-slate-200 bg-white hover:border-purple-300 transition-all flex flex-col justify-between shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 truncate">{f.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteFont(f.filename)}
                          className="size-6 p-0 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{f.size_kb} KB · {f.filename}</span>
                    </div>

                    <div className="mt-2.5 p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-700 font-semibold tracking-wide truncate">
                        Aa Bb Cc 123
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setBrandProfile({ ...brandProfile, font_pair_id: f.family.toLowerCase() })
                          toast.success(`Set "${f.family}" as active Brand Kit font!`)
                        }}
                        className="text-[10px] font-bold text-purple-700 hover:underline shrink-0"
                      >
                        Use in Brand Kit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --- Personas List Section --- */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">AI Content Personas</h3>
          <p className="text-xs text-slate-500">Personas define the voice, tone, and scheduling rules for your page.</p>
        </div>
        <Button
          onClick={() => {
            const fresh = emptyPersona()
            fresh.brand_palette_id = brandProfile.palette_id || "ink-sun"
            fresh.brand_font_pair_id = brandProfile.font_pair_id || "space-grotesk-dm-sans"
            setEditing(fresh)
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 shadow-xs"
        >
          <Plus className="size-3.5 mr-1.5" />
          Create AI Persona
        </Button>
      </div>

      {loadingPersonas ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-6 animate-spin text-purple-600" />
        </div>
      ) : personas.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <Wand2 className="size-10 text-purple-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-800">No Personas Setup Yet</h4>
          <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
            Set up an AI persona to define your page niche, tone of voice, and autonomous posting schedule.
          </p>
          <Button
            onClick={() => setEditing(emptyPersona())}
            className="bg-purple-700 hover:bg-purple-800 text-white text-xs"
          >
            <Plus className="size-3.5 mr-1.5" />
            Set Up Your First Persona
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {personas.map((persona) => (
            <Card key={persona.id} className="shadow-xs hover:border-purple-300 transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] text-purple-700 border-purple-200">
                    {persona.priority_level} Priority
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                      onClick={() => setEditing(persona)}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-sm font-bold mt-1 text-slate-900">{persona.persona_name}</CardTitle>
                <CardDescription className="text-xs line-clamp-2">{persona.niche}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 grid gap-2 text-xs text-slate-600">
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(persona.tone_tags) ? persona.tone_tags : []).map(
                    (tone: string, idx: number) => (
                      <span key={idx} className="rounded bg-purple-50 text-purple-800 px-1.5 py-0.5 text-[10px] font-medium">
                        {tone}
                      </span>
                    )
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>Schedule: {Array.isArray(persona.assigned_days) ? persona.assigned_days.join(", ") : "Everyday"}</span>
                  <span className="font-semibold text-slate-700">{persona.total_posts_published || 0} posts</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* --- Streamlined 3-Step Persona Wizard Modal --- */}
      {editing && (
        <StreamlinedPersonaModal
          draft={editing}
          brandProfile={brandProfile}
          saving={saving}
          schedule={scheduleDraft}
          onScheduleChange={setScheduleDraft}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={async () => {
            if (!editing.niche.trim()) return toast.error("Please specify your page niche/topic.")
            setSaving(true)
            try {
              const payload = {
                ...editing,
                assigned_days: activeDaysToAbbrev(scheduleDraft.active_days),
                posting_time_slots: scheduleDraft.default_times,
              }
              if (editing.id) {
                await api.put(`/api/ai/personas/${editing.id}`, payload)
              } else {
                await api.post(`/api/ai/personas/${selectedPage.id}`, payload)
              }
              toast.success("Persona saved successfully!")
              setEditing(null)
              loadPersonas()
            } catch (err: any) {
              toast.error(err.response?.data?.detail || "Failed to save persona.")
            } finally {
              setSaving(false)
            }
          }}
        />
      )}
    </div>
  )
}

function StreamlinedPersonaModal({
  draft,
  brandProfile,
  saving,
  schedule,
  onScheduleChange,
  onChange,
  onClose,
  onSave,
}: {
  draft: AIPersona
  brandProfile: any
  saving: boolean
  schedule: PersonaScheduleData
  onScheduleChange: (schedule: PersonaScheduleData) => void
  onChange: (persona: AIPersona) => void
  onClose: () => void
  onSave: () => void
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const config = promptConfig(draft)

  function toggleTone(tone: string) {
    const current = Array.isArray(draft.tone_tags) ? draft.tone_tags : []
    const next = current.includes(tone) ? current.filter((t) => t !== tone) : [...current, tone].slice(0, 4)
    onChange({ ...draft, tone_tags: next })
  }

  function toggleDay(day: string) {
    const active = schedule.active_days.includes(day)
      ? schedule.active_days.filter((d) => d !== day)
      : [...schedule.active_days, day]
    onScheduleChange({ ...schedule, active_days: active })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-4 flex items-center justify-center animate-in fade-in duration-200">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-purple-600 text-white">
                <Wand2 className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">
                  {draft.id ? "Edit AI Persona" : "Create New AI Persona"}
                </CardTitle>
                <CardDescription className="text-xs">
                  Define your brand tone, audience focus, and posting schedule in 3 simple steps.
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="size-8 p-0" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 grid gap-5">
          {/* Step 1: Page Niche & Topic Focus */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1. Page Niche & Topic Focus <span className="text-red-500">*</span>
              </Label>
              <span className="text-[11px] text-slate-500">What is this page about?</span>
            </div>
            <Input
              value={draft.niche || ""}
              onChange={(e) => onChange({ ...draft, niche: e.target.value })}
              placeholder="e.g. Daily productivity tips, tech founder growth hacks, and startup advice"
              className="text-sm font-medium"
            />
          </div>

          {/* Step 2: Tone of Voice */}
          <div className="grid gap-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              2. Brand Tone of Voice (Select up to 4)
            </Label>
            <div className="flex flex-wrap gap-2">
              {[
                "Authoritative",
                "Inspiring",
                "Casual",
                "Direct",
                "Friendly",
                "Humorous",
                "Value-Packed",
                "Educational",
                "Professional",
              ].map((tone) => {
                const currentTones = Array.isArray(draft.tone_tags) ? draft.tone_tags : []
                const isSelected = currentTones.includes(tone)
                return (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => toggleTone(tone)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border",
                      isSelected
                        ? "bg-purple-700 text-white border-purple-700 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {isSelected && <Check className="size-3.5 inline mr-1" />}
                    {tone}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Step 3: Audience & Goal */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">Target Audience</Label>
              <Input
                value={config.audience || ""}
                onChange={(e) => onChange({ ...draft, prompt_config: { ...config, audience: e.target.value } })}
                placeholder="e.g. Startup founders & indie creators"
                className="text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">Primary Goal</Label>
              <Select
                value={config.goal || "Drive Comments & Discussion"}
                onChange={(e) => onChange({ ...draft, prompt_config: { ...config, goal: e.target.value } })}
                className="text-sm"
              >
                <option value="Drive Comments & Discussion">Drive Comments & Discussion</option>
                <option value="Educate & Provide Actionable Advice">Educate & Provide Actionable Advice</option>
                <option value="Inspire & Motivate">Inspire & Motivate</option>
                <option value="Promote Brand Products & Services">Promote Brand Products & Services</option>
              </Select>
            </div>
          </div>

          {/* Posting Schedule */}
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-slate-600" />
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Autonomous Posting Schedule
                </Label>
              </div>
              <span className="text-[11px] text-slate-500">Active Days</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                const isActive = schedule.active_days.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all border text-center",
                      isActive
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          {/* --- Collapsible Advanced Developer Settings Accordion --- */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Settings2 className="size-4 text-slate-500" />
                ⚙️ Advanced Prompt Rules & Developer Settings (Optional)
              </span>
              {showAdvanced ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>

            {showAdvanced && (
              <div className="p-4 grid gap-4 bg-white border-t border-slate-200 animate-in fade-in duration-200">
                <div className="grid gap-2">
                  <Label className="text-xs font-medium">Custom Prompt Instructions</Label>
                  <Textarea
                    value={draft.custom_instructions || ""}
                    onChange={(e) => onChange({ ...draft, custom_instructions: e.target.value })}
                    placeholder="Enter any specific phrasing guidelines or brand rules in your own words..."
                    className="min-h-24 text-xs font-mono"
                  />
                </div>

                <div className="grid gap-2">
                  <Label className="text-xs font-medium">Persona Name & Priority</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={draft.persona_name || ""}
                      onChange={(e) => onChange({ ...draft, persona_name: e.target.value })}
                      placeholder="Persona Name"
                      className="text-xs"
                    />
                    <Select
                      value={draft.priority_level || "Normal"}
                      onChange={(e) => onChange({ ...draft, priority_level: e.target.value as any })}
                      className="text-xs"
                    >
                      <option value="High">High Priority</option>
                      <option value="Normal">Normal Priority</option>
                      <option value="Low">Low Priority</option>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Engagement Learning Mode</p>
                    <p className="text-[11px] text-slate-500">
                      Continuously adapts prompts based on Facebook comment & like analytics.
                    </p>
                  </div>
                  <Switch
                    checked={draft.learning_mode_enabled}
                    onCheckedChange={(checked) => onChange({ ...draft, learning_mode_enabled: checked })}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-purple-700 hover:bg-purple-800 text-white font-semibold shadow-xs"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Check className="size-4 mr-1.5" />}
            Save Persona & Schedule
          </Button>
        </div>
      </Card>
    </div>
  )
}
