import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const db = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://unilinkbase.com', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(v => v.toString(16).padStart(2, '0')).join('');
function mondayKey(date = new Date()) {
  const day = new Date(date.getTime() + 2 * 3600_000); // Africa/Harare is UTC+2 year-round.
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const client = db();
    const url = new URL(req.url);
    // Token-bearing POST also supports email clients' RFC 8058 one-click unsubscribe.
    if (url.searchParams.has('unsubscribe')) {
      const token = url.searchParams.get('unsubscribe')!;
      if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ error: 'Invalid unsubscribe link' }, 400);
      const { data: delivery, error } = await client.from('weekly_marketing_deliveries').select('customer_id,email').eq('unsubscribe_token', token).maybeSingle();
      if (error) throw error;
      if (!delivery) return json({ error: 'Invalid unsubscribe link' }, 400);
      const { error: consentError } = await client.from('marketing_consents').update({ opted_in: false, opt_out_date: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('customer_id', delivery.customer_id);
      if (consentError) throw consentError;
      const { error: suppressError } = await client.from('marketing_email_suppressions').upsert({ email: delivery.email }, { onConflict: 'email' });
      if (suppressError) throw suppressError;
      return json({ success: true, message: 'You have unsubscribed from UniLink promotional emails. Order updates are unchanged.' });
    }

    const { data: config, error: configError } = await client.from('weekly_marketing_config').select('enabled,token_hash').eq('id', 1).single();
    if (configError) throw configError;
    const token = req.headers.get('x-campaign-secret') || '';
    if (!token || await hash(token) !== config.token_hash) return json({ error: 'Unauthorized' }, 401);
    if (url.searchParams.get('dry_run') === 'true') {
      const { data, error } = await client.rpc('weekly_marketing_candidates', { campaign_week: mondayKey() });
      if (error) throw error;
      return json({ status: 'dry_run', enabled: config.enabled, provider_configured: !!Deno.env.get('RESEND_API_KEY'), eligible_in_first_batch: data?.length ?? 0 });
    }
    if (!config.enabled) return json({ status: 'disabled' });
    const now = new Date();
    // Cron polls during Monday's 09:00 hour so larger campaigns can drain in batches.
    if (now.getUTCDay() !== 1 || now.getUTCHours() !== 7) return json({ status: 'outside_schedule' });
    if (!Deno.env.get('RESEND_API_KEY')) return json({ error: 'Email provider is not configured' }, 503);
    const week = mondayKey(now);
    const { data: candidates, error: candidateError } = await client.rpc('weekly_marketing_candidates', { campaign_week: week });
    if (candidateError) throw candidateError;
    let sent = 0, skipped = 0, failed = 0;
    for (const customer of candidates || []) {
      // Check consent again immediately before claiming/sending, including on retries.
      const { data: consent, error: consentError } = await client.from('marketing_consents').select('opted_in').eq('customer_id', customer.id).maybeSingle();
      if (consentError) throw consentError;
      if (!consent?.opted_in) { skipped++; continue; }
      const { data: suppressed, error: suppressionError } = await client.from('marketing_email_suppressions').select('email').eq('email', customer.email).maybeSingle();
      if (suppressionError) throw suppressionError;
      if (suppressed) { skipped++; continue; }
      const { data: delivery, error: claimError } = await client.from('weekly_marketing_deliveries').insert({ customer_id: customer.id, email: customer.email, campaign_week: week }).select('id,unsubscribe_token').single();
      if (claimError?.code === '23505') { skipped++; continue; }
      if (claimError) throw claimError;
      const unsubscribe = `${Deno.env.get('SUPABASE_URL')}/functions/v1/weekly-marketing?unsubscribe=${delivery.unsubscribe_token}`;
      const manage = `https://unilinkbase.com/unsubscribe.html?token=${delivery.unsubscribe_token}`;
      const subject = 'Need something in town? Let UniLink help this week';
      const text = `Hi ${customer.full_name || 'there'},\n\nNeed groceries, food, household essentials or another item in town this week? Open UniLink to browse available shops or request an errand. Check availability, delivery coverage and fees in the app before ordering.\n\nShop or request an errand: https://unilinkbase.com\n\nThanks for choosing UniLink!\n\nYou received this weekly reminder because you opted in to promotional emails. Unsubscribe: ${manage}\nContact: unilinkbase@gmail.com`;
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json', 'Idempotency-Key': `weekly-marketing/${delivery.id}` },
          body: JSON.stringify({ from: `UniLink <${Deno.env.get('RESEND_FROM_EMAIL') || 'no-reply@unilinkbase.com'}>`, to: [customer.email], reply_to: 'unilinkbase@gmail.com', subject, text,
            html: `<div style="font-family:Arial,sans-serif;max-width:580px;margin:auto;line-height:1.6;color:#18324b"><h1>Make town errands easier this week</h1><p>Hi ${escape(customer.full_name || 'there')},</p><p>Need groceries, food, household essentials or another item in town? Browse available shops or request an errand with UniLink.</p><p>Check availability, delivery coverage and fees in the app before ordering.</p><p><a href="https://unilinkbase.com" style="background:#1A73E8;color:white;padding:14px 22px;text-decoration:none;display:inline-block;border-radius:8px">Open UniLink</a></p><p>Thanks for choosing UniLink!</p><hr><p style="font-size:12px">You opted in to weekly promotional emails. <a href="${manage}">Unsubscribe</a> · <a href="mailto:unilinkbase@gmail.com">Contact UniLink</a></p></div>`,
            headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
          }), signal: AbortSignal.timeout(15000)
        });
        const result = await response.json();
        if (!response.ok || !result.id) throw new Error(`Email provider returned ${response.status}`);
        const { error: updateError } = await client.from('weekly_marketing_deliveries').update({ status: 'sent', provider_id: result.id, sent_at: new Date().toISOString() }).eq('id', delivery.id);
        if (updateError) throw updateError;
        sent++;
      } catch {
        // Ambiguous provider timeouts remain reserved: never risk emailing twice.
        await client.from('weekly_marketing_deliveries').update({ status: 'failed', error_message: 'Delivery failed or is uncertain; review provider before retrying.' }).eq('id', delivery.id);
        failed++;
      }
      await new Promise(resolve => setTimeout(resolve, 600)); // Stay below provider request limits.
    }
    return json({ week, sent, skipped, failed });
  } catch (error) {
    console.error('Weekly campaign failed', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: 'Campaign processing failed' }, 500);
  }
});
