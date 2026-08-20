"use client"

import * as React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
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
  Type,
  Bold,
  CaseSensitive,
  Copy,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Grid,
  Lock,
  Unlock,
  Image as ImageIcon,
  Square,
  Circle,
  Minus,
  Upload,
  Search,
  ChevronRight,
  GripVertical,
  Shapes,
  LayoutTemplate,
  ArrowRight,
  Sliders,
} from "lucide-react"
import { Icon } from "@iconify/react"
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { axiosInstance } from "@/lib/axios"
import { toast } from "sonner"
import type { PosterTemplateItem, TemplateSlot } from "./template-poster-demo-card"

export interface CanvaVisualBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  initialTemplate?: PosterTemplateItem | null
}

// ---------------------------------------------------------------------------
// Canvas Layer Types
// ---------------------------------------------------------------------------
export type CanvasLayerType = "text" | "shape" | "icon" | "emoji" | "image" | "logo" | "badge" | "cta"

export interface CanvasLayer {
  id: string
  type: CanvasLayerType
  role: string
  slot_name?: string
  
  // Coordinates (Percentage 0-100)
  x_pct: number
  y_pct: number
  w_pct: number
  h_pct: number
  rotation: number
  z_index: number
  locked?: boolean
  hidden?: boolean
  opacity?: number

  // Typography
  content?: string
  font_family?: string
  font_size_px?: number
  font_weight?: "bold" | "regular" | "semibold" | "extrabold"
  font_style?: "normal" | "italic"
  text_transform?: "none" | "uppercase" | "lowercase" | "capitalize"
  text_align?: "left" | "center" | "right" | "justify"
  text_color?: string
  line_height?: number
  letter_spacing_px?: number

  // Shapes & Badges
  shape_type?: "rectangle" | "rounded_rect" | "circle" | "pill" | "star" | "line"
  fill_color?: string
  gradient?: string[]
  stroke_color?: string
  stroke_width?: number
  corner_radius?: number

  // Icons & Emojis
  icon_name?: string
  emoji?: string
  icon_color?: string

  // Images & Logos
  image_url?: string
  alt?: string
  fit_mode?: "cover" | "contain" | "fill"
}

// ---------------------------------------------------------------------------
// Aspect Ratios & Presets
// ---------------------------------------------------------------------------
export const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1 Square", width: 1080, height: 1080, desc: "Feed Posts / Ads" },
  { id: "4:5", label: "4:5 Portrait", width: 1080, height: 1350, desc: "Instagram & Facebook Feed" },
  { id: "9:16", label: "9:16 Story/Reel", width: 1080, height: 1920, desc: "Stories & Reels" },
  { id: "16:9", label: "16:9 Landscape", width: 1920, height: 1080, desc: "Banner & Display" },
]

export const GOOGLE_FONTS = [
  { name: "Inter (Clean & Modern)", family: "Inter, sans-serif" },
  { name: "Plus Jakarta Sans (SaaS & Tech)", family: "'Plus Jakarta Sans', sans-serif" },
  { name: "Outfit (Bold Geometric)", family: "Outfit, sans-serif" },
  { name: "Space Grotesk (Tech Minimal)", family: "'Space Grotesk', sans-serif" },
  { name: "Syne (Avant-Garde Luxury)", family: "Syne, sans-serif" },
  { name: "Playfair Display (Editorial Serif)", family: "'Playfair Display', serif" },
  { name: "Cinzel (Classic Elegance)", family: "Cinzel, serif" },
  { name: "Montserrat (Impact & Retail)", family: "Montserrat, sans-serif" },
  { name: "JetBrains Mono (Developer Code)", family: "'JetBrains Mono', monospace" },
]

export const POPULAR_ICONS = [
  "lucide:sparkles",
  "lucide:zap",
  "lucide:flame",
  "lucide:heart",
  "lucide:star",
  "lucide:rocket",
  "lucide:shopping-bag",
  "lucide:tag",
  "lucide:award",
  "lucide:trending-up",
  "lucide:shield-check",
  "lucide:quote",
  "lucide:arrow-right",
  "lucide:check-circle-2",
  "lucide:globe",
  "lucide:lock",
  "lucide:cpu",
  "lucide:lightbulb",
  "lucide:gem",
  "lucide:bell",
]

export const STARTER_ARCHETYPES = [
  {
    id: "centered-hero",
    name: "Modern Hero Promo",
    category: "Sales & Promo",
    description: "High-impact centered headline with prominent corner badge, accent icon, and CTA pill button.",
    layers: [
      {
        id: "badge_1",
        type: "badge" as const,
        role: "badge",
        slot_name: "corner_badge",
        x_pct: 70,
        y_pct: 6,
        w_pct: 24,
        h_pct: 8,
        rotation: -4,
        z_index: 2,
        content: "50% OFF",
        text_color: "#0F172A",
        fill_color: "#F59E0B",
        corner_radius: 12,
        font_weight: "extrabold" as const,
      },
      {
        id: "icon_1",
        type: "icon" as const,
        role: "icon",
        slot_name: "accent_icon",
        x_pct: 45,
        y_pct: 12,
        w_pct: 10,
        h_pct: 10,
        rotation: 0,
        z_index: 2,
        icon_name: "lucide:sparkles",
        icon_color: "#38BDF8",
      },
      {
        id: "head_1",
        type: "text" as const,
        role: "headline",
        slot_name: "headline",
        x_pct: 8,
        y_pct: 26,
        w_pct: 84,
        h_pct: 28,
        rotation: 0,
        z_index: 3,
        content: "SUMMER MEGA SALE",
        font_family: "Outfit, sans-serif",
        font_size_px: 52,
        font_weight: "extrabold" as const,
        text_align: "center" as const,
        text_color: "#FFFFFF",
        text_transform: "uppercase" as const,
      },
      {
        id: "sub_1",
        type: "text" as const,
        role: "subheadline",
        slot_name: "subheadline",
        x_pct: 10,
        y_pct: 56,
        w_pct: 80,
        h_pct: 14,
        rotation: 0,
        z_index: 3,
        content: "Up to 50% off all modern tropical essentials & premium accessories",
        font_family: "'Plus Jakarta Sans', sans-serif",
        font_size_px: 20,
        font_weight: "regular" as const,
        text_align: "center" as const,
        text_color: "#94A3B8",
      },
      {
        id: "cta_1",
        type: "cta" as const,
        role: "cta",
        slot_name: "cta_text",
        x_pct: 26,
        y_pct: 76,
        w_pct: 48,
        h_pct: 9,
        rotation: 0,
        z_index: 4,
        content: "SHOP THE SALE →",
        fill_color: "#0D9488",
        text_color: "#FFFFFF",
        corner_radius: 999,
        font_weight: "bold" as const,
      },
      {
        id: "logo_1",
        type: "text" as const,
        role: "logo",
        slot_name: "text_logo",
        x_pct: 35,
        y_pct: 90,
        w_pct: 30,
        h_pct: 5,
        rotation: 0,
        z_index: 2,
        content: "LUMEN STUDIO",
        font_family: "'Space Grotesk', sans-serif",
        font_size_px: 13,
        font_weight: "bold" as const,
        text_align: "center" as const,
        text_color: "#64748B",
        letter_spacing_px: 3,
        text_transform: "uppercase" as const,
      }
    ],
    bg_gradient: ["#0F172A", "#1E1B4B"],
    bg_color: "#0F172A",
    texture: "dot-grid"
  },
  {
    id: "editorial-story",
    name: "Minimal Editorial Story",
    category: "Editorial & Story",
    description: "Magazine-style left-aligned typography with oversized quote tag, subtle divider line, and clear attribution.",
    layers: [
      {
        id: "badge_1",
        type: "badge" as const,
        role: "badge",
        slot_name: "corner_badge",
        x_pct: 8,
        y_pct: 8,
        w_pct: 26,
        h_pct: 6,
        rotation: 0,
        z_index: 2,
        content: "THOUGHT LEADERSHIP",
        text_color: "#FFFFFF",
        fill_color: "#6366F1",
        corner_radius: 6,
        font_weight: "bold" as const,
      },
      {
        id: "head_1",
        type: "text" as const,
        role: "headline",
        slot_name: "headline",
        x_pct: 8,
        y_pct: 20,
        w_pct: 84,
        h_pct: 32,
        rotation: 0,
        z_index: 3,
        content: "THE FUTURE BELONGS TO CREATORS WHO PROTOTYPE DAILY.",
        font_family: "Syne, sans-serif",
        font_size_px: 44,
        font_weight: "extrabold" as const,
        text_align: "left" as const,
        text_color: "#FFFFFF",
      },
      {
        id: "line_1",
        type: "shape" as const,
        shape_type: "line" as const,
        role: "element",
        x_pct: 8,
        y_pct: 56,
        w_pct: 40,
        h_pct: 1,
        rotation: 0,
        z_index: 2,
        stroke_color: "#6366F1",
        stroke_width: 3,
      },
      {
        id: "sub_1",
        type: "text" as const,
        role: "subheadline",
        slot_name: "subheadline",
        x_pct: 8,
        y_pct: 62,
        w_pct: 84,
        h_pct: 18,
        rotation: 0,
        z_index: 3,
        content: "Autonomous agentic workflows turn raw vision into production-ready assets with zero friction.",
        font_family: "'Plus Jakarta Sans', sans-serif",
        font_size_px: 18,
        font_weight: "regular" as const,
        text_align: "left" as const,
        text_color: "#CBD5E1",
      },
      {
        id: "logo_1",
        type: "text" as const,
        role: "logo",
        slot_name: "text_logo",
        x_pct: 8,
        y_pct: 88,
        w_pct: 40,
        h_pct: 5,
        rotation: 0,
        z_index: 2,
        content: "SYNAPSE JOURNAL · ISSUE 42",
        font_family: "'JetBrains Mono', monospace",
        font_size_px: 12,
        font_weight: "bold" as const,
        text_align: "left" as const,
        text_color: "#94A3B8",
      }
    ],
    bg_gradient: ["#090D16", "#1E1E2F"],
    bg_color: "#090D16",
    texture: "noise"
  },
  {
    id: "stat-metric",
    name: "Growth Stat Highlight",
    category: "Data & Stats",
    description: "Commanding numeric growth callout backed by verified proof badge and conversion CTA.",
    layers: [
      {
        id: "badge_1",
        type: "badge" as const,
        role: "badge",
        slot_name: "corner_badge",
        x_pct: 35,
        y_pct: 10,
        w_pct: 30,
        h_pct: 7,
        rotation: 0,
        z_index: 2,
        content: "GROWTH AUDIT",
        text_color: "#052E16",
        fill_color: "#4ADE80",
        corner_radius: 999,
        font_weight: "extrabold" as const,
      },
      {
        id: "head_1",
        type: "text" as const,
        role: "headline",
        slot_name: "headline",
        x_pct: 8,
        y_pct: 22,
        w_pct: 84,
        h_pct: 26,
        rotation: 0,
        z_index: 3,
        content: "+340% REVENUE",
        font_family: "Outfit, sans-serif",
        font_size_px: 60,
        font_weight: "extrabold" as const,
        text_align: "center" as const,
        text_color: "#22C55E",
      },
      {
        id: "sub_1",
        type: "text" as const,
        role: "subheadline",
        slot_name: "subheadline",
        x_pct: 12,
        y_pct: 52,
        w_pct: 76,
        h_pct: 16,
        rotation: 0,
        z_index: 3,
        content: "Verified benchmark metrics achieved by creators using autonomous publishing workflows.",
        font_family: "'Plus Jakarta Sans', sans-serif",
        font_size_px: 19,
        font_weight: "regular" as const,
        text_align: "center" as const,
        text_color: "#E2E8F0",
      },
      {
        id: "cta_1",
        type: "cta" as const,
        role: "cta",
        slot_name: "cta_text",
        x_pct: 28,
        y_pct: 74,
        w_pct: 44,
        h_pct: 9,
        rotation: 0,
        z_index: 4,
        content: "VIEW BENCHMARK →",
        fill_color: "#16A34A",
        text_color: "#FFFFFF",
        corner_radius: 12,
        font_weight: "bold" as const,
      },
      {
        id: "logo_1",
        type: "text" as const,
        role: "logo",
        slot_name: "text_logo",
        x_pct: 30,
        y_pct: 89,
        w_pct: 40,
        h_pct: 5,
        rotation: 0,
        z_index: 2,
        content: "BENCHMARK LABS",
        font_family: "'Space Grotesk', sans-serif",
        font_size_px: 12,
        font_weight: "bold" as const,
        text_align: "center" as const,
        text_color: "#64748B",
        letter_spacing_px: 2,
      }
    ],
    bg_gradient: ["#022C22", "#064E3B"],
    bg_color: "#022C22",
    texture: "dot-grid"
  }
]

export const COLOR_PALETTES = [
  { label: "Deep Space", gradient: ["#0F172A", "#1E1B4B"], bg: "#0F172A", accent: "#818CF8" },
  { label: "Cyber Neon", gradient: ["#090D16", "#1E1B4B"], bg: "#090D16", accent: "#38BDF8" },
  { label: "Emerald Growth", gradient: ["#022C22", "#064E3B"], bg: "#022C22", accent: "#34D399" },
  { label: "Crimson Flash", gradient: ["#450A0A", "#7F1D1D"], bg: "#450A0A", accent: "#F87171" },
  { label: "Midnight Gold", gradient: ["#18181B", "#27272A"], bg: "#18181B", accent: "#FBBF24" },
  { label: "Sunset Glow", gradient: ["#311042", "#6B21A8"], bg: "#311042", accent: "#F43F5E" },
  { label: "Slate Minimal", gradient: ["#1E293B", "#334155"], bg: "#1E293B", accent: "#94A3B8" },
  { label: "Pure Clean", gradient: ["#F8FAFC", "#E2E8F0"], bg: "#F8FAFC", accent: "#4F46E5" },
]

export const TEXTURES = [
  { id: "none", label: "Clean / Smooth" },
  { id: "dot-grid", label: "Dot Matrix Grid" },
  { id: "noise", label: "Grain Noise" },
  { id: "diagonal-stripes", label: "Subtle Diagonal" },
]

export function CanvaVisualBuilderModal({
  isOpen,
  onClose,
  onSaved,
  initialTemplate,
}: CanvaVisualBuilderModalProps) {
  // Metadata state
  const [name, setName] = useState("Custom Poster Hero")
  const [category, setCategory] = useState("Sales & Promo")
  const [description, setDescription] = useState("")
  const [bestFor, setBestFor] = useState("promo, sale, social, launch")
  const [aspectRatio, setAspectRatio] = useState("1:1")
  
  // Canvas style state
  const [bgColor, setBgColor] = useState("#0F172A")
  const [bgGradient, setBgGradient] = useState<string[]>(["#0F172A", "#1E1B4B"])
  const [bgTexture, setBgTexture] = useState("dot-grid")

  // Layers & Selection
  const [layers, setLayers] = useState<CanvasLayer[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  
  // Left Dock & Tools
  const [activeDockTab, setActiveDockTab] = useState<"templates" | "text" | "elements" | "media" | "background" | "layers">("text")
  const [stockQuery, setStockQuery] = useState("business")
  const [stockPhotos, setStockPhotos] = useState<any[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const [installedFonts, setInstalledFonts] = useState<any[]>([])
  const [previewMode, setPreviewMode] = useState<"canvas" | "simulated">("canvas")
  const [zoomScale, setZoomScale] = useState(1)
  const [showSnapGrid, setShowSnapGrid] = useState(true)
  const [saving, setSaving] = useState(false)

  // Snap crosshair indicators
  const [snapLines, setSnapLines] = useState<{ x: boolean; y: boolean }>({ x: false, y: false })

  // History stack for Undo/Redo
  const [history, setHistory] = useState<CanvasLayer[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedoAction = useRef(false)

  // Stage references
  const stageContainerRef = useRef<HTMLDivElement>(null)
  const stageBoardRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dragging & Resizing Refs
  const dragInfoRef = useRef<{
    isDragging: boolean
    handle: string | null
    layerId: string
    startX: number
    startY: number
    startLayer: CanvasLayer
    boardRect: DOMRect | null
  } | null>(null)

  // Initialize or load template
  useEffect(() => {
    if (!isOpen) return

    axiosInstance
      .get("/api/fonts")
      .then((res) => {
        setInstalledFonts(res.data.installed_fonts || [])
      })
      .catch(() => null)

    if (initialTemplate) {
      setName(initialTemplate.name || "Custom Template")
      setCategory(initialTemplate.category || "Custom")
      setDescription(initialTemplate.description || "")
      setBestFor(initialTemplate.best_for?.join(", ") || "custom, social")
      setAspectRatio(initialTemplate.aspect_ratio || "1:1")

      const convertedLayers: CanvasLayer[] = []
      let z = 1
      const sample = initialTemplate.demo_sample || {}
      
      if (sample.gradient) setBgGradient(sample.gradient)
      if (sample.bg_color) setBgColor(sample.bg_color)

      Object.entries(initialTemplate.slots || {}).forEach(([slotKey, slot]) => {
        const role = slot.role || slotKey
        const textContent = 
          (sample as any)[slotKey] || 
          (slotKey.includes("headline") ? initialTemplate.name.toUpperCase() : 
           slotKey.includes("badge") ? "SPECIAL" :
           slotKey.includes("cta") ? "DISCOVER MORE →" : slotKey)

        if (slotKey.includes("badge") || role === "badge") {
          convertedLayers.push({
            id: `layer_${z}`,
            type: "badge",
            role: "badge",
            slot_name: slotKey,
            x_pct: slot.x_pct,
            y_pct: slot.y_pct,
            w_pct: slot.w_pct,
            h_pct: slot.h_pct,
            rotation: 0,
            z_index: z,
            content: textContent,
            font_family: slot.font_family || "Outfit, sans-serif",
            font_weight: slot.font_weight || "extrabold",
            text_color: "#0F172A",
            fill_color: sample.accent_color || "#F59E0B",
            corner_radius: 12,
          })
        } else if (slotKey.includes("cta") || role === "cta") {
          convertedLayers.push({
            id: `layer_${z}`,
            type: "cta",
            role: "cta",
            slot_name: slotKey,
            x_pct: slot.x_pct,
            y_pct: slot.y_pct,
            w_pct: slot.w_pct,
            h_pct: slot.h_pct,
            rotation: 0,
            z_index: z,
            content: textContent,
            font_family: slot.font_family || "'Plus Jakarta Sans', sans-serif",
            font_weight: slot.font_weight || "bold",
            text_color: "#FFFFFF",
            fill_color: sample.accent_color || "#0D9488",
            corner_radius: 999,
          })
        } else {
          convertedLayers.push({
            id: `layer_${z}`,
            type: "text",
            role: role,
            slot_name: slotKey,
            x_pct: slot.x_pct,
            y_pct: slot.y_pct,
            w_pct: slot.w_pct,
            h_pct: slot.h_pct,
            rotation: 0,
            z_index: z,
            content: textContent,
            font_family: slot.font_family || (slotKey.includes("headline") ? "Outfit, sans-serif" : "'Plus Jakarta Sans', sans-serif"),
            font_weight: slot.font_weight || (slotKey.includes("headline") ? "extrabold" : "regular"),
            text_align: slot.align || "center",
            text_color: slotKey.includes("sub") ? "#94A3B8" : "#FFFFFF",
            font_size_px: slotKey.includes("headline") ? 48 : 20,
          })
        }
        z++
      })

      setLayers(convertedLayers)
      setSelectedLayerId(convertedLayers[0]?.id || null)
      pushHistory(convertedLayers)
    } else {
      loadArchetype(STARTER_ARCHETYPES[0])
    }
  }, [isOpen, initialTemplate])

  const pushHistory = useCallback((newLayers: CanvasLayer[]) => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false
      return
    }
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1)
      return [...sliced, JSON.parse(JSON.stringify(newLayers))]
    })
    setHistoryIndex((prev) => prev + 1)
  }, [historyIndex])

  function handleUndo() {
    if (historyIndex > 0) {
      isUndoRedoAction.current = true
      const nextIdx = historyIndex - 1
      const prevLayers = JSON.parse(JSON.stringify(history[nextIdx]))
      setLayers(prevLayers)
      setHistoryIndex(nextIdx)
      toast.info("Undo", { duration: 1000 })
    }
  }

  function handleRedo() {
    if (historyIndex < history.length - 1) {
      isUndoRedoAction.current = true
      const nextIdx = historyIndex + 1
      const nextLayers = JSON.parse(JSON.stringify(history[nextIdx]))
      setLayers(nextLayers)
      setHistoryIndex(nextIdx)
      toast.info("Redo", { duration: 1000 })
    }
  }

  function loadArchetype(archetype: typeof STARTER_ARCHETYPES[0]) {
    setName(archetype.name)
    setCategory(archetype.category)
    setDescription(archetype.description)
    setBgGradient(archetype.bg_gradient)
    setBgColor(archetype.bg_color)
    setBgTexture(archetype.texture)
    const clonedLayers = JSON.parse(JSON.stringify(archetype.layers))
    setLayers(clonedLayers)
    setSelectedLayerId(clonedLayers[0]?.id || null)
    pushHistory(clonedLayers)
    toast.success(`Loaded preset: ${archetype.name}`)
  }

  function updateLayer(id: string, patch: Partial<CanvasLayer>, recordHistory = true) {
    setLayers((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
      if (recordHistory) pushHistory(next)
      return next
    })
  }

  function addLayer(newLayerProps: Partial<CanvasLayer>) {
    const nextZ = layers.length ? Math.max(...layers.map((l) => l.z_index)) + 1 : 1
    const newId = `layer_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`
    const defaultLayer: CanvasLayer = {
      id: newId,
      type: "text",
      role: "element",
      x_pct: 20,
      y_pct: 35,
      w_pct: 60,
      h_pct: 15,
      rotation: 0,
      z_index: nextZ,
      content: "New Canvas Element",
      font_family: "Outfit, sans-serif",
      font_size_px: 32,
      font_weight: "bold",
      text_align: "center",
      text_color: "#FFFFFF",
      fill_color: "#6366F1",
      corner_radius: 12,
      opacity: 1,
      ...newLayerProps,
    }
    const next = [...layers, defaultLayer]
    setLayers(next)
    setSelectedLayerId(newId)
    pushHistory(next)
    toast.success(`Added ${defaultLayer.role || defaultLayer.type}`)
  }

  function removeLayer(id: string) {
    const next = layers.filter((l) => l.id !== id)
    setLayers(next)
    if (selectedLayerId === id) {
      setSelectedLayerId(next[next.length - 1]?.id || null)
    }
    pushHistory(next)
    toast.success("Layer removed")
  }

  function duplicateLayer(id: string) {
    const target = layers.find((l) => l.id === id)
    if (!target) return
    const nextZ = Math.max(...layers.map((l) => l.z_index)) + 1
    const newId = `layer_${Date.now().toString(36)}`
    const copy: CanvasLayer = {
      ...JSON.parse(JSON.stringify(target)),
      id: newId,
      x_pct: Math.min(80, target.x_pct + 4),
      y_pct: Math.min(80, target.y_pct + 4),
      z_index: nextZ,
    }
    const next = [...layers, copy]
    setLayers(next)
    setSelectedLayerId(newId)
    pushHistory(next)
    toast.success("Layer duplicated")
  }

  function bringForward(id: string) {
    const target = layers.find((l) => l.id === id)
    if (!target) return
    const next = layers.map((l) => (l.id === id ? { ...l, z_index: l.z_index + 1 } : l))
    setLayers(next)
    pushHistory(next)
  }

  function sendBackward(id: string) {
    const target = layers.find((l) => l.id === id)
    if (!target) return
    const next = layers.map((l) => (l.id === id ? { ...l, z_index: Math.max(1, l.z_index - 1) } : l))
    setLayers(next)
    pushHistory(next)
  }

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedLayerId) {
        e.preventDefault()
        removeLayer(selectedLayerId)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selectedLayerId) {
        e.preventDefault()
        duplicateLayer(selectedLayerId)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault()
        handleRedo()
      }
      if (e.key === "Escape") {
        setSelectedLayerId(null)
      }
      if (selectedLayerId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault()
        const targetLayer = layers.find((l) => l.id === selectedLayerId)
        if (!targetLayer || targetLayer.locked) return
        const step = e.shiftKey ? 5 : 1
        let dx = 0
        let dy = 0
        if (e.key === "ArrowLeft") dx = -step
        if (e.key === "ArrowRight") dx = step
        if (e.key === "ArrowUp") dy = -step
        if (e.key === "ArrowDown") dy = step

        const nextX = Math.max(0, Math.min(100 - targetLayer.w_pct, targetLayer.x_pct + dx))
        const nextY = Math.max(0, Math.min(100 - targetLayer.h_pct, targetLayer.y_pct + dy))
        updateLayer(selectedLayerId, { x_pct: nextX, y_pct: nextY })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, selectedLayerId, layers, historyIndex, history])

  const handlePointerDown = (e: React.PointerEvent, layerId: string, handle: string) => {
    e.stopPropagation()
    const targetLayer = layers.find((l) => l.id === layerId)
    if (!targetLayer || targetLayer.locked) return

    setSelectedLayerId(layerId)
    const boardRect = stageBoardRef.current?.getBoundingClientRect() || null

    dragInfoRef.current = {
      isDragging: true,
      handle,
      layerId,
      startX: e.clientX,
      startY: e.clientY,
      startLayer: { ...targetLayer },
      boardRect,
    }

    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragInfoRef.current || !dragInfoRef.current.isDragging) return
    const { handle, layerId, startX, startY, startLayer, boardRect } = dragInfoRef.current
    if (!boardRect || boardRect.width <= 0 || boardRect.height <= 0) return

    const deltaXPct = ((e.clientX - startX) / boardRect.width) * 100
    const deltaYPct = ((e.clientY - startY) / boardRect.height) * 100

    if (handle === "move") {
      let nextX = startLayer.x_pct + deltaXPct
      let nextY = startLayer.y_pct + deltaYPct

      let snappedX = false
      let snappedY = false
      const centerX = nextX + startLayer.w_pct / 2
      const centerY = nextY + startLayer.h_pct / 2

      if (showSnapGrid) {
        if (Math.abs(centerX - 50) < 2) {
          nextX = 50 - startLayer.w_pct / 2
          snappedX = true
        }
        if (Math.abs(centerY - 50) < 2) {
          nextY = 50 - startLayer.h_pct / 2
          snappedY = true
        }
      }

      setSnapLines({ x: snappedX, y: snappedY })

      nextX = Math.max(0, Math.min(100 - startLayer.w_pct, nextX))
      nextY = Math.max(0, Math.min(100 - startLayer.h_pct, nextY))

      updateLayer(layerId, {
        x_pct: Math.round(nextX * 10) / 10,
        y_pct: Math.round(nextY * 10) / 10,
      }, false)
    } else if (handle === "rotate") {
      const elemCenterX = boardRect.left + ((startLayer.x_pct + startLayer.w_pct / 2) / 100) * boardRect.width
      const elemCenterY = boardRect.top + ((startLayer.y_pct + startLayer.h_pct / 2) / 100) * boardRect.height
      const rad = Math.atan2(e.clientY - elemCenterY, e.clientX - elemCenterX)
      let deg = Math.round((rad * (180 / Math.PI)) + 90)
      if (deg < 0) deg += 360
      if (deg > 360) deg -= 360

      if (Math.abs(deg) < 4 || Math.abs(deg - 360) < 4) deg = 0
      if (Math.abs(deg - 90) < 4) deg = 90
      if (Math.abs(deg - 180) < 4) deg = 180
      if (Math.abs(deg - 270) < 4) deg = 270

      updateLayer(layerId, { rotation: deg }, false)
    } else {
      let nextX = startLayer.x_pct
      let nextY = startLayer.y_pct
      let nextW = startLayer.w_pct
      let nextH = startLayer.h_pct

      if (handle?.includes("e")) {
        nextW = Math.max(4, startLayer.w_pct + deltaXPct)
      }
      if (handle?.includes("s")) {
        nextH = Math.max(3, startLayer.h_pct + deltaYPct)
      }
      if (handle?.includes("w")) {
        const potentialW = Math.max(4, startLayer.w_pct - deltaXPct)
        nextX = startLayer.x_pct + (startLayer.w_pct - potentialW)
        nextW = potentialW
      }
      if (handle?.includes("n")) {
        const potentialH = Math.max(3, startLayer.h_pct - deltaYPct)
        nextY = startLayer.y_pct + (startLayer.h_pct - potentialH)
        nextH = potentialH
      }

      nextX = Math.max(0, Math.min(100 - nextW, nextX))
      nextY = Math.max(0, Math.min(100 - nextH, nextY))

      updateLayer(layerId, {
        x_pct: Math.round(nextX * 10) / 10,
        y_pct: Math.round(nextY * 10) / 10,
        w_pct: Math.round(nextW * 10) / 10,
        h_pct: Math.round(nextH * 10) / 10,
      }, false)
    }
  }

  const handlePointerUp = () => {
    if (dragInfoRef.current?.isDragging) {
      dragInfoRef.current = null
      setSnapLines({ x: false, y: false })
      pushHistory(layers)
    }
  }

  async function searchStockPhotos(query: string) {
    if (!query.trim()) return
    setStockLoading(true)
    try {
      const res = await axiosInstance.get("/api/stock-photos", { params: { query, page: 1 } })
      if (res.data?.photos) {
        setStockPhotos(res.data.photos)
      }
    } catch {
      toast.error("Could not fetch stock photos")
    } finally {
      setStockLoading(false)
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      addLayer({
        type: "image",
        role: "element",
        image_url: url,
        w_pct: 35,
        h_pct: 35,
        fit_mode: "cover",
      })
    }
    reader.readAsDataURL(file)
  }

  async function handleSaveTemplate() {
    if (!name.trim()) {
      toast.error("Please enter a template name")
      return
    }
    if (layers.length === 0) {
      toast.error("Please add at least one element to the canvas")
      return
    }

    setSaving(true)
    try {
      const bestForList = bestFor
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)

      const slots: Record<string, TemplateSlot> = {}
      const demoSample: Record<string, any> = {
        gradient: bgGradient,
        bg_color: bgColor,
        accent_color: layers.find((l) => l.fill_color)?.fill_color || "#38BDF8",
      }

      layers.forEach((l) => {
        const slotKey = l.slot_name || `${l.role}_${l.id}`
        slots[slotKey] = {
          x_pct: l.x_pct,
          y_pct: l.y_pct,
          w_pct: l.w_pct,
          h_pct: l.h_pct,
          align: l.text_align === "justify" ? "center" : (l.text_align || "center"),
          role: l.role,
          font_family: l.font_family,
          font_weight: l.font_weight === "bold" || l.font_weight === "extrabold" ? "bold" : "regular",
        }

        if (l.content) {
          demoSample[slotKey] = l.content
          if (l.role === "headline") demoSample["headline"] = l.content
          if (l.role === "subheadline") demoSample["subheadline"] = l.content
          if (l.role === "badge") demoSample["badge_text"] = l.content
          if (l.role === "cta") demoSample["cta_text"] = l.content
          if (l.role === "logo") demoSample["text_logo"] = l.content
        }
      })

      const payload = {
        name: name.trim(),
        category: category.trim() || "Custom",
        description: description.trim() || `Crafted in Visual Canvas Studio with ${layers.length} layers`,
        aspect_ratio: aspectRatio,
        slots: slots,
        best_for: bestForList.length ? bestForList : ["custom", "social"],
        demo_sample: demoSample,
        canvas_state: {
          canvas_w: 1080,
          canvas_h: aspectRatio === "4:5" ? 1350 : aspectRatio === "9:16" ? 1920 : aspectRatio === "16:9" ? 607 : 1080,
          aspect_ratio: aspectRatio,
          bg_color: bgColor,
          bg_gradient: bgGradient,
          bg_texture: bgTexture,
          layers: layers,
        }
      }

      await axiosInstance.post("/api/poster/templates", payload)

      toast.success(`Template "${name}" saved to your Library!`)
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  const activeLayer = layers.find((l) => l.id === selectedLayerId) || null
  const activeAspect = ASPECT_RATIOS.find((a) => a.id === aspectRatio) || ASPECT_RATIOS[0]
  const stageAspectRatio = `${activeAspect.width} / ${activeAspect.height}`

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-sm text-slate-800 select-none animate-in fade-in duration-200 font-sans">
      
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION & HEADER BAR (Clean Light Theme)                        */}
      {/* ========================================================================= */}
      <header className="h-14 border-b border-slate-200 bg-white px-4 flex items-center justify-between shrink-0 z-30 shadow-xs">
        
        {/* Left: Brand / Title / Category */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Exit Canvas Builder"
          >
            <X className="size-5" />
          </button>

          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <Sparkles className="size-4 text-purple-600 shrink-0" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent font-bold text-sm text-slate-900 hover:bg-slate-50 focus:bg-white px-2 py-1 rounded-md border border-transparent focus:border-purple-600 outline-none w-52 md:w-68 truncate"
              placeholder="Untitled Poster Template"
            />
            <span className="text-xs text-purple-700 font-medium hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200">
              {category}
            </span>
          </div>
        </div>

        {/* Center: Aspect Ratio & Zoom & Snap Controls */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Aspect Ratio Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            {ASPECT_RATIOS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAspectRatio(item.id)}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all ${
                  aspectRatio === item.id 
                    ? "bg-white text-purple-700 shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title={item.desc}
              >
                {item.id}
              </button>
            ))}
          </div>

          {/* Snap Guide Toggle */}
          <button
            type="button"
            onClick={() => setShowSnapGrid(!showSnapGrid)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
              showSnapGrid 
                ? "bg-purple-50 border-purple-300 text-purple-700 font-semibold" 
                : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
            }`}
            title="Toggle Magnetic Snapping & Alignment Guides"
          >
            <Grid className="size-3.5" />
            <span className="text-[11px] hidden xl:inline">Snap</span>
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded text-slate-600 hover:text-slate-900 disabled:opacity-30 transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded text-slate-600 hover:text-slate-900 disabled:opacity-30 transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="size-3.5" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs text-slate-700">
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.1))}
              className="p-1.5 rounded hover:text-slate-900"
              title="Zoom Out"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="px-1 text-[11px] font-mono">{Math.round(zoomScale * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.min(1.4, z + 0.1))}
              className="p-1.5 rounded hover:text-slate-900"
              title="Zoom In"
            >
              <ZoomIn className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Mode Toggle & Save Button */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setPreviewMode("canvas")}
              className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors ${
                previewMode === "canvas" ? "bg-white text-purple-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Canvas
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("simulated")}
              className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors ${
                previewMode === "simulated" ? "bg-white text-purple-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Eye className="size-3 inline mr-1" />
              Simulated
            </button>
          </div>

          {/* Primary Save Action */}
          <Button
            size="sm"
            onClick={handleSaveTemplate}
            disabled={saving}
            className="h-8 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white shadow-sm gap-1.5 px-3.5 transition-all hover:scale-[1.02]"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Save Template
          </Button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. CONTEXTUAL TOP PROPERTY TOOLBAR (Clean Light Theme)                    */}
      {/* ========================================================================= */}
      <div className="h-11 border-b border-slate-200 bg-slate-50/90 px-4 flex items-center justify-between overflow-x-auto text-xs shrink-0 z-20">
        {activeLayer ? (
          <div className="flex items-center gap-3 w-full">
            {/* Element Identifier */}
            <div className="flex items-center gap-1.5 pr-3 border-r border-slate-200 shrink-0">
              <span className="font-mono text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200 uppercase font-bold">
                {activeLayer.role || activeLayer.type}
              </span>
            </div>

            {/* Typography Controls for Text / Badge / CTA */}
            {(activeLayer.type === "text" || activeLayer.type === "badge" || activeLayer.type === "cta") && (
              <div className="flex items-center gap-2 shrink-0">
                {/* Font Family Picker */}
                <select
                  value={activeLayer.font_family || "Outfit, sans-serif"}
                  onChange={(e) => updateLayer(activeLayer.id, { font_family: e.target.value })}
                  className="h-7 px-2 rounded bg-white border border-slate-200 text-xs text-slate-900 outline-none focus:border-purple-600 max-w-[150px]"
                >
                  <optgroup label="Popular Google Fonts">
                    {GOOGLE_FONTS.map((f) => (
                      <option key={f.name} value={f.family}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                  {installedFonts.length > 0 && (
                    <optgroup label="System Installed Fonts">
                      {installedFonts.map((f) => (
                        <option key={f.filename} value={f.family}>
                          {f.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {/* Font Size Stepper */}
                <div className="flex items-center bg-white rounded border border-slate-200">
                  <button
                    type="button"
                    onClick={() => updateLayer(activeLayer.id, { font_size_px: Math.max(10, (activeLayer.font_size_px || 24) - 2) })}
                    className="px-1.5 h-7 text-slate-600 hover:text-slate-900"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={activeLayer.font_size_px || 24}
                    onChange={(e) => updateLayer(activeLayer.id, { font_size_px: Number(e.target.value) })}
                    className="w-10 h-7 text-center bg-transparent font-mono text-[11px] text-slate-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateLayer(activeLayer.id, { font_size_px: Math.min(120, (activeLayer.font_size_px || 24) + 2) })}
                    className="px-1.5 h-7 text-slate-600 hover:text-slate-900"
                  >
                    +
                  </button>
                </div>

                {/* Text Color Picker */}
                <div className="flex items-center gap-1.5 bg-white px-2 h-7 rounded border border-slate-200">
                  <input
                    type="color"
                    value={activeLayer.text_color || "#FFFFFF"}
                    onChange={(e) => updateLayer(activeLayer.id, { text_color: e.target.value })}
                    className="size-4 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <span className="font-mono text-[10px] text-slate-700 uppercase">
                    {activeLayer.text_color || "#FFF"}
                  </span>
                </div>

                {/* Bold / Italic / Uppercase */}
                <div className="flex items-center bg-white p-0.5 rounded border border-slate-200">
                  <button
                    type="button"
                    onClick={() => updateLayer(activeLayer.id, { font_weight: activeLayer.font_weight === "bold" ? "regular" : "bold" })}
                    className={`p-1 rounded text-xs transition-colors ${
                      activeLayer.font_weight === "bold" || activeLayer.font_weight === "extrabold"
                        ? "bg-purple-100 text-purple-800 font-bold" 
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Bold"
                  >
                    <Bold className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLayer(activeLayer.id, { text_transform: activeLayer.text_transform === "uppercase" ? "none" : "uppercase" })}
                    className={`p-1 rounded text-xs transition-colors ${
                      activeLayer.text_transform === "uppercase"
                        ? "bg-purple-100 text-purple-800 font-bold" 
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Uppercase (TT)"
                  >
                    <CaseSensitive className="size-3" />
                  </button>
                </div>

                {/* Alignment */}
                <div className="flex items-center bg-white p-0.5 rounded border border-slate-200">
                  {(["left", "center", "right"] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => updateLayer(activeLayer.id, { text_align: align })}
                      className={`p-1 rounded text-xs ${
                        activeLayer.text_align === align ? "bg-purple-100 text-purple-800 font-bold" : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {align === "left" && <AlignLeft className="size-3" />}
                      {align === "center" && <AlignCenter className="size-3" />}
                      {align === "right" && <AlignRight className="size-3" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Shape / Badge / CTA Fill & Corner Radius */}
            {(activeLayer.type === "shape" || activeLayer.type === "badge" || activeLayer.type === "cta") && (
              <div className="flex items-center gap-2 shrink-0 border-l border-slate-200 pl-2">
                <div className="flex items-center gap-1.5 bg-white px-2 h-7 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500">Fill:</span>
                  <input
                    type="color"
                    value={activeLayer.fill_color || "#6366F1"}
                    onChange={(e) => updateLayer(activeLayer.id, { fill_color: e.target.value })}
                    className="size-4 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <span className="font-mono text-[10px] text-slate-700 uppercase">
                    {activeLayer.fill_color || "#6366F1"}
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-white px-2 h-7 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500">Radius:</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={activeLayer.corner_radius || 0}
                    onChange={(e) => updateLayer(activeLayer.id, { corner_radius: Number(e.target.value) })}
                    className="w-8 text-center bg-transparent font-mono text-[10px] text-slate-900 outline-none"
                  />
                  <span className="text-[10px] text-slate-500">px</span>
                </div>
              </div>
            )}

            {/* Slot Role Assigner */}
            <div className="flex items-center gap-1.5 shrink-0 border-l border-slate-200 pl-2">
              <span className="text-[10px] text-slate-500">Slot Role:</span>
              <select
                value={activeLayer.role || "element"}
                onChange={(e) => updateLayer(activeLayer.id, { role: e.target.value, slot_name: e.target.value })}
                className="h-7 px-2 rounded bg-white border border-slate-200 text-[11px] text-purple-750 font-mono outline-none font-semibold"
              >
                <option value="headline">Headline Title</option>
                <option value="subheadline">Subheadline Body</option>
                <option value="badge">Badge Tag</option>
                <option value="cta">CTA Button</option>
                <option value="logo">Brand Logo</option>
                <option value="icon">Accent Icon</option>
                <option value="details">Details Block</option>
                <option value="element">Custom Layer</option>
              </select>
            </div>

            {/* Actions: Duplicate, Layering, Delete */}
            <div className="flex items-center gap-1 ml-auto shrink-0">
              <button
                type="button"
                onClick={() => bringForward(activeLayer.id)}
                className="p-1.5 rounded bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                title="Bring Forward"
              >
                <ChevronRight className="size-3 -rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => sendBackward(activeLayer.id)}
                className="p-1.5 rounded bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                title="Send Backward"
              >
                <ChevronRight className="size-3 rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => duplicateLayer(activeLayer.id)}
                className="p-1.5 rounded bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                title="Duplicate (Ctrl+D)"
              >
                <Copy className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => removeLayer(activeLayer.id)}
                className="p-1.5 rounded bg-red-50 border border-red-200 text-red-600 hover:bg-red-100"
                title="Delete (Del)"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>
        ) : (
          /* Canvas Background Bar */
          <div className="flex items-center justify-between w-full text-slate-600">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-slate-800 flex items-center gap-1">
                <Palette className="size-3.5 text-purple-700" />
                Canvas Artboard:
              </span>

              {/* Background Color */}
              <div className="flex items-center gap-1.5 bg-white px-2 h-7 rounded border border-slate-200">
                <span className="text-[10px] text-slate-500">Solid:</span>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="size-4 rounded cursor-pointer border-0 p-0 bg-transparent"
                />
                <span className="font-mono text-[10px] text-slate-700 uppercase">{bgColor}</span>
              </div>

              {/* Texture */}
              <div className="flex items-center gap-1.5 bg-white px-2 h-7 rounded border border-slate-200">
                <span className="text-[10px] text-slate-500">Texture:</span>
                <select
                  value={bgTexture}
                  onChange={(e) => setBgTexture(e.target.value)}
                  className="bg-transparent text-[11px] text-slate-800 outline-none"
                >
                  {TEXTURES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <span className="text-[11px] text-slate-500">
              Click any element on the canvas or pick from the left drawer to edit.
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN WORKSPACE: LEFT TOOL DOCK & CANVAS STAGE                          */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* --- 3A. LEFT PRIMARY DOCK STRIP (Clean Light Theme) --- */}
        <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-3 gap-1 shrink-0 z-20">
          {[
            { id: "templates", label: "Templates", icon: LayoutTemplate },
            { id: "text", label: "Text", icon: Type },
            { id: "elements", label: "Elements", icon: Shapes },
            { id: "media", label: "Media", icon: ImageIcon },
            { id: "background", label: "Style", icon: Palette },
            { id: "layers", label: "Layers", icon: Layers },
          ].map((tab) => {
            const IconComp = tab.icon
            const isActive = activeDockTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveDockTab(tab.id as any)}
                className={`w-13 py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
                  isActive 
                    ? "bg-purple-50 text-purple-700 font-bold border border-purple-200 shadow-xs" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <IconComp className="size-4" />
                <span className="text-[10px] leading-tight">{tab.label}</span>
              </button>
            )
          })}
        </aside>

        {/* --- 3B. EXPANDABLE SECONDARY DRAWER (Clean Light Theme) --- */}
        <aside className="w-72 md:w-80 bg-slate-50/90 border-r border-slate-200 flex flex-col overflow-y-auto p-4 gap-4 shrink-0 z-10 text-slate-800">
          
          {/* TAB 1: TEMPLATES / ARCHETYPES */}
          {activeDockTab === "templates" && (
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Starter Archetypes</h3>
                <p className="text-xs text-slate-500 mt-0.5">Click to instantly load a high-converting layout.</p>
              </div>

              <div className="grid gap-2.5">
                {STARTER_ARCHETYPES.map((arch) => (
                  <div
                    key={arch.id}
                    onClick={() => loadArchetype(arch)}
                    className="group p-3 rounded-xl border border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/30 cursor-pointer transition-all space-y-1.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-xs text-slate-900 group-hover:text-purple-700 transition-colors">
                        {arch.name}
                      </h4>
                      <Badge variant="outline" className="text-[9px] border-slate-200 text-slate-600 bg-slate-50">
                        {arch.category}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {arch.description}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-purple-700 font-mono">
                      <span>{arch.layers.length} canvas layers</span>
                      <span className="flex items-center gap-0.5 group-hover:translate-x-1 transition-transform font-bold">
                        Remix <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: TEXT PRESETS */}
          {activeDockTab === "text" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Add Typography</h3>
                <p className="text-xs text-slate-500 mt-0.5">Click any block to inject it onto the canvas.</p>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => addLayer({
                    type: "text",
                    role: "headline",
                    slot_name: "headline",
                    content: "BOLD IMPACT HEADLINE",
                    font_family: "Outfit, sans-serif",
                    font_size_px: 52,
                    font_weight: "extrabold",
                    text_align: "center",
                    text_color: "#FFFFFF",
                    w_pct: 84,
                    h_pct: 26,
                  })}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-purple-400 hover:bg-purple-50/40 text-left transition-all group shadow-xs"
                >
                  <span className="font-extrabold text-base text-slate-900 block group-hover:text-purple-700">
                    Add Heading Title
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Headline slot · 52px Outfit</span>
                </button>

                <button
                  type="button"
                  onClick={() => addLayer({
                    type: "text",
                    role: "subheadline",
                    slot_name: "subheadline",
                    content: "Supporting descriptive statement clarifying your value proposition.",
                    font_family: "'Plus Jakarta Sans', sans-serif",
                    font_size_px: 20,
                    font_weight: "regular",
                    text_align: "center",
                    text_color: "#94A3B8",
                    w_pct: 80,
                    h_pct: 15,
                  })}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-purple-400 hover:bg-purple-50/40 text-left transition-all group shadow-xs"
                >
                  <span className="font-medium text-sm text-slate-800 block group-hover:text-purple-700">
                    Add Subheading / Body
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Subheadline slot · 20px Jakarta</span>
                </button>

                <button
                  type="button"
                  onClick={() => addLayer({
                    type: "badge",
                    role: "badge",
                    slot_name: "corner_badge",
                    content: "SPECIAL OFFER",
                    fill_color: "#F59E0B",
                    text_color: "#0F172A",
                    corner_radius: 12,
                    font_weight: "extrabold",
                    w_pct: 28,
                    h_pct: 8,
                  })}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-purple-400 hover:bg-purple-50/40 text-left transition-all group shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold text-[10px]">
                      BADGE
                    </span>
                    <span className="font-bold text-xs text-slate-900">Promo Badge Tag</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">Badge slot · Highlight pill</span>
                </button>

                <button
                  type="button"
                  onClick={() => addLayer({
                    type: "cta",
                    role: "cta",
                    slot_name: "cta_text",
                    content: "GET STARTED NOW →",
                    fill_color: "#0D9488",
                    text_color: "#FFFFFF",
                    corner_radius: 999,
                    font_weight: "bold",
                    w_pct: 46,
                    h_pct: 9,
                  })}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-purple-400 hover:bg-purple-50/40 text-left transition-all group shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-teal-600 text-white font-bold text-[10px]">
                      CTA →
                    </span>
                    <span className="font-bold text-xs text-slate-900">Action Button Pill</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">CTA slot · High conversion</span>
                </button>

                <button
                  type="button"
                  onClick={() => addLayer({
                    type: "text",
                    role: "logo",
                    slot_name: "text_logo",
                    content: "BRAND NAME / @HANDLE",
                    font_family: "'Space Grotesk', sans-serif",
                    font_size_px: 13,
                    font_weight: "bold",
                    text_color: "#64748B",
                    letter_spacing_px: 3,
                    text_transform: "uppercase",
                    w_pct: 35,
                    h_pct: 5,
                  })}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-purple-400 hover:bg-purple-50/40 text-left transition-all group shadow-xs"
                >
                  <span className="font-mono text-xs text-slate-700 block tracking-widest uppercase group-hover:text-purple-700">
                    Brand Logo / Handle
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Logo slot · Tracking spacing</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: ELEMENTS & SHAPES & ICONS */}
          {activeDockTab === "elements" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Shapes &amp; Badges</h3>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => addLayer({ type: "shape", shape_type: "rectangle", fill_color: "#6366F1", corner_radius: 0, w_pct: 30, h_pct: 20 })}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-purple-400 flex flex-col items-center gap-1 shadow-2xs"
                  >
                    <Square className="size-5 text-purple-600" />
                    <span className="text-[10px] text-slate-700">Rect</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addLayer({ type: "shape", shape_type: "rounded_rect", fill_color: "#3B82F6", corner_radius: 16, w_pct: 30, h_pct: 20 })}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-purple-400 flex flex-col items-center gap-1 shadow-2xs"
                  >
                    <Square className="size-5 rounded-md text-blue-600" />
                    <span className="text-[10px] text-slate-700">Rounded</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addLayer({ type: "shape", shape_type: "circle", fill_color: "#EC4899", corner_radius: 999, w_pct: 20, h_pct: 20 })}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-purple-400 flex flex-col items-center gap-1 shadow-2xs"
                  >
                    <Circle className="size-5 text-pink-600" />
                    <span className="text-[10px] text-slate-700">Circle</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addLayer({ type: "shape", shape_type: "line", stroke_color: "#6366F1", stroke_width: 3, w_pct: 40, h_pct: 1 })}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-purple-400 flex flex-col items-center gap-1 shadow-2xs"
                  >
                    <Minus className="size-5 text-indigo-600" />
                    <span className="text-[10px] text-slate-700">Divider</span>
                  </button>
                </div>
              </div>

              {/* Popular Icons */}
              <div>
                <h3 className="font-bold text-sm text-slate-900">Popular Icons</h3>
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {POPULAR_ICONS.map((iconName) => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => addLayer({
                        type: "icon",
                        icon_name: iconName,
                        icon_color: "#38BDF8",
                        w_pct: 12,
                        h_pct: 12,
                        role: "icon",
                      })}
                      className="size-11 rounded-lg border border-slate-200 bg-white hover:border-purple-400 hover:bg-purple-50/50 flex items-center justify-center text-slate-700 hover:text-purple-750 transition-colors shadow-2xs"
                    >
                      <Icon icon={iconName} className="size-5" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Emoji Picker */}
              <div>
                <h3 className="font-bold text-sm text-slate-900">Emojis</h3>
                <div className="mt-2 rounded-xl overflow-hidden border border-slate-200">
                  <EmojiPicker
                    onEmojiClick={(data: EmojiClickData) => addLayer({
                      type: "emoji",
                      emoji: data.emoji,
                      w_pct: 12,
                      h_pct: 12,
                      role: "icon",
                    })}
                    theme={"light" as any}
                    width="100%"
                    height={250}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MEDIA & PHOTOS */}
          {activeDockTab === "media" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Custom Uploads</h3>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full mt-2 h-9 text-xs border-dashed border-purple-300 bg-white hover:bg-purple-50 text-purple-700 font-semibold gap-1.5 shadow-2xs"
                >
                  <Upload className="size-3.5" />
                  Upload Image / Logo
                </Button>
              </div>

              {/* Stock Photo Search */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900">Stock Photos</h3>
                <div className="flex gap-1.5">
                  <Input
                    placeholder="Search e.g. nature, tech..."
                    value={stockQuery}
                    onChange={(e) => setStockQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchStockPhotos(stockQuery)}
                    className="h-8 text-xs bg-white border-slate-200"
                  />
                  <Button
                    size="sm"
                    onClick={() => searchStockPhotos(stockQuery)}
                    disabled={stockLoading}
                    className="h-8 px-2.5 text-xs bg-purple-700 hover:bg-purple-800 text-white"
                  >
                    <Search className="size-3.5" />
                  </Button>
                </div>

                {stockLoading ? (
                  <div className="py-8 flex justify-center text-purple-600">
                    <Loader2 className="size-6 animate-spin" />
                  </div>
                ) : stockPhotos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 mt-2 max-h-60 overflow-y-auto">
                    {stockPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        onClick={() => addLayer({
                          type: "image",
                          image_url: photo.large || photo.thumbnail,
                          w_pct: 40,
                          h_pct: 40,
                          role: "photo",
                        })}
                        className="group relative rounded-lg overflow-hidden border border-slate-200 cursor-pointer aspect-video bg-slate-100 shadow-2xs"
                      >
                        <img src={photo.thumbnail} alt="Stock" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold transition-opacity">
                          + Add
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* TAB 5: BACKGROUND & PALETTES */}
          {activeDockTab === "background" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Curated Palettes</h3>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {COLOR_PALETTES.map((pal) => (
                    <button
                      key={pal.label}
                      type="button"
                      onClick={() => {
                        setBgGradient(pal.gradient)
                        setBgColor(pal.bg)
                        toast.success(`Applied ${pal.label}`)
                      }}
                      className="p-2 rounded-xl border border-slate-200 bg-white hover:border-purple-400 text-left space-y-1.5 transition-all shadow-2xs"
                    >
                      <div
                        className="h-8 w-full rounded-lg shadow-inner border border-slate-200"
                        style={{ background: `linear-gradient(135deg, ${pal.gradient.join(", ")})` }}
                      />
                      <span className="text-[11px] font-semibold text-slate-800 block truncate">
                        {pal.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-sm text-slate-900">Texture Overlay</h3>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {TEXTURES.map((tex) => (
                    <button
                      key={tex.id}
                      type="button"
                      onClick={() => setBgTexture(tex.id)}
                      className={`p-2 rounded-xl border text-left text-xs transition-all ${
                        bgTexture === tex.id 
                          ? "border-purple-600 bg-purple-50 text-purple-800 font-bold shadow-xs" 
                          : "border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      {tex.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: LAYERS STACK */}
          {activeDockTab === "layers" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">Canvas Layers ({layers.length})</h3>
                <span className="text-[10px] text-slate-500">Z-Index Top to Bottom</span>
              </div>

              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {[...layers].sort((a, b) => b.z_index - a.z_index).map((layer) => {
                  const isSelected = layer.id === selectedLayerId
                  return (
                    <div
                      key={layer.id}
                      onClick={() => setSelectedLayerId(layer.id)}
                      className={`p-2 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                        isSelected 
                          ? "border-purple-600 bg-purple-50 text-purple-950 shadow-xs ring-1 ring-purple-600 font-semibold" 
                          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <GripVertical className="size-3.5 text-slate-400 shrink-0" />
                        <div className="truncate">
                          <span className="font-semibold block truncate">
                            {layer.content || layer.icon_name || layer.shape_type || layer.type}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {layer.role || layer.type} · X:{layer.x_pct}% Y:{layer.y_pct}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            updateLayer(layer.id, { locked: !layer.locked })
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700"
                          title={layer.locked ? "Unlock layer" : "Lock layer"}
                        >
                          {layer.locked ? <Lock className="size-3 text-amber-500" /> : <Unlock className="size-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeLayer(layer.id)
                          }}
                          className="p-1 text-slate-400 hover:text-red-600"
                          title="Delete Layer"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </aside>

        {/* --- 3C. MAIN INTERACTIVE CANVAS STAGE WORKSPACE (Clean Light Neutral Workbench) --- */}
        <main
          ref={stageContainerRef}
          onClick={() => setSelectedLayerId(null)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex-1 overflow-auto bg-slate-100/90 flex items-center justify-center p-6 md:p-12 relative select-none"
        >
          {/* Centered Artboard Container */}
          <div
            style={{
              transform: `scale(${zoomScale})`,
              transformOrigin: "center center",
              transition: "transform 0.15s ease-out",
            }}
            className="flex items-center justify-center"
          >
            {/* The 1080x1080 / Aspect Artboard */}
            <div
              ref={stageBoardRef}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[480px] rounded-2xl shadow-2xl ring-1 ring-slate-900/10 overflow-hidden select-none border-0"
              style={{
                aspectRatio: stageAspectRatio,
                backgroundColor: bgColor,
                backgroundImage: bgGradient ? `linear-gradient(135deg, ${bgGradient.join(", ")})` : undefined,
              }}
            >
              {/* Texture Overlays */}
              {bgTexture === "dot-grid" && (
                <div
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{
                    backgroundImage: `radial-gradient(circle, #FFFFFF 1px, transparent 1px)`,
                    backgroundSize: "20px 20px",
                  }}
                />
              )}
              {bgTexture === "noise" && (
                <div
                  className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay"
                  style={{
                    backgroundImage: `radial-gradient(#818CF8 0.75px, transparent 0.75px)`,
                    backgroundSize: "8px 8px",
                  }}
                />
              )}
              {bgTexture === "diagonal-stripes" && (
                <div
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{
                    backgroundImage: `repeating-linear-gradient(45deg, #FFF, #FFF 1px, transparent 1px, transparent 12px)`,
                  }}
                />
              )}

              {/* Magnetic Alignment Snap Crosshairs */}
              {snapLines.x && (
                <div className="absolute top-0 bottom-0 left-1/2 w-[1.5px] bg-purple-500 z-50 pointer-events-none shadow-[0_0_8px_#9333EA]" />
              )}
              {snapLines.y && (
                <div className="absolute left-0 right-0 top-1/2 h-[1.5px] bg-purple-500 z-50 pointer-events-none shadow-[0_0_8px_#9333EA]" />
              )}

              {/* --- RENDER CANVAS LAYERS --- */}
              {layers.map((layer) => {
                const isSelected = layer.id === selectedLayerId
                const isBlueprint = previewMode === "simulated"

                return (
                  <div
                    key={layer.id}
                    onPointerDown={(e) => handlePointerDown(e, layer.id, "move")}
                    className={`absolute flex items-center justify-center select-none cursor-move transition-shadow ${
                      isSelected && !isBlueprint
                        ? "ring-2 ring-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.35)] z-40" 
                        : "hover:ring-1 hover:ring-purple-400/60 z-10"
                    }`}
                    style={{
                      left: `${layer.x_pct}%`,
                      top: `${layer.y_pct}%`,
                      width: `${layer.w_pct}%`,
                      height: `${layer.h_pct}%`,
                      transform: `rotate(${layer.rotation || 0}deg)`,
                      transformOrigin: "center center",
                      opacity: layer.opacity ?? 1,
                      zIndex: isSelected ? 99 : layer.z_index,
                    }}
                  >
                    {/* Layer Content by Type */}
                    {layer.type === "text" && (
                      <div
                        className="w-full h-full flex p-1"
                        style={{
                          alignItems: "center",
                          justifyContent: 
                            layer.text_align === "left" ? "flex-start" : 
                            layer.text_align === "right" ? "flex-end" : "center",
                          textAlign: layer.text_align || "center",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: layer.font_family || "inherit",
                            fontWeight: layer.font_weight === "extrabold" ? 800 : layer.font_weight === "bold" ? 700 : 400,
                            fontSize: `${layer.font_size_px ? layer.font_size_px * 0.45 : 18}px`,
                            color: layer.text_color || "#FFFFFF",
                            textTransform: layer.text_transform || "none",
                            letterSpacing: layer.letter_spacing_px ? `${layer.letter_spacing_px}px` : "normal",
                            lineHeight: 1.15,
                            wordBreak: "break-word",
                          }}
                        >
                          {layer.content || "Heading Title"}
                        </span>
                      </div>
                    )}

                    {layer.type === "badge" && (
                      <div
                        className="w-full h-full flex items-center justify-center px-3 py-1 shadow-md"
                        style={{
                          backgroundColor: layer.fill_color || "#F59E0B",
                          borderRadius: `${layer.corner_radius || 12}px`,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: layer.font_family || "inherit",
                            fontWeight: 800,
                            fontSize: `${layer.font_size_px ? layer.font_size_px * 0.35 : 12}px`,
                            color: layer.text_color || "#0F172A",
                            textTransform: "uppercase",
                            letterSpacing: "1px",
                          }}
                        >
                          {layer.content || "BADGE"}
                        </span>
                      </div>
                    )}

                    {layer.type === "cta" && (
                      <div
                        className="w-full h-full flex items-center justify-center px-4 py-2 shadow-lg"
                        style={{
                          backgroundColor: layer.fill_color || "#0D9488",
                          borderRadius: `${layer.corner_radius ?? 999}px`,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: layer.font_family || "inherit",
                            fontWeight: 700,
                            fontSize: `${layer.font_size_px ? layer.font_size_px * 0.35 : 13}px`,
                            color: layer.text_color || "#FFFFFF",
                            textTransform: "uppercase",
                            letterSpacing: "1.5px",
                          }}
                        >
                          {layer.content || "GET STARTED →"}
                        </span>
                      </div>
                    )}

                    {layer.type === "shape" && (
                      <div
                        className="w-full h-full"
                        style={{
                          backgroundColor: layer.shape_type === "line" ? "transparent" : (layer.fill_color || "#6366F1"),
                          borderRadius: layer.shape_type === "circle" ? "9999px" : `${layer.corner_radius || 0}px`,
                          border: layer.shape_type === "line" 
                            ? undefined 
                            : layer.stroke_width ? `${layer.stroke_width}px solid ${layer.stroke_color || "#FFFFFF"}` : undefined,
                        }}
                      >
                        {layer.shape_type === "line" && (
                          <div 
                            className="w-full h-full" 
                            style={{ 
                              backgroundColor: layer.stroke_color || "#6366F1",
                              height: `${layer.stroke_width || 3}px`
                            }} 
                          />
                        )}
                      </div>
                    )}

                    {layer.type === "icon" && (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon
                          icon={layer.icon_name || "lucide:sparkles"}
                          className="w-full h-full"
                          style={{ color: layer.icon_color || "#38BDF8" }}
                        />
                      </div>
                    )}

                    {layer.type === "emoji" && (
                      <div className="w-full h-full flex items-center justify-center text-3xl">
                        {layer.emoji || "✨"}
                      </div>
                    )}

                    {layer.type === "image" && (
                      <img
                        src={layer.image_url}
                        alt="Media"
                        className="w-full h-full pointer-events-none rounded-lg"
                        style={{ objectFit: layer.fit_mode || "cover" }}
                      />
                    )}

                    {/* --- 8-POINT RESIZE HANDLES & ROTATION HANDLE --- */}
                    {isSelected && !previewMode.includes("simulated") && !layer.locked && (
                      <>
                        {/* Top Rotation Stem & Handle */}
                        <div
                          onPointerDown={(e) => handlePointerDown(e, layer.id, "rotate")}
                          className="absolute -top-7 left-1/2 -translate-x-1/2 size-3.5 rounded-full bg-purple-600 border-2 border-white shadow cursor-grab flex items-center justify-center hover:scale-125 transition-transform"
                          title="Rotate"
                        >
                          <div className="absolute top-3 w-[1.5px] h-3 bg-purple-600 pointer-events-none" />
                        </div>

                        {/* 8 Bounding Corner & Edge Handles */}
                        {[
                          { id: "nw", pos: "-top-1.5 -left-1.5 cursor-nwse-resize" },
                          { id: "n", pos: "-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize" },
                          { id: "ne", pos: "-top-1.5 -right-1.5 cursor-nesw-resize" },
                          { id: "e", pos: "top-1/2 -translate-y-1/2 -right-1.5 cursor-ew-resize" },
                          { id: "se", pos: "-bottom-1.5 -right-1.5 cursor-nwse-resize" },
                          { id: "s", pos: "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize" },
                          { id: "sw", pos: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
                          { id: "w", pos: "top-1/2 -translate-y-1/2 -left-1.5 cursor-ew-resize" },
                        ].map((h) => (
                          <div
                            key={h.id}
                            onPointerDown={(e) => handlePointerDown(e, layer.id, h.id)}
                            className={`absolute size-2.5 rounded-xs bg-white border-2 border-purple-600 shadow-sm ${h.pos} hover:scale-125 transition-transform`}
                          />
                        ))}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick Floating Zoom / Status Indicator */}
          <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200 text-[11px] text-slate-600 font-mono shadow-sm flex items-center gap-2">
            <span>{activeAspect.label}</span>
            <span>·</span>
            <span>{layers.length} Layers</span>
          </div>
        </main>
      </div>
    </div>
  )
}
