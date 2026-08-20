"use client"

import { useApp } from "@/contexts/app-context"
import { AgenticPosterLab } from "@/components/social-platform/AgenticPosterLab"
import { Loader2 } from "lucide-react"

export default function PosterStudioPage() {
  const { isInitialLoading, pages } = useApp()

  if (isInitialLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-slate-400" /></div>
  }

  return <AgenticPosterLab pages={pages} />
}
