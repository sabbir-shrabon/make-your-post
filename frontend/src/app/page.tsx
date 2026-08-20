import Link from "next/link"
import { CalendarClock, CheckCircle2, PenLine, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

const features: { title: string; text: string; Icon: LucideIcon }[] = [
  { title: "Connect", text: "Guided Facebook OAuth popup with server-side token handling.", Icon: CheckCircle2 },
  { title: "Create", text: "Composer with scheduling, media URLs, character count, and link preview.", Icon: PenLine },
  { title: "Manage", text: "Scheduled, published, analytics, and settings pages in one workspace.", Icon: CalendarClock },
]

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-slate-50 px-4 py-10">
      <section className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1fr_0.9fr] md:items-center">
        <div className="grid gap-4">
          <h1 className="max-w-3xl text-xl font-bold leading-6 tracking-tight text-slate-950">
            Manage your Facebook Page posts without touching the API.
          </h1>
          <p className="max-w-xl text-sm font-normal leading-5 text-slate-600">
            Connect your page once, then create, schedule, publish, and review performance from a clean dashboard.
          </p>
          <Button asChild className="h-9 w-full bg-blue-700 text-white text-sm font-semibold leading-[18px] hover:bg-blue-800 sm:w-fit">
            <Link href="/register">Get Started Free</Link>
          </Button>
        </div>
        <div className="grid gap-4 rounded-md border bg-white p-6">
          {features.map(({ title, text, Icon }) => (
            <div key={title} className="flex gap-3 rounded-md border p-4">
              <Icon className="mt-1 size-5 text-blue-700" />
              <div>
                <h2 className="text-base font-semibold leading-5">{title}</h2>
                <p className="text-xs font-normal leading-4 text-slate-500 mt-1">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
