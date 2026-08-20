"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function StyleAnalyzerRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/dashboard/ai-settings?mode=extract")
  }, [router])

  return (
    <div className="flex justify-center py-16">
      <Loader2 className="size-6 animate-spin text-slate-400" />
    </div>
  )
}
