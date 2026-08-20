"use client"

import * as React from "react"
import { useState } from "react"
import { BookmarkPlus, X, Check, Loader2, Sparkles, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { axiosInstance } from "@/lib/axios"
import { toast } from "sonner"

interface Props {
  isOpen: boolean
  onClose: () => void
  canvasState: any
  onSaved?: () => void
}

export function SaveCanvasAsTemplateDialog({ isOpen, onClose, canvasState, onSaved }: Props) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState("Custom Saved Layouts")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  const elementsCount = canvasState?.resolved_assets?.length || 0

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Please enter a name for this template")
      return
    }

    setSaving(true)
    try {
      await axiosInstance.post("/api/poster/templates/save-canvas-as-template", {
        name: name.trim(),
        category: category.trim() || "Custom Saved Layouts",
        description: description.trim() || `Saved from Poster Lab with ${elementsCount} canvas elements`,
        aspect_ratio: canvasState?.aspect_ratio || "1:1",
        canvas_state: canvasState,
      })

      toast.success(`Template "${name}" saved to your Library!`)
      if (onSaved) onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4 bg-slate-50">
          <div className="flex items-center gap-2">
            <BookmarkPlus className="size-5 text-purple-600" />
            <h3 className="font-semibold text-slate-900 text-base leading-5">Save as Reusable Template</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          <div className="rounded-lg bg-purple-50 p-3 border border-purple-100 flex items-center gap-2.5">
            <Layers className="size-4 text-purple-700 shrink-0" />
            <p className="text-xs text-purple-900">
              This will extract all <strong>{elementsCount} canvas layers</strong> (headline, badge, buttons, shapes) into a reusable template slot architecture.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-name" className="text-xs font-bold text-slate-700">Template Name</Label>
            <Input
              id="tpl-name"
              placeholder="e.g. Tropical Summer Flash Promo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-cat" className="text-xs font-bold text-slate-700">Category</Label>
            <Input
              id="tpl-cat"
              placeholder="e.g. Sales &amp; Promo, Mindset, Tech"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc" className="text-xs font-bold text-slate-700">Description (Optional)</Label>
            <Input
              id="tpl-desc"
              placeholder="e.g. High-conversion retail layout with sunburst background"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-5 py-3.5 bg-slate-50">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-4 flex items-center gap-1.5"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Save to Library
          </Button>
        </div>
      </div>
    </div>
  )
}
