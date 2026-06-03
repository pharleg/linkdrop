export default function Skeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-10 bg-gray-100 rounded animate-pulse"
          style={{ width: i % 3 === 2 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}
