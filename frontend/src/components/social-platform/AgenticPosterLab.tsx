import * as React from "react"
import { useState } from "react"
import { Sparkles, Loader2, FlaskConical, CheckCircle2, AlertTriangle, AlertCircle, Copy, Check, FileImage } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { axiosInstance } from "@/lib/axios"
import { toast } from "sonner"

export function AgenticPosterLab() {
  const [topic, setTopic] = useState("")
  const [loading, setLoading] = useState(false)
  const [trace, setTrace] = useState<any>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

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

    try {
      const res = await axiosInstance.post("/api/poster/assemble-trace", {
        topic,
        aspect_ratio: "1:1",
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

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards">
      <Card className="lg:col-span-1 h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="size-5 text-purple-600" />
            Agentic Pipeline
          </CardTitle>
          <CardDescription>
            Test the end-to-end poster generation orchestrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="topic">Topic / Content</Label>
              <Input
                id="topic"
                placeholder="e.g. Summer Flash Sale"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button 
              type="submit" 
              className="bg-purple-700 text-white hover:bg-purple-800 w-full"
              disabled={loading || !topic.trim()}
            >
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
              {loading ? "Orchestrating pipeline..." : "Run Pipeline"}
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
                  <div><span className="font-medium">Template:</span> {trace.art_director.template_id}</div>
                  <div><span className="font-medium">Palette:</span> {trace.art_director.palette_id}</div>
                  <div><span className="font-medium">Fonts:</span> {trace.art_director.font_pair_id}</div>
                  <div className="pt-2"><span className="font-medium text-slate-900">{trace.art_director.headline}</span></div>
                  <div>{trace.art_director.subheadline}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center justify-between">
                  Resource Resolver
                  <Badge variant="outline" className="text-xs bg-slate-50">{trace.resolved_assets?.length} assets</Badge>
                </h4>
                <div className="space-y-2">
                  {trace.resolved_assets?.map((asset: any, i: number) => (
                    <div key={i} className="text-xs bg-slate-50 p-2 rounded-md flex items-start gap-2 border">
                      {asset.low_confidence ? (
                        <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-medium truncate" title={asset.description}>{asset.description}</div>
                        <div className="text-slate-500 text-[10px] break-all">{asset.resolved}</div>
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
                  <span>Overlay Opacity: {(trace.final_opacity * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 min-h-[500px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Output Render</span>
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
          <CardDescription>Generated by backend PIL rendering engine</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center bg-slate-50 rounded-b-lg border-t p-6 gap-4">
          {loading ? (
            <div className="flex flex-col items-center text-slate-400 gap-3">
              <Loader2 className="size-8 animate-spin" />
              <p className="text-sm font-medium">Assembling layout & rendering image...</p>
            </div>
          ) : trace?.base64_image ? (
            <div className="flex flex-col items-center gap-4 w-full max-w-md">
              <div className="relative w-full aspect-square shadow-xl ring-1 ring-black/5 rounded-md overflow-hidden bg-white">
                <img 
                  src={`data:image/png;base64,${trace.base64_image}`} 
                  alt="Generated Poster" 
                  className="w-full h-full object-cover"
                />
              </div>
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
            </div>
          ) : (
            <div className="text-sm text-slate-400 flex flex-col items-center gap-2">
              <FlaskConical className="size-8 opacity-20" />
              Enter a topic to generate a test poster
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

