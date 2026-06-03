import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { renderSignedPDF } from '@/lib/pdf'
import { hashIp } from '@/lib/track'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { signer_name, signer_email, link_id, proposal_id, revision, signature_data } = body

  if (!signer_name || !signer_email || !link_id || !proposal_id || !revision || !signature_data) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: existing } = await supabase.from('signatures').select('id').eq('proposal_id', proposal_id).eq('link_id', link_id).single()
  if (existing) return NextResponse.json({ error: 'Already signed' }, { status: 409 })

  const { data: revisionData } = await supabase.from('proposal_revisions').select('body').eq('proposal_id', proposal_id).eq('revision', revision).single()
  const { data: proposal } = await supabase.from('proposals').select('title, user_id').eq('id', proposal_id).single()

  if (!revisionData || !proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

  const signedAt = new Date().toISOString()
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  const sigBuffer = Buffer.from(signature_data.replace(/^data:image\/png;base64,/, ''), 'base64')
  await supabase.storage.from('signatures').upload(`${proposal_id}/${link_id}-sig.png`, sigBuffer, { contentType: 'image/png', upsert: true })

  const pdfBuffer = await renderSignedPDF({ title: proposal.title, body: revisionData.body, signerName: signer_name, signerEmail: signer_email, signedAt })
  const pdfPath = `${proposal_id}/${link_id}-signed.pdf`
  await supabase.storage.from('signatures').upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  const { data: pdfUrlData } = await supabase.storage.from('signatures').createSignedUrl(pdfPath, 60 * 60 * 24 * 7)

  await supabase.from('signatures').insert({
    proposal_id,
    link_id,
    revision,
    signer_name,
    signer_email,
    signature_data,
    ip_hash: hashIp(ip),
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data: { user: owner } } = await supabase.auth.admin.getUserById(proposal.user_id)
  const pdfLink = pdfUrlData?.signedUrl ?? ''

  await Promise.all([
    owner?.email ? resend.emails.send({
      from: 'noreply@linkdrop.io',
      to: owner.email,
      subject: `"${proposal.title}" has been signed`,
      text: `${signer_name} (${signer_email}) signed at ${signedAt}.\n\nDownload: ${pdfLink}`,
    }) : Promise.resolve(),
    resend.emails.send({
      from: 'noreply@linkdrop.io',
      to: signer_email,
      subject: `Your signed copy of "${proposal.title}"`,
      text: `Thank you for signing. Download your copy: ${pdfLink}`,
    }),
  ])

  return NextResponse.json({ ok: true, pdf_url: pdfLink })
}
