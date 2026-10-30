import 'server-only';

import { generateText, Output } from 'ai';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db';
import { conversations, outcome, type Outcome } from '@/db/schema';
import { summaryModel, summaryProviderOptions } from '@/lib/ai/models';
import { getConversationDetail } from '@/lib/conversations';
import { followUpLabels, formatINR } from '@/lib/format';

const summarySchema = z.object({
  summary: z.string().describe('2 to 4 sentences in English for the sales team: who called, what they asked, what was agreed'),
  outcome: z.enum(outcome.enumValues),
  nextSteps: z.string().describe('One short sentence on what the sales team should do next, or "None"'),
});

/** Closes a call: writes an English summary and outcome for the sales team, and marks it completed. */
export async function finalizeConversation(id: string) {
  const detail = await getConversationDetail(id);
  if (!detail) throw new Error('Conversation not found');
  const { conversation, retailer, items, followUps } = detail;
  if (conversation.status === 'completed') return conversation;

  const transcript = conversation.messages
    .map((m) => {
      const text = m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join(' ').trim();
      return text ? `${m.role === 'user' ? 'Retailer' : 'Agent'}: ${text}` : null;
    })
    .filter(Boolean)
    .join('\n');

  const captured = [
    ...items.map(({ item, product, scheme }) =>
      item.kind === 'order'
        ? `ORDER ${item.quantity} ${item.unit} of ${product.name} ${product.packSize}, est. ${formatINR(item.estimatedValue ?? 0)}${scheme ? `, scheme ${scheme.code}` : ''}`
        : `INTEREST in ${product.name} ${product.packSize}${item.quantity ? ` (${item.quantity} ${item.unit})` : ''}`,
    ),
    ...followUps.map((f) => `FOLLOW-UP ${followUpLabels[f.type]}${f.dueDate ? ` on ${f.dueDate}` : ''}: ${f.notes}`),
  ];

  const hasUserTurns = conversation.messages.some((m) => m.role === 'user');
  const orderLines = items.filter(({ item }) => item.kind === 'order').length;
  let result: z.infer<typeof summarySchema> = fallbackSummary(orderLines, items.length - orderLines, followUps.length, hasUserTurns);

  if (hasUserTurns) {
    try {
      const { output } = await generateText({
        model: summaryModel(),
        providerOptions: summaryProviderOptions,
        output: Output.object({ schema: summarySchema }),
        instructions: `You summarise sales calls between an FMCG voice agent and a kirana retailer for the sales team. Write in English even if the call was in Hindi. Base the outcome on what was captured:
- order_enquiry: at least one order line with a quantity
- follow_up: no order, but a follow-up was recorded
- interested: interest shown in products, no order or follow-up
- not_interested: retailer declined
- no_outcome: nothing meaningful happened`,
        prompt: `Retailer: ${retailer ? `${retailer.shopName} (${retailer.ownerName}, ${retailer.town})` : (conversation.retailerName ?? 'Unidentified')}
Captured:
${captured.join('\n') || 'Nothing captured'}

Transcript:
${transcript}`,
      });
      result = output;
    } catch (error) {
      console.error('Summary generation failed, using fallback', error);
    }
  }

  const [updated] = await db
    .update(conversations)
    .set({ status: 'completed', endedAt: new Date(), ...result })
    .where(eq(conversations.id, id))
    .returning();
  return updated;
}

function fallbackSummary(orderLines: number, interestLines: number, followUpCount: number, hasUserTurns: boolean) {
  const outcomeValue: Outcome = !hasUserTurns
    ? 'no_outcome'
    : orderLines
      ? 'order_enquiry'
      : followUpCount
        ? 'follow_up'
        : interestLines
          ? 'interested'
          : 'no_outcome';
  return {
    summary: hasUserTurns
      ? `Call captured ${orderLines} order line(s), ${interestLines} product interest(s) and ${followUpCount} follow-up(s).`
      : 'The call ended before the retailer said anything.',
    outcome: outcomeValue,
    nextSteps: 'None',
  };
}
