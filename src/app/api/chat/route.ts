import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  hasToolCall,
  isStepCount,
  streamText,
  toUIMessageStream,
  validateUIMessages,
} from 'ai';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db';
import { retailers } from '@/db/schema';
import { chatModel, chatProviderOptions } from '@/lib/ai/models';
import { buildInstructions } from '@/lib/agent/prompt';
import { createTools, type AgentUIMessage } from '@/lib/agent/tools';
import { getCatalogue } from '@/lib/catalogue';
import { getConversation, saveMessages } from '@/lib/conversations';

export const maxDuration = 30;

const bodySchema = z.object({ id: z.uuid(), message: z.unknown() });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });
  const { id, message } = parsed.data;

  const conversation = await getConversation(id);
  if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });
  if (conversation.status !== 'active') return Response.json({ error: 'This call has ended' }, { status: 409 });

  const [catalogue, retailer] = await Promise.all([
    getCatalogue(),
    conversation.retailerId ? db.query.retailers.findFirst({ where: eq(retailers.id, conversation.retailerId) }) : null,
  ]);
  const tools = createTools(id, catalogue);

  // Only the newest message comes from the client; history is loaded from the database.
  const messages = await validateUIMessages<AgentUIMessage>({
    messages: [...conversation.messages, message],
    tools,
  });

  const result = streamText({
    model: chatModel(),
    providerOptions: chatProviderOptions,
    instructions: buildInstructions({
      language: conversation.language,
      retailer: retailer ?? null,
      retailerName: conversation.retailerName,
      catalogue,
    }),
    messages: await convertToModelMessages(messages),
    tools,
    // Hanging up ends the turn: no extra step that would say goodbye twice.
    stopWhen: [isStepCount(5), hasToolCall('endCall')],
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: messages,
      generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }),
      onEnd: ({ messages: updated }) => saveMessages(id, updated),
      onError: (error) => {
        console.error('Chat stream failed', error);
        return 'The assistant could not respond. Please try again.';
      },
    }),
  });
}
