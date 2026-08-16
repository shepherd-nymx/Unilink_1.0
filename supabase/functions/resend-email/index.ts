import { createClient } from "npm:@supabase/supabase-js@2.58.0";

// ---------------------------------------------------------------------------
// UniLink transactional email dispatcher (Resend)
//
// Responsibilities:
//   • Accept a typed email request from the frontend / other edge functions.
//   • Enforce idempotency via the email_notifications unique indexes.
//   • Render branded responsive HTML + plain-text bodies.
//   • Call Resend, log the result (resend_id, status), and never leak secrets.
//   • Never block the caller's flow on Resend failure — return 200 with a
//     logged error so retries can happen later.
//
// Required env (configured automatically as Supabase secrets):
//   RESEND_API_KEY   — Resend API key
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — DB access (bypasses RLS)
//   EMAIL_FROM       — sender address (default: no-reply@unilinkbase.com)
//   APP_URL          — public app base URL for CTAs (default: https://unilinkbase.com)
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API = "https://api.resend.com/emails";
const FROM_ADDRESS = Deno.env.get("EMAIL_FROM") || "no-reply@unilinkbase.com";
const APP_URL = (Deno.env.get("APP_URL") || "https://unilinkbase.com").replace(/\/$/, "");

type EmailType =
  | "welcome"
  | "email_verification"
  | "password_reset"
  | "order_confirmation"
  | "order_status"
  | "messenger_assignment"
  | "shop_notification"
  | "payment_success"
  | "payment_failed"
  | "payment_refunded"
  | "shop_approval"
  | "shop_payment_required"
  | "shop_activated"
  | "shop_new_order"
  | "shop_order_status"
  | "shop_messenger_assigned";

interface EmailRequest {
  type: EmailType;
  to: string;
  userId?: string | null;
  userType?: "customer" | "driver" | "admin" | "shop" | null;
  orderId?: string | null;
  data?: Record<string, any>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Order Received",
  accepted: "Order Confirmed",
  in_progress: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  confirmed: "Order Confirmed",
  preparing: "Preparing Your Order",
  ready: "Ready for Pickup",
  assigned: "Messenger Assigned",
  picked_up: "Picked Up",
  out_for_delivery: "Out for Delivery",
};

const SHOP_STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pending Approval",
  payment_required: "Payment Required",
  payment_submitted: "Payment Submitted",
  active: "Active",
  suspended: "Suspended",
  rejected: "Rejected",
};

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase server credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function reserveEmailSlot(
  supabase: ReturnType<typeof getSupabase>,
  req: EmailRequest,
  subject: string,
): Promise<{ id: string | null; isDuplicate: boolean }> {
  const row: Record<string, any> = {
    recipient_email: req.to,
    type: req.type,
    subject,
    status: "pending",
    attempts: 0,
  };
  if (req.userId) row.user_id = req.userId;
  if (req.userType) row.user_type = req.userType;
  if (req.orderId) row.order_id = req.orderId;
  if (req.data) row.metadata = req.data;

  const { data, error } = await supabase
    .from("email_notifications")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return { id: null, isDuplicate: true };
    throw error;
  }
  return { id: data?.id ?? null, isDuplicate: false };
}

async function markSent(
  supabase: ReturnType<typeof getSupabase>,
  id: string,
  resendId: string,
) {
  await supabase
    .from("email_notifications")
    .update({ status: "sent", resend_id: resendId, sent_at: new Date().toISOString() })
    .eq("id", id);
}

async function markFailed(
  supabase: ReturnType<typeof getSupabase>,
  id: string,
  message: string,
) {
  await supabase
    .from("email_notifications")
    .update({ status: "failed", error_message: message, attempts: 1 })
    .eq("id", id);
}

async function sendViaResend(payload: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ id: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    const msg = body?.message || body?.error || `Resend HTTP ${res.status}`;
    throw new Error(msg);
  }
  return { id: body.id };
}

function logoBlock(): string {
  return `
  <div style="text-align:center;margin:0 0 24px 0;">
    <div style="display:inline-block;background:#0066ff;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:22px;letter-spacing:2px;padding:12px 22px;border-radius:10px;">
      UNI<span style="color:#00d4ff;">LINK</span>
    </div>
  </div>`;
}

function ctaButton(href: string, label: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 8px auto;">
    <tr>
      <td style="border-radius:10px;background:#0066ff;text-align:center;">
        <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function emailShell(title: string, bodyHtml: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body{margin:0;padding:0;background:#f0f4f8;font-family:'Helvetica Neue',Arial,sans-serif;color:#0a1929;}
    .wrap{max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;}
    .content{padding:32px 28px;}
    h1{font-size:22px;font-weight:800;margin:0 0 12px 0;color:#0a1929;}
    p{font-size:15px;line-height:24px;margin:0 0 14px 0;color:#2d3748;}
    .small{font-size:13px;color:#64748b;}
    .footer{padding:20px 28px;text-align:center;}
    .footer a{color:#0066ff;text-decoration:none;}
    @media (max-width:520px){
      .content{padding:24px 18px;}
      h1{font-size:20px;}
    }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#ffffff;">${preheader}</div>
  <div style="padding:24px 12px;">
    <div class="wrap">
      ${logoBlock()}
      <div class="content">
        ${bodyHtml}
      </div>
      <div class="footer">
        <p class="small">UniLink — connect, deliver, and receive anywhere, anytime.</p>
        <p class="small"><a href="${APP_URL}/support">Help &amp; Support</a> &middot; <a href="${APP_URL}">unilinkbase.com</a></p>
        <p class="small" style="margin-top:8px;">You received this email because you have a UniLink account.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function plainTextWrap(body: string): string {
  return `${body}\n\n— UniLink\n${APP_URL}\nSupport: ${APP_URL}/support`;
}

// ---------------------------------------------------------------------------
// Per-type renderers
// ---------------------------------------------------------------------------
function renderWelcome(d: Record<string, any>): { subject: string; html: string; text: string } {
  const name = d.name || "there";
  const html = `
    <h1>Welcome to UniLink, ${name}!</h1>
    <p>We're thrilled to have you. UniLink connects students with trusted messengers to order groceries and essentials from local shops and get them delivered right to their door — quickly, safely, and affordably.</p>
    <p>Here's what you can do next:</p>
    <p>&bull; Place your first order from your favourite shop.<br>&bull; Track your delivery in real time.<br>&bull; Chat with your messenger inside the app.</p>
    ${ctaButton(`${APP_URL}`, "Open UniLink")}
    <p class="small">Need help? Reply to this email or visit our support page.</p>`;
  const text = `Welcome to UniLink, ${name}!\n\nWe're thrilled to have you. UniLink connects students with trusted messengers to order groceries and essentials and get them delivered to their door.\n\nOpen UniLink: ${APP_URL}`;
  return { subject: "Welcome to UniLink!", html, text };
}

function renderEmailVerification(d: Record<string, any>): { subject: string; html: string; text: string } {
  const link = d.verificationUrl || `${APP_URL}/verify?token=${d.token || ""}`;
  const html = `
    <h1>Verify your email</h1>
    <p>Tap the button below to confirm your email address and finish setting up your UniLink account.</p>
    ${ctaButton(link, "Verify Email")}
    <p class="small">If the button doesn't work, copy this link: ${link}</p>
    <p class="small">If you didn't create an account, you can safely ignore this email.</p>`;
  const text = `Verify your email\n\nConfirm your address: ${link}\n\nIf you didn't create an account, ignore this email.`;
  return { subject: "Verify your UniLink email", html, text };
}

function renderPasswordReset(d: Record<string, any>): { subject: string; html: string; text: string } {
  const link = d.resetUrl || `${APP_URL}/reset?token=${d.token || ""}`;
  const html = `
    <h1>Reset your password</h1>
    <p>We received a request to reset the password for your UniLink account. Tap below to choose a new password.</p>
    ${ctaButton(link, "Reset Password")}
    <p class="small">If the button doesn't work, copy this link: ${link}</p>
    <p class="small">This link expires soon. If you didn't request a reset, ignore this email — your password won't change.</p>`;
  const text = `Reset your password\n\nChoose a new password: ${link}\n\nIf you didn't request this, ignore this email.`;
  return { subject: "Reset your UniLink password", html, text };
}

function renderOrderConfirmation(d: Record<string, any>): { subject: string; html: string; text: string } {
  const orderNum = d.orderNumber || d.orderId || "—";
  const items = Array.isArray(d.items) ? d.items : [];
  const total = d.totalAmount != null ? Number(d.totalAmount).toFixed(2) : "—";
  const fee = d.deliveryFee != null ? Number(d.deliveryFee).toFixed(2) : "—";
  const address = d.address || "—";
  const rows = items
    .map((it: any) => `<tr><td style="padding:6px 0;">${escapeHtml(it.name || it.item || "Item")} ×${it.qty ?? it.quantity ?? 1}</td><td style="text-align:right;padding:6px 0;">${formatMoney(it.price)}</td></tr>`)
    .join("");
  const html = `
    <h1>Order confirmed — #${orderNum}</h1>
    <p>Thanks for your order! Here's a summary:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:14px;margin:8px 0 16px 0;">
      ${rows}
    </table>
    <p><strong>Delivery fee:</strong> $${fee} &nbsp; <strong>Total:</strong> $${total}</p>
    <p><strong>Delivery address:</strong><br>${escapeHtml(address)}</p>
    ${ctaButton(`${APP_URL}/customer/orders?orderId=${encodeURIComponent(orderNum)}`, "Track Order")}
    <p class="small">We'll email you again when your order status changes.</p>`;
  const text = `Order confirmed — #${orderNum}\n\nItems:\n${items.map((it:any)=>`- ${it.name||it.item} ×${it.qty??it.quantity??1} — ${formatMoney(it.price)}`).join("\n")}\n\nDelivery fee: $${fee}\nTotal: $${total}\nAddress: ${address}\n\nTrack: ${APP_URL}/customer/orders?orderId=${encodeURIComponent(orderNum)}`;
  return { subject: `Order #${orderNum} confirmed`, html, text };
}

function renderOrderStatus(d: Record<string, any>): { subject: string; html: string; text: string } {
  const orderNum = d.orderNumber || d.orderId || "—";
  const status = d.statusTo || d.status || "—";
  const label = STATUS_LABELS[status] || status;
  const html = `
    <h1>Order #${orderNum} — ${escapeHtml(label)}</h1>
    <p>Your order status just changed. Here's where things stand now:</p>
    <p style="font-size:18px;font-weight:800;color:#0066ff;">${escapeHtml(label)}</p>
    ${ctaButton(`${APP_URL}/customer/orders?orderId=${encodeURIComponent(orderNum)}`, "Track Order")}
    <p class="small">Have a question? Reply to this email or open a support ticket in the app.</p>`;
  const text = `Order #${orderNum} — ${label}\n\nTrack: ${APP_URL}/customer/orders?orderId=${encodeURIComponent(orderNum)}`;
  return { subject: `Order #${orderNum}: ${label}`, html, text };
}

function renderMessengerAssignment(d: Record<string, any>): { subject: string; html: string; text: string } {
  const orderNum = d.orderNumber || d.orderId || "—";
  const pickup = d.pickup || "—";
  const delivery = d.delivery || d.address || "—";
  const html = `
    <h1>You've been assigned a delivery — #${orderNum}</h1>
    <p>A new order is ready for you to deliver.</p>
    <p><strong>Pickup:</strong><br>${escapeHtml(pickup)}</p>
    <p><strong>Drop-off:</strong><br>${escapeHtml(delivery)}</p>
    ${ctaButton(`${APP_URL}/driver/delivery-requests`, "Open Driver Dashboard")}
    <p class="small">Accept or decline from the app. Customer details appear after you accept.</p>`;
  const text = `You've been assigned a delivery — #${orderNum}\n\nPickup: ${pickup}\nDrop-off: ${delivery}\n\nDashboard: ${APP_URL}/driver/delivery-requests`;
  return { subject: `New delivery assigned — #${orderNum}`, html, text };
}

function renderShopNotification(d: Record<string, any>): { subject: string; html: string; text: string } {
  const orderNum = d.orderNumber || d.orderId || "—";
  const action = d.action || "new_order";
  let heading = "You have a new order";
  let body = `A new order (#${orderNum}) has been placed. Review the details and confirm or reject it.`;
  if (action === "confirmed") {
    heading = `Order #${orderNum} confirmed`;
    body = "You confirmed this order. The customer has been notified.";
  } else if (action === "rejected") {
    heading = `Order #${orderNum} rejected`;
    body = "You rejected this order. The customer has been notified.";
  } else if (action === "registration_received") {
    const shopName = d.shopName || "your shop";
    heading = "Registration received — under review";
    body = `Thank you for registering <strong>${escapeHtml(shopName)}</strong> on UniLink. Your shop application is now pending admin approval. We'll email you once it has been reviewed.`;
    const html = `
      <h1>${escapeHtml(heading)}</h1>
      <p>${body}</p>
      <p class="small">You can check your shop status anytime from your shop dashboard.</p>`;
    const text = `${heading}\n\nThank you for registering ${shopName} on UniLink. Your shop application is pending admin approval. We'll email you once reviewed.`;
    return { subject: `Registration received — ${shopName}`, html, text };
  }
  const items = Array.isArray(d.items) ? d.items : [];
  const rows = items
    .map((it: any) => `<tr><td style="padding:6px 0;">${escapeHtml(it.name || it.item || "Item")} ×${it.qty ?? it.quantity ?? 1}</td></tr>`)
    .join("");
  const html = `
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(body)}</p>
    ${rows ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:14px;margin:8px 0 16px 0;">${rows}</table>` : ""}
    ${ctaButton(`${APP_URL}/admin/deliveries`, "Open Dashboard")}`;
  const text = `${heading}\n\n${body}\n\nDashboard: ${APP_URL}/admin/deliveries`;
  return { subject: heading, html, text };
}

function renderPayment(d: Record<string, any>, kind: "success" | "failed" | "refunded"): { subject: string; html: string; text: string } {
  const orderNum = d.orderNumber || d.orderId || "—";
  const amount = d.amount != null ? Number(d.amount).toFixed(2) : "—";
  const map = {
    success: { h: "Payment received", p: `We received your payment of $${amount} for order #${orderNum}.`, s: `Payment received — #${orderNum}` },
    failed: { h: "Payment failed", p: `Your payment of $${amount} for order #${orderNum} didn't go through. Please try again or use a different method.`, s: `Payment failed — #${orderNum}` },
    refunded: { h: "Refund processed", p: `A refund of $${amount} for order #${orderNum} has been processed. It may take a few business days to appear.`, s: `Refund processed — #${orderNum}` },
  }[kind];
  const html = `
    <h1>${escapeHtml(map.h)}</h1>
    <p>${escapeHtml(map.p)}</p>
    ${ctaButton(`${APP_URL}/customer/orders?orderId=${encodeURIComponent(orderNum)}`, "View Order")}`;
  const text = `${map.h}\n\n${map.p}\n\nView: ${APP_URL}/customer/orders?orderId=${encodeURIComponent(orderNum)}`;
  return { subject: map.s, html, text };
}

// ---------------------------------------------------------------------------
// Shop-specific email renderers
// ---------------------------------------------------------------------------
function renderShopApproval(d: Record<string, any>): { subject: string; html: string; text: string } {
  const shopName = d.shopName || "your shop";
  const html = `
    <h1>Your shop has been approved!</h1>
    <p>Great news — <strong>${escapeHtml(shopName)}</strong> has been approved by the UniLink admin team.</p>
    <p>Before your shop goes live, you'll need to pay the registration fee. Visit your shop dashboard to complete the payment.</p>
    ${ctaButton(`${APP_URL}/shop/dashboard`, "Pay Registration Fee")}
    <p class="small">Once payment is verified, your shop will be active and visible to customers.</p>`;
  const text = `Your shop has been approved!\n\n${shopName} has been approved. Pay the registration fee to activate your shop.\n\nDashboard: ${APP_URL}/shop/dashboard`;
  return { subject: `Shop approved — ${shopName}`, html, text };
}

function renderShopPaymentRequired(d: Record<string, any>): { subject: string; html: string; text: string } {
  const shopName = d.shopName || "your shop";
  const fee = d.fee != null ? Number(d.fee).toFixed(2) : "10.00";
  const html = `
    <h1>Payment required — $${fee}</h1>
    <p>To activate <strong>${escapeHtml(shopName)}</strong>, please pay the registration fee of $${fee}.</p>
    <p>Use EcoCash or your preferred payment method from the shop dashboard.</p>
    ${ctaButton(`${APP_URL}/shop/dashboard`, "Pay Now")}
    <p class="small">Your shop will become active once payment is verified by our admin team.</p>`;
  const text = `Payment required — $${fee}\n\nTo activate ${shopName}, pay the registration fee of $${fee}.\n\nDashboard: ${APP_URL}/shop/dashboard`;
  return { subject: `Payment required — ${shopName}`, html, text };
}

function renderShopActivated(d: Record<string, any>): { subject: string; html: string; text: string } {
  const shopName = d.shopName || "your shop";
  const html = `
    <h1>Your shop is now live!</h1>
    <p><strong>${escapeHtml(shopName)}</strong> is now active and visible to customers.</p>
    <p>You can start adding products and receiving orders right away.</p>
    ${ctaButton(`${APP_URL}/shop/dashboard`, "Open Dashboard")}
    <p class="small">Welcome to the UniLink marketplace!</p>`;
  const text = `Your shop is now live!\n\n${shopName} is active and visible to customers.\n\nDashboard: ${APP_URL}/shop/dashboard`;
  return { subject: `Shop activated — ${shopName}`, html, text };
}

function renderShopNewOrder(d: Record<string, any>): { subject: string; html: string; text: string } {
  const orderNum = d.orderNumber || d.orderId || "—";
  const customerName = d.customerName || "a customer";
  const items = Array.isArray(d.items) ? d.items : [];
  const total = d.total != null ? Number(d.total).toFixed(2) : "—";
  const rows = items
    .map((it: any) => `<tr><td style="padding:6px 0;">${escapeHtml(it.name || "Item")} ×${it.qty ?? it.quantity ?? 1}</td><td style="text-align:right;padding:6px 0;">${formatMoney(it.price)}</td></tr>`)
    .join("");
  const html = `
    <h1>New order received — #${orderNum}</h1>
    <p>${escapeHtml(customerName)} just placed an order from your shop.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:14px;margin:8px 0 16px 0;">
      ${rows}
    </table>
    <p><strong>Total:</strong> $${total}</p>
    ${ctaButton(`${APP_URL}/shop/dashboard`, "Review Order")}
    <p class="small">Confirm or reject the order from your dashboard.</p>`;
  const text = `New order — #${orderNum}\n\n${customerName} placed an order.\n\nTotal: $${total}\n\nDashboard: ${APP_URL}/shop/dashboard`;
  return { subject: `New order — #${orderNum}`, html, text };
}

function renderShopOrderStatus(d: Record<string, any>): { subject: string; html: string; text: string } {
  const orderNum = d.orderNumber || d.orderId || "—";
  const status = d.statusTo || d.status || "—";
  const label = STATUS_LABELS[status] || status;
  const html = `
    <h1>Order #${orderNum} — ${escapeHtml(label)}</h1>
    <p>Your order status has been updated.</p>
    <p style="font-size:18px;font-weight:800;color:#0066ff;">${escapeHtml(label)}</p>
    ${ctaButton(`${APP_URL}/customer/marketplace/orders`, "Track Order")}`;
  const text = `Order #${orderNum} — ${label}\n\nTrack: ${APP_URL}/customer/marketplace/orders`;
  return { subject: `Order #${orderNum}: ${label}`, html, text };
}

function renderShopMessengerAssigned(d: Record<string, any>): { subject: string; html: string; text: string } {
  const orderNum = d.orderNumber || d.orderId || "—";
  const messengerName = d.messengerName || "a messenger";
  const pickup = d.pickup || "—";
  const delivery = d.delivery || "—";
  const html = `
    <h1>Delivery assigned — #${orderNum}</h1>
    <p>${escapeHtml(messengerName)} has been assigned to deliver order #${orderNum}.</p>
    <p><strong>Pickup:</strong><br>${escapeHtml(pickup)}</p>
    <p><strong>Drop-off:</strong><br>${escapeHtml(delivery)}</p>
    ${ctaButton(`${APP_URL}/driver/delivery-requests`, "Open Dashboard")}
    <p class="small">Update the delivery status from your dashboard.</p>`;
  const text = `Delivery assigned — #${orderNum}\n\n${messengerName} assigned.\nPickup: ${pickup}\nDrop-off: ${delivery}\n\nDashboard: ${APP_URL}/driver/delivery-requests`;
  return { subject: `Delivery assigned — #${orderNum}`, html, text };
}

function render(req: EmailRequest): { subject: string; html: string; text: string } {
  const d = req.data || {};
  switch (req.type) {
    case "welcome": return renderWelcome(d);
    case "email_verification": return renderEmailVerification(d);
    case "password_reset": return renderPasswordReset(d);
    case "order_confirmation": return renderOrderConfirmation(d);
    case "order_status": return renderOrderStatus(d);
    case "messenger_assignment": return renderMessengerAssignment(d);
    case "shop_notification": return renderShopNotification(d);
    case "payment_success": return renderPayment(d, "success");
    case "payment_failed": return renderPayment(d, "failed");
    case "payment_refunded": return renderPayment(d, "refunded");
    case "shop_approval": return renderShopApproval(d);
    case "shop_payment_required": return renderShopPaymentRequired(d);
    case "shop_activated": return renderShopActivated(d);
    case "shop_new_order": return renderShopNewOrder(d);
    case "shop_order_status": return renderShopOrderStatus(d);
    case "shop_messenger_assigned": return renderShopMessengerAssigned(d);
    default: throw new Error(`Unknown email type: ${req.type}`);
  }
}

function escapeHtml(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatMoney(v: any): string {
  const n = Number(v ?? 0);
  return `$${n.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Outbox dispatch path
// ---------------------------------------------------------------------------
async function dispatchOutboxRow(
  supabase: ReturnType<typeof getSupabase>,
  payload: Record<string, any>,
): Promise<void> {
  const deliveryId = payload.delivery_id;
  const statusTo = payload.status_to;
  if (!deliveryId || !statusTo) return;

  const { data: delivery, error: dErr } = await supabase
    .from("deliveries")
    .select("id, customer_id, total_amount, delivery_fee, items, status, formatted_address")
    .eq("id", deliveryId)
    .maybeSingle();
  if (dErr || !delivery) return;

  const { data: customer, error: cErr } = await supabase
    .from("customers")
    .select("id, email, full_name")
    .eq("id", delivery.customer_id)
    .maybeSingle();
  if (cErr || !customer || !customer.email) return;

  const req: EmailRequest = {
    type: "order_status",
    to: customer.email,
    userId: customer.id,
    userType: "customer",
    orderId: delivery.id,
    data: {
      orderNumber: delivery.id.slice(0, 8),
      orderId: delivery.id,
      statusTo,
      statusFrom: payload.status_from,
    },
  };
  await sendOne(supabase, req);
}

async function sendOne(
  supabase: ReturnType<typeof getSupabase>,
  req: EmailRequest,
): Promise<{ id: string | null; status: string; duplicate: boolean; error?: string; resendId?: string }> {
  if (!req.to || !req.to.includes("@")) {
    return { id: null, status: "skipped", duplicate: false, error: "invalid recipient" };
  }

  let rendered: { subject: string; html: string; text: string };
  try {
    rendered = render(req);
  } catch (e: any) {
    return { id: null, status: "skipped", duplicate: false, error: e.message };
  }

  const { id, isDuplicate } = await reserveEmailSlot(supabase, req, rendered.subject);
  if (isDuplicate) return { id: null, status: "duplicate", duplicate: true };
  if (!id) return { id: null, status: "skipped", duplicate: false, error: "no slot" };

  try {
    const { id: resendId } = await sendViaResend({
      from: `UniLink <${FROM_ADDRESS}>`,
      to: req.to,
      subject: rendered.subject,
      html: emailShell(rendered.subject, rendered.html, rendered.subject),
      text: plainTextWrap(rendered.text),
    });
    await markSent(supabase, id, resendId);
    return { id, status: "sent", duplicate: false, resendId };
  } catch (e: any) {
    await markFailed(supabase, id, e.message);
    return { id, status: "failed", duplicate: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = getSupabase();
    const body = await req.json();

    if (body?.outbox && Array.isArray(body.rows)) {
      const results = [];
      for (const row of body.rows) {
        try {
          await dispatchOutboxRow(supabase, row.payload || row);
          results.push({ ok: true, id: row.id });
        } catch (e: any) {
          results.push({ ok: false, id: row.id, error: e.message });
        }
      }
      return new Response(JSON.stringify({ processed: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body?.retry && body.id) {
      const { data: existing, error } = await supabase
        .from("email_notifications")
        .select("*")
        .eq("id", body.id)
        .maybeSingle();
      if (error || !existing) {
        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (existing.status === "sent" || existing.status === "delivered") {
        return new Response(JSON.stringify({ status: "already_sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const retryReq: EmailRequest = {
        type: existing.type as EmailType,
        to: existing.recipient_email,
        userId: existing.user_id,
        userType: existing.user_type,
        orderId: existing.order_id,
        data: existing.metadata || {},
      };
      let rendered: { subject: string; html: string; text: string };
      try { rendered = render(retryReq); }
      catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const { id: resendId } = await sendViaResend({
          from: `UniLink <${FROM_ADDRESS}>`,
          to: retryReq.to,
          subject: rendered.subject,
          html: emailShell(rendered.subject, rendered.html, rendered.subject),
          text: plainTextWrap(rendered.text),
        });
        await supabase
          .from("email_notifications")
          .update({ status: "sent", resend_id: resendId, sent_at: new Date().toISOString(), error_message: null, attempts: existing.attempts + 1 })
          .eq("id", existing.id);
        return new Response(JSON.stringify({ status: "sent", resendId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        await supabase
          .from("email_notifications")
          .update({ status: "failed", error_message: e.message, attempts: existing.attempts + 1 })
          .eq("id", existing.id);
        return new Response(JSON.stringify({ status: "failed", error: e.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const emailReq: EmailRequest = {
      type: body.type,
      to: body.to,
      userId: body.userId ?? null,
      userType: body.userType ?? null,
      orderId: body.orderId ?? null,
      data: body.data ?? {},
    };
    const result = await sendOne(supabase, emailReq);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
