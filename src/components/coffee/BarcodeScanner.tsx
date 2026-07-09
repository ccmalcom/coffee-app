'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser'

export function BarcodeScanner({
  onDetected,
  onError,
}: {
  onDetected: (barcode: string) => void
  onError?: (message: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    return () => {
      BrowserCodeReader.releaseAllStreams()
    }
  }, [])

  async function start() {
    setScanning(true)
    try {
      const reader = new BrowserMultiFormatReader()
      const result = await reader.decodeOnceFromVideoDevice(
        undefined,
        videoRef.current ?? undefined,
      )
      onDetected(result.getText())
    } catch (err) {
      onError?.(
        err instanceof Error
          ? err.message
          : 'Could not read a barcode from the camera.',
      )
    } finally {
      setScanning(false)
      BrowserCodeReader.releaseAllStreams()
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <video
        ref={videoRef}
        className="w-full max-w-sm rounded border border-surface-raised"
        muted
        playsInline
      />
      <button
        type="button"
        onClick={start}
        disabled={scanning}
        className="rounded bg-accent px-4 py-2 font-medium text-bg hover:bg-accent-hover disabled:opacity-50"
      >
        {scanning ? 'Scanning…' : 'Scan barcode'}
      </button>
    </div>
  )
}
