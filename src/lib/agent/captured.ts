import type { AgentUIMessage } from '@/lib/agent/tools';

type Part = AgentUIMessage['parts'][number];
type Output<T extends Part['type']> = Extract<Part, { type: T; state: 'output-available' }>['output'];

export type CapturedLine = Extract<Output<'tool-recordItem'>, { status: 'recorded' }>;
export type CapturedFollowUp = Extract<Output<'tool-recordFollowUp'>, { status: 'recorded' }>;
export type IdentifiedRetailer = Extract<Output<'tool-identifyRetailer'>, { status: 'found' }>['retailer'];

export type CapturedState = {
  retailer: IdentifiedRetailer | null;
  lines: CapturedLine[];
  followUps: CapturedFollowUp[];
  total: number;
  ended: boolean;
};

/** Replays the agent's tool results to show what the call has captured so far. */
export function deriveCaptured(messages: AgentUIMessage[]): CapturedState {
  let retailer: IdentifiedRetailer | null = null;
  const lines = new Map<string, CapturedLine>();
  const followUps: CapturedFollowUp[] = [];
  let ended = false;

  for (const message of messages) {
    for (const part of message.parts) {
      if (!('state' in part) || part.state !== 'output-available') continue;
      switch (part.type) {
        case 'tool-identifyRetailer':
          if (part.output.status === 'found') retailer = part.output.retailer;
          break;
        case 'tool-recordItem':
          if (part.output.status === 'recorded') lines.set(part.output.sku, part.output);
          break;
        case 'tool-removeItem':
          if (part.output.status === 'removed') lines.delete(part.output.sku);
          break;
        case 'tool-recordFollowUp':
          if (part.output.status === 'recorded') followUps.push(part.output);
          break;
        case 'tool-endCall':
          ended = true;
          break;
      }
    }
  }

  const all = [...lines.values()];
  return {
    retailer,
    lines: all,
    followUps,
    total: all.reduce((sum, line) => sum + (line.estimatedValue ?? 0), 0),
    ended,
  };
}

export function messageText(message: AgentUIMessage) {
  return message.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join(' ')
    .trim();
}
