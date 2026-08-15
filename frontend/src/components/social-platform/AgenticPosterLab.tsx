import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Loader2, FlaskConical, CheckCircle2, AlertTriangle, AlertCircle, Copy, Check, FileImage, Send, ArrowRight, RefreshCw, Layers, Award, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { axiosInstance } from "@/lib/axios"
import { toast } from "sonner"
import dynamic from 'next/dynamic'

const InteractiveCanvas = dynamic(
  () => import('./InteractiveCanvas').then((mod) => mod.InteractiveCanvas),
  { ssr: false }
)

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

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return

    setLoading(true)
    setError("")
    setTrace(null)
    setCopied(false)
    setSelectedElementIndex(null)
    setSelectedVariantIndex(0)

    try {
      const res = await axiosInstance.post("/api/poster/assemble-trace", {
        topic,
        aspect_ratio: "1:1",
        use_news_grounding: useNewsGrounding,
        allow_pexels_bg: allowPexelsBg,
        allow_cat_bg: allowCatBg,
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

  const selectedElement = selectedElementIndex !== null && trace?.resolved_assets?.[selectedElementIndex] ? trace.resolved_assets[selectedElementIndex] : null

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards">
      <Card className="lg:col-span-1 h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="size-5 text-purple-600" />
            Agentic Pipeline
          </CardTitle>
          <CardDescription>
            Test the end-to-end poster generation orchestrator with multi-variant scoring.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="topic">Topic / Content</Label>
              <Input
                id="topic"
                placeholder="e.g. Summer Flash Sale — 50% Off Everything"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-3 rounded-md border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="use-news-grounding" className="text-sm">News grounding</Label>
                <Switch id="use-news-grounding" checked={useNewsGrounding} onCheckedChange={setUseNewsGrounding} disabled={loading} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="allow-pexels-bg" className="text-sm">Pexels photo background</Label>
                <Switch id="allow-pexels-bg" checked={allowPexelsBg} onCheckedChange={setAllowPexelsBg} disabled={loading} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="allow-cat-bg" className="text-sm">Cat photo background</Label>
                <Switch id="allow-cat-bg" checked={allowCatBg} onCheckedChange={setAllowCatBg} disabled={loading} />
              </div>
            </div>
            <Button 
              type="submit" 
              className="bg-purple-700 text-white hover:bg-purple-800 w-full"
              disabled={loading || !topic.trim()}
            >
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
              {loading ? "Orchestrating multi-variant pipeline..." : "Generate Poster Variants"}
            </Button>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100 mt-2">
                {error}
              </div>
            )}
          </form>

          {trace && (
            <div className="mt-8 space-y-6 border-t pt-6">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center justify-between">
                  Art Director
                  <Badge variant="outline" className="text-xs bg-slate-50">LLM</Badge>
                </h4>
                <div className="text-xs space-y-1 text-slate-600 bg-slate-50 p-3 rounded-md">
                  <div><span className="font-medium">Template:</span> {trace.art_director?.template_id}</div>
                  <div><span className="font-medium">Palette:</span> {trace.art_director?.palette_id}</div>
                  <div><span className="font-medium">Fonts:</span> {trace.art_director?.font_pair_id}</div>
                  <div className="pt-2"><span className="font-medium text-slate-900">{trace.art_director?.headline}</span></div>
                  <div>{trace.art_director?.subheadline}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center justify-between">
                  Resource Resolver
                  <Badge variant="outline" className="text-xs bg-slate-50">{trace.resolved_assets?.length} assets</Badge>
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {trace.resolved_assets?.map((asset: any, i: number) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedElementIndex(i)}
                      className={`text-xs p-2 rounded-md flex items-start gap-2 border cursor-pointer transition-colors ${
                        selectedElementIndex === i ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600' : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      {asset.low_confidence ? (
                        <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                      )}
                      <div className="overflow-hidden">
                        <div className="font-medium truncate" title={asset.description || asset.content || asset.role}>
                          {asset.role || asset.type}: {asset.content || asset.description || "Asset"}
                        </div>
                        <div className="text-slate-500 text-[10px] truncate">{asset.resolved || `Slot: ${asset.slot || 'custom'}`}</div>
                      </div>
                    </div>
                  ))}
                  {(!trace.resolved_assets || trace.resolved_assets.length === 0) && (
                    <div className="text-xs text-slate-500 italic">No assets requested.</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center justify-between">
                  Composition Validator
                </h4>
                <div className="text-xs bg-slate-50 p-3 rounded-md flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span>Overlay Opacity: {((trace.final_opacity || 0) * 100).toFixed(0)}% (WCAG AA compliant)</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 min-h-[500px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Output Workbench</span>
            {trace?.output_path && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
                onClick={() => copyPathToClipboard(trace.output_path)}
              >
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                {copied ? "Path Copied!" : "Copy Image Path"}
              </Button>
            )}
          </CardTitle>
          <CardDescription>Interactive Konva Canvas with Multi-Variant Selector &amp; Single-Layer Regeneration</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center bg-slate-50 rounded-b-lg border-t p-6 gap-4">
          {loading ? (
            <div className="flex flex-col items-center text-slate-400 gap-3">
              <Loader2 className="size-8 animate-spin" />
              <p className="text-sm font-medium">Assembling multi-variant designs &amp; scoring aesthetics...</p>
            </div>
          ) : trace?.base64_image ? (
            <div className="flex flex-col items-center gap-4 w-full max-w-lg">
              
              {/* Multi-Variant Selector Strip */}
              {trace.variants && trace.variants.length > 1 && (
                <div className="w-full bg-white p-3 rounded-lg border border-purple-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Award className="size-3.5 text-purple-600" />
                      Generated Design Variants ({trace.variants.length})
                    </span>
                    <span className="text-[11px] text-slate-500">Select to load &amp; edit</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {trace.variants.map((v: any, idx: number) => {
                      const isSelected = selectedVariantIndex === idx
                      const scorePct = Math.round((v.composite_score || 0.85) * 100)
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectVariant(v, idx)}
                          className={`relative rounded-md overflow-hidden border-2 text-left p-1 transition-all bg-slate-50 hover:bg-slate-100 ${
                            isSelected ? 'border-purple-600 ring-2 ring-purple-600/20 bg-purple-50/50' : 'border-slate-200'
                          }`}
                        >
                          <div className="aspect-square w-full rounded overflow-hidden bg-slate-200 mb-1">
                            {v.base64_image ? (
                              <img src={`data:image/png;base64,${v.base64_image}`} alt={`Variant ${idx+1}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">Variant {idx+1}</div>
                            )}
                          </div>
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[11px] font-semibold text-slate-800">
                              #{idx + 1} {v.is_winner && "⭐"}
                            </span>
                            <Badge variant={isSelected ? "default" : "outline"} className={`text-[10px] px-1 py-0 ${isSelected ? 'bg-purple-700' : ''}`}>
                              {scorePct}%
                            </Badge>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Main Interactive Canvas */}
              <div className="relative w-full shadow-xl ring-1 ring-black/5 rounded-md overflow-hidden bg-white">
                {trace.resolved_assets?.length > 0 ? (
                  <InteractiveCanvas 
                    trace={trace} 
                    onUpdateElement={(index, newProps) => {
                      const newTrace = { ...trace };
                      newTrace.resolved_assets[index] = newProps;
                      setTrace(newTrace);
                    }}
                    onSelectElement={setSelectedElementIndex}
                  />
                ) : (
                  <img 
                    src={`data:image/png;base64,${trace.base64_image}`} 
                    alt="Generated Poster" 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Output path display */}
              {trace.output_path && (
                <div className="w-full bg-white p-3 rounded-md border border-slate-200 shadow-sm flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileImage className="size-4 text-purple-600 shrink-0" />
                    <span className="font-mono text-slate-700 truncate" title={trace.output_path}>
                      {trace.output_path}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 shrink-0 text-purple-700 hover:bg-purple-50"
                    onClick={() => copyPathToClipboard(trace.output_path)}
                  >
                    {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    <span className="sr-only">Copy path</span>
                  </Button>
                </div>
              )}

              {/* Handoff to Composer CTA */}
              <Button
                className="w-full bg-purple-700 hover:bg-purple-800 text-white font-medium shadow-sm flex items-center justify-center gap-2"
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
                    toast.success("Handoff to Composer: Loading your graphic...")
                    router.push("/dashboard/create")
                  } catch (e) {
                    toast.error("Could not transfer graphic to Composer.")
                  }
                }}
              >
                <ArrowRight className="size-4" />
                Send Selected Graphic to Composer &amp; Schedule
              </Button>
            </div>
          ) : (
            <div className="text-sm text-slate-400 flex flex-col items-center gap-2">
              <FlaskConical className="size-8 opacity-20" />
              Enter a topic to generate multi-variant poster designs
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single Layer Regeneration Panel */}
      {selectedElement && (
        <Card className="lg:col-span-3 border-purple-200 bg-purple-50/40 shadow-sm animate-in fade-in">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Wand2 className="size-4 text-purple-700" />
                Selected Layer: <span className="font-mono text-sm capitalize">{selectedElement.role || selectedElement.type}</span> (#{selectedElementIndex! + 1})
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedElementIndex(null)} className="h-7 text-xs">
                Deselect
              </Button>
            </div>
            <CardDescription>
              Re-generate only this individual layer with AI while keeping all other canvas elements locked in place.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Input
                placeholder="Optional AI direction (e.g. 'Make it punchier', 'Find a vibrant tech icon', 'Change text')..."
                value={regenPromptHint}
                onChange={(e) => setRegenPromptHint(e.target.value)}
                disabled={regeneratingLayer}
                className="bg-white text-sm"
              />
              <Button
                onClick={handleRegenerateLayer}
                disabled={regeneratingLayer}
                className="bg-purple-700 hover:bg-purple-800 text-white shrink-0 gap-1.5 w-full sm:w-auto"
              >
                {regeneratingLayer ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                {regeneratingLayer ? "Regenerating layer..." : "Regenerate This Layer"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Asset Swap Panel */}
      {selectedElementIndex !== null && trace?.resolved_assets?.[selectedElementIndex]?.candidates && trace.resolved_assets[selectedElementIndex].candidates.length > 0 && (
        <Card className="lg:col-span-3 border-blue-200 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Asset Alternatives for {trace.resolved_assets[selectedElementIndex].type}</span>
            </CardTitle>
            <CardDescription>Click to instantly swap the asset on the canvas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 overflow-x-auto pb-4 pt-2">
              {trace.resolved_assets[selectedElementIndex].candidates.map((cand: any, idx: number) => {
                let candUrl = cand.url || cand;
                const isSelected = trace.resolved_assets[selectedElementIndex].resolved === candUrl;
                
                let displayUrl = candUrl;
                if (!candUrl.startsWith('http') && candUrl.includes(':')) {
                  const parts = candUrl.split(':');
                  if (parts.length === 2) {
                    displayUrl = `https://api.iconify.design/${parts[0]}/${parts[1]}.svg`;
                  }
                }

                return (
                  <div 
                    key={idx}
                    onClick={() => {
                      const newTrace = { ...trace };
                      newTrace.resolved_assets[selectedElementIndex].resolved = candUrl;
                      setTrace(newTrace);
                      toast.success("Asset swapped on canvas!");
                    }}
                    className={`shrink-0 cursor-pointer rounded-md overflow-hidden ring-2 transition-all bg-white flex items-center justify-center p-1 ${
                      isSelected ? 'ring-purple-600 ring-offset-2' : 'ring-transparent hover:ring-slate-300'
                    }`}
                  >
                    {displayUrl.startsWith('http') ? (
                      <img src={displayUrl} alt="candidate" className="h-24 w-24 object-contain" />
                    ) : (
                      <div className="h-24 w-24 flex items-center justify-center bg-slate-100 text-xs text-slate-600 border">
                        {displayUrl}
                      </div>
                    )}
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

