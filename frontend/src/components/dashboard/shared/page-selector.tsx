"use client"

import * as React from "react"
import { Globe, Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageConnection } from "@/types/models"

export function PageSelector({
  pages,
  selectedPageId,
  onSelectPageId,
  className,
  size = "md",
  disabled = false,
}: {
  pages: PageConnection[]
  selectedPageId: number | null
  onSelectPageId: (id: number) => void
  className?: string
  size?: "sm" | "md"
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const publishablePages = pages.filter((p) => p.connection_status === "connected")
  const displayPages = publishablePages.length > 0 ? publishablePages : pages
  const selectedPage = displayPages.find((p) => p.id === selectedPageId) || displayPages[0]

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  if (!displayPages || displayPages.length === 0) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200", className)}>
        <Globe className="size-3.5 shrink-0" />
        <span className="font-medium">No Facebook Pages Connected</span>
      </div>
    )
  }

  return (
    <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 font-semibold text-slate-800 transition-all shadow-2xs focus:outline-hidden cursor-pointer",
          size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-xs",
          isOpen && "ring-2 ring-blue-500/20 border-blue-500",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className="relative shrink-0">
          <img
            src={selectedPage?.page_picture_url || `https://graph.facebook.com/${selectedPage?.facebook_page_id || selectedPage?.page_id}/picture?type=large`}
            alt=""
            className="size-4.5 rounded-full object-cover bg-slate-100 border border-slate-200"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none"
            }}
          />
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-white",
              selectedPage?.connection_status === "connected" ? "bg-emerald-500" : "bg-amber-500"
            )}
          />
        </div>

        <span className="truncate max-w-[140px] sm:max-w-[180px]">
          {selectedPage?.page_name || "Select Page"}
        </span>

        <ChevronDown className={cn("size-3.5 text-slate-400 shrink-0 transition-transform ml-auto", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 animate-in fade-in-0 zoom-in-95">
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
            Target Facebook Page
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {displayPages.map((page) => {
              const isSelected = page.id === selectedPage?.id
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => {
                    onSelectPageId(page.id)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer",
                    isSelected ? "bg-blue-50/80 font-bold text-blue-950" : "hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="relative shrink-0">
                      <img
                        src={page.page_picture_url || `https://graph.facebook.com/${page.facebook_page_id || page.page_id}/picture?type=large`}
                        alt=""
                        className="size-5 rounded-full object-cover bg-slate-100 border border-slate-200"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none"
                        }}
                      />
                      <div
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full border border-white",
                          page.connection_status === "connected" ? "bg-emerald-500" : "bg-amber-500"
                        )}
                      />
                    </div>
                    <div className="truncate">
                      <p className="truncate leading-tight">{page.page_name}</p>
                      {page.connection_status !== "connected" && (
                        <span className="text-[10px] text-amber-600 font-normal">Needs Reconnect</span>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check className="size-3.5 text-blue-600 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
