import { supabase } from '@/lib/supabase';

// Frontend helper for triggering transactional emails via the resend-email
// edge function. Secrets (RESEND_API_KEY, service-role key) stay server-side.

const FUNCTION_SLUG = 'resend-email';

function edgeUrl(): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  return `${base}/functions/v1/${FUNCTION_SLUG}`;
}

type EmailType =
  | 'welcome'
  | 'email_verification'
  | 'password_reset'
  | 'order_confirmation'
  | 'order_status'
  | 'messenger_assignment'
  | 'shop_notification'
  | 'payment_success'
  | 'payment_failed'
  | 'payment_refunded';

interface SendEmailParams {
  type: EmailType;
  to: string;
  userId?: string | null;
  userType?: 'customer' | 'driver' | 'admin' | 'shop' | null;
  orderId?: string | null;
  data?: Record<string, any>;
}

export interface SendEmailResult {
  id: string | null;
  status: string;
  duplicate: boolean;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const url = edgeUrl();
  const {
    data: { session },
  } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      return { id: null, status: 'failed', duplicate: false, error: `HTTP ${res.status}` };
    }
    const json = await res.json();
    return json as SendEmailResult;
  } catch (err: any) {
    return { id: null, status: 'failed', duplicate: false, error: err.message };
  }
}

export async function retryEmail(emailId: string): Promise<{ status: string; error?: string }> {
  const url = edgeUrl();
  const {
    data: { session },
  } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ retry: true, id: emailId }),
    });
    if (!res.ok) return { status: 'failed', error: `HTTP ${res.status}` };
    return await res.json();
  } catch (err: any) {
    return { status: 'failed', error: err.message };
  }
}

export const EmailType = {
  WELCOME: 'welcome' as EmailType,
  EMAIL_VERIFICATION: 'email_verification' as EmailType,
  PASSWORD_RESET: 'password_reset' as EmailType,
  ORDER_CONFIRMATION: 'order_confirmation' as EmailType,
  ORDER_STATUS: 'order_status' as EmailType,
  MESSENGER_ASSIGNMENT: 'messenger_assignment' as EmailType,
  SHOP_NOTIFICATION: 'shop_notification' as EmailType,
  PAYMENT_SUCCESS: 'payment_success' as EmailType,
  PAYMENT_FAILED: 'payment_failed' as EmailType,
  PAYMENT_REFUNDED: 'payment_refunded' as EmailType,
};
