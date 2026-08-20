"use client"

import React, { useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useApp } from "@/contexts/app-context"
import { PostList } from "@/components/dashboard/views/post-list-view"
import { Loader2 } from "lucide-react"

export default function PublishedPostsPage() {
  const { user } = useAuth()
  const { publishedPosts, isFetchingPublished, refreshPublishedPosts, isInitialLoading } = useApp()
  const timezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

  useEffect(() => {
    refreshPublishedPosts()
  }, [refreshPublishedPosts])

  // Only show full loading spinner if we have 0 cached posts and are fetching
  if ((isInitialLoading || isFetchingPublished) && publishedPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="text-xs text-slate-500 font-medium">Loading published posts...</p>
      </div>
    )
  }

  return (
    <PostList 
      title="Published Posts" 
      posts={publishedPosts} 
      emptyAction="/dashboard/create" 
      emptyText="No published posts yet." 
      timezone={timezone} 
      published={true} 
      onChanged={() => refreshPublishedPosts(true)} 
    />
  )
}
