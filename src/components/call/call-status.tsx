import { cn } from '@/lib/utils';

export type CallPhase = 'idle' | 'speaking' | 'listening' | 'thinking' | 'ending';

const BARS = [0.35, 0.7, 1, 0.55, 0.85, 0.45, 0.95, 0.6, 0.4, 0.75, 0.5, 0.3];

const labels: Record<CallPhase, string> = {
  idle: 'Your turn: tap the mic or type',
  speaking: 'Asha is speaking',
  listening: 'Listening…',
  thinking: 'Asha is thinking…',
  ending: 'Wrapping up the call…',
};

/** Voice-line status: bars talk while Asha speaks, the live dot pulses while listening. */
export function CallStatus({ phase, slow }: { phase: CallPhase; slow?: boolean }) {
  return (
    <div className='flex items-center gap-3' role='status' aria-live='polite'>
      <div aria-hidden='true' className='flex h-6 items-center gap-[3px]'>
        {phase === 'listening' ? (
          <span className='relative flex size-3'>
            <span className='absolute inline-flex size-full rounded-full bg-live opacity-60 motion-safe:animate-ping' />
            <span className='relative inline-flex size-3 rounded-full bg-live' />
          </span>
        ) : (
          BARS.map((height, i) => (
            <span
              key={i}
              className={cn(
                'w-[3px] rounded-full bg-foreground transition-[height,opacity] duration-300',
                phase === 'speaking' ? 'motion-safe:animate-voice-bar' : 'opacity-30',
                phase === 'thinking' && 'motion-safe:animate-pulse opacity-60',
              )}
              style={{
                height: phase === 'speaking' ? `${height * 100}%` : '3px',
                animationDelay: `${(i % 5) * 90}ms`,
              }}
            />
          ))
        )}
      </div>
      <p className='text-sm font-medium'>
        {labels[phase]}
        {phase === 'thinking' && slow && (
          <span className='block text-xs font-normal text-muted-foreground'>
            Taking longer than usual. The free AI tier may be rate-limiting; hang on.
          </span>
        )}
      </p>
    </div>
  );
}
