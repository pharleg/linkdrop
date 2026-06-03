interface Props {
  id: string
  slug: string
  destinationUrl: string | null
  clickCount: number
  active: boolean
}

export function LinkCard({ id, slug, destinationUrl, clickCount, active }: Props) {
  return (
    <a
      href={`/dashboard/links/${id}`}
      className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-gray-50"
    >
      <div className="min-w-0">
        <p className="font-mono text-sm font-medium truncate">/{slug}</p>
        {destinationUrl && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{destinationUrl}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span className="text-xs text-gray-500">{clickCount} clicks</span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded ${
            active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {active ? 'active' : 'inactive'}
        </span>
      </div>
    </a>
  )
}
