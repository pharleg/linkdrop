interface Click {
  id: string
  clicked_at: string
  user_agent: string | null
  referrer: string | null
}

export function ClickTimeline({ clicks }: { clicks: Click[] }) {
  if (clicks.length === 0) {
    return <p className="text-sm text-gray-400">No clicks yet.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {clicks.map((click) => (
        <li key={click.id} className="border rounded-lg px-3 py-2">
          <p className="text-xs font-mono text-gray-600">
            {new Date(click.clicked_at).toISOString()}
          </p>
          {click.referrer && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              from {click.referrer}
            </p>
          )}
          {click.user_agent && (
            <p className="text-xs text-gray-300 mt-0.5 truncate">
              {click.user_agent}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
