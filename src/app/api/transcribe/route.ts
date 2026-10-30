import type { GroqTranscriptionModelOptions } from '@ai-sdk/groq';
import { transcribe } from 'ai';

import { transcriptionModel } from '@/lib/ai/models';
import { getCatalogue } from '@/lib/catalogue';

export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024;

/** Speech-to-text fallback via Groq Whisper, for browsers without the Web Speech API (or when chosen in settings). */
export async function POST(req: Request) {
  const form = await req.formData();
  const audio = form.get('audio');
  const language = form.get('language') === 'hi' ? 'hi' : 'en';

  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: 'No audio received' }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: 'Recording is too long' }, { status: 413 });

  try {
    // Whisper spells unfamiliar brand names phonetically; a vocabulary hint fixes most of them.
    const brands = [...new Set((await getCatalogue()).map((p) => `${p.name}`))].join(', ');
    const result = await transcribe({
      model: transcriptionModel(),
      audio: new Uint8Array(await audio.arrayBuffer()),
      providerOptions: {
        groq: {
          language,
          ...(language === 'en' && { prompt: `A kirana retailer orders FMCG products: ${brands}.` }),
        } satisfies GroqTranscriptionModelOptions,
      },
    });
    return Response.json({ text: result.text.trim() });
  } catch (error) {
    console.error('Transcription failed', error);
    return Response.json({ error: 'Could not transcribe the recording' }, { status: 502 });
  }
}
