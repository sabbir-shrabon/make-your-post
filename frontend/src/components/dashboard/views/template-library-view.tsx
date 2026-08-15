"use client"

import * as React from "react"

import {
  PageConnection, Post, AIPersona, PromptStudioConfig, PerformanceInsights,
  Analytics, DashboardIntelligence, StyleAnalysis, TrackerDashboard, ScheduledSlotItem, GlobalModelSettings
} from "@/types/models"
import { PageTitle, PageMini, PageStatusBadge, formatDate, todayLabel, isPastScheduledSlot, slotStatusClass, MiniBars, emptySchedule, scheduleDayLabel, activeDaysToAbbrev, abbrevDaysToFull, scheduleFromLegacyPersona, LearnedInsightsPanel, ConnectEmpty, FacebookConnectButton, Stat, PostRow, Empty, SkeletonPage, badgeClass } from "@/components/dashboard/shared/dashboard-ui"


import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  CalendarClock,
  Check,
  FileText,
  Home,
  Loader2,
  Menu,
  PenLine,
  Plus,
  Plug,
  Radar,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
  Image,
  LayoutTemplate,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { AgenticPosterLab } from "@/components/social-platform/AgenticPosterLab"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { useApp } from "@/contexts/app-context"
import { API_BASE_URL, BACKEND_ORIGIN, api, getApiErrorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"
import { TemplateBuilder } from "@/components/template-builder/template-builder"
import { PostPhotocardEditor } from "@/components/post-photocard-editor"


export function TemplateLibraryView() {
  const { imageTemplates, refreshImageTemplates } = useApp()
  const [selectedTemplate, setSelectedTemplate] = React.useState<any | null>(null)
  const [analyzing, setAnalyzing] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<"choose" | "extract" | "manual">("choose")
  const [name, setName] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)

  const [testingTemplate, setTestingTemplate] = React.useState<any | null>(null)
  const [inputText, setInputText] = React.useState("")
  const [isRunningTest, setIsRunningTest] = React.useState(false)
  const [testLoadingText, setTestLoadingText] = React.useState("")
  const [testResult, setTestResult] = React.useState<any | null>(null)
  const [testError, setTestError] = React.useState<string | null>(null)
  const [showPrompt, setShowPrompt] = React.useState(false)

  const templates = imageTemplates

  async function runTemplateTest() {
    if (!inputText.trim()) {
      toast.error("Please enter a post or describe your content first.")
      return
    }
    setIsRunningTest(true)
    setTestError(null)
    setTestResult(null)
    setTestLoadingText("LLM is deciding styling…")

    try {
      // Step 1: LLM Styling Decisions
      const llmResponse = await api.post(`/api/image-templates/${testingTemplate.id}/test-llm`, {
        input_text: inputText.trim()
      })
      
      const intermediateResult = llmResponse.data
      setTestResult(intermediateResult) // Display readable decisions immediately
      setTestLoadingText("Assembling photocard…")

      // Step 2: Render Image via PIL
      const renderResponse = await api.post(`/api/image-templates/${testingTemplate.id}/test-render`, {
        llm_decisions: intermediateResult.llm_decisions
      })

      // Combine both results
      setTestResult({
        ...intermediateResult,
        preview_image_url: renderResponse.data.preview_image_url
      })
      
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err.message || "Test failed."
      setTestError(errMsg)
    } finally {
      setIsRunningTest(false)
      setTestLoadingText("")
    }
  }



  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !file) {
      toast.error("Please enter a template name and choose a reference image.")
      return
    }
    setAnalyzing(true)
    try {
      const formData = new FormData()
      formData.append("name", name.trim())
      formData.append("image", file)
      await api.post("/api/image-templates/analyze", formData)
      toast.success("Image analyzed and template created successfully!")
      setName("")
      setFile(null)
      refreshImageTemplates()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Template analysis failed.")
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this template?")) return
    try {
      await api.delete(`/api/image-templates/${id}`)
      toast.success("Template deleted successfully")
      refreshImageTemplates()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Delete failed.")
    }
  }

  async function openTemplate(id: string) {
    try {
      const response = await api.get(`/api/image-templates/${id}`)
      setSelectedTemplate(response.data)
    } catch {
      toast.error("Could not load template details.")
    }
  }

  return (
    <Tabs defaultValue="library" className="w-full">
      <div className="flex items-center justify-between mb-6">
        <PageTitle title="Templates" subtitle="Extract layouts from reference images or build templates with visual, form, JSON, or AI-assisted editors." />
        <TabsList>
          <TabsTrigger value="library">Library & Builder</TabsTrigger>
          <TabsTrigger value="lab">Agentic Poster Lab</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="library" className="m-0 focus-visible:outline-none focus-visible:ring-0 space-y-6">
      {createMode === "manual" ? (
        <TemplateBuilder
          onCancel={() => setCreateMode("choose")}
          onSaved={() => {
            setCreateMode("choose")
            refreshImageTemplates()
          }}
        />
      ) : null}
      <div className={cn("grid gap-6 md:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards", createMode === "manual" && "hidden")}>
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>New Template</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {createMode === "choose" ? (
              <>
                <p className="text-sm text-slate-600">Choose how to create your template.</p>
                <Button
                  type="button"
                  className="bg-purple-700 text-white hover:bg-purple-800 w-full"
                  onClick={() => setCreateMode("extract")}
                >
                  <Sparkles className="size-4 mr-2" />
                  Extract from Reference Image
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => setCreateMode("manual")}>
                  <LayoutTemplate className="size-4 mr-2" />
                  Visual Canvas Builder
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" size="sm" className="w-fit -mt-1" onClick={() => setCreateMode("choose")}>
                  ← Back
                </Button>
                <form onSubmit={handleAnalyze} className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      placeholder="e.g. Minimalist Product Slide"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={analyzing}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="reference-file">Reference Image</Label>
                    <Input
                      id="reference-file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      disabled={analyzing}
                    />
                  </div>
                  <Button type="submit" className="bg-purple-700 text-white hover:bg-purple-800 w-full" disabled={analyzing}>
                    {analyzing ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
                    {analyzing ? "Analyzing image structure..." : "Extract Design Layers"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Saved Templates</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {templates.length === 0 ? (
              <div className="col-span-2 text-center py-10 text-slate-500">No layout templates saved. Upload one to get started!</div>
            ) : (
              templates.map((tpl) => (
                <div key={tpl.id} className="text-left relative overflow-hidden rounded-lg border bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer group" onClick={() => openTemplate(tpl.id)}>
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-100 border-b">
                    {tpl.reference_image_url ? (
                      <img src={tpl.reference_image_url} alt={tpl.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-100 to-slate-200 text-slate-500 text-sm">
                        Manual template
                      </div>
                    )}
                    {tpl.creation_method === "manual" ? (
                      <span className="absolute top-2 left-2 rounded bg-purple-700 px-2 py-0.5 text-xs text-white">Manual</span>
                    ) : null}
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <div className="mr-2 overflow-hidden">
                      <h3 className="font-semibold text-slate-800 truncate">{tpl.name}</h3>
                      <p className="text-xs text-slate-500">
                        {tpl.aspect_ratio || "1:1"} · {new Date(tpl.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs text-purple-700 border-purple-200 hover:bg-purple-50 hover:text-purple-800"
                        onClick={(e) => { e.stopPropagation(); setTestingTemplate(tpl) }}
                      >
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); handleDelete(tpl.id) }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      {selectedTemplate ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 overflow-y-auto">
          <Card className="mx-auto mt-10 max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{selectedTemplate.name}</span>
                <Button variant="ghost" size="icon" onClick={() => setSelectedTemplate(null)}><X className="size-4" /></Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {selectedTemplate.reference_image_url ? (
                <img src={selectedTemplate.reference_image_url} alt={selectedTemplate.name} className="w-full rounded-md border" />
              ) : (
                <p className="text-sm text-slate-600 rounded-md border p-4 bg-slate-50">
                  Manually built template ({selectedTemplate.aspect_ratio}, {selectedTemplate.canvas_width}×{selectedTemplate.canvas_height})
                </p>
              )}
              <div className="text-sm text-slate-700">
                {(() => {
                  const layers = selectedTemplate?.template_json?.layers || []
                  const counts = layers.reduce((acc: Record<string, number>, layer: any) => {
                    const key = String(layer?.type || "unknown")
                    acc[key] = (acc[key] || 0) + 1
                    return acc
                  }, {} as Record<string, number>)
                  const entries = Object.entries(counts) as [string, number][]
                  if (!entries.length) return <p>No layers found.</p>
                  return entries.map(([type, count]) => <p key={type}>{count} {type.replaceAll("_", " ")} layer{count > 1 ? "s" : ""}</p>)
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Sheet open={testingTemplate !== null} onOpenChange={(open) => {
        if (!open) {
          setTestingTemplate(null)
          setInputText("")
          setTestResult(null)
          setTestError(null)
          setShowPrompt(false)
        }
      }}>
        <SheetContent className="overflow-y-auto w-full max-w-lg">
          <div className="mt-6 grid gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="size-5 text-purple-600" />
              Test Template: {testingTemplate?.name}
            </h2>
            <p className="text-sm text-slate-500">
              Run a standalone test generation using LLM styling and PIL assembly. Nothing is saved.
            </p>
            
            <div className="grid gap-2">
              <Label htmlFor="test-content" className="text-sm font-medium">
                Paste a post or describe your content
              </Label>
              <Textarea
                id="test-content"
                rows={4}
                className="resize-none"
                placeholder="e.g. 5 productivity tips every entrepreneur needs to know this year…"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isRunningTest}
              />
            </div>

            <Button
              className="bg-purple-700 hover:bg-purple-800 text-white w-full"
              onClick={runTemplateTest}
              disabled={isRunningTest || !inputText.trim()}
            >
              {isRunningTest ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  {testLoadingText}
                </>
              ) : (
                "Run Test"
              )}
            </Button>

            {/* Result Area */}
            {(isRunningTest || testResult || testError) && (
              <div className="mt-4 border-t pt-4 grid gap-3">
                <h3 className="text-sm font-semibold text-slate-800">Result</h3>
                
                {/* Loader showing the exact phase */}
                {isRunningTest && (
                  <div className="rounded-md bg-slate-50 p-4 border flex items-center gap-3">
                    <Loader2 className="size-5 animate-spin text-purple-700" />
                    <span className="text-sm font-medium text-slate-700">
                      {testLoadingText}
                    </span>
                  </div>
                )}

                {/* Error State */}
                {testError && (
                  <div className="rounded-md bg-red-50 p-4 border border-red-200 text-sm text-red-600 font-medium">
                    <p className="font-semibold mb-1">Testing failed</p>
                    <p className="whitespace-pre-wrap break-words">{testError}</p>
                  </div>
                )}

                {/* Success Results */}
                {testResult && (
                  <div className="grid gap-4">
                    {/* Collapsible Prompt Section */}
                    {testResult.prompt_sent && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowPrompt(!showPrompt)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
                        >
                          <span>View Prompt Sent to LLM</span>
                          <span className="text-xs text-slate-500">{showPrompt ? "▼" : "▶"}</span>
                        </button>
                        {showPrompt && (
                          <div className="border-t border-slate-200 px-4 py-3 bg-slate-900 max-h-96 overflow-y-auto">
                            <pre className="text-xs text-slate-200 font-mono whitespace-pre-wrap break-words">
                              {testResult.prompt_sent}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* LLM Decisions readable list */}
                    {testResult.readable_decisions && testResult.readable_decisions.length > 0 && (
                      <div className="rounded-md bg-slate-50 p-4 border border-slate-200 text-sm text-slate-700">
                        <p className="font-semibold text-slate-800 mb-2">LLM Styling Decisions:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {testResult.readable_decisions.map((decision: string, idx: number) => (
                            <li key={idx} className="leading-relaxed font-mono text-xs">{decision}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Final Image Rendering */}
                    {testResult.preview_image_url && (
                      <div className="grid gap-2">
                        <div className="relative border rounded-lg overflow-hidden bg-slate-100">
                          <img
                            src={testResult.preview_image_url}
                            alt="Photocard Preview"
                            className="w-full h-auto object-contain"
                          />
                        </div>
                        <p className="text-xs text-slate-500 text-center italic">
                          This is a preview only. Nothing is saved.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      </TabsContent>
      <TabsContent value="lab" className="m-0 focus-visible:outline-none focus-visible:ring-0">
        <AgenticPosterLab />
      </TabsContent>
    </Tabs>
  )
}

