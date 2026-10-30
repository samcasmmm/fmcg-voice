import { cn } from '@/lib/utils';

// On a phone keypad F=3, M=6, C=2, G=4: the lit keys dial the brand.
const DIAL_ORDER = [3, 6, 2, 4];
const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const DIAL_STEP_MS = 140;

const surfaces = {
  // Neutral grounds (light or dark): ink keys and lettering follow the foreground; unlit keys are signal yellow.
  neutral: { root: 'text-foreground', unlit: 'fill-signal' },
  // Signal-yellow surfaces: ink keys and lettering; unlit keys are a faint ink tint.
  signal: { root: 'text-signal-foreground', unlit: 'fill-signal-foreground/15' },
};

type LogoProps = {
  surface?: keyof typeof surfaces;
  className?: string;
};

/**
 * The fmcg-voice keypad mark and wordmark.
 * Size it with font-size (e.g. `text-xl`). Inside a hovered or focused link, the lit keys replay the dialling.
 */
export function Logo({ surface = 'neutral', className }: LogoProps) {
  const tone = surfaces[surface];

  return (
    <span
      role='img'
      aria-label='fmcg-voice'
      className={cn('inline-flex items-center gap-[0.35em] select-none', tone.root, className)}
    >
      <svg viewBox='0 0 30 30' aria-hidden='true' className='size-[1.2em] shrink-0'>
        {KEYS.map((key) => {
          const dialIndex = DIAL_ORDER.indexOf(key);
          const lit = dialIndex !== -1;
          return (
            <circle
              key={key}
              cx={5 + ((key - 1) % 3) * 10}
              cy={5 + Math.floor((key - 1) / 3) * 10}
              r='4'
              className={cn(
                'origin-center [transform-box:fill-box]',
                lit
                  ? 'fill-current motion-safe:in-[a:focus-visible]:animate-logo-dial motion-safe:in-[a:hover]:animate-logo-dial'
                  : tone.unlit,
              )}
              style={lit ? { animationDelay: `${dialIndex * DIAL_STEP_MS}ms` } : undefined}
            />
          );
        })}
      </svg>
      <span
        aria-hidden='true'
        className='font-condensed text-[1em] leading-none tracking-[0.02em] whitespace-nowrap uppercase'
      >
        <span className='font-extrabold'>FMCG</span> <span className='font-medium'>VOICE</span>
      </span>
    </span>
  );
}
