import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import React from 'react'

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, color: '#1a1a1a', lineHeight: 1.6 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 24 },
  body: { marginBottom: 32 },
  hr: { borderBottom: '1pt solid #e5e5e5', marginBottom: 16 },
  sigLabel: { fontSize: 9, color: '#737373', marginBottom: 4 },
  sigValue: { fontSize: 11 },
  sigRow: { marginBottom: 8 },
})

export async function renderSignedPDF({
  title,
  body,
  signerName,
  signerEmail,
  signedAt,
}: {
  title: string
  body: string
  signerName: string
  signerEmail: string
  signedAt: string
}): Promise<Buffer> {
  const doc = React.createElement(
    Document,
    {},
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.title }, title),
      React.createElement(Text, { style: styles.body }, body),
      React.createElement(View, { style: styles.hr }),
      React.createElement(View, { style: styles.sigRow },
        React.createElement(Text, { style: styles.sigLabel }, 'Signed by'),
        React.createElement(Text, { style: styles.sigValue }, signerName),
      ),
      React.createElement(View, { style: styles.sigRow },
        React.createElement(Text, { style: styles.sigLabel }, 'Email'),
        React.createElement(Text, { style: styles.sigValue }, signerEmail),
      ),
      React.createElement(View, { style: styles.sigRow },
        React.createElement(Text, { style: styles.sigLabel }, 'Signed at'),
        React.createElement(Text, { style: styles.sigValue }, signedAt),
      ),
    )
  )

  const buffer = await renderToBuffer(doc)
  return Buffer.from(buffer)
}
