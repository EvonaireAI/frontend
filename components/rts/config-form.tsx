"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { rtsService, type RTSConfig } from "@/lib/rts"
import { Loader2, Settings } from "lucide-react"
import { toast } from "sonner"

export function ConfigForm() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [config, setConfig] = useState<RTSConfig | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const data = await rtsService.getConfig()
      setConfig(data)
    } catch (error) {
      console.error("Failed to load config:", error)
      toast.error("Failed to load RTS configuration")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!config) return

    setSubmitting(true)

    try {
      const updated = await rtsService.updateConfig(config.id, {
        weights: config.weights,
        decay_half_life_hours: config.decay_half_life_hours,
        threshold_expand: config.threshold_expand,
        threshold_clear: config.threshold_clear,
        threshold_caution: config.threshold_caution,
        threshold_pause: config.threshold_pause,
      })
      setConfig(updated)
      toast.success("RTS configuration updated successfully")
    } catch (error) {
      console.error("Failed to update config:", error)
      toast.error("Failed to update RTS configuration")
    } finally {
      setSubmitting(false)
    }
  }

  const updateWeight = (key: string, value: number) => {
    if (!config) return
    setConfig({
      ...config,
      weights: {
        ...config.weights,
        [key]: value,
      },
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          <p>Failed to load configuration</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          RTS Configuration
        </CardTitle>
        <CardDescription>Configure weights, thresholds, and decay settings for the RTS system</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Signal Weights</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(config.weights).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`weight_${key}`} className="capitalize">
                    {key.replace(/_/g, " ")} Weight
                  </Label>
                  <Input
                    id={`weight_${key}`}
                    type="number"
                    step="0.01"
                    value={value}
                    onChange={(e) => updateWeight(key, Number.parseFloat(e.target.value))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Thresholds</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="threshold_expand">Expand Threshold (≥)</Label>
                <Input
                  id="threshold_expand"
                  type="number"
                  step="0.1"
                  value={config.threshold_expand}
                  onChange={(e) => setConfig({ ...config, threshold_expand: Number.parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold_clear">Clear Threshold (≥)</Label>
                <Input
                  id="threshold_clear"
                  type="number"
                  step="0.1"
                  value={config.threshold_clear}
                  onChange={(e) => setConfig({ ...config, threshold_clear: Number.parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold_caution">Check-In Threshold (≥)</Label>
                <Input
                  id="threshold_caution"
                  type="number"
                  step="0.1"
                  value={config.threshold_caution}
                  onChange={(e) => setConfig({ ...config, threshold_caution: Number.parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold_pause">Caution Threshold (≥)</Label>
                <Input
                  id="threshold_pause"
                  type="number"
                  step="0.1"
                  value={config.threshold_pause}
                  onChange={(e) => setConfig({ ...config, threshold_pause: Number.parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="decay_half_life_hours">Time Decay (hours)</Label>
            <Input
              id="decay_half_life_hours"
              type="number"
              step="0.1"
              value={config.decay_half_life_hours}
              onChange={(e) => setConfig({ ...config, decay_half_life_hours: Number.parseFloat(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">Number of hours for signal decay half-life</p>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating Configuration...
              </>
            ) : (
              "Update Configuration"
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Last updated: {new Date(config.updated_at).toLocaleString()}
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
