import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { startPaynowPayment, generateReference } from '@/lib/paynow-service';
import type {
  ServiceType,
  PaymentMethod,
  DeliveryMethod,
  DeliveryMode,
  BuyAndDeliverForm,
  PickupAndDeliverForm,
  DeliveryRequestRow,
} from '@/lib/delivery-request-types';

interface SubmitBuyPayload {
  customerId: string;
  form: BuyAndDeliverForm;
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
  deliveryMode: DeliveryMode;
  driverId: string | null;
  offerFee: string;
}

interface SubmitPickupPayload {
  customerId: string;
  form: PickupAndDeliverForm;
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
  deliveryMode: DeliveryMode;
  driverId: string | null;
  offerFee: string;
}

export function useDeliveryRequest() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitBuyAndDeliver = useCallback(async (payload: SubmitBuyPayload): Promise<string | null> => {
    const { customerId, form, paymentMethod, deliveryMethod, deliveryMode, driverId, offerFee } = payload;
    setSubmitting(true);
    setError(null);
    try {
      const { data: req, error: reqErr } = await supabase
        .from('delivery_requests')
        .insert({
          customer_id: customerId,
          service_type: 'buy_and_deliver' as ServiceType,
          payment_method: paymentMethod,
          delivery_method: deliveryMethod,
          delivery_mode: deliveryMode,
          driver_id: deliveryMode === 'direct' ? driverId : null,
          offer_fee: deliveryMode === 'direct' && offerFee ? parseFloat(offerFee) || null : null,
          notes: form.instructions,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single();

      if (reqErr || !req) throw reqErr ?? new Error('Failed to create request');

      const { error: detailErr } = await supabase
        .from('delivery_request_buy_details')
        .insert({
          request_id: req.id,
          item_name: form.itemName,
          quantity: form.quantity,
          shop_name: form.shopName,
          shop_location: form.shopLocation,
          budget_estimate: parseFloat(form.budgetEstimate) || 0,
          destination_lat: form.destination?.lat ?? 0,
          destination_lng: form.destination?.lng ?? 0,
          destination_address: form.destination?.address ?? '',
          instructions: form.instructions,
        });

      if (detailErr) throw detailErr;

      if (paymentMethod === 'paynow') {
        const amount = parseFloat(form.budgetEstimate) || 0;
        if (amount > 0) {
          const ref = generateReference('delivery_request', req.id);
          await startPaynowPayment({
            paymentType: 'delivery_request',
            entityId: req.id,
            amount,
            reference: ref,
            description: `UniLink Delivery - ${form.itemName}`,
            metadata: { request_id: req.id, item: form.itemName, shop: form.shopName },
          });
        }
      }

      return req.id;
    } catch (err: any) {
      setError(err?.message ?? 'Failed to submit request');
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const submitPickupAndDeliver = useCallback(async (payload: SubmitPickupPayload): Promise<string | null> => {
    const { customerId, form, paymentMethod, deliveryMethod, deliveryMode, driverId, offerFee } = payload;
    setSubmitting(true);
    setError(null);
    try {
      const { data: req, error: reqErr } = await supabase
        .from('delivery_requests')
        .insert({
          customer_id: customerId,
          service_type: 'pickup_and_deliver' as ServiceType,
          payment_method: paymentMethod,
          delivery_method: deliveryMethod,
          delivery_mode: deliveryMode,
          driver_id: deliveryMode === 'direct' ? driverId : null,
          offer_fee: deliveryMode === 'direct' && offerFee ? parseFloat(offerFee) || null : null,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single();

      if (reqErr || !req) throw reqErr ?? new Error('Failed to create request');

      const { error: detailErr } = await supabase
        .from('delivery_request_pickup_details')
        .insert({
          request_id: req.id,
          pickup_lat: form.pickup?.lat ?? 0,
          pickup_lng: form.pickup?.lng ?? 0,
          pickup_address: form.pickup?.address ?? '',
          pickup_contact_name: form.pickupContactName,
          pickup_contact_phone: form.pickupContactPhone,
          pickup_landmark: form.pickupLandmark,
          pickup_notes: form.pickupNotes,
          destination_lat: form.destination?.lat ?? 0,
          destination_lng: form.destination?.lng ?? 0,
          destination_address: form.destination?.address ?? '',
          receiver_name: form.receiverName,
          receiver_phone: form.receiverPhone,
          destination_notes: form.destinationNotes,
        });

      if (detailErr) throw detailErr;

      if (paymentMethod === 'paynow') {
        const ref = generateReference('delivery_request', req.id);
        await startPaynowPayment({
          paymentType: 'delivery_request',
          entityId: req.id,
          amount: 5,
          reference: ref,
          description: `UniLink Pickup & Deliver`,
          metadata: { request_id: req.id },
        });
      }

      return req.id;
    } catch (err: any) {
      setError(err?.message ?? 'Failed to submit request');
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const fetchMyRequests = useCallback(async (customerId: string): Promise<DeliveryRequestRow[]> => {
    const { data, error: fetchErr } = await supabase
      .from('delivery_requests')
      .select(`
        *,
        delivery_request_buy_details(*),
        delivery_request_pickup_details(*),
        drivers(full_name, phone_number, ecocash_code)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (fetchErr) return [];
    return (data as DeliveryRequestRow[]) ?? [];
  }, []);

  const cancelRequest = useCallback(async (requestId: string): Promise<boolean> => {
    const { error: cancelErr } = await supabase
      .from('delivery_requests')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', requestId);
    return !cancelErr;
  }, []);

  const acceptRequest = useCallback(async (requestId: string, driverId: string): Promise<boolean> => {
    const { data: req, error: fetchErr } = await supabase
      .from('delivery_requests')
      .select('customer_id')
      .eq('id', requestId)
      .eq('status', 'pending')
      .maybeSingle();

    if (fetchErr || !req) return false;

    const { error: acceptErr } = await supabase
      .from('delivery_requests')
      .update({
        status: 'accepted',
        driver_id: driverId,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('status', 'pending');

    if (acceptErr) return false;

    await supabase.rpc('get_or_create_conversation', {
      p_driver_id: driverId,
      p_customer_id: req.customer_id,
    });

    return true;
  }, []);

  const updateStatus = useCallback(async (requestId: string, status: string): Promise<boolean> => {
    const updates: Record<string, string> = { status };
    if (status === 'delivered') updates.completed_at = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('delivery_requests')
      .update(updates)
      .eq('id', requestId);
    return !updateErr;
  }, []);

  // Undo a delivered status — only works within 10 minutes (snapshot expiry window)
  const undoDeliver = useCallback(async (requestId: string): Promise<boolean> => {
    const { data, error: fetchErr } = await supabase
      .from('delivery_requests')
      .select('status, delivered_snapshot_expires_at')
      .eq('id', requestId)
      .maybeSingle();

    if (fetchErr || !data) return false;
    if (data.status !== 'delivered') return false;
    if (!data.delivered_snapshot_expires_at) return false;
    if (new Date(data.delivered_snapshot_expires_at) < new Date()) return false;

    const { error: updateErr } = await supabase
      .from('delivery_requests')
      .update({ status: 'in_progress', completed_at: null } as any)
      .eq('id', requestId);

    return !updateErr;
  }, []);

  return {
    submitting,
    error,
    setError,
    submitBuyAndDeliver,
    submitPickupAndDeliver,
    fetchMyRequests,
    cancelRequest,
    acceptRequest,
    updateStatus,
    undoDeliver,
  };
}
