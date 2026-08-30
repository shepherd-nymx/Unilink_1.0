import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// UniLink Paynow Payment Initiation
//
// Receives a payment request from the frontend, calls the Paynow initiate API,
// stores the transaction, and returns the Paynow payment URL for redirect.
//
// Paynow Integration ID and Key are configured per project.
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PAYNOW_ID = "26582";
const PAYNOW_KEY = "56a31fa1-0a7a-4818-a798-62d09c2c0f8c";
const PAYNOW_INITIATE_URL = "https://www.paynow.co.zw/interface/initiate/";

const APP_URL = (Deno.env.get("APP_URL") || "https://unilinkbase.com").replace(/\/$/, "");
const FUNCTION_BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1/paynow-result`;

function md5(str: string): string {
  return createHash("md5").update(str).digest("hex");
}

function generateHash(values: string[]): string {
  return md5(values.join("") + PAYNOW_KEY);
}

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase server credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

interface InitiateRequest {
  payment_type: "marketplace_order" | "delivery_request" | "shop_registration";
  entity_id?: string;
  amount: number;
  reference: string;
  description: string;
  auth_email?: string;
  return_url?: string;
  user_id?: string;
  metadata?: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: InitiateRequest = await req.json();

    if (!body.amount || body.amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.reference) {
      return new Response(JSON.stringify({ error: "Reference is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.payment_type) {
      return new Response(JSON.stringify({ error: "Payment type is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount = body.amount.toFixed(2);
    const returnUrl = body.return_url || `${APP_URL}/customer/paynow-return`;
    const resultUrl = FUNCTION_BASE;
    const additionalInfo = body.description || "UniLink Payment";
    const authEmail = body.auth_email || "";

    // Build form fields in the correct order for hashing
    const fieldValues = [PAYNOW_ID, body.reference, amount, additionalInfo, returnUrl, resultUrl];
    if (authEmail) fieldValues.push(authEmail);

    const hash = generateHash(fieldValues);

    // Build form-encoded body
    const params = new URLSearchParams();
    params.set("id", PAYNOW_ID);
    params.set("reference", body.reference);
    params.set("amount", amount);
    params.set("additionalinfo", additionalInfo);
    params.set("returnurl", returnUrl);
    params.set("resulturl", resultUrl);
    if (authEmail) params.set("authemail", authEmail);
    params.set("hash", hash);

    // Call Paynow initiate API
    const paynowRes = await fetch(PAYNOW_INITIATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const responseText = await paynowRes.text();
    const responseParams = new URLSearchParams(responseText);

    const status = responseParams.get("status") || "";
    const pollUrl = responseParams.get("pollurl") || "";
    const browserUrl = responseParams.get("browserurl") || "";
    const errorMsg = responseParams.get("error") || "";
    const responseHash = responseParams.get("hash") || "";

    // Verify response hash
    let expectedHash: string;
    if (status.toLowerCase() === "ok") {
      expectedHash = md5(status + pollUrl + browserUrl + PAYNOW_KEY);
    } else {
      expectedHash = md5(status + errorMsg + PAYNOW_KEY);
    }

    const hashValid = responseHash.toLowerCase() === expectedHash.toLowerCase();

    if (status.toLowerCase() !== "ok" || !hashValid) {
      // Store failed attempt
      const supabase = getSupabase();
      await supabase.from("paynow_transactions").insert({
        reference: body.reference,
        payment_type: body.payment_type,
        entity_id: body.entity_id || null,
        user_id: body.user_id || null,
        amount: body.amount,
        status: "failed",
        paynow_status: status,
        metadata: { error: errorMsg, hash_valid: hashValid, ...body.metadata },
      });

      return new Response(JSON.stringify({
        error: errorMsg || "Paynow initiation failed",
        status,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store successful initiation
    const supabase = getSupabase();
    const { data: txn, error: dbErr } = await supabase
      .from("paynow_transactions")
      .insert({
        reference: body.reference,
        payment_type: body.payment_type,
        entity_id: body.entity_id || null,
        user_id: body.user_id || null,
        amount: body.amount,
        status: "initiated",
        paynow_poll_url: pollUrl,
        paynow_payment_url: browserUrl,
        metadata: body.metadata || null,
      })
      .select("id")
      .maybeSingle();

    if (dbErr) throw dbErr;

    return new Response(JSON.stringify({
      success: true,
      payment_url: browserUrl,
      poll_url: pollUrl,
      reference: body.reference,
      transaction_id: txn?.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
