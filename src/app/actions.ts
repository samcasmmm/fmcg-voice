'use server';

import { z } from 'zod';

import { finalizeConversation } from '@/lib/agent/summarize';
import { createConversation } from '@/lib/conversations';

const startSchema = z.object({
  retailerId: z.number().int().positive().nullable(),
  language: z.enum(['en', 'hi']),
});

export async function startConversation(input: z.infer<typeof startSchema>) {
  const { retailerId, language } = startSchema.parse(input);
  const conversation = await createConversation({ retailerId, language });
  return { id: conversation.id, messages: conversation.messages };
}

export async function endConversation(id: string) {
  const conversation = await finalizeConversation(z.uuid().parse(id));
  return { id: conversation.id, outcome: conversation.outcome };
}
