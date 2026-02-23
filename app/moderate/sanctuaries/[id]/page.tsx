"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { authService, type User } from "@/lib/auth"
import {
  sanctuariesService,
  type Sanctuary,
  type Membership,
  type RitualAssignment,
  type AuditLogEntry,
} from "@/lib/sanctuaries"
import { MembersTable } from "@/components/sanctuaries/members-table"
import { RitualAssignments } from "@/components/sanctuaries/ritual-assignments"
import { AuditLog } from "@/components/sanctuaries/audit-log"
import { Loader2, ArrowLeft, Users } from "lucide-react"
import Link from "next/link"

export default function SanctuaryAuditPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sanctuary, setSanctuary] = useState<Sanctuary | null>(null)
  const [members, setMembers] = useState<Membership[]>([])
  const [rituals, setRituals] = useState<RitualAssignment[]>([])
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const router = useRouter()
  const params = useParams()
  const sanctuaryId = Number.parseInt(params.id as string)

  useEffect(() => {
    const loadData = async () => {
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
        await loadSanctuaryData()
      } catch (err) {
        console.error("Failed to load data:", err)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const loadSanctuaryData = async () => {
    setDataLoading(true)
    try {
      const [sanctuaryData, membersData, ritualsData, auditData] = await Promise.all([
        sanctuariesService.getSanctuaryDetail(sanctuaryId),
        sanctuariesService.getApprovedMembers(sanctuaryId),
        sanctuariesService.getAssignedRituals(sanctuaryId),
        sanctuariesService.getAuditLog(sanctuaryId),
      ])

      setSanctuary(sanctuaryData)
      setMembers(membersData)
      setRituals(ritualsData)
      setAuditLog(auditData)
    } catch (err) {
      console.error("Failed to load sanctuary data:", err)
    } finally {
      setDataLoading(false)
    }
  }

  const handleRevokeMembership = async (membershipId: number, reason?: string) => {
    try {
      await sanctuariesService.revokeMembership(sanctuaryId, membershipId, { note: reason })
      await loadSanctuaryData()
    } catch (err) {
      console.error("Failed to revoke membership:", err)
    }
  }

  const handleRemoveRitual = async (ritualId: number) => {
    try {
      await sanctuariesService.removeRitualAssignment(sanctuaryId, ritualId)
      await loadSanctuaryData()
    } catch (err) {
      console.error("Failed to remove ritual:", err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!sanctuary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">Sanctuary not found</p>
            <Button asChild>
              <Link href="/moderate">Back to Guardian Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button asChild variant="outline" className="mb-4 bg-transparent">
            <Link href="/moderate">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Guardian Dashboard
            </Link>
          </Button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">{sanctuary.title}</h1>
              <p className="text-muted-foreground">{sanctuary.description}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="capitalize">
                {sanctuary.status}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Privacy</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="capitalize">
                {sanctuary.privacy}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {sanctuary.active_members_count}/{sanctuary.capacity}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Open Join</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{sanctuary.allow_open_join ? "Enabled" : "Disabled"}</Badge>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="members" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="rituals">Rituals</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <MembersTable
              members={members}
              loading={dataLoading}
              onRevoke={handleRevokeMembership}
              onRefresh={loadSanctuaryData}
            />
          </TabsContent>

          <TabsContent value="rituals">
            <RitualAssignments
              rituals={rituals}
              loading={dataLoading}
              onRemove={handleRemoveRitual}
              onRefresh={loadSanctuaryData}
            />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLog entries={auditLog} loading={dataLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
