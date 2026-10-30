import type { FollowUpType, Outcome } from '@/db/schema';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export function formatINR(value: number) {
  return inr.format(value);
}

export function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
}

export const outcomeLabels: Record<Outcome, string> = {
  order_enquiry: 'Order enquiry',
  interested: 'Interested',
  follow_up: 'Follow-up needed',
  not_interested: 'Not interested',
  no_outcome: 'No outcome',
};

export const followUpLabels: Record<FollowUpType, string> = {
  callback: 'Callback',
  visit: 'Sales rep visit',
  samples: 'Send samples',
  credit: 'Credit / payment query',
  complaint: 'Complaint',
  other: 'Other',
};

export const stockLabels = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
} as const;
