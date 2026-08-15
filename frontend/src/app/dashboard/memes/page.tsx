"use client"

import { useApp } from "@/contexts/app-context"
import { MemeStudioView } from "@/components/dashboard/views/meme-studio-view"
import { Loader2 } from "lucide-react"

export default function MemeStudioPage() {
  const { pages, isInitialLoading } = useApp()

  if (isInitialLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-purple-600" />
      </div>
    )
  }

  return <MemeStudioView pages={pages} />
}
