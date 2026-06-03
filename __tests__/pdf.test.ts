import { describe, it, expect } from 'vitest'
import { renderSignedPDF } from '@/lib/pdf'

describe('renderSignedPDF', () => {
  it('returns a Buffer', async () => {
    const result = await renderSignedPDF({
      title: 'Test Proposal',
      body: 'This is the proposal body.',
      signerName: 'Jane Smith',
      signerEmail: 'jane@example.com',
      signedAt: '2026-06-01T12:00:00Z',
    })
    expect(Buffer.isBuffer(result)).toBe(true)
  }, 15000)

  it('produces non-empty PDF (>1KB)', async () => {
    const result = await renderSignedPDF({
      title: 'Another Proposal',
      body: 'Body text.',
      signerName: 'John Doe',
      signerEmail: 'john@example.com',
      signedAt: '2026-06-01T12:00:00Z',
    })
    expect(result.length).toBeGreaterThan(1000)
  }, 15000)
})
