import { cn } from '@/lib/cn';

export type ArtKind = 'entry' | 'customer' | 'import';

/**
 * Hand-drawn vector illustrations for success states. No image assets, no
 * network request, and they inherit the light/dark theme through tokens.
 */
export function SuccessArt({ kind, className }: { kind: ArtKind; className?: string }) {
  return (
    <div className={cn('relative mx-auto h-32 w-44', className)} aria-hidden>
      <svg viewBox="0 0 220 170" className="h-full w-full" role="presentation">
        <circle cx="110" cy="82" r="70" className="fill-accent-soft" />

        {kind === 'entry' ? <EntryArt /> : null}
        {kind === 'customer' ? <CustomerArt /> : null}
        {kind === 'import' ? <ImportArt /> : null}

        <g className="animate-pop">
          <circle cx="163" cy="118" r="21" className="fill-accent" />
          <path
            d="M153 118.5l7 7 13-14"
            fill="none"
            stroke="currentColor"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw text-accent-ink"
            style={{ strokeDasharray: 48 }}
          />
        </g>

        <Sparkle x={44} y={38} scale={1.1} />
        <Sparkle x={178} y={54} scale={0.8} />
        <Sparkle x={58} y={132} scale={0.7} />
        <circle cx="176" cy="92" r="2.4" className="fill-accent/40" />
        <circle cx="38" cy="96" r="2" className="fill-accent/30" />
      </svg>
    </div>
  );
}

function Sparkle({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <path
      d="M0 -7 L1.9 -1.9 L7 0 L1.9 1.9 L0 7 L-1.9 1.9 L-7 0 L-1.9 -1.9 Z"
      transform={`translate(${x} ${y}) scale(${scale})`}
      className="fill-accent/60"
    />
  );
}

function EntryArt() {
  return (
    <g>
      <path
        d="M72 34h76a6 6 0 016 6v82l-8-5-7 5-7-5-7 5-7-5-7 5-7-5-7 5-7-5-8 5V40a6 6 0 016-6z"
        className="fill-surface stroke-line"
        strokeWidth="2"
      />
      <rect x="84" y="46" width="42" height="6" rx="3" className="fill-accent/70" />
      <rect x="84" y="60" width="52" height="4" rx="2" className="fill-line" />
      <rect x="84" y="68" width="44" height="4" rx="2" className="fill-line" />
      <rect x="84" y="76" width="49" height="4" rx="2" className="fill-line" />
      <rect x="84" y="90" width="30" height="4" rx="2" className="fill-line" />
      <rect x="84" y="102" width="38" height="9" rx="4.5" className="fill-accent-soft" />
      <circle cx="68" cy="126" r="10" className="fill-warn/25 stroke-warn/50" strokeWidth="1.5" />
      <circle cx="82" cy="132" r="7" className="fill-warn/20 stroke-warn/40" strokeWidth="1.5" />
    </g>
  );
}

function CustomerArt() {
  return (
    <g>
      <circle cx="104" cy="62" r="24" className="fill-surface stroke-line" strokeWidth="2" />
      <circle cx="104" cy="56" r="10" className="fill-accent/60" />
      <path d="M90 78c3-8 9-11 14-11s11 3 14 11" className="fill-accent/60" />
      <path
        d="M64 118c6-18 22-28 40-28s34 10 40 28"
        fill="none"
        className="stroke-accent/45"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="138" cy="44" r="3" className="fill-accent/50" />
      <circle cx="66" cy="60" r="2.5" className="fill-accent/35" />
    </g>
  );
}

function ImportArt() {
  return (
    <g>
      <rect x="66" y="46" width="78" height="58" rx="8" className="fill-surface stroke-line" strokeWidth="2" transform="rotate(-8 105 75)" />
      <rect x="72" y="40" width="78" height="58" rx="8" className="fill-surface stroke-line" strokeWidth="2" transform="rotate(-2 111 69)" />
      <rect x="78" y="34" width="78" height="58" rx="8" className="fill-surface stroke-line" strokeWidth="2" />
      <rect x="90" y="48" width="34" height="5" rx="2.5" className="fill-accent/70" />
      <rect x="90" y="60" width="50" height="4" rx="2" className="fill-line" />
      <rect x="90" y="68" width="42" height="4" rx="2" className="fill-line" />
      <rect x="90" y="76" width="48" height="4" rx="2" className="fill-line" />
    </g>
  );
}
