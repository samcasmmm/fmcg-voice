import { Badge } from '@/components/ui/badge';
import type { Outcome } from '@/db/schema';
import { outcomeLabels } from '@/lib/format';
import { cn } from '@/lib/utils';

const styles: Record<Outcome, string> = {
  order_enquiry: 'bg-signal text-signal-foreground border-transparent',
  follow_up: 'bg-accent text-accent-foreground border-transparent',
  interested: 'border-foreground/25 bg-transparent text-foreground',
  not_interested: 'bg-muted text-muted-foreground border-transparent',
  no_outcome: 'bg-muted text-muted-foreground border-transparent',
};

export function OutcomeBadge({ outcome, status }: { outcome: Outcome | null; status: 'active' | 'completed' }) {
  if (status === 'active' || !outcome) {
    return (
      <Badge variant='outline' className='text-muted-foreground'>
        Not ended
      </Badge>
    );
  }
  return <Badge className={cn(styles[outcome])}>{outcomeLabels[outcome]}</Badge>;
}
