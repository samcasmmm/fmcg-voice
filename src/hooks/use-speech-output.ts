'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import type { Language } from '@/db/schema';

const noopSubscribe = () => () => {};

export function useSpeechOutputSupported() {
  return useSyncExternalStore(noopSubscribe, () => 'speechSynthesis' in window, () => false);
}

const LOCALES: Record<Language, string> = { en: 'en-IN', hi: 'hi-IN' };

function pickVoice(language: Language) {
  const voices = window.speechSynthesis.getVoices();
  const locale = LOCALES[language];
  const prefix = locale.split('-')[0];
  return (
    voices.find((v) => v.lang.replace('_', '-') === locale && /natural|google|neural/i.test(v.name)) ??
    voices.find((v) => v.lang.replace('_', '-') === locale) ??
    voices.find((v) => v.lang.startsWith(prefix)) ??
    null
  );
}

/** Reads text aloud for the spoken channel: strips markup and speaks sentence by sentence (Chrome cuts off long utterances). */
export function cleanForSpeech(text: string) {
  return text
    .replace(/[*_#`>|]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentences(text: string) {
  return text.match(/[^.!?।]+[.!?।]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
}

export function useSpeechOutput() {
  const supported = useSpeechOutputSupported();
  // Chrome may drop end events for utterances that get garbage-collected, so keep references.
  const queue = useRef<SpeechSynthesisUtterance[]>([]);
  const cancelToken = useRef(0);

  useEffect(() => {
    if (!supported) return;
    // Voices load asynchronously; touching the list starts loading.
    window.speechSynthesis.getVoices();
    return () => window.speechSynthesis.cancel();
  }, [supported]);

  const cancel = useCallback(() => {
    cancelToken.current += 1;
    queue.current = [];
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const speak = useCallback(
    (text: string, language: Language) =>
      new Promise<void>((resolve) => {
        const clean = cleanForSpeech(text);
        if (!supported || !clean) return resolve();

        cancel();
        const token = cancelToken.current;
        // Chrome sometimes never fires onend (or has no audio device); don't let the call hang on it.
        const safety = setTimeout(resolve, clean.length * 90 + 4000);
        const finish = () => {
          clearTimeout(safety);
          resolve();
        };
        const voice = pickVoice(language);
        const parts = sentences(clean);

        queue.current = parts.map((part, index) => {
          const utterance = new SpeechSynthesisUtterance(part);
          utterance.lang = LOCALES[language];
          if (voice) utterance.voice = voice;
          utterance.rate = 1.02;
          utterance.onend = () => {
            if (index === parts.length - 1 || token !== cancelToken.current) finish();
          };
          utterance.onerror = finish;
          return utterance;
        });
        for (const utterance of queue.current) window.speechSynthesis.speak(utterance);
      }),
    [cancel, supported],
  );

  return { supported, speak, cancel };
}
