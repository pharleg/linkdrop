'use client'

import { useState } from 'react'

interface Markup {
  id: string
  paragraph_index: number
  markup_type: 'strikethrough' | 'comment'
  comment_text: string | null
  reply_text: string | null
  author_role: 'sender' | 'recipient'
}

interface Props {
  proposalId: string
  revision: number
  body: string
  markups: Markup[]
  canMarkup: boolean
}

export default function ProposalViewer({ proposalId, revision, body, markups, canMarkup }: Props) {
  const paragraphs = body.split('\n\n').filter(Boolean)
  const [localMarkups, setLocalMarkups] = useState<Markup[]>(markups)
  const [activeComment, setActiveComment] = useState<number | null>(null)
  const [commentText, setCommentText] = useState('')
  const [error, setError] = useState('')

  async function addMarkup(paragraphIndex: number, type: 'strikethrough' | 'comment', text?: string) {
    setError('')
    const res = await fetch('/api/markups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposal_id: proposalId,
        revision,
        paragraph_index: paragraphIndex,
        markup_type: type,
        comment_text: text ?? null,
        author_role: 'recipient',
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setLocalMarkups(prev => [
        ...prev,
        { id: data.id, paragraph_index: paragraphIndex, markup_type: type, comment_text: text ?? null, reply_text: null, author_role: 'recipient' },
      ])
      setActiveComment(null)
      setCommentText('')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to add markup')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {paragraphs.map((para, idx) => {
        const paraMarkups = localMarkups.filter(m => m.paragraph_index === idx)
        const isStruck = paraMarkups.some(m => m.markup_type === 'strikethrough')
        const comments = paraMarkups.filter(m => m.markup_type === 'comment')
        return (
          <div key={idx} className="group relative">
            <p className={`text-sm leading-relaxed ${isStruck ? 'line-through text-gray-400' : ''}`}>{para}</p>
            {canMarkup && !isStruck && (
              <div className="mt-1 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => addMarkup(idx, 'strikethrough')}
                  className="text-xs text-gray-400 hover:text-gray-700 border rounded px-2 py-0.5"
                >
                  Strike
                </button>
                <button
                  onClick={() => setActiveComment(activeComment === idx ? null : idx)}
                  className="text-xs text-gray-400 hover:text-gray-700 border rounded px-2 py-0.5"
                >
                  Comment
                </button>
              </div>
            )}
            {activeComment === idx && (
              <div className="mt-2 flex gap-2">
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 border rounded px-2 py-1 text-sm"
                />
                <button
                  onClick={() => addMarkup(idx, 'comment', commentText)}
                  className="text-sm px-3 py-1 bg-black text-white rounded"
                >
                  Add
                </button>
              </div>
            )}
            {comments.map(c => (
              <div key={c.id} className="mt-2 border-l-2 border-amber-300 pl-3">
                <p className="text-xs text-gray-600">{c.comment_text}</p>
                {c.reply_text && <p className="text-xs text-gray-400 mt-1">↳ {c.reply_text}</p>}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
