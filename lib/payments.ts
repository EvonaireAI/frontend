const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

const TIER_PRICE_MAP: Record<string, string> = {
  evocore:  process.env.NEXT_PUBLIC_STRIPE_PRICE_EVOCORE  || "price_1SOkvQPQ0i07tXXWqL2ucrSf",
  evobloom: process.env.NEXT_PUBLIC_STRIPE_PRICE_EVOBLOOM || "price_1SOkguPQ0i07tXXW85W3BCmJ",
  evoluxe:  process.env.NEXT_PUBLIC_STRIPE_PRICE_EVOLUXE  || "price_1SOkvQPQ0i07tXXWFISgGgtr",
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

class PaymentService {
  private getAuthHeaders(): Record<string, string> {
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
