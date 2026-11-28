// Consecutive-failure budget for media-element reconnects. The count resets
// whenever a reconnect reaches loadedmetadata, so recoverable dead-token
// 403s (rotation kills the URL embedded in src) cannot accumulate into a
// permanent "audio unavailable" state. Only back-to-back failures exhaust it.
export class ReconnectBudget {
  private failures = 0
  private readonly maxAttempts: number

  constructor(maxAttempts: number) {
    this.maxAttempts = maxAttempts
  }

  get exhausted(): boolean {
    return this.failures >= this.maxAttempts
  }

  fail(): void {
    this.failures += 1
  }

  reset(): void {
    this.failures = 0
  }
}
