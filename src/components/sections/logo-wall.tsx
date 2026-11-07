import { cn } from '@/lib/utils'

export type Logo = { name: string; src?: string; alt?: string }

/** Logo wall skeleton: renders images when provided, otherwise name placeholders. */
export function LogoWall({ logos, className }: { logos: Logo[]; className?: string }) {
  return (
    <ul
      className={cn(
        'grid grid-cols-2 items-center gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-6',
        className,
      )}
    >
      {logos.map((logo) => (
        <li key={logo.name} className="flex h-12 items-center justify-center">
          {logo.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo.src}
              alt={logo.alt ?? logo.name}
              className="max-h-8 w-auto opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0"
            />
          ) : (
            <span className="text-h4 tracking-tight text-muted/80">{logo.name}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
