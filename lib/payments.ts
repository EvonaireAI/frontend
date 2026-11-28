import { throwIfGated } from "./gateway-quiz"
import { authedFetch } from "./authed-fetch"
import { isAllowedExternalUrl } from "./external-navigation"
import { tr } from "./i18n/index.ts"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export interface PaymentConfig {
  publishable_key: string | null
  default_price_id: string | null
  provider?: string
  billing_available?: boolean
  mode?: string
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
    const response = await authedFetch(`${API_BASE_URL}/payments/config/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error(tr("Failed to fetch payment configuration"))
    }

    return response.json()
  }

  async createCheckoutSession(tierId: string): Promise<CheckoutSession> {
    // The plan code is the provider-neutral selector: the backend resolves
    // it to the configured price for whichever processor is active.
    const config = await this.getPaymentConfig()
    if (config.billing_available === false) {
      throw new Error(tr("Billing is temporarily unavailable. Please try again later."))
    }

    const response = await authedFetch(`${API_BASE_URL}/payments/checkout-session/`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan: tierId,
      }),
    })

    if (!response.ok) {
      // A gateway_incomplete 403 here throws GatewayIncompleteError (handled by
      // runGatedAction, which finishes the Gateway then retries checkout).
      const error = await throwIfGated(response)
      throw new Error(error?.detail || tr("Failed to create checkout session"))
    }

    return response.json()
  }

  async redirectToCheckout(sessionUrl: string): Promise<void> {
    if (typeof window !== "undefined") {
      if (!isAllowedExternalUrl(sessionUrl)) {
        throw new Error(tr("Refusing to navigate to an unexpected checkout URL"))
      }
      window.location.href = sessionUrl
    }
  }
}

export const paymentService = new PaymentService()
