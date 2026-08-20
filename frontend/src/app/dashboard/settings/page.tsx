"use client"

import * as React from "react"
import { useApp } from "@/contexts/app-context"
import { useAuth } from "@/contexts/auth-context"
import { SettingsView } from "@/components/dashboard/views/settings-view"
import { Loader2 } from "lucide-react"

export default function SettingsPage() {
  const { pages, isInitialLoading, refreshPages } = useApp()
  const { user } = useAuth()
  const timezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

  React.useEffect(() => {
    refreshPages()
  }, [refreshPages])

  if (isInitialLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-slate-400" /></div>
  }

  return <SettingsView pages={pages} timezone={timezone} onChanged={refreshPages} />
}
