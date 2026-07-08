import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Music, Check } from "lucide-react"
import { formatPrice, type Listing } from "@/lib/commons"
import { LicenseChip, EarlyAccessBadge } from "./listing-chips"

// Browse-grid card. Links to the detail page; no sales-pressure mechanics.
export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link href={`/commons/listings/${listing.id}`} className="group block">
      <Card className="h-full bg-card border-border transition-colors group-hover:border-primary/50">
        <CardContent className="p-5 flex flex-col h-full gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <LicenseChip level={listing.license_level} />
            {listing.early_access && <EarlyAccessBadge earlyAccess={listing.early_access} />}
            {listing.has_access && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs gap-1">
                <Check className="w-3 h-3" />
                In your library
              </Badge>
            )}
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
              {listing.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{listing.summary}</p>
          </div>

          {listing.ritual && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Music className="w-3.5 h-3.5" />
              <span className="truncate">{listing.ritual.title}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-border/60">
            <span className="text-sm text-muted-foreground truncate">
              {listing.creator.display_name}
            </span>
            <span className="text-base font-semibold text-foreground">
              {formatPrice(listing.price_cents, listing.currency)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
