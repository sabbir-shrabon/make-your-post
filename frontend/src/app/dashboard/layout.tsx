"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  CalendarClock,
  FileText,
  Image as ImageIcon,
  Loader2,
  Menu,
  PenLine,
  Settings,
  Sparkles,
  LayoutTemplate,
  Laugh,
  Share,
  Search,
  ChevronDown,
  Clock,
  Wand2,
  LogOut,
  Globe,
  User,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/auth-context"
import { useApp } from "@/contexts/app-context"
import { cn } from "@/lib/utils"

const primaryNav = [
  { href: "/dashboard/ai-settings", label: "Persona", icon: Sparkles },
  { href: "/dashboard/poster-studio", label: "Poster Studio", icon: Wand2 },
  { href: "/dashboard/memes", label: "Meme Studio", icon: Laugh },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/templates", label: "Templates", icon: LayoutTemplate },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const { pages, posts, publishedPosts } = useApp()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false)
  const profileMenuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    if (profileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [profileMenuOpen])

  // Auth guard
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login")
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading || !isAuthenticated) {
    return (
      <main className="grid min-h-screen place-items-center">
        <Loader2 className="size-5 animate-spin" />
      </main>
    )
  }

  const connectedPage = pages.find((page) => page.connection_status === "connected") || pages[0]

  function signOut() {
    setProfileMenuOpen(false)
    logout()
    router.push("/login")
  }

  // Calculate live total published and scheduled post counts
  const publishedCount = publishedPosts.length > 0
    ? publishedPosts.length
    : pages.reduce((sum, p) => sum + (p.post_count || 0), 0)

  const scheduledCount = pages.reduce((sum, p) => sum + (p.scheduled_post_count || 0), 0)
    || posts.filter(p => p.status === "scheduled" || p.status === "pending").length

  // Determine top bar title
  let topBarTitle = ""

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r bg-white">
      <div className="p-6 pb-4 flex flex-col gap-6">
        {/* Logo row */}
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-blue-700 shadow-sm">
            <span className="text-sm font-bold text-white">P</span>
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">PagePilot</span>
        </div>

        {/* Create Post Button */}
        <Button
          onClick={() => {
            router.push("/dashboard/create")
            setMobileOpen(false)
          }}
          className="w-full rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-md"
        >
          Create post
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <nav className="flex flex-col gap-1 mb-8">
          {primaryNav.map((item) => {
            const Icon = item.icon
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors",
                  active && "bg-slate-100 text-slate-900 font-semibold"
                )}
              >
                <Icon className="size-[18px]" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex flex-col gap-1">
          <Link
            href="/dashboard/scheduled"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors",
              pathname.startsWith("/dashboard/scheduled") && "bg-slate-100 text-slate-900 font-semibold"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="size-2 rounded-full bg-blue-500 shadow-sm" />
              Scheduled posts
            </div>
            <span className="text-xs text-slate-400 font-bold">{scheduledCount}</span>
          </Link>

          <Link
            href="/dashboard/published"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors",
              pathname.startsWith("/dashboard/published") && "bg-slate-100 text-slate-900 font-semibold"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="size-2 rounded-full bg-emerald-500 shadow-sm" />
              Published posts
            </div>
            <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">{publishedCount}</span>
          </Link>
        </div>
      </div>

      {/* Bottom Block */}
      <div className="mt-auto border-t p-4 bg-slate-50 space-y-2">
        <div className="flex items-center gap-2 px-2 text-slate-500 mb-2">
          <Clock className="size-4 shrink-0" />
          <span className="text-xs font-medium">Free trial ends in 7 days</span>
        </div>

        <Link
          href="/dashboard/settings"
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:shadow-sm hover:text-slate-900 transition-all border border-transparent",
            pathname.startsWith("/dashboard/settings") && "bg-white shadow-sm border-slate-200 text-slate-900 font-semibold"
          )}
        >
          <Settings className="size-[18px]" />
          Settings
        </Link>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors text-left"
        >
          <LogOut className="size-[18px]" />
          Log Out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 flex">
      {/* Desktop Sidebar */}
      <div className="fixed inset-y-0 left-0 hidden md:flex md:w-64 flex-col bg-white z-40 border-r">
        {sidebar}
      </div>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col md:ml-64 min-h-screen">

        {/* Mobile Header (replaces sidebar on small screens) */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-white px-4 md:hidden">
          <div className="flex items-center gap-2">
            <div className="grid size-6 place-items-center rounded bg-blue-700 shadow-sm">
              <span className="text-xs font-bold text-white">P</span>
            </div>
            <span className="font-bold text-slate-900">PagePilot</span>
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="p-0 w-64">{sidebar}</SheetContent>
          </Sheet>
        </header>

        {/* Desktop Top Bar */}
        <div className="sticky top-0 z-30 hidden md:flex h-16 items-center justify-between border-b bg-white px-6">
          <div className="flex-1 flex items-center justify-start">
            <Button variant="outline" size="sm" className="rounded-full h-8 px-3 text-xs font-semibold gap-1.5 text-slate-700">
              <Share className="size-3.5" />
              Share
            </Button>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm font-medium text-slate-700">{topBarTitle}</span>
          </div>

          <div className="flex-1 flex items-center justify-end gap-3" ref={profileMenuRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-200"
              >
                <div className="relative">
                  <img
                    src={connectedPage?.page_picture_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"}
                    alt="Profile"
                    className="size-8 rounded-full border border-slate-200 object-cover bg-slate-100"
                  />
                  <div className={cn(
                    "absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white",
                    connectedPage?.connection_status === "connected" ? "bg-emerald-500" : "bg-slate-400"
                  )} />
                </div>
                <div className="flex flex-col text-left hidden lg:flex">
                  <span className="text-xs font-bold text-slate-900 leading-tight">{user?.name || "User"}</span>
                  <span className="text-[10px] text-slate-500 leading-tight">{user?.email || "Account"}</span>
                </div>
                <ChevronDown className={cn("size-4 text-slate-400 ml-1 transition-transform", profileMenuOpen && "rotate-180")} />
              </button>

              {/* Profile Dropdown Menu */}
              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in-0 zoom-in-95">
                  <div className="px-3 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{user?.name || "User Account"}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    {connectedPage && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                        <Globe className="size-3 text-blue-600 shrink-0" />
                        <span className="truncate font-medium">{connectedPage.page_name}</span>
                        <span className={cn(
                          "ml-auto size-1.5 rounded-full",
                          connectedPage.connection_status === "connected" ? "bg-emerald-500" : "bg-amber-500"
                        )} />
                      </div>
                    )}
                  </div>

                  <div className="py-1">
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      <Settings className="size-4 text-slate-500" />
                      Settings & Pages
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 pt-1">
                    <button
                      type="button"
                      onClick={signOut}
                      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors text-left"
                    >
                      <LogOut className="size-4 text-rose-500" />
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 mx-auto w-full max-w-6xl">
          {children}
        </main>
      </div>
    </div>
  )
}
