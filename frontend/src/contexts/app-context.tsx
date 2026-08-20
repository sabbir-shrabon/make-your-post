"use client"

import * as React from "react"
import { api } from "@/lib/api"
import { useAuth } from "./auth-context"

type AppContextValue = {
  pages: any[]
  activePageId: number | null
  setActivePageId: (id: number | null) => void
  posts: any[]
  publishedPosts: any[]
  isFetchingPublished: boolean
  imageTemplates: any[]
  dashboardData: any | null
  isInitialLoading: boolean
  refreshPages: () => Promise<void>
  refreshPosts: () => Promise<void>
  refreshPublishedPosts: (force?: boolean) => Promise<void>
  refreshImageTemplates: () => Promise<void>
  refreshDashboard: () => Promise<void>
  setDashboardData: (data: any | null) => void
}

const AppContext = React.createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [pages, setPages] = React.useState<any[]>([])
  const [activePageId, setActivePageId] = React.useState<number | null>(null)
  const [posts, setPosts] = React.useState<any[]>([])
  const [publishedPosts, setPublishedPosts] = React.useState<any[]>([])
  const [isFetchingPublished, setIsFetchingPublished] = React.useState(false)
  const [imageTemplates, setImageTemplates] = React.useState<any[]>([])
  const [dashboardData, setDashboardData] = React.useState<any | null>(null)
  const [isInitialLoading, setIsInitialLoading] = React.useState(true)

  const fetched = React.useRef({ pages: false, posts: false, imageTemplates: false, dashboardData: false })
  const lastFetchedPublished = React.useRef<number>(0)

  const refreshPages = React.useCallback(async () => {
    try {
      const res = await api.get("/api/pages")
      setPages(res.data)
      fetched.current.pages = true
      // Auto set active page if not selected
      if (res.data && res.data.length > 0) {
        setActivePageId((prev) => {
          if (prev && res.data.some((p: any) => p.id === prev)) return prev
          const connected = res.data.find((p: any) => p.connection_status === "connected")
          return connected ? connected.id : res.data[0].id
        })
      }
    } catch {
      console.warn("[AppContext] Failed to fetch pages")
    }
  }, [])

  const refreshPosts = React.useCallback(async () => {
    try {
      const res = await api.get("/posts", { params: { limit: 50 } })
      setPosts(res.data)
      fetched.current.posts = true
    } catch {
      console.warn("[AppContext] Failed to fetch posts")
    }
  }, [])

  const publishedInFlight = React.useRef<Promise<void> | null>(null)

  const refreshPublishedPosts = React.useCallback(async (force = false) => {
    const now = Date.now()
    // Stale-While-Revalidate: If not forced and fetched recently (< 45s), do not refetch
    if (!force && lastFetchedPublished.current > 0 && now - lastFetchedPublished.current < 45000) {
      return
    }

    // Deduplicate: if a request is already in-flight, reuse it instead of firing a second one
    if (publishedInFlight.current) {
      return publishedInFlight.current
    }

    setIsFetchingPublished(true)
    const promise = (async () => {
      try {
        const res = await api.get("/posts", { params: { status: "published", limit: 100 } })
        setPublishedPosts(res.data || [])
        lastFetchedPublished.current = Date.now()
      } catch {
        console.warn("[AppContext] Failed to fetch published posts")
      } finally {
        setIsFetchingPublished(false)
        publishedInFlight.current = null
      }
    })()
    publishedInFlight.current = promise
    return promise
  }, [])

  const refreshImageTemplates = React.useCallback(async () => {
    try {
      const res = await api.get("/api/image-templates")
      setImageTemplates(res.data)
      fetched.current.imageTemplates = true
    } catch {
      console.warn("[AppContext] Failed to fetch image templates")
    }
  }, [])

  const refreshDashboard = React.useCallback(async () => {
    try {
      const res = await api.get("/api/dashboard")
      setDashboardData(res.data)
      fetched.current.dashboardData = true
    } catch {
      console.warn("[AppContext] Failed to fetch dashboard data")
    }
  }, [])

  React.useEffect(() => {
    if (!authLoading) {
      if (isAuthenticated) {
        // Fetch pages and published posts on initial load, unblock render
        Promise.allSettled([
          refreshPages(),
          refreshPublishedPosts(),
        ]).finally(() => {
          setIsInitialLoading(false)
        })
      } else {
        setPages([])
        setActivePageId(null)
        setPosts([])
        setPublishedPosts([])
        setImageTemplates([])
        setDashboardData(null)
        fetched.current = { pages: false, posts: false, imageTemplates: false, dashboardData: false }
        lastFetchedPublished.current = 0
        setIsInitialLoading(false)
      }
    }
  }, [isAuthenticated, authLoading, refreshPages, refreshPublishedPosts])

  return (
    <AppContext.Provider
      value={{
        pages,
        activePageId,
        setActivePageId,
        posts,
        publishedPosts,
        isFetchingPublished,
        imageTemplates,
        dashboardData,
        isInitialLoading,
        refreshPages,
        refreshPosts,
        refreshPublishedPosts,
        refreshImageTemplates,
        refreshDashboard,
        setDashboardData,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = React.useContext(AppContext)
  if (!context) throw new Error("useApp must be used inside AppProvider")
  return context
}
