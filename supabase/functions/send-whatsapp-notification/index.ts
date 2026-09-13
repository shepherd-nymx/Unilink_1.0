import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WhatsAppPayload {
  orderId: string;
  orderNumber: string;
  driverId?: string;
  driverPhone?: string;
  driverWhatsApp?: string | null;
  shopName: string;
  shopAddress: string;
  shopWhatsApp?: string | null;
  customerName: string;
  customerPhone: string;
  deliveryLocation: string;
  items: Array<{ name: string; qty: number; price: number }>;
  totalAmount: number;
  deliveryFee: number;
  paymentMethod: string;
  recipientType?: "driver" | "shop";
}

async function sendWhatsAppMessage(
  cleanPhone: string,
  message: string,
): Promise<{ sent: boolean; error: string | null }> {
  let sent = false;
  let waError: string | null = null;

  const waToken = Deno.env.get("WHATSAPP_TOKEN");
  const waPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

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
        },
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
          },
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

  return { sent, error: sent ? null : waError };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: WhatsAppPayload = await req.json();
    const {
      orderId, orderNumber, driverId, driverPhone, driverWhatsApp,
      shopName, shopAddress, shopWhatsApp,
      customerName, customerPhone,
      deliveryLocation, items, totalAmount, deliveryFee, paymentMethod,
      recipientType = "driver",
    } = body;

    if (!orderId) {
      return new Response(JSON.stringify({ error: "Missing orderId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const itemsText = items.map((i) => `• ${i.qty}x ${i.name} - $${Number(i.price).toFixed(2)}`).join("\n");
    const grandTotal = Number(totalAmount) + Number(deliveryFee);
    const payLabel = paymentMethod === "pay_on_delivery" ? "Pay on Delivery" : paymentMethod === "paynow" ? "Paynow" : paymentMethod;

    const results: { driver?: { sent: boolean; error: string | null }; shop?: { sent: boolean; error: string | null } } = {};

    // --- Send to driver ---
    if (recipientType === "driver" && driverId) {
      const dupKey = `${orderId}__${driverId}`;
      const { data: existing } = await fetch(
        `${supabaseUrl}/rest/v1/whatsapp_notifications?order_id=eq.${orderId}&driver_id=eq.${driverId}&select=id`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      ).then((r) => r.json());

      if (existing && existing.length > 0) {
        results.driver = { sent: false, error: "duplicate" };
      } else {
        const phone = driverWhatsApp || driverPhone;
        const cleanPhone = phone?.replace(/[^0-9]/g, "");
        if (!cleanPhone) {
          results.driver = { sent: false, error: "no_phone" };
        } else {
          const driverMessage = `🛵 *NEW DELIVERY ASSIGNMENT - UniLink*

📋 *Order:* #${orderNumber}
🏪 *Shop:* ${shopName}
📍 *Pickup:* ${shopAddress}

👤 *Customer:* ${customerName}
📞 *Customer Phone:* ${customerPhone}
🏠 *Delivery To:* ${deliveryLocation}

🛍️ *Items:*
${itemsText}

💰 *Order Total:* $${grandTotal.toFixed(2)}
💵 *Payment:* ${payLabel}

Please confirm you can handle this delivery. Thank you!`;

          const { sent, error } = await sendWhatsAppMessage(cleanPhone, driverMessage);
          results.driver = { sent, error };

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
              message_body: driverMessage,
              status: sent ? "sent" : "failed",
              error_detail: sent ? null : error,
            }),
          });
        }
      }
    }

    // --- Send to shop ---
    if (shopWhatsApp) {
      const cleanShopPhone = shopWhatsApp.replace(/[^0-9]/g, "");
      if (cleanShopPhone) {
        const shopMessage = `📦 *NEW ORDER RECEIVED - UniLink*

📋 *Order:* #${orderNumber}
👤 *Customer:* ${customerName}
📞 *Customer Phone:* ${customerPhone}
🏠 *Delivery To:* ${deliveryLocation}

🛍️ *Items:*
${itemsText}

💰 *Order Total:* $${grandTotal.toFixed(2)}
💵 *Payment:* ${payLabel}

${recipientType === "driver" ? `🛵 *Assigned Messenger:* ${driverId ? "Assigned" : "Pending"}\n` : ""}The customer has confirmed this order via WhatsApp.`;

        const { sent, error } = await sendWhatsAppMessage(cleanShopPhone, shopMessage);
        results.shop = { sent, error };
      }
    }

    const anySent = Object.values(results).some((r) => r?.sent);

    return new Response(JSON.stringify({ sent: anySent, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
