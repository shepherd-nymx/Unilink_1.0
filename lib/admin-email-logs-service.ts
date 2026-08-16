import { Platform } from 'react-native';
import { loadUserDataAsync } from '@/lib/storage-service';

// Frontend helper to fetch email notification logs via the admin-email-logs
// edge function (service-role backed, admin-session verified).

export interface EmailLogRow {
  id: string;
  recipient_email: string;
  user_id: string | null;
  user_type: string | null;
  type: string;
  order_id: string | null;
  subject: string | null;
  status: string;
  resend_id: string | null;
  error_message: string | null;
  attempts: number;
  metadata: Record<string, any> | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FetchLogsParams {
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  perPage?: number;
}

export interface FetchLogsResult {
  rows: EmailLogRow[];
  total: number;
  page: number;
  perPage: number;
}

function edgeUrl(): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  return `${base}/functions/v1/admin-email-logs`;
}

export async function fetchEmailLogs(params: FetchLogsParams): Promise<FetchLogsResult> {
  const user = await loadUserDataAsync();
  if (!user || user.type !== 'admin') {
    return { rows: [], total: 0, page: 1, perPage: params.perPage ?? 50 };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  };

  try {
    const res = await fetch(edgeUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        adminId: user.id,
        ...params,
      }),
    });
    if (!res.ok) return { rows: [], total: 0, page: params.page ?? 1, perPage: params.perPage ?? 50 };
    return await res.json();
  } catch {
    return { rows: [], total: 0, page: params.page ?? 1, perPage: params.perPage ?? 50 };
  }
}

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'opened', label: 'Opened' },
  { value: 'clicked', label: 'Clicked' },
  { value: 'complained', label: 'Complained' },
];

export const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'email_verification', label: 'Email Verification' },
  { value: 'password_reset', label: 'Password Reset' },
  { value: 'order_confirmation', label: 'Order Confirmation' },
  { value: 'order_status', label: 'Order Status' },
  { value: 'messenger_assignment', label: 'Messenger Assignment' },
  { value: 'shop_notification', label: 'Shop Notification' },
  { value: 'payment_success', label: 'Payment Success' },
  { value: 'payment_failed', label: 'Payment Failed' },
  { value: 'payment_refunded', label: 'Payment Refunded' },
];

export function statusColor(status: string): string {
  switch (status) {
    case 'sent': return '#00e5ff';
    case 'delivered': return '#00ff88';
    case 'opened': return '#00ff88';
    case 'clicked': return '#00ff88';
    case 'failed': return '#ff3366';
    case 'bounced': return '#ff3366';
    case 'complained': return '#ffaa00';
    case 'pending': return '#ffaa00';
    default: return '#6a8fb0';
  }
}

export function typeLabel(type: string): string {
  const found = TYPE_OPTIONS.find((t) => t.value === type);
  return found ? found.label : type;
}
