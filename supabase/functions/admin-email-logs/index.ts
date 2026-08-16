import { createClient } from "npm:@supabase/supabase-js@2.58.0";

// ---------------------------------------------------------------------------
// Admin email logs reader + retry
//
// The UniLink admin auth is custom (admins.password_hash), not Supabase Auth,
// so we can't rely on a Supabase JWT. We verify admin credentials against the
// admins table, then use the service-role key (bypasses RLS).
//
// POST { adminId, username, action: "list" | "retry", ... }
//   action=list  → { status?, type?, dateFrom?, dateTo?, page?, perPage? }
//   action=retry → { emailId }
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API = "https://api.resend.com/emails";
const FROM_ADDRESS = Deno.env.get("EMAIL_FROM") || "no-reply@unilinkbase.com";
const APP_URL = (Deno.env.get("APP_URL") || "https://unilinkbase.com").replace(/\/$/, "");

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase server credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Order Received",
  accepted: "Order Confirmed",
  in_progress: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

type EmailType =
  | "welcome" | "email_verification" | "password_reset"
  | "order_confirmation" | "order_status" | "messenger_assignment"
  | "shop_notification" | "payment_success" | "payment_failed" | "payment_refunded";

// ---------------------------------------------------------------------------
// Email rendering (shared with resend-email function — duplicated because
// edge functions must not share code per the skill rules).
// ---------------------------------------------------------------------------
function escapeHtml(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatMoney(v: any): string { return `$${Number(v ?? 0).toFixed(2)}`; }
function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 8px auto;"><tr><td style="border-radius:10px;background:#0066ff;text-align:center;"><a href="${href}" style="display:inline-block;padding:14px 28px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a></td></tr></table>`;
}
function emailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;padding:0;background:#f0f4f8;font-family:'Helvetica Neue',Arial,sans-serif;color:#0a1929;}.wrap{max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;}.content{padding:32px 28px;}h1{font-size:22px;font-weight:800;margin:0 0 12px 0;}p{font-size:15px;line-height:24px;margin:0 0 14px 0;color:#2d3748;}.small{font-size:13px;color:#64748b;}.footer{padding:20px 28px;text-align:center;}.footer a{color:#0066ff;text-decoration:none;}@media(max-width:520px){.content{padding:24px 18px;}h1{font-size:20px;}}</style></head><body><div style="padding:24px 12px;"><div class="wrap"><div style="text-align:center;margin:0 0 24px 0;"><div style="display:inline-block;background:#0066ff;color:#fff;font-weight:800;font-size:22px;letter-spacing:2px;padding:12px 22px;border-radius:10px;">UNI<span style="color:#00d4ff;">LINK</span></div></div><div class="content">${bodyHtml}</div><div class="footer"><p class="small">UniLink — connect, deliver, and receive anywhere, anytime.</p><p class="small"><a href="${APP_URL}/support">Help &amp; Support</a> &middot; <a href="${APP_URL}">unilinkbase.com</a></p></div></div></div></body></html>`;
}
function plainTextWrap(body: string): string { return `${body}\n\n— UniLink\n${APP_URL}`; }

function render(req: { type: EmailType; data: Record<string, any> }): { subject: string; html: string; text: string } {
  const d = req.data || {};
  switch (req.type) {
    case "welcome": {
      const name = d.name || "there";
      return { subject: "Welcome to UniLink!", html: `<h1>Welcome to UniLink, ${escapeHtml(name)}!</h1><p>We're thrilled to have you. UniLink connects students with trusted messengers to order groceries and essentials and get them delivered to their door.</p>${ctaButton(APP_URL, "Open UniLink")}`, text: `Welcome to UniLink, ${name}!\n\nOpen: ${APP_URL}` };
    }
    case "email_verification": {
      const link = d.verificationUrl || `${APP_URL}/verify?token=${d.token || ""}`;
      return { subject: "Verify your UniLink email", html: `<h1>Verify your email</h1><p>Confirm your email address.</p>${ctaButton(link, "Verify Email")}<p class="small">Link: ${link}</p>`, text: `Verify: ${link}` };
    }
    case "password_reset": {
      const link = d.resetUrl || `${APP_URL}/reset?token=${d.token || ""}`;
      return { subject: "Reset your UniLink password", html: `<h1>Reset your password</h1><p>Choose a new password.</p>${ctaButton(link, "Reset Password")}<p class="small">Link: ${link}</p>`, text: `Reset: ${link}` };
    }
    case "order_confirmation": {
      const n = d.orderNumber || d.orderId || "—";
      const items = Array.isArray(d.items) ? d.items : [];
      const total = d.totalAmount != null ? Number(d.totalAmount).toFixed(2) : "—";
      const fee = d.deliveryFee != null ? Number(d.deliveryFee).toFixed(2) : "—";
      const addr = d.address || "—";
      const rows = items.map((it:any)=>`<tr><td style="padding:6px 0;">${escapeHtml(it.name||it.item||"Item")} ×${it.qty??it.quantity??1}</td><td style="text-align:right;padding:6px 0;">${formatMoney(it.price)}</td></tr>`).join("");
      return { subject: `Order #${n} confirmed`, html: `<h1>Order confirmed — #${escapeHtml(n)}</h1><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:14px;">${rows}</table><p><strong>Fee:</strong> $${fee} <strong>Total:</strong> $${total}</p><p><strong>Address:</strong><br>${escapeHtml(addr)}</p>${ctaButton(`${APP_URL}/customer/orders?orderId=${encodeURIComponent(n)}`, "Track Order")}`, text: `Order #${n} confirmed. Total: $${total}. Track: ${APP_URL}/customer/orders?orderId=${encodeURIComponent(n)}` };
    }
    case "order_status": {
      const n = d.orderNumber || d.orderId || "—";
      const label = STATUS_LABELS[d.statusTo || d.status || ""] || d.statusTo || d.status || "—";
      return { subject: `Order #${n}: ${label}`, html: `<h1>Order #${escapeHtml(n)} — ${escapeHtml(label)}</h1><p style="font-size:18px;font-weight:800;color:#0066ff;">${escapeHtml(label)}</p>${ctaButton(`${APP_URL}/customer/orders?orderId=${encodeURIComponent(n)}`, "Track Order")}`, text: `Order #${n}: ${label}. Track: ${APP_URL}/customer/orders?orderId=${encodeURIComponent(n)}` };
    }
    case "messenger_assignment": {
      const n = d.orderNumber || d.orderId || "—";
      return { subject: `New delivery assigned — #${n}`, html: `<h1>Delivery assigned — #${escapeHtml(n)}</h1><p><strong>Pickup:</strong><br>${escapeHtml(d.pickup||"—")}</p><p><strong>Drop-off:</strong><br>${escapeHtml(d.delivery||d.address||"—")}</p>${ctaButton(`${APP_URL}/driver/delivery-requests`, "Open Dashboard")}`, text: `Delivery #${n}. Dashboard: ${APP_URL}/driver/delivery-requests` };
    }
    case "shop_notification": {
      const n = d.orderNumber || d.orderId || "—";
      const action = d.action || "new_order";
      const h = action === "confirmed" ? `Order #${n} confirmed` : action === "rejected" ? `Order #${n} rejected` : "You have a new order";
      return { subject: h, html: `<h1>${escapeHtml(h)}</h1><p>Order #${escapeHtml(n)}.</p>${ctaButton(`${APP_URL}/admin/deliveries`, "Open Dashboard")}`, text: `${h}. Dashboard: ${APP_URL}/admin/deliveries` };
    }
    case "payment_success": case "payment_failed": case "payment_refunded": {
      const kind = req.type.replace("payment_", "") as "success" | "failed" | "refunded";
      const n = d.orderNumber || d.orderId || "—";
      const amt = d.amount != null ? Number(d.amount).toFixed(2) : "—";
      const map = {
        success: { h: "Payment received", p: `Payment of $${amt} for order #${n} received.`, s: `Payment received — #${n}` },
        failed: { h: "Payment failed", p: `Payment of $${amt} for order #${n} failed.`, s: `Payment failed — #${n}` },
        refunded: { h: "Refund processed", p: `Refund of $${amt} for order #${n} processed.`, s: `Refund processed — #${n}` },
      }[kind];
      return { subject: map.s, html: `<h1>${escapeHtml(map.h)}</h1><p>${escapeHtml(map.p)}</p>${ctaButton(`${APP_URL}/customer/orders?orderId=${encodeURIComponent(n)}`, "View Order")}`, text: `${map.h}. ${map.p}` };
    }
    default: throw new Error(`Unknown email type: ${req.type}`);
  }
}

async function sendViaResend(payload: { from: string; to: string; subject: string; html: string; text: string }): Promise<{ id: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  const res = await fetch(RESEND_API, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.message || body?.error || `Resend HTTP ${res.status}`);
  return { id: body.id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json();
    const { adminId, username, action = "list" } = body || {};
    if (!adminId || !username) return new Response(JSON.stringify({ error: "admin credentials required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = getSupabase();
    const { data: admin, error: adminErr } = await supabase.from("admins").select("id, username").eq("id", adminId).maybeSingle();
    if (adminErr || !admin) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    // username is optional but if provided must match
    if (username && admin.username !== username) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- Retry action ---
    if (action === "retry" && body.emailId) {
      const { data: existing, error } = await supabase.from("email_notifications").select("*").eq("id", body.emailId).maybeSingle();
      if (error || !existing) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (existing.status === "sent" || existing.status === "delivered") return new Response(JSON.stringify({ status: "already_sent" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      let rendered: { subject: string; html: string; text: string };
      try { rendered = render({ type: existing.type as EmailType, data: existing.metadata || {} }); }
      catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

      try {
        const { id: resendId } = await sendViaResend({
          from: `UniLink <${FROM_ADDRESS}>`,
          to: existing.recipient_email,
          subject: rendered.subject,
          html: emailShell(rendered.subject, rendered.html),
          text: plainTextWrap(rendered.text),
        });
        await supabase.from("email_notifications").update({ status: "sent", resend_id: resendId, sent_at: new Date().toISOString(), error_message: null, attempts: existing.attempts + 1 }).eq("id", existing.id);
        return new Response(JSON.stringify({ status: "sent", resendId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e: any) {
        await supabase.from("email_notifications").update({ status: "failed", error_message: e.message, attempts: existing.attempts + 1 }).eq("id", existing.id);
        return new Response(JSON.stringify({ status: "failed", error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // --- List action ---
    const { status, type, dateFrom, dateTo, page = 1, perPage = 50 } = body;
    let query = supabase.from("email_notifications").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (status && status !== "all") query = query.eq("status", status);
    if (type && type !== "all") query = query.eq("type", type);
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo);
    const offset = (Number(page) - 1) * Number(perPage);
    query = query.range(offset, offset + Number(perPage) - 1);
    const { data, count, error } = await query;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ rows: data || [], total: count ?? 0, page: Number(page), perPage: Number(perPage) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
