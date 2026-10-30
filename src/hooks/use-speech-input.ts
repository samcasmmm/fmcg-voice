'use client';

import { useCallback, useRef, useState, useSyncExternalStore } from 'react';

import type { Language } from '@/db/schema';

// Minimal Web Speech API typings (not in TypeScript's DOM lib).
type RecognitionResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => Recognition;

function getRecognition(): RecognitionConstructor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

/** sarvam and whisper record in the browser and transcribe on the server; browser uses the Web Speech API. */
export type InputEngine = 'sarvam' | 'browser' | 'whisper';

export function useInputSupport() {
  const browser = useSyncExternalStore(noopSubscribe, () => getRecognition() !== null, () => false);
  const recorder = useSyncExternalStore(
    noopSubscribe,
    () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    () => false,
  );
  return { browser, sarvam: recorder, whisper: recorder } satisfies Record<InputEngine, boolean>;
}

export type ListenError = 'no-speech' | 'denied' | 'no-mic' | 'network' | 'language' | 'failed';
/** `detail` carries the raw browser/server error code for diagnosis. */
export type ListenResult = { text: string } | { error: ListenError; detail?: string };

function recognitionError(code: string): ListenResult {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return { error: 'denied', detail: code };
    case 'no-speech':
    case 'aborted':
      return { error: 'no-speech', detail: code };
    case 'audio-capture':
      return { error: 'no-mic', detail: code };
    case 'network':
      return { error: 'network', detail: code };
    case 'language-not-supported':
      return { error: 'language', detail: code };
    default:
      return { error: 'failed', detail: code };
  }
}

function mediaError(error: unknown): ListenResult {
  const name = error instanceof DOMException ? error.name : 'unknown';
  if (name === 'NotAllowedError' || name === 'SecurityError') return { error: 'denied', detail: name };
  if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError') return { error: 'no-mic', detail: name };
  return { error: 'failed', detail: name };
}

const LOCALES: Record<Language, string> = { en: 'en-IN', hi: 'hi-IN' };

/**
 * One-shot listening: resolves with the final transcript when the speaker pauses.
 * `browser` uses the Web Speech API; `sarvam` and `whisper` record with silence detection and transcribe on the server.
 * The engine is chosen per turn so a call can fall back to Whisper when browser recognition is unavailable.
 */
export function useSpeechInput(language: Language) {
  const [interim, setInterim] = useState('');
  const stopRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const listenBrowser = useCallback(
    () =>
      new Promise<ListenResult>((resolve) => {
        const Recognition = getRecognition();
        if (!Recognition) return resolve({ error: 'failed', detail: 'unsupported' });
        const recognition = new Recognition();
        recognition.lang = LOCALES[language];
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        let finalText = '';
        let failure: ListenResult | null = null;
        recognition.onresult = (event) => {
          let interimText = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) finalText += result[0].transcript;
            else interimText += result[0].transcript;
          }
          setInterim((finalText + interimText).trim());
        };
        recognition.onerror = (event) => {
          console.warn('Speech recognition error:', event.error);
          failure = recognitionError(event.error);
        };
        recognition.onend = () => {
          stopRef.current = abortRef.current = null;
          setInterim('');
          const text = finalText.trim();
          resolve(text ? { text } : (failure ?? { error: 'no-speech' }));
        };
        stopRef.current = () => recognition.stop();
        abortRef.current = () => {
          finalText = '';
          recognition.abort();
        };
        try {
          recognition.start();
        } catch (error) {
          // e.g. InvalidStateError when a previous session has not fully stopped yet.
          stopRef.current = abortRef.current = null;
          resolve({ error: 'failed', detail: error instanceof DOMException ? error.name : 'start-failed' });
        }
      }),
    [language],
  );

  const listenRecorded = useCallback(async (provider: 'sarvam' | 'whisper'): Promise<ListenResult> => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (error) {
      console.warn('Microphone error:', error);
      return mediaError(error);
    }

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    // Silence detection: stop ~1.2s after speech ends; give up after 8s without speech.
    const audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 1024;
    audio.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const startedAt = performance.now();
    let heardSpeech = false;
    let lastSound = startedAt;
    let aborted = false;
    let frame = 0;

    const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    const stop = () => recorder.state === 'recording' && recorder.stop();
    stopRef.current = stop;
    abortRef.current = () => {
      aborted = true;
      stop();
    };

    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += ((s - 128) / 128) ** 2;
      const rms = Math.sqrt(sum / samples.length);
      const now = performance.now();
      if (rms > 0.035) {
        heardSpeech = true;
        lastSound = now;
      }
      if ((heardSpeech && now - lastSound > 1200) || (!heardSpeech && now - startedAt > 8000) || now - startedAt > 20000) stop();
      else frame = requestAnimationFrame(tick);
    };

    recorder.start();
    setInterim('…');
    frame = requestAnimationFrame(tick);
    await stopped;

    cancelAnimationFrame(frame);
    stream.getTracks().forEach((t) => t.stop());
    void audio.close();
    stopRef.current = abortRef.current = null;

    if (aborted || !heardSpeech) {
      setInterim('');
      return { error: 'no-speech' };
    }

    setInterim('Transcribing…');
    try {
      const form = new FormData();
      form.append('audio', new Blob(chunks, { type: recorder.mimeType }), 'speech.webm');
      form.append('language', language);
      form.append('provider', provider);
      const res = await fetch('/api/transcribe', { method: 'POST', body: form });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) return { error: 'failed', detail: `transcribe ${res.status}: ${data.error ?? 'error'}` };
      return data.text ? { text: data.text } : { error: 'no-speech' };
    } catch {
      return { error: 'network', detail: 'transcribe request failed' };
    } finally {
      setInterim('');
    }
  }, [language]);

  const listen = useCallback(
    (engine: InputEngine) => (engine === 'browser' ? listenBrowser() : listenRecorded(engine)),
    [listenBrowser, listenRecorded],
  );
  /** Finish now and use what was heard so far. */
  const stop = useCallback(() => stopRef.current?.(), []);
  /** Discard and stop. */
  const abort = useCallback(() => abortRef.current?.(), []);

  return { listen, stop, abort, interim };
}
