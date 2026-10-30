'use client';

import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Square, Volume2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

gsap.registerPlugin(useGSAP);

const MESSAGE = 'The number you have dialled does not exist. Please check the link and try again.';
const BAR_COUNT = 56;
const BAR_STAGGER = 0.012;

// Deterministic so the server and client render the same frozen waveform.
const BAR_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const envelope = 0.55 + 0.45 * Math.sin((Math.PI * i) / (BAR_COUNT - 1));
  const voice = 0.18 + 0.82 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.37));
  return Number((envelope * voice).toFixed(3));
});

const focusRing =
  'focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-signal-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-signal';

const noopSubscribe = () => () => {};

function useSpeechSupported() {
  return useSyncExternalStore(
    noopSubscribe,
    () => 'speechSynthesis' in window,
    () => false,
  );
}

// The 404 page is prerendered, so the requested path is only known in the browser.
function useDialledPath() {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.pathname,
    () => null,
  );
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function CallLine({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const speechSupported = useSpeechSupported();
  const dialledPath = useDialledPath();

  const { contextSafe } = useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.timeline({ delay: 0.3 }).add(talk(7)).add(hangUp());
      });
      mm.add('(prefers-reduced-motion: reduce)', () => {
        deadLine();
      });

      return () => window.speechSynthesis?.cancel();
    },
    { scope },
  );

  function parts() {
    const root = scope.current!;
    return {
      bars: root.querySelectorAll('[data-bar]'),
      flatline: root.querySelector('[data-flatline]'),
      dot: root.querySelector('[data-dot]'),
    };
  }

  // Voice activity: bars jump to fresh random heights on every repeat.
  function talk(repeat: number) {
    const { bars, flatline, dot } = parts();
    gsap.killTweensOf([bars, flatline, dot]);
    gsap.set(flatline, { scaleX: 0 });
    gsap.set(dot, { scale: 0 });
    return gsap.to(bars, {
      scaleY: () => gsap.utils.random(0.12, 1),
      duration: 0.16,
      ease: 'sine.inOut',
      stagger: { each: 0.006, from: 'random' },
      repeat,
      repeatRefresh: true,
    });
  }

  // The line goes dead left to right, tracing a flat line that ends in a red dot.
  function hangUp() {
    const { bars, flatline, dot } = parts();
    return gsap
      .timeline()
      .to(bars, {
        scaleY: 0,
        duration: 0.5,
        ease: 'expo.out',
        stagger: { each: BAR_STAGGER, from: 'start' },
      })
      .fromTo(flatline, { scaleX: 0 }, { scaleX: 1, duration: BAR_COUNT * BAR_STAGGER + 0.2, ease: 'power2.out' }, '<')
      .fromTo(dot, { scale: 0 }, { scale: 1, duration: 0.5, ease: 'expo.out' }, '-=0.15');
  }

  function deadLine() {
    const { bars, flatline, dot } = parts();
    gsap.killTweensOf([bars, flatline, dot]);
    gsap.set(bars, { scaleY: 0 });
    gsap.set(flatline, { scaleX: 1 });
    gsap.set(dot, { scale: 1 });
  }

  const endMessage = contextSafe(() => {
    utterance.current = null;
    setSpeaking(false);
    if (prefersReducedMotion()) deadLine();
    else hangUp();
  });

  const playMessage = contextSafe(() => {
    const synth = window.speechSynthesis;
    synth.cancel();

    const next = new SpeechSynthesisUtterance(MESSAGE);
    next.lang = 'en-IN';
    next.rate = 0.95;
    next.voice = synth.getVoices().find((v) => v.lang.replace('_', '-') === 'en-IN') ?? null;
    next.onend = next.onerror = () => {
      if (utterance.current === next) endMessage();
    };

    utterance.current = next;
    setSpeaking(true);
    if (!prefersReducedMotion()) talk(-1);
    synth.speak(next);
  });

  function stopMessage() {
    utterance.current = null;
    window.speechSynthesis.cancel();
    endMessage();
  }

  return (
    <div ref={scope} className='flex flex-1 flex-col justify-center gap-[clamp(2rem,6vh,4.5rem)]'>
      <div aria-hidden='true' className='relative h-[clamp(5rem,20vh,12rem)]'>
        <div className='flex h-full items-center gap-[clamp(2px,0.35vw,6px)] pr-6'>
          {BAR_HEIGHTS.map((height, i) => (
            <span
              key={i}
              data-bar
              className='h-full flex-1 rounded-xs bg-signal-foreground'
              style={{ transform: `scaleY(${height})` }}
            />
          ))}
        </div>
        <span
          data-flatline
          className='absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 origin-left bg-signal-foreground'
          style={{ transform: 'scaleX(0)' }}
        />
        <span
          data-dot
          className='absolute right-0 top-1/2 size-3 -translate-y-1/2 rounded-full bg-live'
          style={{ transform: 'scale(0)' }}
        />
      </div>

      <div className='grid gap-8 lg:grid-cols-12 lg:items-end'>
        <div className='lg:col-span-8'>{children}</div>
        <dl className='grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm tabular-nums lg:col-span-3 lg:col-start-10'>
          <dt className='text-signal-foreground/75'>Dialled</dt>
          <dd className='font-medium break-all'>{dialledPath ?? ' '}</dd>
          <dt className='text-signal-foreground/75'>Status</dt>
          <dd className='font-medium'>404 · Not reachable</dd>
        </dl>
      </div>

      <div className='flex flex-wrap gap-3'>
        <Button
          asChild
          className={`h-11 rounded-md bg-signal-foreground px-5 text-base font-semibold text-signal hover:bg-signal-foreground/85 ${focusRing}`}
        >
          <Link href='/'>Back to home</Link>
        </Button>
        {speechSupported && (
          <Button
            type='button'
            variant='ghost'
            onClick={speaking ? stopMessage : playMessage}
            className={`h-11 rounded-md border-signal-foreground/30 px-5 text-base font-semibold text-signal-foreground hover:bg-signal-foreground/10 hover:text-signal-foreground dark:hover:bg-signal-foreground/10 ${focusRing}`}
          >
            {speaking ? <Square aria-hidden='true' /> : <Volume2 aria-hidden='true' />}
            {speaking ? 'Stop message' : 'Play the message'}
          </Button>
        )}
      </div>
    </div>
  );
}
