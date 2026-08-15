import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Loader2, FlaskConical, CheckCircle2, AlertTriangle, AlertCircle, Copy, Check, FileImage, Send, ArrowRight, RefreshCw, Layers, Award, Wand2, Plus, Palette, Trash2, ArrowUp, ArrowDown, Bold, Sun, Zap, Compass, Quote, BookmarkPlus, LayoutTemplate, Info, Eye, Code, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { axiosInstance } from "@/lib/axios"
import { toast } from "sonner"
import dynamic from 'next/dynamic'
import { SaveCanvasAsTemplateDialog } from "./SaveCanvasAsTemplateDialog"

const InteractiveCanvas = dynamic(
  () => import('./InteractiveCanvas').then((mod) => mod.InteractiveCanvas),
  { ssr: false }
)

const PRESET_TOPICS = [
  { label: "🌴 Summer Tropical Sale", topic: "Summer Mega Sale — 50% Off Tropical Collection", hint: "summer" },
  { label: "⚡ Flash Promo 50% Off", topic: "Flash Deal: All Items 50% Off This Weekend Only", hint: "promo" },
  { label: "🚀 SaaS & Tech Launch", topic: "Next-Gen AI Automation Studio — Ship 10x Faster", hint: "tech" },
  { label: "✍️ Founder Quote", topic: "Focus on creating value, and success will follow effortlessly.", hint: "quote" },
]

const COLOR_SWATCHES = [
  "#EF4444", "#F59E0B", "#10B981", "#0D9488", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899", "#FFFFFF", "#0F172A"
]

export function AgenticPosterLab() {
  const router = useRouter()
  const [topic, setTopic] = useState("")
  const [loading, setLoading] = useState(false)
  const [trace, setTrace] = useState<any>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [useNewsGrounding, setUseNewsGrounding] = useState(false)
  const [allowPexelsBg, setAllowPexelsBg] = useState(false)
  const [allowCatBg, setAllowCatBg] = useState(false)
  const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null)
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0)
  const [regeneratingLayer, setRegeneratingLayer] = useState(false)
  const [regenPromptHint, setRegenPromptHint] = useState("")

  // Template State
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("auto")
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false)
  const [blueprintTemplate, setBlueprintTemplate] = useState<any | null>(null)

  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await axiosInstance.get("/api/poster/templates")
        if (res.data?.templates) {
          setTemplates(res.data.templates)
        }
      } catch (e) {
        console.error("Failed to load poster templates:", e)
      }
    }
    loadTemplates()

    // Check if a template was pre-selected from Template Library
    const prefillTpl = sessionStorage.getItem("poster_lab_selected_template")
    if (prefillTpl) {
      setSelectedTemplateId(prefillTpl)
      sessionStorage.removeItem("poster_lab_selected_template")
      toast.success(`Selected template: ${prefillTpl}`)
    }
  }, [])

  async function copyPathToClipboard(path: string) {
    if (!path) return
    try {
      await navigator.clipboard.writeText(path)
      setCopied(true)
      toast.success("Output path copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy path automatically.")
    }
  }

  async function handleGenerate(e?: React.FormEvent, customTopic?: string) {
    if (e) e.preventDefault()
    const targetTopic = (customTopic || topic).trim()
    if (!targetTopic) return

    setLoading(true)
    setError("")
    setTrace(null)
    setCopied(false)
    setSelectedElementIndex(null)
    setSelectedVariantIndex(0)

    try {
      const res = await axiosInstance.post("/api/poster/assemble-trace", {
        topic: targetTopic,
        aspect_ratio: "1:1",
        use_news_grounding: useNewsGrounding,
        allow_pexels_bg: allowPexelsBg,
        allow_cat_bg: allowCatBg,
        template_id: selectedTemplateId !== "auto" ? selectedTemplateId : undefined,
      })
      setTrace(res.data)

      if (res.data?.output_path) {
        await copyPathToClipboard(res.data.output_path)
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail ??
        err.message ??
        "Unknown error occurred"
      )
    } finally {
      setLoading(false)
    }
  }

  function handleSelectVariant(variant: any, index: number) {
    setSelectedVariantIndex(index)
    if (!trace) return

    setTrace({
      ...trace,
      art_director: variant.art_director || trace.art_director,
      resolved_assets: variant.resolved_assets || trace.resolved_assets,
      final_opacity: variant.final_opacity ?? trace.final_opacity,
      base64_image: variant.base64_image || trace.base64_image,
      output_path: variant.output_path || trace.output_path,
      vision_critic: variant.vision_critic || trace.vision_critic,
    })
    setSelectedElementIndex(null)
    toast.success(`Loaded Variant #${index + 1}`)
  }

  async function handleRegenerateLayer() {
    if (selectedElementIndex === null || !trace) return
    setRegeneratingLayer(true)

    try {
      const res = await axiosInstance.post("/api/poster/regenerate-layer", {
        element_index: selectedElementIndex,
        current_state: trace,
        topic: topic.trim() || "Social Poster",
        prompt_hint: regenPromptHint.trim() || undefined,
        allow_pexels_bg: allowPexelsBg,
        allow_cat_bg: allowCatBg,
      })

      if (res.data?.status === "success") {
        setTrace({
          ...trace,
          resolved_assets: res.data.resolved_assets,
          base64_image: res.data.base64_image,
          output_path: res.data.output_path,
          final_opacity: res.data.final_opacity,
        })
        setRegenPromptHint("")
        toast.success(`Layer #${selectedElementIndex + 1} regenerated successfully!`)
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to regenerate layer")
    } finally {
      setRegeneratingLayer(false)
    }
  }

  // Quick Layer Manipulation Helpers
  function handleUpdateSelected(patch: any) {
    if (selectedElementIndex === null || !trace?.resolved_assets?.[selectedElementIndex]) return
    const newAssets = [...trace.resolved_assets]
    newAssets[selectedElementIndex] = { ...newAssets[selectedElementIndex], ...patch }
    setTrace({ ...trace, resolved_assets: newAssets })
  }

  function handleDeleteSelected() {
    if (selectedElementIndex === null || !trace?.resolved_assets) return
    const newAssets = trace.resolved_assets.filter((_: any, i: number) => i !== selectedElementIndex)
    setTrace({ ...trace, resolved_assets: newAssets })
    setSelectedElementIndex(null)
    toast.success("Layer removed from canvas")
  }

  function handleAddVectorAsset(shapeId: string, role: string, size: { w: number; h: number }, pos: { x: number; y: number }, content?: string) {
    if (!trace) return
    const newAsset: any = {
      type: role === "cta" ? "text" : (role === "badge" ? "badge" : "shape"),
      role: role,
      shape_id: shapeId,
      content: content || (role === "cta" ? "SHOP NOW" : (role === "badge" ? "50% OFF" : undefined)),
      badge_text: role === "badge" ? (content || "50% OFF") : undefined,
      x: pos.x,
      y: pos.y,
      w: size.w,
      h: size.h,
      z_index: (trace.resolved_assets?.length || 0) + 1,
      color: "#0D9488",
    }
    const newAssets = [...(trace.resolved_assets || []), newAsset]
    setTrace({ ...trace, resolved_assets: newAssets })
    setSelectedElementIndex(newAssets.length - 1)
    toast.success(`Added ${shapeId} to canvas!`)
  }

  const selectedElement = selectedElementIndex !== null && trace?.resolved_assets?.[selectedElementIndex] ? trace.resolved_assets[selectedElementIndex] : null

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards">
      {/* Left Column: Generation Controls & Inspector */}
      <Card className="lg:col-span-1 h-fit shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-700">
            <FlaskConical className="size-5 text-purple-600" />
            Agentic Poster Studio
          </CardTitle>
          <CardDescription>
            Canva-grade automated poster composition with vector graphics &amp; auto-layout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => handleGenerate(e)} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="topic" className="font-semibold">Topic / Creative Brief</Label>
              <Input
                id="topic"
                placeholder="e.g. Summer Flash Sale — 50% Off Everything"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
                className="focus-visible:ring-purple-600"
              />
            </div>

            {/* Thematic Preset Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_TOPICS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setTopic(preset.topic)
                    handleGenerate(undefined, preset.topic)
                  }}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Template Architecture Selector */}
            <div className="grid gap-1.5 pt-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="template-select" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <LayoutTemplate className="size-3.5 text-purple-600" />
                  Template / Layout Blueprint
                </Label>
                {selectedTemplateId !== "auto" && (
                  <button
                    type="button"
                    onClick={() => {
                      const t = templates.find((x) => x.id === selectedTemplateId)
                      if (t) setBlueprintTemplate(t)
                    }}
                    className="text-[11px] text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                  >
                    <Info className="size-3" /> View Blueprint
                  </button>
                )}
              </div>
              <select
                id="template-select"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                disabled={loading}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 disabled:opacity-50"
              >
                <option value="auto">✨ Auto (AI Art Director Choice)</option>
                {templates.filter((t) => t.is_system).length > 0 && (
                  <optgroup label="── Built-In System Templates ──">
                    {templates
                      .filter((t) => t.is_system)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.category})
                        </option>
                      ))}
                  </optgroup>
                )}
                {templates.filter((t) => !t.is_system).length > 0 && (
                  <optgroup label="── My Custom Templates ──">
                    {templates
                      .filter((t) => !t.is_system)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          ⭐ {t.name}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 mt-1">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="use-news-grounding" className="text-xs font-medium cursor-pointer">Live Trend Grounding</Label>
                <Switch id="use-news-grounding" checked={useNewsGrounding} onCheckedChange={setUseNewsGrounding} disabled={loading} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="allow-pexels-bg" className="text-xs font-medium cursor-pointer">Pexels Photo Background</Label>
                <Switch id="allow-pexels-bg" checked={allowPexelsBg} onCheckedChange={setAllowPexelsBg} disabled={loading} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="allow-cat-bg" className="text-xs font-medium cursor-pointer">Cat Photo Background</Label>
                <Switch id="allow-cat-bg" checked={allowCatBg} onCheckedChange={setAllowCatBg} disabled={loading} />
              </div>
            </div>

            <Button 
              type="submit" 
              className="bg-purple-700 text-white hover:bg-purple-800 w-full font-semibold shadow-md mt-1"
              disabled={loading || !topic.trim()}
            >
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
              {loading ? "Assembling Canva-grade designs..." : "Generate Poster Variants"}
            </Button>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 p-3 rounded-md border border-red-100 mt-2">
                {error}
              </div>
            )}
          </form>

          {/* Design Inspector */}
          {trace && (
            <div className="mt-6 space-y-4 border-t pt-5">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  Art Director Intelligence
                  <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 font-mono">1-Pass</Badge>
                </h4>
                <div className="text-xs space-y-1.5 text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900">Template:</span>{" "}
                      <span className="font-mono text-purple-700">{trace.art_director?.template_id}</span>
                    </div>
                    {trace.art_director?.template_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-1.5 text-purple-700 hover:bg-purple-100 gap-1"
                        onClick={() => {
                          const t = templates.find((x) => x.id === trace.art_director?.template_id) || {
                            id: trace.art_director?.template_id,
                            name: trace.art_director?.template_id,
                            slots: {},
                          }
                          setBlueprintTemplate(t)
                        }}
                      >
                        <Code className="size-3" /> Blueprint
                      </Button>
                    )}
                  </div>
                  <div><span className="font-semibold text-slate-900">Palette:</span> {trace.art_director?.palette_id}</div>
                  <div><span className="font-semibold text-slate-900">Typography:</span> {trace.art_director?.font_pair_id}</div>
                </div>
              </div>

              {/* Layer Stack Inspector */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  Canvas Layers
                  <Badge variant="outline" className="text-[10px] bg-slate-100 font-mono">{trace.resolved_assets?.length || 0} active</Badge>
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {trace.resolved_assets?.map((asset: any, i: number) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedElementIndex(i)}
                      className={`text-xs p-2 rounded-md flex items-center justify-between border cursor-pointer transition-all ${
                        selectedElementIndex === i ? 'border-purple-600 bg-purple-50/80 ring-1 ring-purple-600 font-medium' : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-[10px] font-mono text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">#{i+1}</span>
                        <span className="truncate text-slate-800">{asset.content || asset.badge_text || asset.shape_id || asset.role || asset.type}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1.5 py-0">
                        {asset.role || asset.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right Column: Canva Stage & Quick Toolbar */}
      <Card className="lg:col-span-2 min-h-[550px] flex flex-col shadow-md">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2 font-bold text-slate-900">
              <Award className="size-4 text-purple-600" />
              Canva-Grade Generative Stage
            </span>
            <div className="flex items-center gap-2">
              {trace && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50 font-medium"
                  onClick={() => setIsSaveTemplateOpen(true)}
                  title="Save current layout as a reusable template"
                >
                  <BookmarkPlus className="size-3.5 text-purple-600" />
                  Save as Template
                </Button>
              )}
              {trace?.output_path && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50 font-medium"
                  onClick={() => copyPathToClipboard(trace.output_path)}
                >
                  {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  {copied ? "Path Copied!" : "Copy Output Path"}
                </Button>
              )}
            </div>
          </CardTitle>
          <CardDescription className="text-xs">
            Direct interactive manipulation: Click, drag, resize, restyle, or insert Canva-grade vector components.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col items-center justify-center bg-slate-100/60 p-6 gap-4">
          {loading ? (
            <div className="flex flex-col items-center text-slate-500 gap-3 py-16">
              <Loader2 className="size-10 animate-spin text-purple-600" />
              <p className="text-sm font-semibold">Composing vector assets &amp; validating zero-collision layout...</p>
            </div>
          ) : trace?.base64_image ? (
            <div className="flex flex-col items-center gap-4 w-full max-w-lg">
              
              {/* Multi-Variant Selector */}
              {trace.variants && trace.variants.length > 1 && (
                <div className="w-full bg-white p-2.5 rounded-lg border border-purple-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Award className="size-3.5 text-purple-600" />
                      Design Variations ({trace.variants.length})
                    </span>
                    <span className="text-[11px] text-slate-500">1-Click Switcher</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {trace.variants.map((v: any, idx: number) => {
                      const isSelected = selectedVariantIndex === idx
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectVariant(v, idx)}
                          className={`relative rounded-lg overflow-hidden border-2 text-left p-1 transition-all bg-slate-50 ${
                            isSelected ? 'border-purple-600 ring-2 ring-purple-600/20 bg-purple-50/50' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="aspect-square w-full rounded overflow-hidden bg-slate-200 mb-1">
                            {v.base64_image && (
                              <img src={`data:image/png;base64,${v.base64_image}`} alt={`Variant ${idx+1}`} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[11px] font-bold text-slate-800">
                              #{idx + 1} {v.is_winner && "⭐"}
                            </span>
                            <Badge variant={isSelected ? "default" : "outline"} className={`text-[10px] px-1 py-0 ${isSelected ? 'bg-purple-700' : ''}`}>
                              {Math.round((v.composite_score || 0.9) * 100)}%
                            </Badge>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Floating Quick Action / Asset Insert Bar */}
              <div className="w-full bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between gap-1 overflow-x-auto">
                <span className="text-[11px] font-bold text-slate-500 uppercase px-2 shrink-0">Add Asset:</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 px-2 border-amber-200 bg-amber-50/50 text-amber-900 hover:bg-amber-100"
                    onClick={() => handleAddVectorAsset("sunburst-rays", "background", { w: 1080, h: 1080 }, { x: 0, y: 0 })}
                  >
                    <Sun className="size-3 text-amber-600" /> + Sunburst
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 px-2 border-emerald-200 bg-emerald-50/50 text-emerald-900 hover:bg-emerald-100"
                    onClick={() => handleAddVectorAsset("tropical-palm-fronds", "corner_accent", { w: 220, h: 220 }, { x: 840, y: 0 })}
                  >
                    🌴 + Leaves
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 px-2 border-red-200 bg-red-50/50 text-red-900 hover:bg-red-100"
                    onClick={() => handleAddVectorAsset("starburst-badge", "badge", { w: 160, h: 160 }, { x: 860, y: 40 }, "50% OFF")}
                  >
                    <Zap className="size-3 text-red-600" /> + Starburst
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 px-2 border-teal-200 bg-teal-50/50 text-teal-900 hover:bg-teal-100"
                    onClick={() => handleAddVectorAsset("pill-button", "cta", { w: 320, h: 64 }, { x: 380, y: 920 }, "SHOP NOW")}
                  >
                    <Plus className="size-3 text-teal-600" /> + Pill CTA
                  </Button>
                </div>
              </div>

              {/* Main Interactive Stage */}
              <div className="relative w-full rounded-xl overflow-hidden bg-white shadow-xl ring-1 ring-black/5 flex items-center justify-center p-2">
                {trace.resolved_assets?.length > 0 ? (
                  <InteractiveCanvas 
                    trace={trace} 
                    onUpdateElement={(index, newProps) => {
                      const newTrace = { ...trace };
                      newTrace.resolved_assets[index] = newProps;
                      setTrace(newTrace);
                    }}
                    onSelectElement={setSelectedElementIndex}
                    selectedElementIndex={selectedElementIndex}
                  />
                ) : (
                  <img 
                    src={`data:image/png;base64,${trace.base64_image}`} 
                    alt="Generated Poster" 
                    className="w-full h-full object-cover rounded-lg"
                  />
                )}
              </div>

              {/* Context Floating Styling Toolbar for Selected Layer */}
              {selectedElement && (
                <div className="w-full bg-white p-3 rounded-lg border border-purple-200 shadow-md flex flex-col gap-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                      <Palette className="size-3.5 text-purple-600" />
                      Styling Layer #{selectedElementIndex! + 1}: <span className="font-mono text-purple-700 capitalize">{selectedElement.role || selectedElement.type}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-red-600 hover:bg-red-50 text-[11px] gap-1"
                        onClick={handleDeleteSelected}
                      >
                        <Trash2 className="size-3" /> Remove
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-slate-500 hover:bg-slate-100 text-[11px]"
                        onClick={() => setSelectedElementIndex(null)}
                      >
                        Done
                      </Button>
                    </div>
                  </div>

                  {/* Color Swatches */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <span className="text-[11px] text-slate-500 font-medium shrink-0">Color:</span>
                    {COLOR_SWATCHES.map((hex, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleUpdateSelected({ color: hex })}
                        style={{ backgroundColor: hex }}
                        className={`size-5 rounded-full border border-slate-300 shrink-0 transition-transform ${
                          selectedElement.color === hex ? 'ring-2 ring-purple-600 ring-offset-1 scale-110' : 'hover:scale-105'
                        }`}
                        title={hex}
                      />
                    ))}
                  </div>

                  {/* Text Size Nudge & Font Weight */}
                  {selectedElement.type === "text" && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 font-medium">Font Size:</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleUpdateSelected({ font_size: Math.max(12, (selectedElement.font_size || 24) - 4) })}
                        >
                          A-
                        </Button>
                        <span className="text-xs font-mono font-semibold w-8 text-center">{Math.round(selectedElement.font_size || 24)}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleUpdateSelected({ font_size: Math.min(160, (selectedElement.font_size || 24) + 4) })}
                        >
                          A+
                        </Button>
                      </div>

                      <Button
                        variant={selectedElement.font_weight === "bold" ? "default" : "outline"}
                        size="sm"
                        className={`h-6 px-2 text-xs gap-1 ${selectedElement.font_weight === "bold" ? 'bg-purple-700' : ''}`}
                        onClick={() => handleUpdateSelected({ font_weight: selectedElement.font_weight === "bold" ? "normal" : "bold" })}
                      >
                        <Bold className="size-3" /> Bold
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Export to Composer Button */}
              <Button
                className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold shadow-md flex items-center justify-center gap-2 py-5"
                onClick={() => {
                  try {
                    if (trace.base64_image) {
                      sessionStorage.setItem("composer_prefill_image", `data:image/png;base64,${trace.base64_image}`)
                    } else if (trace.output_path) {
                      sessionStorage.setItem("composer_prefill_image", trace.output_path)
                    }
                    if (topic) {
                      sessionStorage.setItem("composer_prefill_topic", topic)
                    }
                    toast.success("Sending design to Post Composer...")
                    router.push("/dashboard/create")
                  } catch (e) {
                    toast.error("Could not transfer graphic to Composer.")
                  }
                }}
              >
                <ArrowRight className="size-4" />
                Schedule &amp; Post This Graphic
              </Button>
            </div>
          ) : (
            <div className="text-sm text-slate-400 flex flex-col items-center gap-3 py-16">
              <FlaskConical className="size-10 opacity-30 text-purple-600" />
              <p className="font-medium">Enter a topic or select a preset chip to build your poster</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Canvas As Template Dialog */}
      <SaveCanvasAsTemplateDialog
        isOpen={isSaveTemplateOpen}
        onClose={() => setIsSaveTemplateOpen(false)}
        canvasState={trace}
        onSaved={async () => {
          try {
            const res = await axiosInstance.get("/api/poster/templates")
            if (res.data?.templates) setTemplates(res.data.templates)
          } catch (e) {}
        }}
      />

      {/* Blueprint Inspection Modal */}
      {blueprintTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-white overflow-hidden flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <LayoutTemplate className="size-4 text-purple-400" />
                  {blueprintTemplate.name || blueprintTemplate.id}
                </h3>
                <p className="text-xs text-slate-400">{blueprintTemplate.category || "Layout Architecture"} · {blueprintTemplate.description || "Slot Bounds"}</p>
              </div>
              <button
                type="button"
                onClick={() => setBlueprintTemplate(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Wireframe Box */}
            <div className="relative aspect-square w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden p-2">
              <div 
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(#818CF8 1px, transparent 1px)`,
                  backgroundSize: "14px 14px",
                }}
              />
              {Object.entries(blueprintTemplate.slots || {}).map(([slotKey, slot]: any) => (
                <div
                  key={slotKey}
                  className="absolute flex flex-col items-center justify-center p-1 rounded border-2 border-dashed border-sky-400/80 bg-sky-500/15 text-sky-200"
                  style={{
                    left: `${slot.x_pct}%`,
                    top: `${slot.y_pct}%`,
                    width: `${slot.w_pct}%`,
                    height: `${slot.h_pct}%`,
                  }}
                >
                  <span className="font-mono text-[9px] font-bold truncate leading-none">{slotKey}</span>
                  <span className="font-mono text-[7px] text-white/50">{slot.w_pct}%×{slot.h_pct}%</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-400 font-mono">
                {Object.keys(blueprintTemplate.slots || {}).length} defined slots
              </span>
              <Button
                size="sm"
                className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold"
                onClick={() => {
                  setSelectedTemplateId(blueprintTemplate.id)
                  setBlueprintTemplate(null)
                  toast.success(`Template ${blueprintTemplate.name || blueprintTemplate.id} selected!`)
                }}
              >
                Select this Template
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
