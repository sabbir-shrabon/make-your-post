const fs = require('fs');

// 1. Remove GlobalModelSettings from settings-view.tsx
const settingsFile = 'frontend/src/components/dashboard/views/settings-view.tsx';
let settingsContent = fs.readFileSync(settingsFile, 'utf-8');

// Find type GlobalModelSettings block and remove it
const typeGlobalModelRegex = /type GlobalModelSettings = \{[\s\S]*?\n\}\n/;
settingsContent = settingsContent.replace(typeGlobalModelRegex, '');

// Import PageConnectionCard
if (!settingsContent.includes('PageConnectionCard } from "@/components/dashboard/shared/dashboard-ui"')) {
    settingsContent = settingsContent.replace(
        /import \{ PageTitle, PageMini, /,
        'import { PageConnectionCard, PageTitle, PageMini, '
    );
}
fs.writeFileSync(settingsFile, settingsContent);

// 2. Add PageConnectionCard to dashboard-ui.tsx
const dashboardUiFile = 'frontend/src/components/dashboard/shared/dashboard-ui.tsx';
let dashboardUiContent = fs.readFileSync(dashboardUiFile, 'utf-8');

if (!dashboardUiContent.includes('export function PageConnectionCard')) {
    const pageConnectionCardCode = `
export function PageConnectionCard({
  page,
  onChanged,
  onSyncHistory,
  onDisconnect,
  isSyncing,
  showDashboardActions,
}: {
  page: PageConnection
  onChanged: () => void
  onSyncHistory?: () => void
  onDisconnect?: () => void
  isSyncing?: boolean
  showDashboardActions?: boolean
}) {
  const status = page.connection_status
  const postCount = page.post_count ?? 0
  const pausedCount = page.paused_post_count ?? 0

  return (
    <Card>
      <CardContent className="grid gap-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <PageMini page={page} />
            <PageStatusBadge status={status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "connected" && showDashboardActions ? (
              <>
                <Button asChild variant="outline"><Link href="/dashboard/create">Create Post</Link></Button>
                <Button asChild variant="outline"><Link href="/dashboard/published">View Posts</Link></Button>
                {onDisconnect ? <Button variant="destructive" onClick={onDisconnect}>Disconnect</Button> : null}
              </>
            ) : null}
            {status === "connected" && !showDashboardActions ? (
              <>
                {onSyncHistory ? (
                  <Button variant="outline" disabled={isSyncing} onClick={onSyncHistory}>
                    {isSyncing ? "Syncing..." : "Sync History"}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  disabled={isSyncing}
                  onClick={async () => {
                    await api.post(\`/facebook/pages/\${page.id}/refresh-token\`)
                    toast.success("Token refreshed.")
                    onChanged()
                  }}
                >
                  Refresh Token
                </Button>
                {onDisconnect ? (
                  <Button variant="destructive" disabled={isSyncing} onClick={onDisconnect}>
                    Disconnect
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {status === "connected" ? (
          <p className="text-sm text-slate-600">
            {postCount} posts in history
            {(page.scheduled_post_count ?? 0) > 0 ? \` • \${page.scheduled_post_count} scheduled\` : ""}
          </p>
        ) : null}

        {status === "disconnected" ? (
          <div className="grid gap-1 text-sm text-slate-600">
            <p>{postCount} posts saved • Your post history is preserved</p>
            {pausedCount > 0 ? (
              <p className="text-amber-700">
                {pausedCount} scheduled posts are paused. They will resume when you reconnect.
              </p>
            ) : null}
          </div>
        ) : null}

        {status === "needs-reconnection" ? (
          <p className="text-sm text-amber-700">Please reconnect to resume posting.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
`;
    dashboardUiContent += pageConnectionCardCode;
    fs.writeFileSync(dashboardUiFile, dashboardUiContent);
}

console.log('Final missing TS piece resolved');
