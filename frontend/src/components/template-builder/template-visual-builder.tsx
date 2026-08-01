"use client"

import * as React from "react"
import { Icon } from "@iconify/react"
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react"
import { Rnd } from "react-rnd"
import {
  Check,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  Plus,
  Trash2,
  Type,
  Unlock,
} from "lucide-react"
import { toast } from "sonner"

import { TemplateLayerFields } from "@/components/template-builder/template-layer-fields"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { getBackendUrl } from "@/lib/env"
import {
  backgroundSwatchStyle,
  canvasDisplaySize,
  createDefaultEmojiLayer,
  createDefaultIconLayer,
  createDefaultLogoLayer,
  createDefaultOverlayLayer,
  createDefaultShapeLayer,
  createDefaultTextLayer,
  findBackgroundAsset,
  nextLayerId,
  nextZIndex,
  percentToPx,
  pxToPercent,
  snapPercent,
} from "@/lib/template-state"
import type {
  BackgroundAsset,
  BackgroundTexture,
  EmojiLayer,
  FontAsset,
  IconLayer,
  ImageLayer,
  TemplateLayer,
  TemplateState,
  TextLayer,
} from "@/lib/template-types"
import { cn } from "@/lib/utils"

type Props = {
  state: TemplateState
  backgrounds: BackgroundAsset[]
  fonts: FontAsset[]
  onStateChange: (state: TemplateState) => void
  onExportToJson: () => void
}

type HandleId =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "rotate"
  | "move"

type DragState = {
  mode: HandleId
  layerIds: string[]
  startX: number
  startY: number
  snapshots: Record<string, { x: number; y: number; w: number; h: number; rot: number }>
}

type SidebarTab = "text" | "elements" | "background" | "cats"

const POPULAR_ICONS = [
  "mdi:star",
  "mdi:heart",
  "mdi:lightning-bolt",
  "mdi:flower",
  "mdi:music-note",
  "mdi:rocket",
  "mdi:briefcase",
  "mdi:chart-line",
  "mdi:phone",
  "mdi:camera",
  "mdi:palette",
  "mdi:shopping",
  "mdi:leaf",
  "mdi:cloud",
  "mdi:rocket-launch",
  "mdi:bullseye-arrow",
  "mdi:party-popper",
  "mdi:fire",
  "mdi:gift",
  "mdi:book-open",
]

const HANDLE_CURSORS: Record<string, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
}

const TEXTURE_OPTIONS: { id: BackgroundTexture; label: string }[] = [
  { id: "none", label: "None" },
  { id: "noise", label: "Noise" },
  { id: "dot-grid", label: "Dot Grid" },
  { id: "diagonal-stripes", label: "Diagonal Stripes" },
]

function layerIcon(type: string) {
  if (type === "text") return <Type className="size-3.5" />
  if (type === "logo") return <ImageIcon className="size-3.5" />
  if (type === "image") return <ImageIcon className="size-3.5" />
  if (type === "icon") return <Icon icon="mdi:star" className="size-3.5" />
  if (type === "emoji") return <span className="text-[12px]">🙂</span>
  return <Layers className="size-3.5" />
}

function getEmojiSvgUrl(emoji: string): string {
  const codePoints = Array.from(emoji)
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter(Boolean)
    .join("-")
  return `https://twemoji.maxcdn.com/v/latest/svg/${codePoints || "1f600"}.svg`
}

export function TemplateVisualBuilder({
  state,
  backgrounds,
  fonts,
  onStateChange,
  onExportToJson,
}: Props) {
  const [showGrid, setShowGrid] = React.useState(true)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [showAddLayer, setShowAddLayer] = React.useState(false)
  const [sidebarTab, setSidebarTab] = React.useState<SidebarTab>("text")
  const [iconSearch, setIconSearch] = React.useState("nature")
  const [stockQuery, setStockQuery] = React.useState("nature")
  const [catPhotos, setCatPhotos] = React.useState<Array<{ id: string; url: string; width: number; height: number }>>([])
  const [catLoading, setCatLoading] = React.useState(false)
  const [catError, setCatError] = React.useState<string | null>(null)
  const [catPage, setCatPage] = React.useState(1)
  const [stockPhotos, setStockPhotos] = React.useState<Array<{ id: number; photographer: string; thumbnail: string; large: string }>>([])
  const [stockLoading, setStockLoading] = React.useState(false)
  const [stockPage, setStockPage] = React.useState(1)
  const [stockError, setStockError] = React.useState<string | null>(null)
  const [extraBackgroundAssets, setExtraBackgroundAssets] = React.useState<BackgroundAsset[]>([])
  const dragRef = React.useRef<DragState | null>(null)
  const canvasRef = React.useRef<HTMLDivElement>(null)
  const listDragId = React.useRef<string | null>(null)
  const stateRef = React.useRef(state)
  stateRef.current = state

  const json = state.templateJson
  const { width: displayW, height: displayH } = canvasDisplaySize(
    json.canvas_width,
    json.canvas_height,
  )

  const allBackgroundAssets = React.useMemo(
    () => [...backgrounds, ...extraBackgroundAssets],
    [backgrounds, extraBackgroundAssets],
  )
  const previewBg = findBackgroundAsset(allBackgroundAssets, state.previewBackgroundAssetId)
  const sortedLayers = [...json.layers].sort((a, b) => a.z_index - b.z_index)

  function isHidden(id: string) {
    return state.visualMeta[id]?.hidden ?? false
  }
  function isLocked(id: string) {
    return state.visualMeta[id]?.locked ?? false
  }

  function setLayers(layers: TemplateLayer[]) {
    onStateChange({ ...state, templateJson: { ...json, layers } })
  }

  function updateLayers(updater: (layers: TemplateLayer[]) => TemplateLayer[]) {
    setLayers(updater(json.layers))
  }

  function patchLayer(id: string, patch: Partial<TemplateLayer>) {
    updateLayers((layers) =>
      layers.map((l) => (l.id === id ? ({ ...l, ...patch } as TemplateLayer) : l)),
    )
  }

  function patchLayers(ids: string[], patch: Partial<TemplateLayer>) {
    const idSet = new Set(ids)
    updateLayers((layers) =>
      layers.map((l) => (idSet.has(l.id) ? ({ ...l, ...patch } as TemplateLayer) : l)),
    )
  }

  function toggleMeta(id: string, key: "hidden" | "locked") {
    onStateChange({
      ...state,
      visualMeta: {
        ...state.visualMeta,
        [id]: { ...state.visualMeta[id], [key]: !state.visualMeta[id]?.[key] },
      },
    })
  }

  function selectLayer(id: string, shift: boolean) {
    if (isLocked(id)) return
    if (shift) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      )
    } else {
      setSelectedIds([id])
    }
  }

  function startDrag(
    e: React.MouseEvent | React.TouchEvent,
    mode: HandleId,
    layerId: string,
  ) {
    e.stopPropagation()
    if (isLocked(layerId)) return
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    const ids = selectedIds.includes(layerId) ? selectedIds : [layerId]
    const snapshots: DragState["snapshots"] = {}
    for (const lid of ids) {
      const l = json.layers.find((x) => x.id === lid)
      if (!l) continue
      snapshots[lid] = {
        x: l.position_x_percent,
        y: l.position_y_percent,
        w: l.width_percent,
        h: l.height_percent,
        rot: l.rotation_degrees ?? 0,
      }
    }
    dragRef.current = { mode, layerIds: ids, startX: clientX, startY: clientY, snapshots }
  }

  React.useEffect(() => {
    function onMove(clientX: number, clientY: number) {
      const drag = dragRef.current
      if (!drag || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const dxPct = pxToPercent(clientX - drag.startX, rect.width)
      const dyPct = pxToPercent(clientY - drag.startY, rect.height)

      const current = stateRef.current
      const curLayers = current.templateJson.layers
      const nextLayers = curLayers.map((layer) => {
          const snap = drag.snapshots[layer.id]
          if (!snap) return layer
          let { x, y, w, h, rot } = snap

          if (drag.mode === "move") {
            x = snapPercent(snap.x + dxPct, showGrid)
            y = snapPercent(snap.y + dyPct, showGrid)
          } else if (drag.mode === "rotate") {
            const cx = percentToPx(snap.x + snap.w / 2, rect.width)
            const cy = percentToPx(snap.y + snap.h / 2, rect.height)
            const startAngle = Math.atan2(drag.startY - rect.top - cy, drag.startX - rect.left - cx)
            const curAngle = Math.atan2(clientY - rect.top - cy, clientX - rect.left - cx)
            rot = snap.rot + ((curAngle - startAngle) * 180) / Math.PI
          } else {
            const handles = drag.mode
            if (handles.includes("e")) w = snapPercent(snap.w + dxPct, showGrid)
            if (handles.includes("w")) {
              w = snapPercent(snap.w - dxPct, showGrid)
              x = snapPercent(snap.x + dxPct, showGrid)
            }
            if (handles.includes("s")) h = snapPercent(snap.h + dyPct, showGrid)
            if (handles.includes("n")) {
              h = snapPercent(snap.h - dyPct, showGrid)
              y = snapPercent(snap.y + dyPct, showGrid)
            }
            w = Math.max(2, w)
            h = Math.max(2, h)
          }

          return {
            ...layer,
            position_x_percent: Math.max(0, Math.min(100 - w, x)),
            position_y_percent: Math.max(0, Math.min(100 - h, y)),
            width_percent: w,
            height_percent: h,
            rotation_degrees: rot,
          }
      })
      onStateChange({
        ...current,
        templateJson: { ...current.templateJson, layers: nextLayers },
      })
    }

    function onMouseMove(e: MouseEvent) {
      onMove(e.clientX, e.clientY)
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    function onEnd() {
      dragRef.current = null
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onEnd)
    window.addEventListener("touchmove", onTouchMove, { passive: false })
    window.addEventListener("touchend", onEnd)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onEnd)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onEnd)
    }
  }, [showGrid, onStateChange])

  function addLayer(type: "text" | "logo" | "overlay") {
    const id = nextLayerId(json.layers)
    const z = nextZIndex(json.layers)
    let layer: TemplateLayer
    if (type === "text") layer = createDefaultTextLayer(z, id, fonts)
    else if (type === "overlay") layer = createDefaultOverlayLayer(z, id)
    else layer = createDefaultLogoLayer(z, id)
    setLayers([...json.layers, layer])
    setSelectedIds([id])
    setShowAddLayer(false)
  }

  function addShapeLayer(shapeType: "rectangle" | "circle" | "pill" | "line") {
    const id = nextLayerId(json.layers)
    const z = nextZIndex(json.layers)
    const layer = createDefaultShapeLayer(z, id) as TemplateLayer
    ;(layer as any).shape_type = shapeType
    ;(layer as any).width_percent = shapeType === "line" ? 40 : 24
    ;(layer as any).height_percent = shapeType === "line" ? 2 : 20
    ;(layer as any).position_x_percent = 20
    ;(layer as any).position_y_percent = 20
    ;(layer as any).fill_color_options = [{ color_hex: "#8b5cf6", label: "Purple" }]
    ;(layer as any).stroke_color_options = [{ color_hex: "#ffffff", label: "White" }]
    ;(layer as any).stroke_width = shapeType === "line" ? 4 : 2
    ;(layer as any).corner_radius = shapeType === "rectangle" ? 12 : 0
    setLayers([...json.layers, layer])
    setSelectedIds([id])
    setSidebarTab("text")
  }

  function addIconLayer(iconName: string) {
    const id = nextLayerId(json.layers)
    const z = nextZIndex(json.layers)
    const layer = createDefaultIconLayer(z, id) as TemplateLayer
    ;(layer as any).icon_name = iconName
    ;(layer as any).icon_color_hex = "#ffffff"
    setLayers([...json.layers, layer])
    setSelectedIds([id])
    setSidebarTab("text")
  }

  function addEmojiLayer(emoji: string) {
    const id = nextLayerId(json.layers)
    const z = nextZIndex(json.layers)
    const layer = createDefaultEmojiLayer(z, id) as TemplateLayer
    ;(layer as any).emoji = emoji
    ;(layer as any).emoji_svg_url = getEmojiSvgUrl(emoji)
    ;(layer as any).emoji_color_hex = "#ffffff"
    setLayers([...json.layers, layer])
    setSelectedIds([id])
    setSidebarTab("text")
  }

  async function fetchStockPhotos(query: string, page = 1) {
    if (!query.trim()) {
      setStockPhotos([])
      return
    }
    setStockLoading(true)
    setStockError(null)
    try {
      const response = await api.get<{ photos: Array<{ id: number; photographer: string; thumbnail: string; large: string }> }>(
        "/api/stock-photos",
        { params: { query, page } },
      )
      setStockPhotos(response.data.photos)
      setStockPage(page)
    } catch (err) {
      setStockError("Could not load stock photos.")
    } finally {
      setStockLoading(false)
    }
  }

  async function importStockPhoto(photo: { id: number; photographer: string; large: string }) {
    try {
      setStockLoading(true)
      const response = await api.post<BackgroundAsset>("/api/stock-photos/import", {
        photo_id: photo.id,
        photographer: photo.photographer,
        image_url: photo.large,
      })
      setExtraBackgroundAssets((prev) => [...prev, response.data])
      toggleBackground(response.data)
      toast.success("Stock photo added to your backgrounds.")
    } catch (err) {
      toast.error("Failed to import stock photo.")
    } finally {
      setStockLoading(false)
    }
  }

  async function fetchCatPhotos(page = 1, append = false) {
    setCatLoading(true)
    setCatError(null)
    try {
      const backendUrl = getBackendUrl()
      const response = await fetch(`${backendUrl}/api/cat-photos?limit=24&page=${page}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(`Failed to load cat photos: ${response.status}`)
      }

      const data = (await response.json()) as Array<{ id: string; url: string; width: number; height: number }>
      const nextPhotos = Array.isArray(data)
        ? data
            .map((item) => {
              const rawUrl = String(item.url || "")
              return {
                id: String(item.id),
                url: rawUrl.startsWith("/") ? `${backendUrl}${rawUrl}` : rawUrl,
                width: Number(item.width ?? 400),
                height: Number(item.height ?? 400),
              }
            })
            .filter((photo) => photo.url)
        : []

      setCatPhotos((prev) => (append ? [...prev, ...nextPhotos] : nextPhotos))
      setCatPage(page)
    } catch (err) {
      setCatError("Could not load cat photos.")
    } finally {
      setCatLoading(false)
    }
  }

  function addCatImageLayer(photo: { id: string; url: string }) {
    const id = nextLayerId(json.layers)
    const z = nextZIndex(json.layers)
    const layer = {
      id,
      type: "image" as const,
      z_index: z,
      position_x_percent: 20,
      position_y_percent: 20,
      width_percent: 28,
      height_percent: 28,
      rotation_degrees: 0,
      image_url: photo.url,
      alt: "Cat photo",
    } as TemplateLayer
    setLayers([...json.layers, layer])
    setSelectedIds([id])
    setSidebarTab("cats")
  }

  function removeLayer(id: string) {
    setLayers(json.layers.filter((l) => l.id !== id))
    setSelectedIds((s) => s.filter((x) => x !== id))
  }

  function reorderList(fromId: string, toId: string) {
    const sorted = [...json.layers].sort((a, b) => a.z_index - b.z_index)
    const fromIdx = sorted.findIndex((l) => l.id === fromId)
    const toIdx = sorted.findIndex((l) => l.id === toId)
    if (fromIdx < 0 || toIdx < 0) return
    const [moved] = sorted.splice(fromIdx, 1)
    sorted.splice(toIdx, 0, moved)
    setLayers(sorted.map((l, i) => ({ ...l, z_index: i })))
  }

  function toggleBackground(asset: BackgroundAsset, ctrl = false) {
    const exists = json.background_options.find((b) => b.asset_id === asset.id)
    let next = json.background_options
    if (exists && !ctrl) {
      onStateChange({
        ...state,
        previewBackgroundAssetId: asset.id,
      })
      return
    }
    if (exists) {
      next = json.background_options.filter((b) => b.asset_id !== asset.id)
    } else {
      if (json.background_options.length >= 6) {
        toast.error("Maximum 6 backgrounds.")
        return
      }
      next = [...json.background_options, { asset_id: asset.id, label: asset.label || "Background" }]
    }
    onStateChange({
      ...state,
      templateJson: { ...json, background_options: next },
      previewBackgroundAssetId: asset.id,
    })
  }

  React.useEffect(() => {
    if (sidebarTab === "cats" && catPhotos.length === 0 && !catLoading) {
      void fetchCatPhotos(1, false)
    }
  }, [sidebarTab, catPhotos.length, catLoading])

  const primarySelected = selectedIds[0]
  const primaryLayer = json.layers.find((l) => l.id === primarySelected)
  const filteredIcons = React.useMemo(() => {
    const search = iconSearch.trim().toLowerCase()
    if (!search) return POPULAR_ICONS
    return POPULAR_ICONS.filter((name) => name.toLowerCase().includes(search))
  }, [iconSearch])

  const canvasBgStyle: React.CSSProperties = state.previewBackgroundImageBase64
    ? {
        backgroundImage: `url(${state.previewBackgroundImageBase64})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : state.previewBackgroundColor
    ? {
        backgroundColor: state.previewBackgroundColor,
      }
    : previewBg
    ? {
        ...backgroundSwatchStyle(previewBg),
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { backgroundColor: "#1e293b" }

  function updateLayerGeometry(layerId: string, xPx: number, yPx: number, wPx: number, hPx: number) {
    const x = snapPercent(Math.max(0, Math.min(100, pxToPercent(xPx, displayW))), showGrid)
    const y = snapPercent(Math.max(0, Math.min(100, pxToPercent(yPx, displayH))), showGrid)
    const w = snapPercent(Math.max(2, Math.min(100, pxToPercent(wPx, displayW))), showGrid)
    const h = snapPercent(Math.max(2, Math.min(100, pxToPercent(hPx, displayH))), showGrid)
    const nextX = Math.max(0, Math.min(100 - w, x))
    const nextY = Math.max(0, Math.min(100 - h, y))
    patchLayer(layerId, {
      position_x_percent: nextX,
      position_y_percent: nextY,
      width_percent: w,
      height_percent: h,
    })
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2 items-center">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
          Show grid (5% snap)
        </label>
        <Button type="button" size="sm" variant="outline" onClick={onExportToJson}>
          Current canvas state → JSON Editor
        </Button>
      </div>
      <div className="rounded-lg border border-purple-200 bg-purple-50/70 px-3 py-2 text-sm text-purple-900">
        Drag layers on the canvas, use the corner handles to resize them, and edit text, colors, and fonts from the right panel.
      </div>

      <div className="grid lg:grid-cols-[200px_1fr_260px] gap-4">
        {/* Layer list */}
        <aside className="grid gap-2 content-start">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {[
              { id: "text", label: "Text" },
              { id: "elements", label: "Elements" },
              { id: "cats", label: "Cats" },
              { id: "background", label: "Background" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSidebarTab(tab.id as SidebarTab)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  sidebarTab === tab.id ? "bg-white text-purple-700 shadow-sm" : "text-slate-600",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {sidebarTab === "text" ? (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Layers</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowAddLayer((v) => !v)}>
                  <Plus className="size-3" />
                </Button>
              </div>
              {showAddLayer ? (
                <div className="flex flex-col gap-1">
                  <Button type="button" size="sm" onClick={() => addLayer("text")}>
                    Text
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => addLayer("logo")}>
                    Logo
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => addLayer("overlay")}>
                    Overlay
                  </Button>
                </div>
              ) : null}
              <ul className="grid gap-1 max-h-[400px] overflow-y-auto">
                {[
                  ...(json.background_options.length > 0
                    ? [
                        {
                          id: "__background__",
                          type: "background" as const,
                          label: json.background_options[0]?.label || "Background",
                        },
                      ]
                    : []),
                  ...sortedLayers,
                ]
                  .reverse()
                  .map((layer) => {
                    const isBackgroundLayer = layer.type === "background"
                    return (
                      <li
                        key={layer.id}
                        draggable={!isBackgroundLayer}
                        onDragStart={() => {
                          if (!isBackgroundLayer) listDragId.current = layer.id
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (!isBackgroundLayer && listDragId.current) reorderList(listDragId.current, layer.id)
                        }}
                        className={cn(
                          "flex items-center gap-1 rounded border px-1 py-1 text-xs",
                          selectedIds.includes(layer.id) && "border-purple-600 bg-purple-50",
                          isBackgroundLayer ? "border-dashed border-slate-300 bg-slate-50" : isHidden(layer.id) && "opacity-50",
                        )}
                      >
                        {!isBackgroundLayer ? <GripVertical className="size-3 text-slate-400 shrink-0 cursor-grab" /> : <ImageIcon className="size-3 text-slate-500 shrink-0" />}
                        <button
                          type="button"
                          className="flex-1 flex items-center gap-1 text-left truncate"
                          onClick={() => selectLayer(layer.id, false)}
                        >
                          {isBackgroundLayer ? <ImageIcon className="size-3.5" /> : layerIcon(layer.type)}
                          <span className="truncate">
                            {isBackgroundLayer ? layer.label : layer.type === "text" ? (layer as TextLayer).role : layer.type}
                          </span>
                        </button>
                        {isBackgroundLayer ? (
                          <span className="text-[10px] text-slate-500">bg</span>
                        ) : (
                          <>
                            <button type="button" onClick={() => toggleMeta(layer.id, "hidden")} className="p-0.5">
                              {isHidden(layer.id) ? (
                                <EyeOff className="size-3" />
                              ) : (
                                <Eye className="size-3" />
                              )}
                            </button>
                            <button type="button" onClick={() => toggleMeta(layer.id, "locked")} className="p-0.5">
                              {isLocked(layer.id) ? (
                                <Lock className="size-3" />
                              ) : (
                                <Unlock className="size-3" />
                              )}
                            </button>
                            <button type="button" onClick={() => removeLayer(layer.id)} className="p-0.5 text-red-500">
                              <Trash2 className="size-3" />
                            </button>
                          </>
                        )}
                      </li>
                    )
                  })}
              </ul>
            </>
          ) : null}

          {sidebarTab === "elements" ? (
            <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-1">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Shapes</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => addShapeLayer("rectangle")} className="rounded border bg-white px-2 py-1 text-xs">Rectangle</button>
                  <button type="button" onClick={() => addShapeLayer("circle")} className="rounded border bg-white px-2 py-1 text-xs">Circle</button>
                  <button type="button" onClick={() => addShapeLayer("line")} className="rounded border bg-white px-2 py-1 text-xs">Line</button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Icons</p>
                <input
                  value={iconSearch}
                  onChange={(e) => setIconSearch(e.target.value)}
                  placeholder="Search icons"
                  className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {filteredIcons.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => addIconLayer(name)}
                      className="flex h-10 items-center justify-center rounded border border-slate-200 bg-white text-slate-700 hover:border-purple-500"
                    >
                      <Icon icon={name} className="size-5" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Emojis</p>
                <div className="mt-2 overflow-hidden rounded border border-slate-200 bg-white">
                  <EmojiPicker onEmojiClick={(emojiData: EmojiClickData) => addEmojiLayer(emojiData.emoji)} width="100%" height={260} lazyLoadEmojis />
                </div>
              </div>
            </div>
          ) : null}

          {sidebarTab === "cats" ? (
            <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-1">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Cats</p>
                <p className="mt-1 text-[11px] text-slate-500">Add cat photos to the canvas as draggable image layers.</p>
                {catError ? <p className="mt-2 text-xs text-red-500">{catError}</p> : null}
                {catLoading && catPhotos.length === 0 ? (
                  <div className="mt-3 flex justify-center py-4">
                    <Loader2 className="size-6 animate-spin text-slate-500" />
                  </div>
                ) : null}
                {!catLoading || catPhotos.length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {catPhotos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => addCatImageLayer(photo)}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-white text-left"
                      >
                        <img src={photo.url} alt="Cat photo" crossOrigin="anonymous" className="h-24 w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                ) : null}
                <Button type="button" size="sm" className="mt-3 w-full" onClick={() => fetchCatPhotos(catPage + 1, true)} disabled={catLoading}>
                  {catLoading ? "Loading..." : "Load More Cats"}
                </Button>
              </div>
            </div>
          ) : null}

          {sidebarTab === "background" ? (
            <div className="grid gap-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="grid gap-1 flex-1">
                    <Label className="text-xs font-semibold">Stock photos</Label>
                    <input
                      value={stockQuery}
                      onChange={(e) => setStockQuery(e.target.value)}
                      placeholder="Search stock photos"
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") fetchStockPhotos(stockQuery)
                      }}
                    />
                  </div>
                  <Button type="button" size="sm" onClick={() => fetchStockPhotos(stockQuery)} disabled={stockLoading}>
                    Search
                  </Button>
                </div>

                {stockError ? <p className="text-xs text-red-500">{stockError}</p> : null}
                {stockLoading ? (
                  <div className="py-4 text-center">
                    <Loader2 className="size-6 animate-spin text-slate-500" />
                  </div>
                ) : null}

                {!stockLoading && stockPhotos.length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {stockPhotos.map((photo) => (
                      <div key={photo.id} className="rounded-lg border overflow-hidden bg-white">
                        <img src={photo.thumbnail} alt={photo.photographer} className="h-28 w-full object-cover" />
                        <div className="p-2">
                          <p className="text-xs text-slate-600 truncate">{photo.photographer}</p>
                          <Button type="button" size="sm" className="mt-2 w-full" onClick={() => importStockPhoto(photo)}>
                            Add background
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Backgrounds</Label>
                <div className="flex gap-2 overflow-x-auto py-2">
                  {[...backgrounds, ...extraBackgroundAssets].map((asset) => {
                    const selected = json.background_options.some((b) => b.asset_id === asset.id)
                    const isPreview = state.previewBackgroundAssetId === asset.id
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={(e) => toggleBackground(asset, e.ctrlKey || e.metaKey)}
                        className={cn(
                          "relative shrink-0 size-14 rounded-lg border-2 overflow-hidden",
                          selected || isPreview ? "border-purple-600" : "border-slate-200",
                        )}
                      >
                        <div className="absolute inset-0" style={backgroundSwatchStyle(asset)} />
                        {asset.preview_url ? (
                          <img src={asset.preview_url} alt={asset.label || "Background"} className="absolute inset-0 h-full w-full object-cover" />
                        ) : null}
                        {selected ? (
                          <span className="absolute top-0.5 right-0.5 rounded-full bg-purple-600 p-0.5 text-white">
                            <Check className="size-3" />
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Texture Overlay</Label>
                <div className="flex gap-2 overflow-x-auto py-2">
                  {TEXTURE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onStateChange({
                        ...state,
                        templateJson: { ...state.templateJson, background_texture: opt.id }
                      })}
                      className={cn(
                        "relative shrink-0 flex items-center justify-center h-14 w-20 rounded-lg border-2 bg-white text-xs font-medium overflow-hidden",
                        (state.templateJson.background_texture || "none") === opt.id ? "border-purple-600 text-purple-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {opt.id === "noise" && <div className="absolute inset-0 opacity-20" style={{ filter: 'url(#noiseFilter)' }} />}
                      {opt.id === "dot-grid" && <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '8px 8px' }} />}
                      {opt.id === "diagonal-stripes" && <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, currentColor, currentColor 2px, transparent 2px, transparent 8px)' }} />}
                      <span className="relative z-10">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </aside>

        {/* Canvas */}
        <div className="flex flex-col items-center gap-3">
          <div
            ref={canvasRef}
            className="relative border-2 border-slate-300 rounded-lg overflow-hidden shadow-inner"
            style={{ width: displayW, height: displayH, ...canvasBgStyle }}
            onMouseDown={() => setSelectedIds([])}
          >
            <svg style={{ display: "none" }}>
              <defs>
                <filter id="noiseFilter">
                  <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                </filter>
              </defs>
            </svg>
            
            {state.templateJson.background_texture === "noise" && (
              <div className="absolute inset-0 pointer-events-none opacity-[0.15] mix-blend-overlay" style={{ filter: 'url(#noiseFilter)' }} />
            )}
            {state.templateJson.background_texture === "dot-grid" && (
              <div className="absolute inset-0 pointer-events-none opacity-[0.15] mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle, #000 1.5px, transparent 1.5px)', backgroundSize: `${displayW / 30}px ${displayW / 30}px` }} />
            )}
            {state.templateJson.background_texture === "diagonal-stripes" && (
              <div className="absolute inset-0 pointer-events-none opacity-[0.08] mix-blend-overlay" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000, #000 2px, transparent 2px, transparent 12px)' }} />
            )}

            {showGrid ? (
              <div
                className="absolute inset-0 pointer-events-none opacity-30"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(255,255,255,0.4) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255,255,255,0.4) 1px, transparent 1px)
                  `,
                  backgroundSize: `${displayW / 20}px ${displayH / 20}px`,
                }}
              />
            ) : null}

            {sortedLayers.map((layer) => {
              if (isHidden(layer.id)) return null
              const left = percentToPx(layer.position_x_percent, displayW)
              const top = percentToPx(layer.position_y_percent, displayH)
              const w = percentToPx(layer.width_percent, displayW)
              const h = percentToPx(layer.height_percent, displayH)
              const selected = selectedIds.includes(layer.id)
              const rot = layer.rotation_degrees ?? 0

              let bg = "rgba(99,102,241,0.25)"
              let border = "1px dashed rgba(99,102,241,0.8)"
              if (layer.type === "text") {
                const tl = layer as TextLayer
                bg = tl.color_options[0]?.color_hex
                  ? `${tl.color_options[0].color_hex}33`
                  : bg
              } else if (layer.type === "overlay") {
                const c = layer.color_options[0]
                if (c) bg = `${c.color_hex}${Math.round(c.opacity * 255).toString(16).padStart(2, "0")}`
              }

              let textContent = ""
              let textStyle: React.CSSProperties = {}
              if (layer.type === "text") {
                const tl = layer as TextLayer
                textContent = state.previewTexts?.[layer.id] || `[Preview ${tl.role}]`
                const textColor = tl.color_options[0]?.color_hex || "#ffffff"
                const textAlign = tl.text_align_options[0] || "center"
                const avgPct = (tl.font_size_min_percent + tl.font_size_max_percent) / 2
                const fontSizePx = displayH * (avgPct / 100)
                textStyle = {
                  color: textColor,
                  textAlign: textAlign,
                  fontSize: `${fontSizePx}px`,
                  fontWeight: tl.font_weight || "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: textAlign === "left" ? "flex-start" : textAlign === "right" ? "flex-end" : "center",
                  padding: "4px",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                  height: "100%",
                  width: "100%",
                }
              }

              const isImageLayer = layer.type === "image"
              const isResizableLayer = layer.type === "icon" || layer.type === "emoji" || layer.type === "shape" || isImageLayer

              if (isResizableLayer) {
                const innerStyle: React.CSSProperties = {
                  width: "100%",
                  height: "100%",
                  borderRadius: layer.type === "shape" && (layer as any).shape_type === "circle" ? "9999px" : layer.type === "shape" && (layer as any).shape_type === "line" ? 0 : 12,
                  background: layer.type === "shape"
                    ? ((layer as any).fill_color_options?.[0]?.color_hex ? (layer as any).fill_color_options[0].color_hex : "#8b5cf6")
                    : "transparent",
                  border: layer.type === "shape"
                    ? `${(layer as any).stroke_width ?? 0}px solid ${((layer as any).stroke_color_options?.[0]?.color_hex || "#ffffff")}`
                    : "none",
                  transform: `rotate(${rot}deg)`,
                  transformOrigin: "center center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }

                return (
                  <Rnd
                    key={layer.id}
                    className={cn("absolute box-border select-none touch-none", selected && "ring-2 ring-purple-500")}
                    size={{ width: Math.max(24, w), height: Math.max(24, h) }}
                    position={{ x: left, y: top }}
                    bounds="parent"
                    enableResizing={!isLocked(layer.id)}
                    resizeHandles={selected && !isLocked(layer.id) ? ["se", "sw", "nw", "ne", "e", "w", "s", "n"] : []}
                    onMouseDown={(e: any) => {
                      e.stopPropagation()
                      selectLayer(layer.id, e.shiftKey)
                    }}
                    onTouchStart={(e: any) => {
                      e.stopPropagation()
                      selectLayer(layer.id, false)
                    }}
                    onDragStop={(_, d) => updateLayerGeometry(layer.id, d.x, d.y, w, h)}
                    onResizeStop={(_, __, ref, ___, position) => {
                      updateLayerGeometry(layer.id, position.x, position.y, ref.offsetWidth, ref.offsetHeight)
                    }}
                    style={{ zIndex: layer.z_index + 1 }}
                  >
                    <div className="h-full w-full" style={innerStyle}>
                      {layer.type === "shape" ? (
                        (layer as any).shape_type === "line" ? (
                          <svg viewBox="0 0 100 100" className="h-full w-full">
                            <line x1="0" y1="50" x2="100" y2="50" stroke={(layer as any).stroke_color_options?.[0]?.color_hex || "#ffffff"} strokeWidth={(layer as any).stroke_width ?? 4} strokeLinecap="round" />
                          </svg>
                        ) : null
                      ) : null}
                      {layer.type === "icon" ? (
                        <Icon icon={(layer as IconLayer).icon_name || "mdi:star"} width="100%" height="100%" style={{ color: (layer as IconLayer).icon_color_hex || "#ffffff" }} />
                      ) : null}
                      {layer.type === "emoji" ? (
                        <img src={(layer as EmojiLayer).emoji_svg_url || getEmojiSvgUrl((layer as EmojiLayer).emoji)} alt={(layer as EmojiLayer).emoji} className="h-full w-full object-contain" />
                      ) : null}
                      {isImageLayer ? (
                        <img src={(layer as ImageLayer).image_url} alt={(layer as ImageLayer).alt || "Cat image"} crossOrigin="anonymous" className="h-full w-full object-cover" />
                      ) : null}
                      {layer.type === "shape" && (layer as any).shape_type !== "line" ? (
                        <div className="absolute inset-0" style={{ background: (layer as any).fill_color_options?.[0]?.color_hex ? (layer as any).fill_color_options[0].color_hex : "transparent" }} />
                      ) : null}
                    </div>
                  </Rnd>
                )
              }

              return (
                <div
                  key={layer.id}
                  className={cn(
                    "absolute box-border select-none touch-none",
                    selected && "ring-2 ring-purple-500",
                  )}
                  style={{
                    left,
                    top,
                    width: w,
                    height: h,
                    background: layer.type === "logo" ? (state.previewLogoBase64 ? "transparent" : "rgba(255,255,255,0.15)") : bg,
                    border,
                    transform: `rotate(${rot}deg)`,
                    transformOrigin: "center center",
                    cursor: isLocked(layer.id) ? "not-allowed" : "move",
                    zIndex: layer.z_index + 1,
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    selectLayer(layer.id, e.shiftKey)
                    startDrag(e, "move", layer.id)
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    selectLayer(layer.id, false)
                    startDrag(e, "move", layer.id)
                  }}
                >
                  {layer.type === "text" ? (
                    <div style={textStyle}>{textContent}</div>
                  ) : layer.type === "logo" && state.previewLogoBase64 ? (
                    <img src={state.previewLogoBase64} alt="logo" className="w-full h-full object-contain pointer-events-none" />
                  ) : isImageLayer ? (
                    <img src={(layer as ImageLayer).image_url} alt={(layer as ImageLayer).alt || "Cat image"} crossOrigin="anonymous" className="w-full h-full object-cover pointer-events-none" />
                  ) : (
                    <span className="absolute top-0 left-0 text-[9px] bg-black/50 text-white px-1 truncate max-w-full">
                      {layer.type}
                    </span>
                  )}
                  {selected && !isLocked(layer.id) ? (
                    <>
                      {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map((h) => (
                        <div
                          key={h}
                          className="absolute size-2.5 bg-white border border-purple-600 rounded-sm"
                          style={{
                            cursor: HANDLE_CURSORS[h],
                            ...(h.includes("n") ? { top: -5 } : h.includes("s") ? { bottom: -5 } : { top: "50%", marginTop: -5 }),
                            ...(h.includes("w") ? { left: -5 } : h.includes("e") ? { right: -5 } : { left: "50%", marginLeft: -5 }),
                            ...(h === "n" || h === "s" ? { left: "50%", marginLeft: -5 } : {}),
                            ...(h === "e" || h === "w" ? { top: "50%", marginTop: -5 } : {}),
                          }}
                          onMouseDown={(e) => startDrag(e, h, layer.id)}
                          onTouchStart={(e) => startDrag(e, h, layer.id)}
                        />
                      ))}
                      <div
                        className="absolute left-1/2 -translate-x-1/2 -top-7 size-3 rounded-full bg-purple-600 border-2 border-white cursor-grab"
                        onMouseDown={(e) => startDrag(e, "rotate", layer.id)}
                        onTouchStart={(e) => startDrag(e, "rotate", layer.id)}
                      />
                    </>
                  ) : null}
                </div>
              )
            })}
          </div>

        </div>

        {/* Properties */}
        <aside className="max-h-[520px] overflow-y-auto">
          {primaryLayer ? (
            <TemplateLayerFields
              layer={primaryLayer}
              fontAssets={fonts}
              onChange={(patch) => {
                if (selectedIds.length > 1) patchLayers(selectedIds, patch)
                else patchLayer(primaryLayer.id, patch)
              }}
              previewText={state.previewTexts?.[primaryLayer.id] || ""}
              onPreviewTextChange={(text) => {
                onStateChange({
                  ...state,
                  previewTexts: {
                    ...(state.previewTexts || {}),
                    [primaryLayer.id]: text
                  }
                })
              }}
              previewLogoBase64={state.previewLogoBase64}
              onLogoUpload={(base64) => {
                onStateChange({
                  ...state,
                  previewLogoBase64: base64
                })
              }}
            />
          ) : (
            <p className="text-sm text-slate-500">Select a layer on the canvas.</p>
          )}
        </aside>
      </div>
    </div>
  )
}


