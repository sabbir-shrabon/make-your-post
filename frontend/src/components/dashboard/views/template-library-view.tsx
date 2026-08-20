"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles,
  LayoutTemplate,
  Search,
  Plus,
  Upload,
  Download,
  Trash2,
  Eye,
  Code,
  Layers,
  Filter,
  Grid,
  List,
  RefreshCw,
  FlaskConical,
  Check,
  ChevronRight,
  Info,
  Pencil,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PageTitle } from "@/components/dashboard/shared/dashboard-ui"
import { axiosInstance } from "@/lib/axios"
import { AgenticPosterLab } from "@/components/social-platform/AgenticPosterLab"
import { 
  TemplatePosterDemoCard, 
  type PosterTemplateItem 
} from "@/components/dashboard/templates/template-poster-demo-card"
import { CanvaVisualBuilderModal } from "@/components/dashboard/templates/canva-visual-builder-modal"

const CATEGORIES = [
  "All",
  "Sales & Promo",
  "Tech & SaaS",
  "Quotes & Mindset",
  "Editorial & Story",
  "Data & Stats",
  "Lists & How-To",
  "Comparison & Results",
  "My Custom Templates",
]

export function TemplateLibraryView() {
  const router = useRouter()
  const [activeMainTab, setActiveMainTab] = useState<"poster" | "meme">("poster")
  const [templates, setTemplates] = useState<PosterTemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  
  // Custom Canva Visual Canvas Builder Modal
  const [isBuilderModalOpen, setIsBuilderModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PosterTemplateItem | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function handleOpenCreate() {
    setEditingTemplate(null)
    setIsBuilderModalOpen(true)
  }

  function handleEditTemplate(tpl: PosterTemplateItem) {
    setEditingTemplate(tpl)
    setIsBuilderModalOpen(true)
  }

  const fetchTemplates = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.get("/api/poster/templates")
      if (res.data?.templates) {
        setTemplates(res.data.templates)
      }
    } catch (err: any) {
      console.error("Failed to load templates:", err)
      toast.error("Failed to load templates catalog")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Filter templates
  const filteredTemplates = templates.filter((tpl) => {
    const matchesSearch =
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.best_for?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    if (!matchesSearch) return false

    if (selectedCategory === "All") return true
    if (selectedCategory === "My Custom Templates") return !tpl.is_system
    return tpl.category.toLowerCase() === selectedCategory.toLowerCase()
  })

  // Action: Launch template in Poster Lab
  function handleUseInLab(tpl: PosterTemplateItem) {
    sessionStorage.setItem("poster_lab_selected_template", tpl.id)
    router.push("/dashboard/poster-studio")
    toast.success(`Selected "${tpl.name}" — Launching Poster Lab!`)
  }

  // Action: Delete custom template
  async function handleDeleteTemplate(tpl: PosterTemplateItem) {
    if (!confirm(`Are you sure you want to delete custom template "${tpl.name}"?`)) return
    try {
      await axiosInstance.delete(`/api/poster/templates/${tpl.id}`)
      toast.success(`Template "${tpl.name}" deleted.`)
      fetchTemplates()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Delete failed")
    }
  }

  // Action: Import JSON file
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    try {
      await axiosInstance.post("/api/poster/templates/import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      toast.success("Template imported successfully!")
      fetchTemplates()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Import failed. Invalid JSON format.")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as any)} className="w-full">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <PageTitle 
          title="Poster Templates Hub" 
          subtitle="Explore high-converting Canva-grade layout architectures, inspect slot blueprints, and build custom reusable templates." 
        />
        
        <div className="flex items-center gap-2 shrink-0">
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="poster" className="data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm text-xs font-semibold">
              <LayoutTemplate className="size-3.5 mr-1.5" />
              Poster Templates
            </TabsTrigger>
            <TabsTrigger value="meme" className="data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm text-xs font-semibold">
              <LayoutTemplate className="size-3.5 mr-1.5" />
              Meme Templates
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* --- TAB 1: POSTER TEMPLATES --- */}
      <TabsContent value="poster" className="m-0 focus-visible:outline-none space-y-6">
        {/* Top Control Bar: Search, Category Filters, and Builder Trigger */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                placeholder="Search templates by name, category, or tag (e.g. sale, quote, tech)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 text-sm focus-visible:ring-purple-600 bg-slate-50/70"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".json" 
                onChange={handleImportFile} 
                className="hidden" 
              />
              
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-xs font-semibold gap-1.5 text-slate-700 hover:text-purple-700 hover:border-purple-300"
                onClick={() => fileInputRef.current?.click()}
                title="Import Template JSON file"
              >
                <Upload className="size-3.5" />
                Import JSON
              </Button>

              <Button
                size="sm"
                className="h-10 text-xs font-bold gap-2 bg-purple-700 hover:bg-purple-800 text-white shadow-md transition-all hover:scale-[1.02]"
                onClick={handleOpenCreate}
              >
                <Plus className="size-4" />
                Create Manual Template
              </Button>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 ml-1">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === "grid" ? "bg-white text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Grid View (Live Previews)"
                >
                  <Grid className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === "list" ? "bg-white text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="List View (Detailed Table)"
                >
                  <List className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0 flex items-center gap-1">
              <Filter className="size-3" /> Filter:
            </span>
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all shrink-0 ${
                    isSelected
                      ? "bg-purple-700 text-white font-bold shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                  }`}
                >
                  {cat}
                  {cat === "All" && ` (${templates.length})`}
                  {cat === "My Custom Templates" && ` (${templates.filter((t) => !t.is_system).length})`}
                </button>
              )
            })}
          </div>
        </div>

        {/* Results Count & Quick Status */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <p>
            Showing <strong>{filteredTemplates.length}</strong> of <strong>{templates.length}</strong> layout templates
          </p>
          <button
            type="button"
            onClick={fetchTemplates}
            className="flex items-center gap-1 text-slate-500 hover:text-purple-700 transition-colors"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin text-purple-600" : ""}`} />
            Refresh Catalog
          </button>
        </div>

        {/* --- TEMPLATES DISPLAY --- */}
        {loading && templates.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="size-8 animate-spin text-purple-600" />
            <p className="font-semibold text-sm">Loading Canva-grade poster templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center flex flex-col items-center justify-center gap-3">
            <LayoutTemplate className="size-10 text-slate-300" />
            <h4 className="font-semibold text-slate-700 text-base leading-5">No templates found</h4>
            <p className="text-xs text-slate-500 max-w-sm">
              No layout templates match your active search or filter. Try clearing filters or create a new custom template.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("All")
              }}
              className="text-xs mt-2"
            >
              Reset Filters
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          /* GRID VIEW */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredTemplates.map((tpl) => (
              <TemplatePosterDemoCard
                key={tpl.id}
                template={tpl}
                onUseInLab={handleUseInLab}
                onEdit={handleEditTemplate}
                onDelete={handleDeleteTemplate}
              />
            ))}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
            {filteredTemplates.map((tpl) => {
              const slotKeys = Object.keys(tpl.slots || {})
              return (
                <div 
                  key={tpl.id} 
                  className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-purple-50/30 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="size-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-purple-400 font-mono text-xs font-bold shadow-sm">
                      {slotKeys.length}s
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900 text-sm leading-5">{tpl.name}</h4>
                        {tpl.is_system ? (
                          <Badge variant="outline" className="text-[10px] font-mono text-purple-700 bg-purple-50 border-purple-200">
                            Built-In
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] font-mono bg-emerald-600 text-white">
                            Custom
                          </Badge>
                        )}
                        <span className="text-xs text-slate-500 font-medium">· {tpl.category}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-xl line-clamp-1">
                        {tpl.description || "Optimized poster layout blueprint"}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {slotKeys.map((s) => (
                          <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                      onClick={() => handleUseInLab(tpl)}
                    >
                      <Sparkles className="size-3.5 mr-1" />
                      Use in Lab
                    </Button>
                    {!tpl.is_system && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs text-slate-700 border-slate-200 hover:bg-slate-50"
                        onClick={() => handleEditTemplate(tpl)}
                        title="Edit in Canvas Builder"
                      >
                        <Pencil className="size-3.5 mr-1" />
                        Edit
                      </Button>
                    )}
                    {!tpl.is_system && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteTemplate(tpl)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </TabsContent>

      {/* --- TAB 2: MEME TEMPLATES --- */}
      <TabsContent value="meme" className="m-0 focus-visible:outline-none">
        <div className="py-16 text-center text-slate-500">
          <p>Meme templates will be available here soon.</p>
        </div>
      </TabsContent>

      {/* Custom Canva Visual Canvas Builder Modal */}
      <CanvaVisualBuilderModal
        isOpen={isBuilderModalOpen}
        onClose={() => setIsBuilderModalOpen(false)}
        onSaved={fetchTemplates}
        initialTemplate={editingTemplate}
      />
    </Tabs>
  )
}
