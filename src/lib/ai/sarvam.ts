import 'server-only';

import type { Language } from '@/db/schema';

const API = 'https://api.sarvam.ai';
const LOCALES: Record<Language, string> = { en: 'en-IN', hi: 'hi-IN' };

const STT_MODEL = process.env.SARVAM_STT_MODEL || 'saaras:v4';
const TTS_MODEL = process.env.SARVAM_TTS_MODEL || 'bulbul:v4-flash';
const SPEAKERS: Record<Language, string> = {
  en: process.env.SARVAM_SPEAKER_EN || 'simran_en_sales',
  hi: process.env.SARVAM_SPEAKER_HI || 'simran_hi_sales',
};
const TTS_MAX_CHARS = 2500;

export const sarvamConfigured = () => Boolean(process.env.SARVAM_API_KEY);

export class SarvamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function call(path: string, init: RequestInit) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new SarvamError('SARVAM_API_KEY is not set', 500, 'not_configured');
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'api-subscription-key': key, ...init.headers },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
    throw new SarvamError(body?.error?.message ?? `Sarvam request failed (${res.status})`, res.status, body?.error?.code);
  }
  return res.json();
}

/** Speech-to-text with Saaras. `keyterms` bias recognition towards product and brand names. */
export async function sarvamTranscribe(audio: Blob, language: Language, keyterms: string[] = []) {
  // Browsers label recordings "audio/webm;codecs=opus"; Sarvam only accepts the bare media type.
  const mediaType = audio.type.split(';')[0] || 'audio/webm';
  const extension = mediaType.split('/')[1] ?? 'webm';
  const form = new FormData();
  form.append('file', new Blob([audio], { type: mediaType }), `speech.${extension}`);
  form.append('model', STT_MODEL);
  form.append('language_code', LOCALES[language]);
  if (keyterms.length && STT_MODEL === 'saaras:v4') {
    form.append('keyterms', JSON.stringify(keyterms.slice(0, 50).map((term) => term.slice(0, 64))));
  }
  const data = (await call('/speech-to-text', { method: 'POST', body: form })) as { transcript: string };
  return data.transcript.trim();
}

/** Text-to-speech with Bulbul. Returns MP3 bytes. */
export async function sarvamSpeak(text: string, language: Language) {
  const data = (await call('/text-to-speech', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: text.slice(0, TTS_MAX_CHARS),
      language_code: LOCALES[language],
      model: TTS_MODEL,
      speaker: SPEAKERS[language],
      output_audio_codec: 'mp3',
      speech_sample_rate: 24000,
    }),
  })) as { audios: string[] };
  return Buffer.from(data.audios.join(''), 'base64');
}
