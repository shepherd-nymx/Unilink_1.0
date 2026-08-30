import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// UniLink Paynow Result Callback Handler
//
// Paynow calls this endpoint after a transaction is processed (paid, cancelled,
// failed, or delivered). We verify the hash, update the transaction status in
// the database, and update the related entity (order, delivery, shop).
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PAYNOW_KEY = "56a31fa1-0a7a-4818-a798-62d09c2c0f8c";

function md5(str: string): string {
  return createHash("md5").update(str).digest("hex");
}

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase server credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

function mapPaynowStatus(paynowStatus: string): string {
  const s = paynowStatus.toLowerCase();
  if (s === "paid" || s === "delivered") return "paid";
  if (s === "cancelled" || s === "cancelled by user") return "cancelled";
  if (s === "failed" || s === "disputed") return "failed";
  if (s === "created" || s === "sent") return "created";
  if (s === "delivered") return "delivered";
  return s;
}

async function updateMarketplaceOrder(
  supabase: ReturnType<typeof getSupabase>,
  txn: { entity_id: string | null; reference: string; amount: number; paynow_amount_paid: number | null }
) {
  if (!txn.entity_id) return;
  // Update shop_orders payment status
  await supabase
    .from("shop_orders")
    .update({ payment_status: "paid", payment_method: "paynow" })
    .eq("id", txn.entity_id);
}

async function updateDeliveryRequest(
  supabase: ReturnType<typeof getSupabase>,
  txn: { entity_id: string | null; reference: string }
) {
  if (!txn.entity_id) return;
  // Update delivery_requests payment status
  await supabase
    .from("delivery_requests")
    .update({ payment_status: "paid", payment_method: "paynow" })
    .eq("id", txn.entity_id);
}

async function updateShopRegistration(
  supabase: ReturnType<typeof getSupabase>,
  txn: { entity_id: string | null; reference: string }
) {
  if (!txn.entity_id) return;
  // Auto-activate the shop after successful registration payment
  await supabase
    .from("shops")
    .update({ status: "active", payment_proof: "paynow_verified" })
    .eq("id", txn.entity_id);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Paynow sends data as form-encoded POST or GET query params
    let params: URLSearchParams;
    if (req.method === "GET") {
      const url = new URL(req.url);
      params = url.searchParams;
    } else {
      const text = await req.text();
      params = new URLSearchParams(text);
    }

    const reference = params.get("reference") || "";
    const paynowReference = params.get("paynowreference") || "";
    const paynowStatus = params.get("status") || "";
    const amount = params.get("amount") || "";
    const hash = params.get("hash") || "";

    if (!reference || !hash) {
      return new Response(JSON.stringify({ error: "Missing reference or hash" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify hash
    const expectedHash = md5(reference + paynowReference + paynowStatus + amount + PAYNOW_KEY);
    if (hash.toLowerCase() !== expectedHash.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Hash verification failed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mappedStatus = mapPaynowStatus(paynowStatus);
    const paidAmount = amount ? parseFloat(amount) : null;

    const supabase = getSupabase();

    // Find and update the transaction
    const { data: txn, error: findErr } = await supabase
      .from("paynow_transactions")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (findErr || !txn) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update transaction
    await supabase
      .from("paynow_transactions")
      .update({
        status: mappedStatus,
        paynow_status: paynowStatus,
        paynow_amount_paid: paidAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", txn.id);

    // If paid, update the related entity
    if (mappedStatus === "paid") {
      const txnData = {
        entity_id: txn.entity_id,
        reference: txn.reference,
        amount: parseFloat(txn.amount),
        paynow_amount_paid: paidAmount,
      };

      if (txn.payment_type === "marketplace_order") {
        await updateMarketplaceOrder(supabase, txnData);
      } else if (txn.payment_type === "delivery_request") {
        await updateDeliveryRequest(supabase, txnData);
      } else if (txn.payment_type === "shop_registration") {
        await updateShopRegistration(supabase, txnData);
      }
    }

    return new Response(JSON.stringify({ success: true, status: mappedStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
