/**
 * CaptureProcessor — AudioWorklet processor for mic capture.
 *
 * Runs on the audio render thread (real-time priority). Emits Float32 frames
 * and smoothed RMS levels to the main thread via MessagePort.
 *
 * NOTE: Must be plain JS. AudioWorkletProcessor runs in an isolated global
 * scope that cannot import modules.
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._bufferCount = 0
    this._port = this.port
    // Smoothing state
    this._smoothedLevel = 0
    this._smoothingFactor = 0.4
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const channel = input[0]
    if (!channel || channel.length === 0) return true

    // Compute RMS on the audio thread (no allocation)
    let sumSquares = 0
    for (let i = 0; i < channel.length; i++) {
      sumSquares += channel[i] * channel[i]
    }
    const rms = Math.sqrt(sumSquares / channel.length)
    this._smoothedLevel =
      this._smoothingFactor * rms +
      (1 - this._smoothingFactor) * this._smoothedLevel

    // Transfer the frame buffer (zero-copy) + RMS to the main thread
    const samples = channel.slice(0)
    this._port.postMessage(
      { samples, level: this._smoothedLevel, frameCount: ++this._bufferCount },
      [samples.buffer]
    )

    return true
  }
}

registerProcessor('capture-processor', CaptureProcessor)
