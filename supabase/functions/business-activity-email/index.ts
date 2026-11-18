import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(v => v.toString(16).padStart(2, '0')).join('');
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
const labels: Record<string,string> = { customers:'Customer account', drivers:'Messenger account', shops:'Shop account', shop_products:'Product', shop_orders:'Shop order', deliveries:'Shopping request', delivery_requests:'Delivery request', delivery_quotes:'Delivery quote', chat_messages:'New message notification', delivery_rate_cards:'Delivery rate', driver_delivery_capacity:'Messenger capacity', delivery_pricing_settings:'Quote checkout setting' };

export function renderActivity(event: any) {
 const title = `${labels[event.entity_table] || 'Business activity'} ${event.operation === 'insert' ? 'created' : event.operation === 'delete' ? 'removed' : 'updated'}`;
 const id = String(event.entity_id).slice(0,8);
 const summary = Object.entries(event.snapshot || {}).map(([key,value]) => `${key.replaceAll('_',' ')}: ${typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}`).join('\n');
 const text = `${title} · #${id}\n\nTime: ${event.created_at}\nChanged: ${(event.changed_fields || []).join(', ')}\n\n${summary}\n\nOpen UniLink for full details: https://unilinkbase.com\n\nThis is a business activity alert. Passwords, verification codes and private message contents are never included.`;
 return { subject:`[UniLink activity] ${title} · #${id}`, text,
  html:`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#18324b;line-height:1.6"><h1 style="font-size:22px">${escape(title)}</h1><pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${escape(text)}</pre><a href="https://unilinkbase.com">Open UniLink</a></div>` };
}

Deno.serve(async (request: Request) => {
 if (request.method !== 'POST') return json({error:'Method not allowed'},405);
 try {
  const client = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:config,error:configError}=await client.from('business_activity_email_config').select('enabled,token_hash').eq('id',true).single();
  if(configError) throw configError;
  const token=request.headers.get('x-activity-secret') || '';
  if(!token || await digest(token)!==config.token_hash) return json({error:'Unauthorized'},401);
  const apiKey=Deno.env.get('RESEND_API_KEY');
  if(new URL(request.url).searchParams.get('dry_run')==='true') return json({status:'dry_run',enabled:config.enabled,provider_configured:!!apiKey});
  if(!config.enabled) return json({status:'disabled'});
  if(!apiKey) return json({error:'Email provider is not configured'},503);
  const {data:deliveries,error}=await client.rpc('claim_business_activity_emails');if(error)throw error;
  let sent=0,failed=0;
  for(const delivery of deliveries || []) {
   try {
    const {data:event,error:eventError}=await client.from('business_activity_events').select('*').eq('id',delivery.event_id).single();
    if(eventError)throw eventError;
    const rendered=renderActivity(event);
    const response=await fetch('https://api.resend.com/emails',{
     method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`business-activity/${delivery.id}`},
     body:JSON.stringify({from:`UniLink <${Deno.env.get('RESEND_FROM_EMAIL') || 'no-reply@unilinkbase.com'}>`,to:[delivery.recipient_email],reply_to:'unilinkbase@gmail.com',...rendered}),signal:AbortSignal.timeout(8000)
    });
    const result=await response.json();if(!response.ok || !result.id)throw Error(`Email provider returned ${response.status}`);
    const {error:updateError}=await client.from('business_activity_email_deliveries').update({status:'sent',provider_id:result.id,sent_at:new Date().toISOString(),error_message:null}).eq('id',delivery.id);
    if(updateError)throw updateError;sent++;
   } catch {
    const terminal=delivery.attempts>=8;
    await client.from('business_activity_email_deliveries').update({status:terminal?'failed':'queued',error_message:terminal?'Delivery failed after eight attempts; review provider.':'Delivery failed or uncertain; retry uses the same provider idempotency key.',next_attempt_at:new Date(Date.now()+Math.min(30,2**delivery.attempts)*60000).toISOString()}).eq('id',delivery.id);
    failed++;
   }
   await new Promise(resolve=>setTimeout(resolve,600));
  }
  return json({sent,failed});
 } catch { return json({error:'Activity email processing failed'},500); }
});
