"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { authService, type User, type ModerationCase } from "@/lib/auth"
import { Loader2, ArrowLeft, FileText, AlertTriangle, Clock, Filter } from "lucide-react"
import Link from "next/link"
import { CaseDetail } from "@/components/moderation/case-detail"
import { toast } from "sonner"

export default function ModerationCases() {
  const [user, setUser] = useState<User | null>(null)
  const [cases, setCases] = useState<ModerationCase[]>([])
  const [filteredCases, setFilteredCases] = useState<ModerationCase[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState<ModerationCase | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const router = useRouter()

  useEffect(() => {
    const loadUser = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }

        const userData = await authService.getProfile()
        if (!["moderator", "admin", "superadmin"].includes(userData.role)) {
          router.push("/dashboard")
          return
        }

        setUser(userData)
        await loadCases()
      } catch (err) {
        console.error("Failed to load user:", err)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [router])

  useEffect(() => {
    filterCases()
  }, [cases, statusFilter, priorityFilter])

  const loadCases = async () => {
    try {
      const moderationCases = await authService.getModerationCases()
      setCases(moderationCases)
    } catch (error) {
      console.error("Failed to load moderation cases:", error)
      toast.error("Failed to load moderation cases")
    }
  }

  const filterCases = () => {
    let filtered = cases

    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter)
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter((c) => c.severity === priorityFilter)
    }

    // Sort by severity and creation date
    filtered.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 }
      const aSeverity = severityOrder[a.severity as keyof typeof severityOrder] || 0
      const bSeverity = severityOrder[b.severity as keyof typeof severityOrder] || 0

      if (aSeverity !== bSeverity) {
        return bSeverity - aSeverity
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    setFilteredCases(filtered)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-800"
      case "assigned":
        return "bg-yellow-100 text-yellow-800"
      case "resolved":
        return "bg-green-100 text-green-800"
      case "closed":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleCaseUpdate = () => {
    loadCases()
    setSelectedCase(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (selectedCase) {
    return <CaseDetail case={selectedCase} onBack={() => setSelectedCase(null)} onUpdate={handleCaseUpdate} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button asChild variant="outline" size="sm">
            <Link href="/moderate">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Moderation Cases</h1>
            <p className="text-muted-foreground">Manage active moderation cases and reports</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Severity</label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cases List */}
        <div className="space-y-4">
          {filteredCases.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No cases found</h3>
                <p className="text-muted-foreground">
                  {statusFilter !== "all" || priorityFilter !== "all"
                    ? "Try adjusting your filters to see more cases."
                    : "All moderation cases have been resolved."}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredCases.map((moderationCase) => (
              <Card
                key={moderationCase.id}
                className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                style={{
                  borderLeftColor:
                    moderationCase.severity === "high"
                      ? "#ef4444"
                      : moderationCase.severity === "medium"
                        ? "#eab308"
                        : "#22c55e",
                }}
                onClick={() => setSelectedCase(moderationCase)}
              >
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">Case #{moderationCase.id}</h3>
                        <Badge className={getSeverityColor(moderationCase.severity)}>
                          {moderationCase.severity.toUpperCase()}
                        </Badge>
                        <Badge className={getStatusColor(moderationCase.status)}>
                          {moderationCase.status.replace("_", " ").toUpperCase()}
                        </Badge>
                      </div>

                      <h4 className="font-medium text-primary mb-2">{moderationCase.ritual_title}</h4>

                      <p className="text-muted-foreground mb-3 line-clamp-2">{moderationCase.flagged_reason}</p>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          Ritual ID: {moderationCase.ritual}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(moderationCase.created_at).toLocaleDateString()}
                        </div>
                        {moderationCase.assigned_moderator_email && (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            Assigned to {moderationCase.assigned_moderator_email}
                          </div>
                        )}
                      </div>
                    </div>

                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
