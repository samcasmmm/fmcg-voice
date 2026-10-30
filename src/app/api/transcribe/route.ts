import type { GroqTranscriptionModelOptions } from '@ai-sdk/groq';
import { transcribe } from 'ai';

import type { Language } from '@/db/schema';
import { transcriptionModel } from '@/lib/ai/models';
import { sarvamConfigured, sarvamTranscribe } from '@/lib/ai/sarvam';
import { getCatalogue } from '@/lib/catalogue';

export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Speech-to-text for recorded turns. Sarvam Saaras is the default; if it fails (quota, outage) the same
 * recording is retried with Groq Whisper, so the retailer never has to repeat themselves.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const audio = form.get('audio');
  const language: Language = form.get('language') === 'hi' ? 'hi' : 'en';
  const preferred = form.get('provider') === 'whisper' ? 'whisper' : 'sarvam';

  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: 'No audio received' }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: 'Recording is too long' }, { status: 413 });

  // Recognition hints: brand and product names are invented, so neither model knows them.
  const productNames = [...new Set((await getCatalogue()).map((p) => p.name))];

  if (preferred === 'sarvam' && sarvamConfigured()) {
    try {
      return Response.json({ text: await sarvamTranscribe(audio, language, productNames), provider: 'sarvam' });
    } catch (error) {
      console.error('Sarvam transcription failed, falling back to Whisper', error);
    }
  }

  try {
    const result = await transcribe({
      model: transcriptionModel(),
      audio: new Uint8Array(await audio.arrayBuffer()),
      providerOptions: {
        groq: {
          language,
          ...(language === 'en' && { prompt: `A kirana retailer orders FMCG products: ${productNames.join(', ')}.` }),
        } satisfies GroqTranscriptionModelOptions,
      },
    });
    return Response.json({ text: result.text.trim(), provider: 'whisper' });
  } catch (error) {
    console.error('Transcription failed', error);
    return Response.json({ error: 'Could not transcribe the recording' }, { status: 502 });
  }
}
