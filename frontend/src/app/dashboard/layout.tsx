"use client"

/**
 * dashboard/layout.tsx — Persistent Dashboard Shell
 *
 * WHY THIS FILE EXISTS:
 * ---------------------
 * Previously, every dashboard route rendered the full <SocialPlatform> component
 * which included the sidebar, auth guard, and the view content all in one component.
 * When a user navigated between tabs (e.g. /dashboard/create → /dashboard/scheduled),
 * Next.js would unmount and remount the entire SocialPlatform component because each
 * page.tsx was rendering a new instance of it. This caused:
 *   - Sidebar to flicker/re-render on every navigation
 *   - Auth guard to re-run and flash the loading spinner
 *   - AppContext data to be re-fetched unnecessarily
 *
 * HOW THIS FIXES IT:
 * ------------------
 * By placing the sidebar and auth guard here in layout.tsx, Next.js App Router
 * keeps this layout mounted across all /dashboard/* navigations. Only the
 * {children} slot (the individual view) swaps out. The sidebar, auth state,
 * and AppContext data all persist in memory between tab switches.
 *
 * STATE SURVIVAL TABLE:
 * ┌──────────────────────────────┬──────────────────────────┐
 * │ State                        │ Survives tab switch?     │
 * ├──────────────────────────────┼──────────────────────────┤
 * │ useAuth() token + user       │ ✅ Yes (AuthProvider)    │
 * │ useApp() pages / posts       │ ✅ Yes (AppProvider)     │
 * │ Sidebar active link          │ ✅ Yes (usePathname)     │
 * │ Per-view local state         │ ❌ No (expected)         │
 * └──────────────────────────────┴──────────────────────────┘
 */

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  CalendarClock,
  FileText,
  Home,
  Image,
  Loader2,
  Menu,
  PenLine,
  Radar,
  Search,
  Settings,
  Sparkles,
  LayoutDashboard,
  Layers,
  BrainCircuit,
  Palette,
  ChevronDown,
  Laugh,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/auth-context"
import { useApp } from "@/contexts/app-context"
import { cn } from "@/lib/utils"

const navGroups = [
  {
    title: "Overview",
    icon: LayoutDashboard,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    ]
  },
  {
    title: "Content Pipeline",
    icon: Layers,
    items: [
      { href: "/dashboard/create", label: "Create Post", icon: PenLine },
      { href: "/dashboard/ai-settings", label: "AI Personas & Prompts", icon: Sparkles },
      { href: "/dashboard/memes", label: "Meme Studio", icon: Laugh },
      { href: "/dashboard/scheduled", label: "Scheduled Posts", icon: CalendarClock },
      { href: "/dashboard/published", label: "Published Posts", icon: FileText },
    ]
  },
  {
    title: "Design & Setup",
    icon: Palette,
    items: [
      { href: "/dashboard/templates", label: "Poster Templates", icon: Image },
      { href: "/dashboard/settings", label: "Settings & Typography", icon: Settings },
    ]
  }
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const { pages } = useApp()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  // Expand the group that contains the current pathname by default
  const [expandedGroups, setExpandedGroups] = React.useState<string[]>(() => {
    const activeGroup = navGroups.find(g => g.items.some(i => i.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(i.href)))
    return activeGroup ? [activeGroup.title] : [navGroups[0].title]
  })

  function toggleGroup(title: string) {
    setExpandedGroups(prev => prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title])
  }

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
    logout()
    router.push("/login")
  }

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r bg-white">
      <div className="border-b p-6 text-lg font-semibold text-slate-950 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded bg-blue-700 text-sm font-bold text-white">P</span>
        PagePilot
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <nav className="grid gap-4">
          {navGroups.map((group) => {
            const GroupIcon = group.icon
            const isExpanded = expandedGroups.includes(group.title)
            return (
              <div key={group.title} className="grid gap-1">
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <GroupIcon className="size-4 text-slate-500" />
                    {group.title}
                  </div>
                  <ChevronDown className={cn("size-4 text-slate-400 transition-transform", isExpanded && "rotate-180")} />
                </button>
                {isExpanded && (
                  <div className="grid gap-1 pl-6 pt-1">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors",
                            active && "bg-blue-50 text-blue-700"
                          )}
                        >
                          <Icon className="size-4" />
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>
      <div className="mt-auto border-t p-4 bg-slate-50">
        {connectedPage ? (
          <div className="flex items-center gap-2 text-sm text-slate-700">
            {connectedPage.page_picture_url && (
              <img
                src={connectedPage.page_picture_url}
                alt={connectedPage.page_name}
                className="size-8 rounded-full object-cover border bg-white"
              />
            )}
            <span className="truncate font-medium">{connectedPage.page_name}</span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No page connected</p>
        )}
        <Button variant="outline" className="mt-3 w-full bg-white shadow-sm" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-950">
      <div className="fixed inset-y-0 left-0 hidden md:block">{sidebar}</div>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white px-4 md:hidden">
        <span className="font-semibold flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded bg-blue-700 text-xs font-bold text-white">P</span>
          PagePilot
        </span>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent className="p-0 w-64">{sidebar}</SheetContent>
        </Sheet>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 p-4 md:ml-64 md:p-8">
        {children}
      </main>
    </div>
  )
}
