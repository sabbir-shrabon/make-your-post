/**
 * Central URL resolution for frontend ↔ backend communication.
 *
 * Set in frontend/.env.local (local) or Vercel env vars (production):
 *   NEXT_PUBLIC_API_URL=https://autopost-1-ax2p.onrender.com
 *   — or the legacy alias —
 *   NEXT_PUBLIC_BACKEND_URL=https://autopost-1-ax2p.onrender.com
 *
 * When unset, defaults to http://localhost:8000 for local development.
 */

export const DEFAULT_BACKEND_URL = "http://localhost:8000"

export function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "")
}

export function isLocalHostname(hostname?: string): boolean {
  const host = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")).toLowerCase()
  return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host)
}

export function isLocalBackendUrl(url?: string): boolean {
  const target = (url || getBackendUrl()).toLowerCase()
  return (
    target.includes("localhost") ||
    target.includes("127.0.0.1") ||
    target.includes("0.0.0.0") ||
    target.includes("::1")
  )
}

export function shouldShowColdStartOverlay(url?: string): boolean {
  if (process.env.NODE_ENV === "development") return false
  if (typeof window !== "undefined" && isLocalHostname(window.location.hostname)) return false
  return !isLocalBackendUrl(url)
}

export function getBackendUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    DEFAULT_BACKEND_URL
  return normalizeUrl(url)
}
