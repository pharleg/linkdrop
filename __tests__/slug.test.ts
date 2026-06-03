import { describe, it, expect, vi } from 'vitest'
import { generateSlug, resolveSlug } from '@/lib/slug'

describe('generateSlug', () => {
  it('generates 6-char alphanumeric slug', () => {
    const slug = generateSlug()
    expect(slug).toMatch(/^[a-z0-9]{6}$/)
  })

  it('uses custom length', () => {
    expect(generateSlug(8)).toHaveLength(8)
  })
})

describe('resolveSlug', () => {
  it('returns base slug if not taken', async () => {
    const checkExists = vi.fn().mockResolvedValue(false)
    const result = await resolveSlug('abc123', checkExists)
    expect(result).toBe('abc123')
    expect(checkExists).toHaveBeenCalledWith('abc123')
  })

  it('appends digit if base is taken', async () => {
    const checkExists = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    const result = await resolveSlug('abc123', checkExists)
    expect(result).toMatch(/^abc123[0-9]$/)
  })

  it('returns null if base and retry both taken', async () => {
    const checkExists = vi.fn().mockResolvedValue(true)
    const result = await resolveSlug('abc123', checkExists)
    expect(result).toBeNull()
  })
})
