"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { rtsService, type RTSCreatorSummary } from "@/lib/rts"
import { Search, Eye } from "lucide-react"
import Link from "next/link"

interface CreatorScoreTableProps {
  creators: RTSCreatorSummary[]
}

export function CreatorScoreTable({ creators }: CreatorScoreTableProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredCreators = creators.filter(
    (creator) =>
      `${creator.user.first_name} ${creator.user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      creator.user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const sortedCreators = [...filteredCreators].sort((a, b) => a.current_score - b.current_score)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Creator RTS Scores</CardTitle>
        <CardDescription>Monitor all creator Resonance Trust Scores</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {sortedCreators.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No creators found</p>
            </div>
          ) : (
            sortedCreators.map((creator) => {
              const band = rtsService.getScoreBand(creator.current_score)
              const colorClass = rtsService.getBandColor(band)

              return (
                <div
                  key={creator.user.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-xl font-bold w-16">{creator.current_score.toFixed(0)}</div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {creator.user.first_name} {creator.user.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{creator.user.email}</p>
                    </div>
                    <Badge variant="outline" className={`${colorClass} text-xs`}>
                      {rtsService.getBandLabel(band)}
                    </Badge>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/moderate/rts/${creator.user.id}`}>
                      <Eye className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
