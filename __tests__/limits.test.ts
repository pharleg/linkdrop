import { describe, it, expect } from 'vitest'
import { PLAN_LIMITS, signaturesEnabled } from '@/lib/limits'

describe('PLAN_LIMITS', () => {
  it('free: 5 links, 0 proposals', () => {
    expect(PLAN_LIMITS.free.links).toBe(5)
    expect(PLAN_LIMITS.free.proposals).toBe(0)
  })

  it('starter: 25 links, 5 proposals', () => {
    expect(PLAN_LIMITS.starter.links).toBe(25)
    expect(PLAN_LIMITS.starter.proposals).toBe(5)
  })

  it('pro: unlimited', () => {
    expect(PLAN_LIMITS.pro.links).toBe(Infinity)
    expect(PLAN_LIMITS.pro.proposals).toBe(Infinity)
  })
})

describe('signaturesEnabled', () => {
  it('disabled for free', () => expect(signaturesEnabled('free')).toBe(false))
  it('enabled for starter', () => expect(signaturesEnabled('starter')).toBe(true))
  it('enabled for pro', () => expect(signaturesEnabled('pro')).toBe(true))
})
