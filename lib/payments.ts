const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

const TIER_PRICE_MAP: Record<string, string> = {
  evocore: "price_1SOkvQPQ0i07tXXWqL2ucrSf", // Update this with your actual price ID from Stripe
  evobloom: "price_1SOkguPQ0i07tXXW85W3BCmJ", // Update this with your actual price ID from Stripe
  eivoluxe: "price_1SOkvQPQ0i07tXXWFISgGgtr", // Update this with your actual price ID from Stripe
}

export interface PaymentConfig {
  publishable_key: string
  default_price_id: string
}

export interface CheckoutSession {
  client_secret?: string
  session_id?: string
  session_url?: string
}

export interface PaymentTier {
  id: string
  name: string
  price: number
  description: string
  features: string[]
}

export const PREMIUM_TIERS: PaymentTier[] = [
  {
    id: "evocore",
    name: "EVOcore",
    price: 11,
    description: "Perfect for beginners",
    features: ["Basic access to all sanctuaries", "Monthly ritual recommendations", "Community support"],
  },
  {
    id: "evobloom",
    name: "EVObloom",
    price: 22,
    description: "Our most popular plan",
    features: ["Everything in EVOcore", "Advanced ritual tracking", "Personal wellness insights", "Priority support"],
  },
  {
    id: "evioluxe",
    name: "EVOluxe",
    price: 33,
    description: "For the dedicated practitioner",
    features: [
      "Everything in EVObloom",
      "1-on-1 coaching sessions",
      "Custom ritual creation",
      "VIP community access",
      "Quarterly wellness reports",
    ],
  },
]

class PaymentService {
  private getAuthHeaders() {
    const token = localStorage.getItem("access_token")
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async getPaymentConfig(): Promise<PaymentConfig> {
    const response = await fetch(`${API_BASE_URL}/payments/config/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch payment configuration")
    }

    return response.json()
  }

  async createCheckoutSession(tierId: string): Promise<CheckoutSession> {
    const priceId = TIER_PRICE_MAP[tierId]
    const config = await this.getPaymentConfig()
    const finalPriceId = priceId || config.default_price_id

    const response = await fetch(`${API_BASE_URL}/payments/checkout-session/`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_id: finalPriceId,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to create checkout session")
    }

    return response.json()
  }

  async redirectToCheckout(sessionUrl: string): Promise<void> {
    if (typeof window !== "undefined") {
      window.location.href = sessionUrl
    }
  }
}

export const paymentService = new PaymentService()
