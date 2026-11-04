import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const CUR = Deno.env.get("CURRENCY") ?? "USD";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const shortId = (id: string) => String(id).slice(0, 8).toUpperCase();
const mapItems = (arr: any) =>
  (Array.isArray(arr) ? arr : []).map((i: any) => ({
    name: i.name ?? i.title ?? "Item",
    quantity: i.quantity ?? i.qty ?? 1,
    price: i.price ?? 0,
  }));

async function build(p: any) {
  const r = p.record, o = p.old_record;

  if (p.table === "customers" && p.type === "INSERT") {
    if (!r.email) return null;
    return {
      key: `user_registered:${r.id}`,
      body: { event: "user_registered", customer: { name: r.full_name || "there", email: r.email } },
    };
  }

  if (p.table === "shop_orders") {
    if (!r.customer_email) return null;
    const customer = { name: r.customer_name || "Customer", email: r.customer_email };
    const order = {
      id: shortId(r.id), status: r.status, total: r.total_amount, currency: CUR,
      delivery_address: r.delivery_location, items: mapItems(r.products),
    };
    if (p.type === "INSERT")
      return { key: `order_created:${r.id}`, body: { event: "order_created", customer, order } };
    if (p.type === "UPDATE" && o && o.status !== r.status)
      return { key: `order_status_changed:${r.id}:${r.status}`, body: { event: "order_status_changed", customer, order } };
  }

  if (p.table === "deliveries" && p.type === "UPDATE" && o && o.status !== r.status) {
    const { data: c } = await sb.from("customers")
      .select("full_name,email").eq("id", r.customer_id).maybeSingle();
    if (!c?.email) return null;
    return {
      key: `order_status_changed:${r.id}:${r.status}`,
      body: {
        event: "order_status_changed",
        customer: { name: c.full_name || "Customer", email: c.email },
        order: {
          id: shortId(r.id), status: r.status, total: r.total_amount, currency: CUR,
          delivery_address: r.formatted_address, items: mapItems(r.items),
        },
      },
    };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("DB_WEBHOOK_SECRET"))
    return json({ error: "unauthorized" }, 401);

  const evt = await build(await req.json());
  if (!evt) return json({ skipped: true });

  const { error: dupErr } = await sb
    .from("n8n_email_events")
    .insert({ dedupe_key: evt.key, event: evt.body.event });
  if (dupErr)
    return dupErr.code === "23505" ? json({ duplicate: true }) : json({ error: dupErr.message }, 500);

  const res = await fetch(Deno.env.get("N8N_WEBHOOK_URL")!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [Deno.env.get("N8N_AUTH_HEADER_NAME")!]: Deno.env.get("N8N_AUTH_HEADER_VALUE")!,
    },
    body: JSON.stringify(evt.body),
  });
  if (!res.ok) {
    await sb.from("n8n_email_events").delete().eq("dedupe_key", evt.key);
    return json({ error: `n8n ${res.status}` }, 502);
  }
  return json({ sent: true });
});
