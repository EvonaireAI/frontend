// Owns the microphone capture lifecycle for the ritual recorder (MediaRecorder,
// media stream, and start races). The upload page previously kept the recorder
// in a ref with no unmount cleanup: navigating away mid-recording left the mic
// live, a permission prompt resolving after navigation still started capture,
// and the five-minute limit invoked a stop closure whose state check was
// captured stale, so it never fired. This class owns those handles so the
// component only mirrors UI state.
//
// `start` is async and can be superseded while awaiting permission by a newer
// start, a stop, or teardown. Each attempt gets a token; a stale attempt
// releases the stream it just acquired instead of recording with no UI.
export class RitualRecorder {
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: BlobPart[] = []
  private onBlob: ((blob: Blob) => void) | null = null
  private startToken = 0

  /** True while a recorder exists and has not been stopped. */
  get recording(): boolean {
    return this.recorder !== null && this.recorder.state !== "inactive"
  }

  /**
   * Acquires the mic and starts capture. `getStream` is injected so the
   * permission call stays at the call site and tests can stub it. Returns
   * false when this start was superseded while awaiting the stream — the
   * acquired tracks are stopped before returning so no capture begins.
   */
  async start(getStream: () => Promise<MediaStream>, onBlob: (blob: Blob) => void): Promise<boolean> {
    const token = ++this.startToken
    const stream = await getStream()
    if (token !== this.startToken) {
      stream.getTracks().forEach((track) => track.stop())
      return false
    }

    this.stopStream()
    this.stream = stream
    this.chunks = []
    this.onBlob = onBlob

    try {
      const recorder = new MediaRecorder(stream)
      this.recorder = recorder
      recorder.ondataavailable = (event) => this.chunks.push(event.data)
      recorder.onstop = () => {
        this.stopStream()
        this.onBlob?.(new Blob(this.chunks, { type: "audio/mp3" }))
      }
      recorder.start()
    } catch (err) {
      this.stopStream()
      this.recorder = null
      throw err
    }
    return true
  }

  /**
   * Ends capture if running; the assembled blob is delivered via the callback
   * from `start` once the recorder flushes. Also cancels any start still
   * awaiting permission, so a late-granted prompt cannot begin recording.
   */
  stop(): void {
    this.startToken += 1
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop()
    }
  }

  /**
   * Unmount path: cancels pending starts, stops capture, releases the mic, and
   * suppresses the blob callback (the page it belonged to is gone).
   */
  teardown(): void {
    this.onBlob = null
    this.stop()
    this.stopStream()
    this.recorder = null
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
  }
}
