"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { authService } from "@/lib/auth"
import {
  listeningService,
  ListeningForbiddenError,
  currentUtcPeriod,
  periodLabel,
  shiftPeriod,
  fillMonth,
  type CreatorListening,
  type ListeningDay,
} from "@/lib/listening"
import { Loader2, ChevronLeft, ChevronRight, Clock, Users, Headphones, RefreshCw, Moon } from "lucide-react"

interface DayPoint extends ListeningDay {
  day: number
}

function formatMinutes(minutes: number): string {
  return minutes.toLocaleString("en-US", { maximumFractionDigits: 1 })
}

function DayTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DayPoint }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const rows: Array<[string, string]> = [
    ["Qualified minutes", formatMinutes(p.qualified_minutes)],
    ["Unique listeners", String(p.unique_listeners)],
    ["Sessions", String(p.sessions)],
  ]
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{p.date}</p>
      <div className="mt-1 space-y-0.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-6">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CreatorListeningPage() {
  const [authChecked, setAuthChecked] = useState(false)
  const [period, setPeriod] = useState(currentUtcPeriod)
  const [data, setData] = useState<CreatorListening | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAccess = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }
        const userData = await authService.getProfile()
        if (userData.role !== "creator") {
          router.push("/dashboard")
          return
        }
        setAuthChecked(true)
      } catch (err) {
        console.error("Failed to verify access:", err)
        router.push("/auth/login")
      }
    }
    checkAccess()
  }, [router])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await listeningService.getCreatorListening(period))
    } catch (err) {
      if (err instanceof ListeningForbiddenError) {
        router.replace("/dashboard")
        return
      }
      console.error("Failed to load listening analytics:", err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [period, router])

  useEffect(() => {
    if (authChecked) load()
  }, [authChecked, load])

  const isCurrentMonth = period >= currentUtcPeriod()

  const points = useMemo<DayPoint[]>(() => {
    if (!data) return []
    return fillMonth(data.period, data.by_day).map((d) => ({
      ...d,
      day: Number(d.date.slice(8, 10)),
    }))
  }, [data])

  const hasData = data !== null && (data.totals.sessions > 0 || data.by_ritual.length > 0)

  if (!authChecked || (loading && !data)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 lg:py-12 max-w-5xl">
          {!authChecked ? (
            <div className="min-h-[50vh] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              <Skeleton className="h-9 w-64" />
              <div className="grid gap-4 md:grid-cols-3">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
              </div>
              <Skeleton className="h-[300px]" />
              <Skeleton className="h-[240px]" />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12 max-w-5xl">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Your Listening</h1>
            <p className="text-muted-foreground mt-1">
              How members spend time with your rituals. Aggregate minutes only — updated nightly.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
              aria-label="Previous month"
              className="bg-transparent border-border"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium text-foreground min-w-[8.5rem] text-center tabular-nums">
              {periodLabel(period)}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
              disabled={isCurrentMonth}
              aria-label="Next month"
              className="bg-transparent border-border"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
              <span>Failed to load your listening analytics.</span>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {data && !hasData && !error && (
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center">
              <Headphones className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No qualified listening yet
              </h3>
              <p className="text-muted-foreground">
                Minutes appear the day after members listen.
              </p>
            </CardContent>
          </Card>
        )}

        {data && hasData && (
          <div className={loading ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
            <div className="grid gap-4 md:grid-cols-3 mb-8">
              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Qualified Minutes</CardTitle>
                  <Clock className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {formatMinutes(data.totals.qualified_minutes)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Your royalties are based on these</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Unique Listeners</CardTitle>
                  <Users className="h-4 w-4 text-gold-light" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gold-light">{data.totals.unique_listeners}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Sessions</CardTitle>
                  <Headphones className="h-4 w-4 text-gold-muted" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gold-muted">{data.totals.sessions}</div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card border-border mb-8">
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-foreground">Qualified minutes by day</CardTitle>
                    <CardDescription>
                      {isCurrentMonth
                        ? "Updated nightly — today's listening appears tomorrow"
                        : "Updated nightly"}
                    </CardDescription>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Moon className="w-3.5 h-3.5" />
                    Updated nightly
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{ qualified_minutes: { label: "Qualified minutes", color: "var(--chart-1)" } }}
                  className="aspect-auto h-[260px] w-full"
                >
                  <BarChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeWidth={1} />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} interval={2} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={(v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                    />
                    <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<DayTooltip />} />
                    <Bar dataKey="qualified_minutes" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">By ritual</CardTitle>
                <CardDescription>Where your qualified minutes came from this month</CardDescription>
              </CardHeader>
              <CardContent>
                {data.by_ritual.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    No qualified listening for individual rituals this month.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ritual</TableHead>
                        <TableHead className="text-right">Qualified minutes</TableHead>
                        <TableHead className="text-right">Unique listeners</TableHead>
                        <TableHead className="text-right">Sessions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.by_ritual.map((r) => (
                        <TableRow key={r.ritual_id}>
                          <TableCell className="font-medium text-foreground">{r.ritual_title}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMinutes(r.qualified_minutes)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.unique_listeners}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.sessions}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
