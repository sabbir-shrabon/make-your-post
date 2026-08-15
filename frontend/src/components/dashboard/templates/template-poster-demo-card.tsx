"use client"

import * as React from "react"
import { useState } from "react"
import { 
  Sparkles, 
  Quote, 
  Home, 
  Zap, 
  Layers, 
  Eye, 
  Code, 
  Download, 
  Trash2, 
  ArrowRight, 
  Check, 
  Copy,
  Info,
  Maximize2,
  BookmarkPlus
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export interface TemplateSlot {
  x_pct: number
  y_pct: number
  w_pct: number
  h_pct: number
  align?: "left" | "center" | "right"
  role?: string
  font_family?: string
  font_weight?: "bold" | "regular"
}

export interface PosterTemplateItem {
  id: string
  db_id?: string
  name: string
  category: string
  description: string
  best_for: string[]
  slots: Record<string, TemplateSlot>
  demo_sample?: {
    headline?: string
    subheadline?: string
    badge_text?: string
    corner_badge?: string
    accent_icon?: string
    cta_text?: string
    details_block?: string
    text_logo?: string
    text_before?: string
    text_after?: string
    gradient?: string[]
    bg_color?: string
    accent_color?: string
  }
  is_system: boolean
  aspect_ratio?: string
  canvas_width?: number
  canvas_height?: number
  created_at?: string
}

interface Props {
  template: PosterTemplateItem
  onUseInLab?: (template: PosterTemplateItem) => void
  onDelete?: (template: PosterTemplateItem) => void
  onExport?: (template: PosterTemplateItem) => void
}

export function TemplatePosterDemoCard({
  template,
  onUseInLab,
  onDelete,
  onExport,
}: Props) {
  const [viewMode, setViewMode] = useState<"demo" | "blueprint">("demo")
  const [copied, setCopied] = useState(false)

  const slots = template.slots || {}
  const sample = template.demo_sample || {}
  const gradient = sample.gradient || ["#1E1B4B", "#312E81"]
  const bgColor = sample.bg_color || "#0F172A"
  const accentColor = sample.accent_color || "#38BDF8"

  const slotEntries = Object.entries(slots)

  function copyTemplateId() {
    navigator.clipboard.writeText(template.id)
    setCopied(true)
    toast.success(`Copied template ID: ${template.id}`)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleExportJson() {
    if (onExport) {
      onExport(template)
      return
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template, null, 2))
    const downloadAnchor = document.createElement("a")
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `${template.id}-template.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    toast.success("Template exported as JSON!")
  }

  // Color mapping for blueprint slots
  function getSlotColor(slotName: string): { border: string; bg: string; text: string } {
    const s = slotName.toLowerCase()
    if (s.includes("headline")) return { border: "border-indigo-400", bg: "bg-indigo-500/15", text: "text-indigo-200" }
    if (s.includes("subheadline")) return { border: "border-sky-400", bg: "bg-sky-500/15", text: "text-sky-200" }
    if (s.includes("badge")) return { border: "border-amber-400", bg: "bg-amber-500/20", text: "text-amber-200" }
    if (s.includes("cta")) return { border: "border-emerald-400", bg: "bg-emerald-500/20", text: "text-emerald-200" }
    if (s.includes("icon")) return { border: "border-fuchsia-400", bg: "bg-fuchsia-500/20", text: "text-fuchsia-200" }
    if (s.includes("logo")) return { border: "border-slate-400", bg: "bg-slate-500/15", text: "text-slate-200" }
    return { border: "border-teal-400", bg: "bg-teal-500/15", text: "text-teal-200" }
  }

  return (
    <div className="group relative flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-xl hover:border-purple-300 transition-all duration-300 overflow-hidden">
      {/* Top Media / Preview Stage */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate-950 select-none">
        {/* Toggle Mode Button */}
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-md p-1 border border-white/10 text-white shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode("demo")}
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors ${
              viewMode === "demo" ? "bg-purple-600 text-white shadow" : "text-white/70 hover:text-white"
            }`}
            title="Live Demo Poster"
          >
            <Eye className="size-3" />
            Demo
          </button>
          <button
            type="button"
            onClick={() => setViewMode("blueprint")}
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors ${
              viewMode === "blueprint" ? "bg-purple-600 text-white shadow" : "text-white/70 hover:text-white"
            }`}
            title="Slot Layout Blueprint"
          >
            <Code className="size-3" />
            Slots
          </button>
        </div>

        {/* System vs Custom Badge */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5">
          {template.is_system ? (
            <Badge className="bg-slate-900/80 text-purple-300 border-purple-400/30 backdrop-blur-md text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 shadow">
              Built-In
            </Badge>
          ) : (
            <Badge className="bg-emerald-600/90 text-white backdrop-blur-md text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 shadow">
              Custom
            </Badge>
          )}
          <Badge variant="outline" className="bg-black/50 text-white/90 border-white/20 backdrop-blur-md text-[10px] px-1.5 py-0">
            {slotEntries.length} slots
          </Badge>
        </div>

        {/* --- VIEW MODE 1: LIVE DEMO POSTER --- */}
        {viewMode === "demo" ? (
          <div 
            className="absolute inset-0 flex flex-col justify-between p-5 text-white transition-opacity duration-300"
            style={{
              background: `linear-gradient(145deg, ${gradient[0] || bgColor}, ${gradient[1] || '#05070E'})`,
            }}
          >
            {/* Subtle decorative glow */}
            <div 
              className="absolute -top-10 -right-10 w-44 h-44 rounded-full blur-3xl opacity-30 pointer-events-none"
              style={{ backgroundColor: accentColor }}
            />
            <div 
              className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ backgroundColor: gradient[0] || '#4F46E5' }}
            />

            {/* Render Each Slot Element based on exact template coordinates */}
            {slotEntries.map(([slotName, slot]) => {
              const alignClass = 
                slot.align === "left" ? "text-left items-start justify-start" :
                slot.align === "right" ? "text-right items-end justify-end" :
                "text-center items-center justify-center"

              // Slot Content Matching
              let content: React.ReactNode = null

              if (slotName.includes("headline") && !slotName.includes("sub")) {
                content = (
                  <h2 
                    className="font-extrabold uppercase leading-[1.05] tracking-tight drop-shadow-md text-white overflow-hidden line-clamp-3"
                    style={{ fontSize: `clamp(13px, ${Math.min(slot.h_pct * 0.95, 20)}px, 26px)` }}
                  >
                    {sample.headline || "HERO HEADLINE"}
                  </h2>
                )
              } else if (slotName.includes("subheadline")) {
                content = (
                  <p 
                    className="text-white/80 font-medium leading-tight overflow-hidden line-clamp-2"
                    style={{ fontSize: `clamp(9px, ${Math.min(slot.h_pct * 0.8, 12)}px, 13px)` }}
                  >
                    {sample.subheadline || "Compelling descriptive subheadline statement"}
                  </p>
                )
              } else if (slotName.includes("badge")) {
                content = (
                  <span 
                    className="inline-flex items-center justify-center font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-lg border border-white/20 text-slate-900"
                    style={{ 
                      backgroundColor: accentColor,
                      fontSize: `clamp(8px, ${Math.min(slot.h_pct * 0.8, 11)}px, 12px)`
                    }}
                  >
                    {sample.badge_text || sample.corner_badge || "SPECIAL"}
                  </span>
                )
              } else if (slotName.includes("cta")) {
                content = (
                  <span 
                    className="inline-flex items-center justify-center font-bold uppercase tracking-wide px-3 py-1 rounded-lg text-white shadow-md border border-white/20 hover:scale-105 transition-transform"
                    style={{ 
                      backgroundColor: accentColor.startsWith("#F") ? "#0D9488" : accentColor,
                      fontSize: `clamp(8px, ${Math.min(slot.h_pct * 0.75, 11)}px, 12px)` 
                    }}
                  >
                    {sample.cta_text || "DISCOVER NOW →"}
                  </span>
                )
              } else if (slotName.includes("icon")) {
                content = (
                  <div 
                    className="flex items-center justify-center rounded-xl bg-white/10 backdrop-blur-md p-1.5 text-amber-300 shadow-sm border border-white/15"
                  >
                    {sample.accent_icon?.includes("quote") ? (
                      <Quote className="size-4" />
                    ) : sample.accent_icon?.includes("home") ? (
                      <Home className="size-4" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                  </div>
                )
              } else if (slotName.includes("logo")) {
                content = (
                  <span 
                    className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/60 font-semibold truncate"
                  >
                    {sample.text_logo || "CREATOR LAB"}
                  </span>
                )
              } else if (slotName.includes("details")) {
                content = (
                  <span 
                    className="font-mono text-[8.5px] uppercase tracking-wider text-white/70 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded border border-white/10 truncate"
                  >
                    {sample.details_block || "2026 EDITION · ALL ACCESS"}
                  </span>
                )
              } else if (slotName.includes("before")) {
                content = (
                  <div className="w-full bg-red-950/40 border border-red-500/30 rounded p-1 text-[8.5px] text-red-200">
                    {sample.text_before || "BEFORE: Manual design grind"}
                  </div>
                )
              } else if (slotName.includes("after")) {
                content = (
                  <div className="w-full bg-emerald-950/40 border border-emerald-500/30 rounded p-1 text-[8.5px] text-emerald-200">
                    {sample.text_after || "AFTER: 1-click agentic posters"}
                  </div>
                )
              } else {
                content = (
                  <span className="text-[9px] text-white/70 truncate">{slotName}</span>
                )
              }

              return (
                <div
                  key={slotName}
                  className={`absolute flex ${alignClass} pointer-events-none`}
                  style={{
                    left: `${slot.x_pct}%`,
                    top: `${slot.y_pct}%`,
                    width: `${slot.w_pct}%`,
                    height: `${slot.h_pct}%`,
                  }}
                >
                  {content}
                </div>
              )
            })}
          </div>
        ) : (
          /* --- VIEW MODE 2: SLOT BLUEPRINT / WIREFRAME --- */
          <div className="absolute inset-0 bg-[#090D16] p-3 text-white overflow-hidden transition-opacity duration-300">
            {/* Isometric / Grid Backdrop */}
            <div 
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(#6366F1 1px, transparent 1px)`,
                backgroundSize: "16px 16px",
              }}
            />
            
            {/* Center Canvas Dimension Marker */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
              <span className="font-mono text-3xl font-bold tracking-widest text-white">1080 × 1080</span>
            </div>

            {/* Wireframe Slots */}
            {slotEntries.map(([slotName, slot]) => {
              const theme = getSlotColor(slotName)
              return (
                <div
                  key={slotName}
                  className={`absolute flex flex-col items-center justify-center p-1 rounded border-2 border-dashed ${theme.border} ${theme.bg} transition-transform hover:scale-[1.02] hover:z-10 shadow-sm`}
                  style={{
                    left: `${slot.x_pct}%`,
                    top: `${slot.y_pct}%`,
                    width: `${slot.w_pct}%`,
                    height: `${slot.h_pct}%`,
                  }}
                  title={`${slotName}: ${slot.w_pct}% × ${slot.h_pct}% (Align: ${slot.align || "center"})`}
                >
                  <span className={`font-mono text-[9px] font-bold truncate leading-none ${theme.text}`}>
                    {slotName}
                  </span>
                  <span className="font-mono text-[7px] text-white/50 leading-tight">
                    {slot.w_pct}%×{slot.h_pct}%
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Card Body & Metadata */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3 bg-white">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 group-hover:text-purple-700 transition-colors">
                {template.name}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                {template.description || `Optimized for ${template.category}`}
              </p>
            </div>
            <button
              type="button"
              onClick={copyTemplateId}
              className="text-slate-400 hover:text-purple-600 transition-colors shrink-0 p-1"
              title="Copy Template ID"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            </button>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mt-2.5">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              {template.category}
            </span>
            {template.best_for?.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t pt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900 border-slate-200"
              onClick={handleExportJson}
              title="Export as JSON"
            >
              <Download className="size-3.5" />
            </Button>
            {!template.is_system && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => onDelete(template)}
                title="Delete Template"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>

          <Button
            size="sm"
            className="h-8 px-3 text-xs bg-purple-700 hover:bg-purple-800 text-white font-semibold flex items-center gap-1.5 shadow-sm"
            onClick={() => onUseInLab && onUseInLab(template)}
          >
            <Sparkles className="size-3.5" />
            Use in Poster Lab
          </Button>
        </div>
      </div>
    </div>
  )
}
