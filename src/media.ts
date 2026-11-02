// Photos and voice, prepared in the phone before sending them to the AI.

const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).split(',')[1])
  r.onerror = () => reject(r.error)
  r.readAsDataURL(blob)
})

/** A phone photo is ~4 MB; at 1600 px it's ~300 KB and the AI reads a timetable just as well. */
export async function photoToJpeg(file: File, max = 1600) {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo leer la foto'))), 'image/jpeg', 0.85))
  return { mime: 'image/jpeg', data: await toBase64(blob), url: URL.createObjectURL(blob) }
}

export const MAX_SECONDS = 60

/**
 * Records from the microphone. The iPhone records in its own format (mp4/AAC), which the AI doesn't
 * always accept, so stop() turns it into a small WAV (16 kHz mono, ~32 KB per second) that it always does.
 */
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const rec = new MediaRecorder(stream)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => chunks.push(e.data)
  rec.start()
  return {
    async stop() {
      await new Promise<void>((resolve) => { rec.onstop = () => resolve(); rec.stop() })
      stream.getTracks().forEach((t) => t.stop())
      const wav = await toWav(new Blob(chunks, { type: rec.mimeType }))
      return { mime: 'audio/wav', data: await toBase64(wav) }
    },
    cancel() {
      rec.stop()
      stream.getTracks().forEach((t) => t.stop())
    },
  }
}

async function toWav(blob: Blob, rate = 16_000) {
  const ctx = new AudioContext()
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  ctx.close()
  const seconds = Math.min(decoded.duration, MAX_SECONDS)
  // Re-sampling to 16 kHz mono: plenty for speech and 3× smaller than the original rate.
  const off = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate)
  const src = off.createBufferSource()
  src.buffer = decoded
  src.connect(off.destination)
  src.start()
  const pcm = (await off.startRendering()).getChannelData(0)

  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2))
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => out.setUint8(at + i, c.charCodeAt(0)))
  ascii(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); ascii(8, 'WAVE')
  ascii(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true)
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true)
  ascii(36, 'data'); out.setUint32(40, pcm.length * 2, true)
  pcm.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true))
  return new Blob([out], { type: 'audio/wav' })
}
