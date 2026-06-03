import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  return createHash('sha256').update(ip).digest('hex')
}

export function buildClickRecord({
  linkId,
  ip,
  userAgent,
  referrer,
}: {
  linkId: string
  ip: string | null
  userAgent: string | null
  referrer: string | null
}) {
  return {
    link_id: linkId,
    ip_hash: hashIp(ip),
    user_agent: userAgent,
    referrer,
  }
}

export async function logClick({
  linkId,
  ip,
  userAgent,
  referrer,
}: {
  linkId: string
  ip: string | null
  userAgent: string | null
  referrer: string | null
}): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('clicks').insert(buildClickRecord({ linkId, ip, userAgent, referrer }))
}

export async function getClickCount(linkId: string): Promise<number> {
  const supabase = createServiceClient()
  const result = await supabase
    .from('clicks')
    .select('id', { count: 'exact', head: true })
    .eq('link_id', linkId)
  return result.count ?? 0
}
