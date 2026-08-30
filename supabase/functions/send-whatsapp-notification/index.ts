import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WhatsAppPayload {
  orderId: string;
  orderNumber: string;
  driverId: string;
  driverPhone: string;
  driverWhatsApp?: string | null;
  shopName: string;
  shopAddress: string;
  customerName: string;
  customerPhone: string;
  deliveryLocation: string;
  items: Array<{ name: string; qty: number; price: number }>;
  totalAmount: number;
  deliveryFee: number;
  paymentMethod: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: WhatsAppPayload = await req.json();
    const {
      orderId, orderNumber, driverId, driverPhone, driverWhatsApp,
      shopName, shopAddress, customerName, customerPhone,
      deliveryLocation, items, totalAmount, deliveryFee, paymentMethod,
    } = body;

    if (!orderId || !driverId) {
      return new Response(JSON.stringify({ error: "Missing orderId or driverId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Check for duplicate notification
    const { data: existing } = await fetch(
      `${supabaseUrl}/rest/v1/whatsapp_notifications?order_id=eq.${orderId}&driver_id=eq.${driverId}&select=id`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    ).then(r => r.json());

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ sent: false, reason: "duplicate" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = driverWhatsApp || driverPhone;
    const cleanPhone = phone?.replace(/[^0-9]/g, "");
    if (!cleanPhone) {
      return new Response(JSON.stringify({ sent: false, reason: "no_phone" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itemsText = items.map(i => `• ${i.qty}x ${i.name} - $${Number(i.price).toFixed(2)}`).join("\n");
    const grandTotal = Number(totalAmount) + Number(deliveryFee);

    const message = `🛵 *NEW DELIVERY ASSIGNMENT - UniLink*

📋 *Order:* #${orderNumber}
🏪 *Shop:* ${shopName}
📍 *Pickup:* ${shopAddress}

👤 *Customer:* ${customerName}
📞 *Customer Phone:* ${customerPhone}
🏠 *Delivery To:* ${deliveryLocation}

🛍️ *Items:*
${itemsText}

💰 *Order Total:* $${grandTotal.toFixed(2)}
💵 *Payment:* ${paymentMethod === "pay_on_delivery" ? "Pay on Delivery" : paymentMethod === "paynow" ? "Paynow" : paymentMethod}

Please confirm you can handle this delivery. Thank you!`;

    // Send via WhatsApp Business API (Meta Cloud API)
    const waToken = Deno.env.get("WHATSAPP_TOKEN");
    const waPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    let sent = false;
    let waError: string | null = null;

    if (waToken && waPhoneId) {
      try {
        const waRes = await fetch(
          `https://graph.facebook.com/v18.0/${waPhoneId}/messages`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${waToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: cleanPhone,
              type: "text",
              text: { body: message },
            }),
          }
        );
        if (waRes.ok) {
          sent = true;
        } else {
          waError = `${waRes.status}: ${await waRes.text()}`;
        }
      } catch (e: any) {
        waError = e.message;
      }
    }

    // Fallback: Twilio WhatsApp sandbox
    if (!sent) {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioWhatsAppFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");

      if (twilioSid && twilioToken && twilioWhatsAppFrom) {
        try {
          const auth = btoa(`${twilioSid}:${twilioToken}`);
          const twilioRes = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Authorization": `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                From: `whatsapp:${twilioWhatsAppFrom}`,
                To: `whatsapp:${cleanPhone}`,
                Body: message,
              }),
            }
          );
          if (twilioRes.ok) {
            sent = true;
          } else {
            waError = `twilio: ${twilioRes.status}: ${await twilioRes.text()}`;
          }
        } catch (e: any) {
          waError = `twilio: ${e.message}`;
        }
      }
    }

    // Record the notification attempt
    await fetch(`${supabaseUrl}/rest/v1/whatsapp_notifications`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order_id: orderId,
        driver_id: driverId,
        phone_number: cleanPhone,
        message_body: message,
        status: sent ? "sent" : "failed",
        error_detail: sent ? null : waError,
      }),
    });

    return new Response(JSON.stringify({ sent, error: sent ? null : waError }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
