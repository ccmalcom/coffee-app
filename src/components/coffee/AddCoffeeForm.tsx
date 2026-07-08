'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addCoffeeFromListing,
  addCoffeeFromBarcode,
  confirmBarcodeCoffee,
} from '@/lib/actions/coffee'
import { BarcodeScanner } from './BarcodeScanner'

type Mode = 'paste' | 'scan'
type BarcodeState =
  | { step: 'idle' }
  | { step: 'catalog_hit'; coffeeName: string; roasterName: string; coffeeId: string }
  | { step: 'off_hit'; barcode: string; productName: string; brand: string | null }
  | { step: 'not_found'; barcode: string }

export function AddCoffeeForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('paste')
  const [rawText, setRawText] = useState('')
  const [listingUrl, setListingUrl] = useState('')
  const [barcodeState, setBarcodeState] = useState<BarcodeState>({ step: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handlePasteSubmit() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await addCoffeeFromListing({ rawText, listingUrl: listingUrl || undefined })
        router.push(`/coffee/${result.coffeeId}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  function handleBarcodeDetected(barcode: string) {
    startTransition(async () => {
      const result = await addCoffeeFromBarcode(barcode)
      if (result.source === 'catalog') {
        setBarcodeState({
          step: 'catalog_hit',
          coffeeName: result.coffeeName,
          roasterName: result.roasterName,
          coffeeId: result.coffeeId,
        })
      } else if (result.source === 'open_food_facts') {
        setBarcodeState({
          step: 'off_hit',
          barcode,
          productName: result.productName,
          brand: result.brand,
        })
      } else {
        setBarcodeState({ step: 'not_found', barcode })
      }
    })
  }

  function handleConfirmAfterScan(barcode: string) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await confirmBarcodeCoffee(barcode, rawText)
        router.push(`/coffee/${result.coffeeId}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('paste')}
          className={`px-3 py-1 rounded ${mode === 'paste' ? 'bg-black text-white' : 'bg-gray-200'}`}
        >
          Paste / URL
        </button>
        <button
          type="button"
          onClick={() => setMode('scan')}
          className={`px-3 py-1 rounded ${mode === 'scan' ? 'bg-black text-white' : 'bg-gray-200'}`}
        >
          Scan barcode
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {mode === 'paste' && (
        <div className="flex flex-col gap-3">
          <input
            value={listingUrl}
            onChange={(e) => setListingUrl(e.target.value)}
            placeholder="Listing URL (optional)"
            className="border rounded p-2"
          />
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste the listing text here"
            rows={8}
            className="border rounded p-2"
          />
          <button
            type="button"
            onClick={handlePasteSubmit}
            disabled={isPending || rawText.trim().length === 0}
            className="bg-black text-white rounded p-2 disabled:opacity-50"
          >
            {isPending ? 'Adding…' : 'Add coffee'}
          </button>
        </div>
      )}

      {mode === 'scan' && (
        <div className="flex flex-col gap-4">
          {barcodeState.step === 'idle' && (
            <BarcodeScanner onDetected={handleBarcodeDetected} onError={setError} />
          )}

          {barcodeState.step === 'catalog_hit' && (
            <div className="border rounded p-4">
              <p className="font-medium">You&apos;ve had this — {barcodeState.roasterName}</p>
              <p>{barcodeState.coffeeName}</p>
              <button
                type="button"
                onClick={() => router.push(`/coffee/${barcodeState.coffeeId}`)}
                className="mt-3 bg-black text-white rounded px-3 py-2"
              >
                View / rate again
              </button>
            </div>
          )}

          {(barcodeState.step === 'off_hit' || barcodeState.step === 'not_found') && (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                {barcodeState.step === 'off_hit'
                  ? `Found "${barcodeState.productName}"${barcodeState.brand ? ` (${barcodeState.brand})` : ''} in the open product database — specialty roasters rarely have full tasting notes there. Paste the bag's full listing text below to get proper flavor/process details.`
                  : "New barcode — not in our catalog or the open product database. Paste the listing text or snap the bag's info below."}
              </p>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste the listing text (or type what's on the bag)"
                rows={8}
                className="border rounded p-2"
              />
              <button
                type="button"
                onClick={() => handleConfirmAfterScan(barcodeState.barcode)}
                disabled={isPending || rawText.trim().length === 0}
                className="bg-black text-white rounded p-2 disabled:opacity-50"
              >
                {isPending ? 'Adding…' : 'Add coffee'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
