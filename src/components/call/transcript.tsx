import { Check, CircleAlert } from 'lucide-react';

import { ProductCard } from '@/components/product-card';
import { messageText } from '@/lib/agent/captured';
import type { AgentUIMessage } from '@/lib/agent/tools';
import type { ProductCardData } from '@/lib/catalogue';
import { followUpLabels } from '@/lib/format';
import { findProductMentions } from '@/lib/product-mentions';
import { cn } from '@/lib/utils';

type Part = AgentUIMessage['parts'][number];

function toolNote(part: Part): { ok: boolean; text: string } | null {
  if (!('state' in part) || part.state !== 'output-available') return null;
  switch (part.type) {
    case 'tool-recordItem':
      if (part.output.status !== 'recorded') return { ok: false, text: part.output.message };
      return {
        ok: true,
        text:
          part.output.kind === 'order'
            ? `Noted ${part.output.quantity} ${part.output.unit} · ${part.output.product}`
            : `Noted interest · ${part.output.product}`,
      };
    case 'tool-removeItem':
      return part.output.status === 'removed' ? { ok: true, text: `Removed · ${part.output.product}` } : null;
    case 'tool-recordFollowUp':
      return { ok: true, text: `Follow-up · ${followUpLabels[part.output.type]}` };
    case 'tool-identifyRetailer':
      return part.output.status === 'found'
        ? { ok: true, text: `Identified · ${part.output.retailer.shopName}` }
        : part.output.status === 'not_found'
          ? { ok: true, text: 'New retailer lead' }
          : null;
    default:
      return null;
  }
}

/** Products Asha names in each reply, each shown only the first time it comes up in the call. */
function productCardsByMessage(messages: AgentUIMessage[], catalogue: ProductCardData[]) {
  const shown = new Set<string>();
  const cards = new Map<string, ProductCardData[]>();
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    const fresh = findProductMentions(messageText(message), catalogue).filter((p) => !shown.has(p.sku));
    fresh.forEach((p) => shown.add(p.sku));
    if (fresh.length) cards.set(message.id, fresh);
  }
  return cards;
}

export function Transcript({
  messages,
  interim,
  catalogue,
}: {
  messages: AgentUIMessage[];
  interim: string;
  catalogue: ProductCardData[];
}) {
  const cards = productCardsByMessage(messages, catalogue);
  return (
    // column-reverse keeps the newest turn in view without scroll effects.
    <div className='@container flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain'>
      <ol className='flex flex-col gap-4 py-2' aria-label='Call transcript'>
        {messages.map((message) => {
          const fromAgent = message.role === 'assistant';
          return (
            <li key={message.id} className={cn('flex flex-col gap-1.5', fromAgent ? 'items-start' : 'items-end')}>
              <span className='px-1 text-xs text-muted-foreground'>{fromAgent ? 'Asha' : 'You'}</span>
              {message.parts.map((part, i) => {
                if (part.type === 'text' && part.text.trim()) {
                  return (
                    <p
                      key={i}
                      className={cn(
                        'max-w-[85%] rounded-lg px-3.5 py-2.5 text-[0.95rem] leading-relaxed text-pretty',
                        fromAgent ? 'bg-muted' : 'bg-primary text-primary-foreground',
                      )}
                    >
                      {part.text}
                    </p>
                  );
                }
                const note = toolNote(part);
                if (!note) return null;
                const Icon = note.ok ? Check : CircleAlert;
                return (
                  <p key={i} className='flex items-center gap-1.5 px-1 text-xs text-muted-foreground'>
                    <Icon className={cn('size-3.5', note.ok ? 'text-foreground' : 'text-live')} aria-hidden='true' />
                    {note.text}
                  </p>
                );
              })}
              {cards.has(message.id) && (
                <ul aria-label='Products mentioned' className='grid w-full max-w-[85%] gap-2 @lg:grid-cols-2'>
                  {cards.get(message.id)!.map((product) => (
                    <li key={product.sku}>
                      <ProductCard product={product} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {interim && (
          <li className='flex flex-col items-end gap-1.5'>
            <span className='px-1 text-xs text-muted-foreground'>You</span>
            <p className='max-w-[85%] rounded-lg border border-dashed px-3.5 py-2.5 text-[0.95rem] text-muted-foreground italic'>
              {interim}
            </p>
          </li>
        )}
      </ol>
    </div>
  );
}
