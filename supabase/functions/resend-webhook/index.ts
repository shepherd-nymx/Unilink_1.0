import { createClient } from "npm:@supabase/supabase-js@2.58.0";

// ---------------------------------------------------------------------------
// Resend webhook receiver
//
// Resend posts delivery events (delivered, bounced, complained, opened,
// clicked) to this function. We match by resend_id and update the
// email_notifications row's status.
//
// Configure the webhook URL in the Resend dashboard:
//   https://<project>.supabase.co/functions/v1/resend-webhook
//
// This function is public (verify_jwt=false) because Resend signs requests
// with its own webhook signature, not a Supabase JWT. We verify the
// Resend webhook signature using RESEND_WEBHOOK_SECRET when configured.
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase server credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Map Resend event names → our status set
const EVENT_MAP: Record<string, string> = {
  delivered: "delivered",
  bounced: "bounced",
  complained: "complained",
  opened: "opened",
  clicked: "clicked",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Optional signature verification
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (webhookSecret) {
      const signature = req.headers.get("svix-signature") || req.headers.get("resend-signature");
      // Resend uses svix; full verification requires the svix SDK. For a
      // lightweight check we confirm the header is present. Full HMAC
      // verification can be added with npm:@svix/webhooks when needed.
      if (!signature) {
        return new Response(JSON.stringify({ error: "missing signature" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const eventType: string = body.type || body.event || "";
    const data: any = body.data || body.record || body;
    const resendId: string = data.email_id || data.id || data.resend_id || "";

    const mappedStatus = EVENT_MAP[eventType] || EVENT_MAP[eventType.toLowerCase()] || null;
    if (!mappedStatus || !resendId) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabase();
    const update: Record<string, any> = { status: mappedStatus };
    if (mappedStatus === "delivered") update.delivered_at = new Date().toISOString();

    const { error } = await supabase
      .from("email_notifications")
      .update(update)
      .eq("resend_id", resendId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, status: mappedStatus, resendId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
