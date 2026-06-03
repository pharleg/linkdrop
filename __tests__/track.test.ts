import { describe, it, expect } from 'vitest'
import { hashIp, buildClickRecord } from '@/lib/track'

describe('hashIp', () => {
  it('returns 64-char hex string', () => {
    expect(hashIp('1.2.3.4')).toMatch(/^[a-f0-9]{64}$/)
  })

  it('consistent for same IP', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'))
  })

  it('different hash for different IPs', () => {
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('5.6.7.8'))
  })

  it('returns null for empty/null', () => {
    expect(hashIp(null)).toBeNull()
    expect(hashIp('')).toBeNull()
  })
})

describe('buildClickRecord', () => {
  it('hashes IP, includes required fields, no raw ip', () => {
    const record = buildClickRecord({ linkId: 'link-1', ip: '1.2.3.4', userAgent: 'Mozilla', referrer: 'https://x.com' })
    expect(record.link_id).toBe('link-1')
    expect(record.ip_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(record.user_agent).toBe('Mozilla')
    expect(record).not.toHaveProperty('ip')
  })
})
