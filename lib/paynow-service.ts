import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// UniLink Paynow Client Service
//
// Provides functions to initiate Paynow payments from the frontend and poll
// for payment status. The actual Paynow API call happens in the paynow-initiate
// edge function to keep credentials server-side.
// ---------------------------------------------------------------------------

export type PaynowPaymentType = 'marketplace_order' | 'delivery_request' | 'shop_registration';

export type PaynowStatus = 'initiated' | 'created' | 'paid' | 'cancelled' | 'failed' | 'delivered';

export interface PaynowInitiateParams {
  paymentType: PaynowPaymentType;
  entityId?: string;
  amount: number;
  reference: string;
  description: string;
  authEmail?: string;
  returnUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaynowInitiateResult {
  success: boolean;
  paymentUrl: string;
  pollUrl: string;
  reference: string;
  transactionId?: string;
  error?: string;
}

export interface PaynowTransaction {
  id: string;
  reference: string;
  payment_type: PaynowPaymentType;
  entity_id: string | null;
  user_id: string | null;
  amount: number;
  status: PaynowStatus;
  paynow_poll_url: string | null;
  paynow_payment_url: string | null;
  paynow_status: string | null;
  paynow_amount_paid: number | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Initiate a Paynow payment. Returns the Paynow payment URL to redirect the user to.
 */
export async function initiatePaynowPayment(params: PaynowInitiateParams): Promise<PaynowInitiateResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/paynow-initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        payment_type: params.paymentType,
        entity_id: params.entityId,
        amount: params.amount,
        reference: params.reference,
        description: params.description,
        auth_email: params.authEmail,
        return_url: params.returnUrl,
        user_id: user?.id,
        metadata: params.metadata,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return {
        success: false,
        paymentUrl: '',
        pollUrl: '',
        reference: params.reference,
        error: errBody.error || `Request failed (${response.status})`,
      };
    }

    const data = await response.json();
    if (data.error) {
      return {
        success: false,
        paymentUrl: '',
        pollUrl: '',
        reference: params.reference,
        error: data.error,
      };
    }

    return {
      success: true,
      paymentUrl: data.payment_url,
      pollUrl: data.poll_url,
      reference: data.reference,
      transactionId: data.transaction_id,
    };
  } catch (err: any) {
    return {
      success: false,
      paymentUrl: '',
      pollUrl: '',
      reference: params.reference,
      error: err.message || 'Failed to initiate Paynow payment',
    };
  }
}

/**
 * Poll the Paynow transaction status by reference from our database.
 */
export async function pollPaynowStatus(reference: string): Promise<PaynowTransaction | null> {
  try {
    const { data, error } = await supabase
      .from('paynow_transactions')
      .select('*')
      .eq('reference', reference)
      .maybeSingle();
    if (error) return null;
    return data as PaynowTransaction | null;
  } catch {
    return null;
  }
}

/**
 * Generate a unique reference for a Paynow transaction.
 */
export function generateReference(type: PaynowPaymentType, entityId?: string): string {
  const prefix = type === 'marketplace_order' ? 'MKT' : type === 'delivery_request' ? 'DEL' : 'REG';
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  const entity = entityId ? entityId.substring(0, 8) : '';
  return `${prefix}-${entity}-${ts}${rand}`;
}

/**
 * Redirect the user to the Paynow payment page.
 * On web, this opens in a new tab. On mobile, it opens the browser.
 */
export function redirectToPaynow(paymentUrl: string): void {
  if (typeof window !== 'undefined') {
    window.location.href = paymentUrl;
  }
}

/**
 * Start a payment flow: initiate, then redirect to Paynow.
 * Returns the result so the caller can show errors or store the reference.
 */
export async function startPaynowPayment(params: PaynowInitiateParams): Promise<PaynowInitiateResult> {
  const result = await initiatePaynowPayment(params);
  if (result.success && result.paymentUrl) {
    redirectToPaynow(result.paymentUrl);
  }
  return result;
}
