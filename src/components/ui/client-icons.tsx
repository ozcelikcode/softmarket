import type { SVGProps } from 'react'

/**
 * Inline copies of the few lucide icons used inside client islands (identical markup), so the
 * lucide-react runtime does not ship in the shared client bundle. Server components keep using lucide-react.
 */
function Svg({ name, className, children, ...props }: SVGProps<SVGSVGElement> & { name: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lucide lucide-${name}${className ? ` ${className}` : ''}`} aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

export const XIcon = (p: SVGProps<SVGSVGElement>) => <Svg name="x" {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg>
export const GlobeIcon = (p: SVGProps<SVGSVGElement>) => <Svg name="globe" {...p}><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></Svg>
export const PlayIcon = (p: SVGProps<SVGSVGElement>) => <Svg name="play" {...p}><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" /></Svg>
