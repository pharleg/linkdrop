const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function generateSlug(length = 6): string {
  return Array.from(
    { length },
    () => CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}

export async function resolveSlug(
  base: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string | null> {
  if (!(await checkExists(base))) return base
  const retry = base + Math.floor(Math.random() * 10).toString()
  if (!(await checkExists(retry))) return retry
  return null
}
