"use client"

import * as React from "react"
import { Analytics } from "@/types/models"
import { PageTitle, Stat, Empty } from "@/components/dashboard/shared/dashboard-ui"
import { Card, CardContent } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { api } from "@/lib/api"


export function AnalyticsView({
  analytics,
  setAnalytics,
}: {
  analytics: Analytics | null
  setAnalytics: (value: Analytics) => void
}) {
  async function changeRange(value: string) {
    try {
      const response = await api.get<Analytics>("/analytics", { params: { days: Number(value) } })
      setAnalytics(response.data)
    } catch {
      // Keep existing analytics on failure
    }
  }

  const max = Math.max(...(analytics?.posts_per_day.map((day) => day.count) || [0]), 1) + 2

  return (
    <>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
        <PageTitle title="Analytics" subtitle="Current performance across published posts." />
        <Select className="w-44" defaultValue="30" onChange={(event) => changeRange(event.target.value)}>
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 3 Months</option>
        </Select>
      </div>

      {analytics ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <Stat label="Total posts published" value={analytics.total_posts} />
            <Stat label="Total likes received" value={analytics.total_likes} />
            <Stat label="Total comments received" value={analytics.total_comments} />
            <Stat label="Total shares received" value={analytics.total_shares} />
          </section>
          <Card>
            <CardContent className="flex h-64 items-end gap-1 p-6">
              {analytics.posts_per_day.map((day) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t bg-blue-700 transition-all"
                    style={{ height: `${Math.max(4, (day.count / max) * 210)}px` }}
                  />
                  <span className="hidden text-[10px] text-slate-500 md:block">{day.date.slice(5)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <Empty text="No analytics yet." action="/dashboard/create" />
      )}
    </>
  )
}
