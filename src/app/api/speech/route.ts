import { z } from 'zod';

import { sarvamConfigured, sarvamSpeak, SarvamError } from '@/lib/ai/sarvam';

export const maxDuration = 30;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(2500),
  language: z.enum(['en', 'hi']),
});

/** Text-to-speech with Sarvam Bulbul. The client falls back to the browser's voice if this fails. */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });
  if (!sarvamConfigured()) return Response.json({ error: 'Sarvam is not configured' }, { status: 503 });

  try {
    const audio = await sarvamSpeak(parsed.data.text, parsed.data.language);
    return new Response(new Uint8Array(audio), {
      headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' },
    });
  } catch (error) {
    console.error('Sarvam speech failed', error);
    const status = error instanceof SarvamError && error.status === 429 ? 429 : 502;
    return Response.json({ error: 'Could not generate speech' }, { status });
  }
}
