'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import type { Language } from '@/db/schema';

export type VoiceEngine = 'sarvam' | 'browser';

const noopSubscribe = () => () => {};

export function useSpeechOutputSupported() {
  return useSyncExternalStore(noopSubscribe, () => 'speechSynthesis' in window, () => false);
}

const LOCALES: Record<Language, string> = { en: 'en-IN', hi: 'hi-IN' };

// A shared player that gets unlocked during a click. Browsers only allow audio with sound after a user
// gesture; Asha's greeting starts after an async round trip, so the Start call click unlocks it up front.
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
let sharedPlayer: HTMLAudioElement | null = null;

function player() {
  return (sharedPlayer ??= new Audio());
}

/** Call from a click handler (Start call, mic) so later replies can play without being blocked. */
export function unlockAudio() {
  const audio = player();
  if (!audio.paused) return;
  audio.src = SILENCE;
  audio.play().catch(() => {});
  // Also warm up speechSynthesis, which Safari blocks until first used in a gesture.
  if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
}

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

/** Text for the spoken channel: no markup. */
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

/** First sentence on its own so audio starts quickly; the rest merged into larger requests. */
function chunks(text: string, max = 400) {
  const [first, ...rest] = sentences(text);
  const result = [first];
  for (const sentence of rest) {
    const last = result.length > 1 ? result[result.length - 1] : null;
    if (last && last.length + sentence.length < max) result[result.length - 1] = `${last} ${sentence}`;
    else result.push(sentence);
  }
  return result;
}

/**
 * Speaks replies with Sarvam Bulbul (natural Indian voices) or the browser's voice.
 * Sarvam failures and blocked autoplay fall back to the browser voice for whatever is left to say.
 */
export function useSpeechOutput() {
  const browserSupported = useSpeechOutputSupported();
  // Chrome may drop end events for utterances that get garbage-collected, so keep references.
  const utterances = useRef<SpeechSynthesisUtterance[]>([]);
  const controller = useRef<AbortController | null>(null);
  const cancelToken = useRef(0);

  useEffect(() => {
    if (!browserSupported) return;
    // Voices load asynchronously; touching the list starts loading.
    window.speechSynthesis.getVoices();
    return () => window.speechSynthesis.cancel();
  }, [browserSupported]);

  useEffect(() => () => sharedPlayer?.pause(), []);

  const cancel = useCallback(() => {
    cancelToken.current += 1;
    controller.current?.abort();
    controller.current = null;
    sharedPlayer?.pause();
    utterances.current = [];
    if (browserSupported) window.speechSynthesis.cancel();
  }, [browserSupported]);

  const speakWithBrowser = useCallback(
    (text: string, language: Language, token: number) =>
      new Promise<void>((resolve) => {
        if (!browserSupported || token !== cancelToken.current) return resolve();
        // Chrome sometimes never fires onend (or has no audio device); don't let the call hang on it.
        const safety = setTimeout(resolve, text.length * 90 + 4000);
        const finish = () => {
          clearTimeout(safety);
          resolve();
        };
        const voice = pickVoice(language);
        const parts = sentences(text);
        utterances.current = parts.map((part, index) => {
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
        for (const utterance of utterances.current) window.speechSynthesis.speak(utterance);
      }),
    [browserSupported],
  );

  /** Returns the text it could not speak (empty when everything played, or when cancelled). */
  const speakWithSarvam = useCallback(async (text: string, language: Language, token: number) => {
    const parts = chunks(text);
    const abort = new AbortController();
    controller.current = abort;
    const requests = parts.map((part) =>
      fetch('/api/speech', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: part, language }),
        signal: abort.signal,
      }).then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`speech ${res.status}`)))),
    );
    requests.forEach((request) => request.catch(() => {}));

    const audio = player();
    for (let i = 0; i < parts.length; i++) {
      try {
        const blob = await requests[i];
        if (token !== cancelToken.current) return '';
        const url = URL.createObjectURL(blob);
        try {
          await new Promise<void>((resolve, reject) => {
            audio.onended = () => resolve();
            audio.onpause = () => resolve();
            audio.onerror = () => reject(new Error('playback failed'));
            audio.src = url;
            audio.play().catch(reject);
          });
        } finally {
          URL.revokeObjectURL(url);
        }
        if (token !== cancelToken.current) return '';
      } catch (error) {
        if (token !== cancelToken.current) return '';
        console.warn('Sarvam speech unavailable, using the browser voice', error);
        abort.abort();
        return parts.slice(i).join(' ');
      }
    }
    return '';
  }, []);

  const speak = useCallback(
    async (text: string, language: Language, engine: VoiceEngine = 'sarvam') => {
      const clean = cleanForSpeech(text);
      if (!clean) return;
      cancel();
      const token = cancelToken.current;
      const remaining = engine === 'sarvam' ? await speakWithSarvam(clean, language, token) : clean;
      if (remaining && token === cancelToken.current) await speakWithBrowser(remaining, language, token);
    },
    [cancel, speakWithBrowser, speakWithSarvam],
  );

  // Sarvam plays through an <audio> element, which every browser has; the browser voice is the fallback.
  return { supported: true, browserSupported, speak, cancel };
}
