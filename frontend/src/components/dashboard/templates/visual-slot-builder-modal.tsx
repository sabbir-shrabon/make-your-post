"use client"

import * as React from "react"
import { useState } from "react"
import { 
  X, 
  Plus, 
  Trash2, 
  Sparkles, 
  Move, 
  Eye, 
  Code, 
  Check, 
  Loader2, 
  Layers,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { axiosInstance } from "@/lib/axios"
import { toast } from "sonner"
import { TemplateSlot } from "./template-poster-demo-card"

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

const DEFAULT_SLOTS: Record<string, TemplateSlot> = {
  headline: { x_pct: 8, y_pct: 25, w_pct: 84, h_pct: 28, align: "center", role: "headline" },
  subheadline: { x_pct: 10, y_pct: 56, w_pct: 80, h_pct: 16, align: "center", role: "subheadline" },
  corner_badge: { x_pct: 74, y_pct: 6, w_pct: 20, h_pct: 12, align: "center", role: "badge" },
  cta_text: { x_pct: 25, y_pct: 80, w_pct: 50, h_pct: 9, align: "center", role: "cta" },
  text_logo: { x_pct: 35, y_pct: 92, w_pct: 30, h_pct: 5, align: "center", role: "logo" },
}

const SLOT_PRESETS = [
  { id: "headline", label: "Headline Title", default: { x_pct: 8, y_pct: 25, w_pct: 84, h_pct: 26, align: "center" } },
  { id: "subheadline", label: "Subheadline / Body", default: { x_pct: 10, y_pct: 55, w_pct: 80, h_pct: 15, align: "center" } },
  { id: "corner_badge", label: "Badge Tag", default: { x_pct: 74, y_pct: 6, w_pct: 20, h_pct: 12, align: "center" } },
  { id: "accent_icon", label: "Icon / Illustration", default: { x_pct: 42, y_pct: 10, w_pct: 16, h_pct: 14, align: "center" } },
  { id: "cta_text", label: "CTA Button", default: { x_pct: 25, y_pct: 78, w_pct: 50, h_pct: 9, align: "center" } },
  { id: "details_block", label: "Details / Disclaimer", default: { x_pct: 10, y_pct: 70, w_pct: 80, h_pct: 7, align: "center" } },
  { id: "text_logo", label: "Brand Logo / Handle", default: { x_pct: 35, y_pct: 92, w_pct: 30, h_pct: 5, align: "center" } },
  { id: "photo_frame", label: "Photo / Image Area", default: { x_pct: 5, y_pct: 5, w_pct: 90, h_pct: 45, align: "center" } },
]

export function VisualSlotBuilderModal({ isOpen, onClose, onSaved }: Props) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState("Custom")
  const [description, setDescription] = useState("")
  const [bestFor, setBestFor] = useState("promo, sale, custom")
  const [slots, setSlots] = useState<Record<string, TemplateSlot>>(DEFAULT_SLOTS)
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>("headline")
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState<"blueprint" | "demo">("blueprint")
  const [installedFonts, setInstalledFonts] = useState<any[]>([])

  React.useEffect(() => {
    if (!isOpen) return
    axiosInstance
      .get("/api/fonts")
      .then((res) => {
        setInstalledFonts(res.data.installed_fonts || [])
      })
      .catch(() => null)
  }, [isOpen])

  if (!isOpen) return null

  function handleAddSlot(preset: typeof SLOT_PRESETS[0]) {
    let key = preset.id
    let counter = 2
    while (slots[key]) {
      key = `${preset.id}_${counter}`
      counter++
    }
    const newSlots = {
      ...slots,
      [key]: {
        ...preset.default,
        align: (preset.default.align || "center") as "left" | "center" | "right",
      }
    }
    setSlots(newSlots)
    setSelectedSlotKey(key)
    toast.success(`Added slot: ${key}`)
  }

  function handleRemoveSlot(key: string) {
    const next = { ...slots }
    delete next[key]
    setSlots(next)
    if (selectedSlotKey === key) {
      setSelectedSlotKey(Object.keys(next)[0] || null)
    }
    toast.success(`Removed slot: ${key}`)
  }

  function handleUpdateSlot(key: string, patch: Partial<TemplateSlot>) {
    setSlots((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...patch,
      }
    }))
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Please enter a template name")
      return
    }
    if (Object.keys(slots).length === 0) {
      toast.error("Please add at least one slot")
      return
    }

    setSaving(true)
    try {
      const bestForList = bestFor
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)

      await axiosInstance.post("/api/poster/templates", {
        name: name.trim(),
        category: category.trim() || "Custom",
        description: description.trim(),
        aspect_ratio: "1:1",
        slots: slots,
        best_for: bestForList.length ? bestForList : ["custom"],
        demo_sample: {
          headline: name.toUpperCase(),
          subheadline: description || "Custom user-crafted template layout",
          badge_text: "CUSTOM",
          cta_text: "EXPLORE NOW →",
          gradient: ["#4F46E5", "#06B6D4"],
          bg_color: "#0F172A",
          accent_color: "#F59E0B",
        }
      })

      toast.success("Custom template saved successfully!")
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  const selectedSlot = selectedSlotKey && slots[selectedSlotKey] ? slots[selectedSlotKey] : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-slate-50/80">
          <div>
            <h2 className="text-xl font-bold leading-6 text-slate-900 flex items-center gap-2">
              <Sparkles className="size-5 text-purple-600" />
              Visual Canvas Template Builder
            </h2>
            <p className="text-xs font-normal leading-4 text-slate-500 mt-1">
              Construct reusable poster slot architectures with exact coordinate control.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body: 2 Columns */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          
          {/* Left Column (5 cols): Metadata & Slot Form */}
          <div className="lg:col-span-5 p-6 flex flex-col gap-5 bg-white overflow-y-auto">
            {/* Basic Info */}
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="t-name" className="text-xs font-bold text-slate-700">Template Name</Label>
                <Input
                  id="t-name"
                  placeholder="e.g. Modern Cyber Product Hero"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="t-cat" className="text-xs font-bold text-slate-700">Category</Label>
                  <Input
                    id="t-cat"
                    placeholder="e.g. Tech & SaaS"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="t-tags" className="text-xs font-bold text-slate-700">Tags (comma separated)</Label>
                  <Input
                    id="t-tags"
                    placeholder="promo, tech, summer"
                    value={bestFor}
                    onChange={(e) => setBestFor(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="t-desc" className="text-xs font-bold text-slate-700">Description</Label>
                <Input
                  id="t-desc"
                  placeholder="e.g. High-impact card optimized for product releases"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Slot Preset Inserter */}
            <div className="border-t pt-4">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                Add Slot Component
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {SLOT_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 px-2.5 bg-slate-50 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200"
                    onClick={() => handleAddSlot(preset)}
                  >
                    <Plus className="size-3" />
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Active Slots List */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active Canvas Slots ({Object.keys(slots).length})
                </Label>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {Object.entries(slots).map(([slotKey, slot]) => (
                  <div
                    key={slotKey}
                    onClick={() => setSelectedSlotKey(slotKey)}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                      selectedSlotKey === slotKey 
                        ? 'border-purple-600 bg-purple-50 text-purple-950 font-semibold ring-1 ring-purple-600' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-[10px] text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                        {slotKey}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        X:{slot.x_pct}% Y:{slot.y_pct}% · {slot.w_pct}×{slot.h_pct}%
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveSlot(slotKey)
                      }}
                      className="text-slate-400 hover:text-red-600 p-1"
                      title="Remove Slot"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Slot Coordinate Controls */}
            {selectedSlot && selectedSlotKey && (
              <div className="border-t pt-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <Move className="size-3.5 text-purple-600" />
                    Adjust: <span className="font-mono text-purple-700">{selectedSlotKey}</span>
                  </span>
                  {/* Alignment buttons */}
                  <div className="flex items-center gap-0.5 bg-white p-0.5 rounded border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleUpdateSlot(selectedSlotKey, { align: "left" })}
                      className={`p-1 rounded text-[10px] ${selectedSlot.align === "left" ? "bg-purple-100 text-purple-700 font-bold" : "text-slate-500"}`}
                      title="Align Left"
                    >
                      <AlignLeft className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateSlot(selectedSlotKey, { align: "center" })}
                      className={`p-1 rounded text-[10px] ${selectedSlot.align === "center" ? "bg-purple-100 text-purple-700 font-bold" : "text-slate-500"}`}
                      title="Align Center"
                    >
                      <AlignCenter className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateSlot(selectedSlotKey, { align: "right" })}
                      className={`p-1 rounded text-[10px] ${selectedSlot.align === "right" ? "bg-purple-100 text-purple-700 font-bold" : "text-slate-500"}`}
                      title="Align Right"
                    >
                      <AlignRight className="size-3" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block mb-1">Left (X%)</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={selectedSlot.x_pct}
                      onChange={(e) => handleUpdateSlot(selectedSlotKey, { x_pct: Number(e.target.value) })}
                      className="h-7 text-xs px-2"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block mb-1">Top (Y%)</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={selectedSlot.y_pct}
                      onChange={(e) => handleUpdateSlot(selectedSlotKey, { y_pct: Number(e.target.value) })}
                      className="h-7 text-xs px-2"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block mb-1">Width (W%)</span>
                    <Input
                      type="number"
                      min={5}
                      max={100}
                      value={selectedSlot.w_pct}
                      onChange={(e) => handleUpdateSlot(selectedSlotKey, { w_pct: Number(e.target.value) })}
                      className="h-7 text-xs px-2"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block mb-1">Height (H%)</span>
                    <Input
                      type="number"
                      min={2}
                      max={100}
                      value={selectedSlot.h_pct}
                      onChange={(e) => handleUpdateSlot(selectedSlotKey, { h_pct: Number(e.target.value) })}
                      className="h-7 text-xs px-2"
                    />
                  </div>
                </div>

                {/* Typography controls for Text / Badge / CTA slots */}
                <div className="border-t border-slate-200/80 pt-2.5 mt-2.5 grid gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Type className="size-3 text-purple-600" />
                      Slot Typography &amp; Font
                    </span>
                    <Badge variant="outline" className="text-[9px] text-slate-500 font-mono">
                      {selectedSlot.font_family || "Theme Default"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <span className="text-[10px] text-slate-500 font-semibold">Font Family</span>
                      <Select
                        value={selectedSlot.font_family || ""}
                        onChange={(e) => handleUpdateSlot(selectedSlotKey, { font_family: e.target.value || undefined })}
                        className="h-7 text-xs"
                      >
                        <option value="">(Theme Default Font)</option>
                        {installedFonts.map((f) => (
                          <option key={f.filename} value={f.family}>
                            {f.name}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="grid gap-1">
                      <span className="text-[10px] text-slate-500 font-semibold">Font Weight</span>
                      <Select
                        value={selectedSlot.font_weight || "bold"}
                        onChange={(e) => handleUpdateSlot(selectedSlotKey, { font_weight: e.target.value as any })}
                        className="h-7 text-xs"
                      >
                        <option value="bold">Bold / Heavy</option>
                        <option value="regular">Regular / Normal</option>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column (7 cols): Visual Interactive Stage Preview */}
          <div className="lg:col-span-7 p-6 flex flex-col items-center justify-between bg-slate-900 gap-4">
            {/* View Mode Switcher */}
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Canvas Stage:</span>
                <Badge variant="outline" className="text-[10px] font-mono border-white/20 text-slate-300">1080 × 1080 (1:1)</Badge>
              </div>

              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/10 text-white">
                <button
                  type="button"
                  onClick={() => setPreviewMode("blueprint")}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    previewMode === "blueprint" ? "bg-purple-600 text-white" : "text-white/70 hover:text-white"
                  }`}
                >
                  <Code className="size-3 inline mr-1" />
                  Blueprint
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("demo")}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    previewMode === "demo" ? "bg-purple-600 text-white" : "text-white/70 hover:text-white"
                  }`}
                >
                  <Eye className="size-3 inline mr-1" />
                  Simulated Poster
                </button>
              </div>
            </div>

            {/* The 1:1 Canvas Stage */}
            <div className="relative aspect-square w-full max-w-[420px] rounded-xl overflow-hidden bg-slate-950 border-2 border-slate-700 shadow-2xl select-none">
              {previewMode === "blueprint" ? (
                /* Blueprint Mode */
                <div className="absolute inset-0 p-3">
                  {/* Grid backdrop */}
                  <div 
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      backgroundImage: `radial-gradient(#818CF8 1px, transparent 1px)`,
                      backgroundSize: "16px 16px",
                    }}
                  />
                  
                  {Object.entries(slots).map(([slotKey, slot]) => {
                    const isSelected = selectedSlotKey === slotKey
                    return (
                      <div
                        key={slotKey}
                        onClick={() => setSelectedSlotKey(slotKey)}
                        className={`absolute flex flex-col items-center justify-center p-1 rounded border-2 transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-purple-400 bg-purple-500/30 text-white ring-2 ring-purple-400 z-20 font-bold' 
                            : 'border-dashed border-sky-400/80 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25 z-10'
                        }`}
                        style={{
                          left: `${slot.x_pct}%`,
                          top: `${slot.y_pct}%`,
                          width: `${slot.w_pct}%`,
                          height: `${slot.h_pct}%`,
                        }}
                      >
                        <span className="font-mono text-[10px] leading-tight truncate">{slotKey}</span>
                        <span className="font-mono text-[8px] opacity-70 leading-none">{slot.w_pct}%×{slot.h_pct}%</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Simulated Poster Mode */
                <div 
                  className="absolute inset-0 p-6 flex flex-col justify-between text-white"
                  style={{
                    background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #0F172A 100%)",
                  }}
                >
                  {Object.entries(slots).map(([slotKey, slot]) => {
                    const alignClass = 
                      slot.align === "left" ? "text-left items-start justify-start" :
                      slot.align === "right" ? "text-right items-end justify-end" :
                      "text-center items-center justify-center"

                    return (
                      <div
                        key={slotKey}
                        className={`absolute flex ${alignClass} pointer-events-none`}
                        style={{
                          left: `${slot.x_pct}%`,
                          top: `${slot.y_pct}%`,
                          width: `${slot.w_pct}%`,
                          height: `${slot.h_pct}%`,
                        }}
                      >
                        {slotKey.includes("headline") && !slotKey.includes("sub") ? (
                          <h2
                            className="font-extrabold uppercase text-white leading-tight drop-shadow text-lg"
                            style={{
                              fontFamily: slot.font_family || "inherit",
                              fontWeight: slot.font_weight === "regular" ? 400 : 800,
                            }}
                          >
                            {name || "CUSTOM HERO HEADLINE"}
                          </h2>
                        ) : slotKey.includes("subheadline") ? (
                          <p
                            className="text-slate-300 text-xs line-clamp-2"
                            style={{
                              fontFamily: slot.font_family || "inherit",
                              fontWeight: slot.font_weight === "regular" ? 400 : 600,
                            }}
                          >
                            {description || "Supporting custom description statement"}
                          </p>
                        ) : slotKey.includes("badge") ? (
                          <span
                            className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 font-bold text-[10px] uppercase shadow"
                            style={{
                              fontFamily: slot.font_family || "inherit",
                            }}
                          >
                            CUSTOM
                          </span>
                        ) : slotKey.includes("cta") ? (
                          <span
                            className="px-3 py-1 rounded bg-teal-500 text-white font-bold text-[10px] uppercase shadow"
                            style={{
                              fontFamily: slot.font_family || "inherit",
                            }}
                          >
                            DISCOVER NOW →
                          </span>
                        ) : (
                          <span
                            className="text-[10px] text-white/70 font-mono"
                            style={{
                              fontFamily: slot.font_family || "inherit",
                            }}
                          >
                            {slotKey}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Click any slot in the list or stage to nudge dimensions and alignments.
            </p>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between border-t px-6 py-4 bg-slate-50">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-5 shadow-md flex items-center gap-2"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : <Check className="size-4 mr-1" />}
            Save &amp; Add to Library
          </Button>
        </div>
      </div>
    </div>
  )
}
