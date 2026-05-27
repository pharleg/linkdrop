// Phase 3: summary card used on dashboard link list
export function LinkCard({ slug, clickCount }: { slug: string; clickCount: number }) {
  return (
    <div className="border rounded-lg px-4 py-3 text-sm">
      <span className="font-medium">/{slug}</span>
      <span className="text-gray-400 ml-2">{clickCount} clicks</span>
    </div>
  )
}
