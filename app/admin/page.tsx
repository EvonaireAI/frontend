"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authService, type RoleRequest, type User } from "@/lib/auth"
import { ConfigForm } from "@/components/rts/config-form"
import { Loader2, Check, X, ArrowLeft, Users, Settings } from "lucide-react"
import Link from "next/link"

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("role-requests")
  const router = useRouter()

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }

        const userData = await authService.getProfile()
        if (userData.role !== "admin") {
          router.push("/dashboard")
          return
        }

        setUser(userData)
        const requests = await authService.getRoleRequests()
        setRoleRequests(requests)
      } catch (err) {
        console.error("Failed to load data:", err)
        setError("Failed to load admin data")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const handleApprove = async (id: number) => {
    setActionLoading(id)
    try {
      await authService.approveRoleRequest(id)
      setRoleRequests((prev) => prev.filter((req) => req.id !== id))
    } catch (err) {
      setError("Failed to approve request")
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id: number) => {
    setActionLoading(id)
    try {
      await authService.rejectRoleRequest(id)
      setRoleRequests((prev) => prev.filter((req) => req.id !== id))
    } catch (err) {
      setError("Failed to reject request")
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user || user.role !== "admin") {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="role-requests" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="role-requests" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Role Requests
            </TabsTrigger>
            <TabsTrigger value="rts-config" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              RTS Config
            </TabsTrigger>
          </TabsList>

          <TabsContent value="role-requests">
            <Card>
              <CardHeader>
                <CardTitle>Pending Role Requests</CardTitle>
                <CardDescription>Review and approve or reject requests for elevated roles</CardDescription>
              </CardHeader>
              <CardContent>
                {roleRequests.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No pending role requests</p>
                ) : (
                  <div className="space-y-4">
                    {roleRequests.map((request) => (
                      <div key={request.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-4">
                            <Avatar>
                              <AvatarImage src={request.user.profile_picture || "/placeholder.svg"} />
                              <AvatarFallback>
                                {request.user.first_name[0]}
                                {request.user.last_name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold">
                                {request.user.first_name} {request.user.last_name}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{request.user.email}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge variant="outline">Current: {request.user.role}</Badge>
                                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  Requesting: {request.requested_role}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(request.id)}
                              disabled={actionLoading === request.id}
                            >
                              {actionLoading === request.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(request.id)}
                              disabled={actionLoading === request.id}
                            >
                              {actionLoading === request.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                              Reject
                            </Button>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Reason:</h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded">
                            {request.reason}
                          </p>
                        </div>
                        <div className="text-xs text-gray-500">
                          Requested on {new Date(request.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rts-config">
            <ConfigForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
