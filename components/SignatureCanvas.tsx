'use client'

import { useRef, useState } from 'react'
import ReactSignatureCanvas from 'react-signature-canvas'

interface Props {
  linkId: string
  proposalId: string
  revision: number
  slug: string
}

export default function SignatureCanvas({ linkId, proposalId, revision, slug }: Props) {
  const canvasRef = useRef<ReactSignatureCanvas>(null)
  const [useTyped, setUseTyped] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [signerName, setSignerName] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function getSignatureData(): string | null {
    if (useTyped) {
      if (!typedName.trim()) return null
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 100
      const ctx = canvas.getContext('2d')!
      ctx.font = 'italic 32px Georgia, serif'
      ctx.fillStyle = '#1a1a1a'
      ctx.fillText(typedName.trim(), 20, 60)
      return canvas.toDataURL('image/png')
    }
    if (!canvasRef.current || canvasRef.current.isEmpty()) return null
    return canvasRef.current.toDataURL('image/png')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!signerName.trim()) { setError('Name is required.'); return }
    if (!signerEmail.trim()) { setError('Email is required.'); return }
    const sig = getSignatureData()
    if (!sig) { setError(useTyped ? 'Please type your name.' : 'Please draw your signature.'); return }

    setSubmitting(true)
    const res = await fetch('/api/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signer_name: signerName,
        signer_email: signerEmail,
        link_id: linkId,
        proposal_id: proposalId,
        revision,
        signature_data: sig,
      }),
    })

    if (res.ok) {
      window.location.href = `/${slug}?signed=true`
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to submit signature.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium block mb-1">Full Name</label>
        <input
          type="text"
          value={signerName}
          onChange={e => setSignerName(e.target.value)}
          required
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Email</label>
        <input
          type="email"
          value={signerEmail}
          onChange={e => setSignerEmail(e.target.value)}
          required
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Signature</label>
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={useTyped}
              onChange={e => setUseTyped(e.target.checked)}
            />
            I prefer to type my name
          </label>
        </div>
        {useTyped ? (
          <input
            type="text"
            placeholder="Type your full name"
            value={typedName}
            onChange={e => setTypedName(e.target.value)}
            className="w-full border rounded px-3 py-2 text-2xl font-serif italic h-16"
          />
        ) : (
          <div className="border rounded bg-white">
            <ReactSignatureCanvas
              ref={canvasRef}
              penColor="#1a1a1a"
              canvasProps={{ className: 'w-full h-32', style: { touchAction: 'none' } }}
            />
            <button
              type="button"
              onClick={() => canvasRef.current?.clear()}
              className="text-xs text-gray-400 px-2 py-1 border-t w-full text-right hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-black text-white text-sm px-4 py-2 rounded disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Sign Document'}
      </button>
    </form>
  )
}
