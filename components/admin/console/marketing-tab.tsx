"use client"

import { useCallback, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buildUtmUrl } from "@/lib/funnel"
import { rateToPercentString } from "@/lib/metrics"
import {
  connectMarketingPlatform,
  disconnectMarketingPlatform,
  getMarketingDashboard,
  syncMarketingPlatform,
  type MarketingDashboard,
  type MarketingPlatform,
  type SocialPlatformKey,
} from "@/lib/marketing"
import { useMetricsZone, ZoneError, ZoneRefetchDim } from "@/components/admin/metrics/zone"

const WINDOW_OPTIONS = [7, 30, 90] as const

const FUNNEL_STAGES = [
  { key: "page_view", label: "Site visits", color: "var(--chart-3)" },
  { key: "signup_click", label: "Sign-up clicks", color: "var(--chart-1)" },
  { key: "signup_view", label: "Form opened", color: "var(--chart-2)" },
  { key: "signup_complete", label: "Registered", color: "var(--chart-4)" },
] as const

const PLATFORM_HINTS: Record<SocialPlatformKey, string> = {
  instagram:
    "Graph API token (instagram_basic, instagram_manage_insights) for a Business or Creator account linked to a Page.",
  x: "X API v2 Bearer or user OAuth2 token. User-context tokens unlock url_link_clicks on owned posts.",
  bluesky:
    "AT Protocol handle (e.g. evonaire.bsky.social). App password optional; engagement is public, while views and clicks are tracked via UTM links.",
}

function rate(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : rateToPercentString(value)
}

function metricCount(value: number | null | undefined, supported = true): string {
  if (!supported) return "UTM only"
  return value === null || value === undefined ? "—" : value.toLocaleString()
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/50 px-4 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}

function Funnel({ data }: { data: MarketingDashboard }) {
  const max = Math.max(...FUNNEL_STAGES.map((s) => data.sessions[s.key]), 0)
  return (
    <div className="space-y-3">
      {FUNNEL_STAGES.map((stage) => {
        const count = data.sessions[stage.key] ?? 0
        const widthPct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 2 : 0) : 0
        return (
          <div key={stage.key}>
            <div className="flex items-baseline justify-between text-sm mb-1">
              <span className="text-foreground">{stage.label}</span>
              <span className="text-muted-foreground tabular-nums">{count.toLocaleString()} sessions</span>
            </div>
            <div className="h-6">
              <div className="h-full rounded-r" style={{ width: `${widthPct}%`, backgroundColor: stage.color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PlatformConnectionCard({
  platform,
  onChanged,
}: {
  platform: MarketingPlatform
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [handle, setHandle] = useState(platform.account_handle || "")
  const [externalId, setExternalId] = useState(platform.external_account_id || "")
  const [token, setToken] = useState("")
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const openEditor = () => {
    setHandle(platform.account_handle || "")
    setExternalId(platform.external_account_id || "")
    setToken("")
    setActionError(null)
    setEditing(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setActionError(null)
    try {
      await connectMarketingPlatform(platform.platform, {
        account_handle: handle,
        external_account_id: externalId,
        access_token: token,
        sync_now: true,
      })
      setToken("")
      setEditing(false)
      onChanged()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save platform credentials")
    } finally {
      setBusy(false)
    }
  }

  const handleSync = async () => {
    setBusy(true)
    setActionError(null)
    try {
      await syncMarketingPlatform(platform.platform)
      onChanged()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to sync platform")
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    setBusy(true)
    setActionError(null)
    try {
      await disconnectMarketingPlatform(platform.platform)
      setEditing(false)
      onChanged()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to disconnect platform")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{platform.label}</h3>
            <Badge variant={platform.connected ? "default" : "outline"}>
              {platform.connected ? "Connected" : "Not connected"}
            </Badge>
            {platform.has_token && platform.token_preview && (
              <span className="text-xs font-mono text-muted-foreground">{platform.token_preview}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {platform.account_handle
              ? `Account: ${platform.account_handle}`
              : PLATFORM_HINTS[platform.platform]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {platform.connected && (
            <Button variant="outline" size="sm" disabled={busy} onClick={handleSync}>
              Sync now
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={busy} onClick={editing ? () => setEditing(false) : openEditor}>
            {editing ? "Cancel" : platform.connected ? "Update token" : "Sign in with token"}
          </Button>
          {platform.connected && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={handleDisconnect}>
              Disconnect
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
        <div className="rounded bg-secondary/40 px-2.5 py-1.5">
          <p className="text-muted-foreground">Impressions</p>
          <p className="font-semibold text-foreground tabular-nums">
            {metricCount(platform.impressions, platform.supports_impressions)}
          </p>
        </div>
        <div className="rounded bg-secondary/40 px-2.5 py-1.5">
          <p className="text-muted-foreground">Platform clicks</p>
          <p className="font-semibold text-foreground tabular-nums">
            {metricCount(platform.platform_clicks, platform.supports_clicks)}
          </p>
        </div>
        <div className="rounded bg-secondary/40 px-2.5 py-1.5">
          <p className="text-muted-foreground">Engagements</p>
          <p className="font-semibold text-foreground tabular-nums">{metricCount(platform.engagements)}</p>
        </div>
        <div className="rounded bg-secondary/40 px-2.5 py-1.5">
          <p className="text-muted-foreground">Followers</p>
          <p className="font-semibold text-foreground tabular-nums">{metricCount(platform.followers)}</p>
        </div>
        <div className="rounded bg-secondary/40 px-2.5 py-1.5">
          <p className="text-muted-foreground">UTM site visits</p>
          <p className="font-semibold text-foreground tabular-nums">{platform.utm_visits.toLocaleString()}</p>
        </div>
        <div className="rounded bg-secondary/40 px-2.5 py-1.5">
          <p className="text-muted-foreground">UTM signups</p>
          <p className="font-semibold text-foreground tabular-nums">
            {platform.utm_signups.toLocaleString()} ({rate(platform.utm_conversion_rate)})
          </p>
        </div>
      </div>

      {platform.last_sync_error && (
        <p className="text-xs text-destructive">{platform.last_sync_error}</p>
      )}
      {actionError && (
        <p className="text-xs text-destructive">{actionError}</p>
      )}

      {editing && (
        <form onSubmit={handleSave} className="grid gap-3 pt-2 border-t border-border sm:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Account handle</label>
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder={platform.platform === "bluesky" ? "evonaire.bsky.social" : "@evonaire"}
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              {platform.requires_token ? "API access token" : "App password or token (optional)"}
            </label>
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={platform.has_token ? "Leave blank to keep current token" : "Paste token"}
              required={platform.requires_token && !platform.has_token}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Account / Page ID (optional)</label>
            <div className="flex gap-2">
              <Input
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="IG user ID or DID"
              />
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Saving…" : "Save & sync"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

function SocialPlatformsSection({
  data,
  onChanged,
}: {
  data: MarketingDashboard
  onChanged: () => void
}) {
  const platforms = data.platforms ?? []
  if (platforms.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Social platform connections</CardTitle>
        <CardDescription>
          Sign in with your Instagram, X, and Bluesky tokens to pull top-of-funnel post metrics alongside UTM site
          conversions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {platforms.map((platform) => (
          <PlatformConnectionCard key={platform.platform} platform={platform} onChanged={onChanged} />
        ))}
      </CardContent>
    </Card>
  )
}

function UtmLinkBuilder() {
  const [source, setSource] = useState<SocialPlatformKey>("instagram")
  const [medium, setMedium] = useState("social")
  const [campaign, setCampaign] = useState("creator_outreach")
  const [copied, setCopied] = useState(false)

  const origin = typeof window !== "undefined" ? window.location.origin : "https://evonaire.ai"
  const taggedUrl = buildUtmUrl(origin, {
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign,
  })

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(taggedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked
    }
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Campaign link builder</p>
          <p className="text-xs text-muted-foreground">
            Tag every social or group post so visits, drop-off, and signups attribute back to the exact post.
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={source}
          onValueChange={(v) => v && setSource(v as SocialPlatformKey)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="instagram">Instagram</ToggleGroupItem>
          <ToggleGroupItem value="x">X</ToggleGroupItem>
          <ToggleGroupItem value="bluesky">Bluesky</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          value={medium}
          onChange={(e) => setMedium(e.target.value)}
          placeholder="utm_medium (e.g. social, group)"
        />
        <Input
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          placeholder="utm_campaign (e.g. yoga_creators)"
        />
        <div className="flex gap-2">
          <Input value={taggedUrl} readOnly className="font-mono text-xs" />
          <Button type="button" variant="outline" size="sm" onClick={copyLink}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function SourcesTable({ data }: { data: MarketingDashboard }) {
  if (data.sources.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Traffic sources</CardTitle>
        <CardDescription>Unique sessions by utm_source; blank tags land under direct.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Visits</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Form opens</TableHead>
              <TableHead className="text-right">Signups</TableHead>
              <TableHead className="text-right">Conversion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.sources.map((s) => (
              <TableRow key={s.utm_source}>
                <TableCell className="font-medium">{s.utm_source}</TableCell>
                <TableCell className="text-right tabular-nums">{s.visits.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{s.clicks.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{s.form_views.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{s.signups.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{rate(s.conversion_rate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function CampaignsSection({ data }: { data: MarketingDashboard }) {
  const campaigns = data.campaigns ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Post and campaign attribution</CardTitle>
        <CardDescription>
          Conversion and form drop-off per tagged post or group share (utm_campaign).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <UtmLinkBuilder />
        {campaigns.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign / Post</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Medium</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Form opens</TableHead>
                <TableHead className="text-right">Signups</TableHead>
                <TableHead className="text-right">Drop-off</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={`${c.utm_campaign}-${c.utm_source}-${c.utm_medium}`}>
                  <TableCell className="font-medium">{c.utm_campaign}</TableCell>
                  <TableCell>{c.utm_source}</TableCell>
                  <TableCell className="text-muted-foreground">{c.utm_medium || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.visits.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.clicks.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.form_views.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.signups.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{rate(c.drop_off_rate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{rate(c.conversion_rate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-xs text-muted-foreground">
            No campaign-tagged visits in this window yet. Copy a link above when posting to Instagram, X, or Bluesky.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function MarketingTab() {
  const [days, setDays] = useState<number>(30)

  const fetcher = useCallback(() => getMarketingDashboard(days), [days])
  const { data, loading, error, retry } = useMetricsZone(fetcher)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Marketing funnel</h2>
          <p className="text-sm text-muted-foreground">
            Anonymous visit sessions through registration, social platform token sync, and post attribution.
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={String(days)}
          onValueChange={(v) => v && setDays(Number(v))}
          variant="outline"
          size="sm"
        >
          {WINDOW_OPTIONS.map((d) => (
            <ToggleGroupItem key={d} value={String(d)}>
              {d}d
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {error && <ZoneError label="the marketing funnel" onRetry={retry} />}

      {loading && !data && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {data && (
        <ZoneRefetchDim dimmed={loading}>
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatChip label="Visits" value={data.sessions.page_view.toLocaleString()} />
              <StatChip label="Click-through" value={rate(data.rates.click_through)} />
              <StatChip label="Form completion" value={rate(data.rates.form_completion)} />
              <StatChip label="Form drop-off" value={rate(data.rates.form_drop_off)} />
              <StatChip label="Visit to signup" value={rate(data.rates.visit_to_signup)} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acquisition funnel</CardTitle>
                <CardDescription>
                  Unique sessions per stage over the last {data.window_days} days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Funnel data={data} />
              </CardContent>
            </Card>
            <SocialPlatformsSection data={data} onChanged={retry} />
            <CampaignsSection data={data} />
            <SourcesTable data={data} />
          </div>
        </ZoneRefetchDim>
      )}
    </div>
  )
}
