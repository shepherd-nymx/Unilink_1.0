import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
const db = () => createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const accessToken = () => Deno.env.get('WHATSAPP_BOT_ACCESS_TOKEN') || Deno.env.get('WHATSAPP_ACCESS_TOKEN') || Deno.env.get('WHATSAPP_TOKEN');
const phoneNumberId = () => Deno.env.get('WHATSAPP_BOT_PHONE_NUMBER_ID') || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
const appSecretValue = () => Deno.env.get('WHATSAPP_BOT_APP_SECRET') || Deno.env.get('WHATSAPP_APP_SECRET');
const verifyTokenValue = () => Deno.env.get('WHATSAPP_BOT_VERIFY_TOKEN') || Deno.env.get('WHATSAPP_VERIFY_TOKEN');
const hash = async (value:string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');
const escape = (value:string) => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const clip = (value:unknown,limit:number) => String(value).slice(0,limit).replace(/[\uD800-\uDBFF]$/,'');
function equal(a:string,b:string) { if(a.length!==b.length)return false;let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0; }

export async function verifyMetaSignature(raw:string,signature:string|null,secret:string) {
 if(!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature))return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)))).map(v=>v.toString(16).padStart(2,'0')).join('');
 return equal(expected,signature.slice(7).toLowerCase());
}

export function metaMessage(to:string,payload:any) {
 const base={messaging_product:'whatsapp',recipient_type:'individual',to};
 const text=clip(payload.text || 'Reply MENU to continue.',4096);
 if(payload.kind==='location_request')return {...base,type:'interactive',interactive:{type:'location_request_message',body:{text:clip(text,1024)},action:{name:'send_location'}}};
 const choices=Array.isArray(payload.choices)?payload.choices.slice(0,10):[];
 if(!choices.length)return {...base,type:'text',text:{body:text,preview_url:false}};
 if(text.length>1024)return {...base,type:'text',text:{body:clip(text+'\n\n'+choices.map((c:any,i:number)=>`${i+1}. ${c.title}`).join('\n'),4096),preview_url:false}};
 if(choices.length<=3)return {...base,type:'interactive',interactive:{type:'button',body:{text},action:{buttons:choices.map((c:any)=>({type:'reply',reply:{id:clip(c.id,256),title:clip(c.title,20)}}))}}};
 return {...base,type:'interactive',interactive:{type:'list',body:{text},action:{button:'Choose an option',sections:[{title:'UniLink',rows:choices.map((c:any)=>({id:clip(c.id,200),title:clip(c.title,24),...(c.description?{description:clip(c.description,72)}:{})}))}]}}};
}

export function incomingMessages(value:any) {
 const phoneId=phoneNumberId();
 if(value.metadata?.phone_number_id!==phoneId)return [];
 return (value.messages || []).map((message:any)=>{
  const interactive=message.interactive?.button_reply?.id || message.interactive?.list_reply?.id;
  const kind=message.type==='location'?'location':message.type==='text'?'text':interactive?'interactive':'unsupported';
  return {p_message_id:message.id,p_wa_id:message.from,p_kind:kind,p_text:Array.from(String(interactive || message.text?.body || '')).slice(0,2048).join(''),
   p_lat:kind==='location'?message.location?.latitude:null,p_lng:kind==='location'?message.location?.longitude:null,
   p_profile_name:'',p_timestamp:new Date(Number(message.timestamp)*1000).toISOString()};
 });
}

export async function paynowPayload(client:ReturnType<typeof db>,delivery:any) {
 const payload={...delivery.payload};
 if(!payload.paynow || !payload.order_id)return payload;
 const {data:order,error}=await client.from('shop_orders').select('id,total_amount,status,payment_method,customer_email').eq('id',payload.order_id).single();
 if(error)throw error;
 if(order.status==='cancelled')return {...payload,paynow:false,text:'This order was cancelled. No new payment is needed.'};
 if(order.payment_method!=='paynow')return {...payload,paynow:false};
 const reference=`WA-${order.id}`;
 const {data:link,error:linkError}=await client.from('whatsapp_bot_orders').select('payment_started,payment_url').eq('order_id',order.id).eq('wa_id',delivery.wa_id).single();
 if(linkError)throw linkError;
 let paymentUrl=link.payment_url;
 if(!paymentUrl && !link.payment_started) {
  const {data:claimed,error:claimError}=await client.from('whatsapp_bot_orders').update({payment_started:true}).eq('order_id',order.id).eq('payment_started',false).select('order_id').maybeSingle();
  if(claimError)throw claimError;
  if(claimed) {
   try {
    const response=await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/paynow-initiate`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,apikey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!},
     body:JSON.stringify({payment_type:'marketplace_order',entity_id:order.id,amount:Number(order.total_amount),reference,description:`UniLink WhatsApp order #${order.id.slice(0,8)}`,auth_email:order.customer_email || '',return_url:'https://unilinkbase.com',metadata:{source:'whatsapp',order_id:order.id}}),signal:AbortSignal.timeout(12000)});
    const result=await response.json();if(response.ok && result.success)paymentUrl=result.payment_url;
   } catch { /* An uncertain payment initiation is never automatically repeated. */ }
  }
 }
 if(paymentUrl) {
  const url=new URL(paymentUrl);
  if(url.protocol!=='https:' || !(url.hostname==='paynow.co.zw' || url.hostname.endsWith('.paynow.co.zw')))throw Error('Invalid payment provider URL');
  const {error:updateError}=await client.from('whatsapp_bot_orders').update({payment_url:paymentUrl}).eq('order_id',order.id);if(updateError)throw updateError;
  payload.text+=`\n\nPay securely with Paynow: ${paymentUrl}\nPayment is confirmed only after Paynow reports success.`;
 } else payload.text+='\n\nYour order is recorded, but a payment link could not be confirmed. Contact unilinkbase@gmail.com with the order reference before paying. No payment has been claimed as successful.';
 payload.paynow=false;
 const {error:updateError}=await client.from('whatsapp_bot_outbox').update({payload}).eq('id',delivery.id);if(updateError)throw updateError;
 return payload;
}

async function sendOutbox(client:ReturnType<typeof db>) {
 const {data:config,error:configError}=await client.from('whatsapp_bot_config').select('enabled').eq('id',true).single();
 if(configError)throw configError;
 if(!config.enabled)return {status:'disabled'};
 const token=accessToken(),phoneId=phoneNumberId();
 if(!token || !phoneId)return {status:'not_configured'};
 const {data:deliveries,error}=await client.rpc('whatsapp_bot_claim_outbox');if(error)throw error;
 let sent=0,failed=0;
 for(const delivery of deliveries || []) {
  try {
   const payload=await paynowPayload(client,delivery);
   const response=await fetch(`https://graph.facebook.com/${Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v25.0'}/${phoneId}/messages`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({...metaMessage(delivery.wa_id,payload),biz_opaque_callback_data:delivery.id}),signal:AbortSignal.timeout(12000)
   });
   const result=await response.json();
   if(response.ok && result.messages?.[0]?.id) {
    const {error:updateError}=await client.from('whatsapp_bot_outbox').update({status:'sent',provider_message_id:result.messages[0].id,last_error:null}).eq('id',delivery.id);if(updateError)throw updateError;sent++;
   } else {
    const retry=response.status===429 && delivery.attempts<5;
    await client.from('whatsapp_bot_outbox').update({status:retry?'queued':response.status>=500?'uncertain':'failed',last_error:`Meta HTTP ${response.status}`,next_attempt_at:new Date(Date.now()+60000*2**delivery.attempts).toISOString()}).eq('id',delivery.id);failed++;
   }
  } catch {
   await client.from('whatsapp_bot_outbox').update({status:'uncertain',last_error:'Send outcome unknown; review Meta status before resending.'}).eq('id',delivery.id);failed++;
  }
 }
 return {sent,failed};
}

async function recordStatuses(client:ReturnType<typeof db>,value:any) {
 if(value.metadata?.phone_number_id!==phoneNumberId())return;
 for(const status of value.statuses || []) {
  if(!['sent','delivered','read'].includes(status.status) || !/^[a-f0-9-]{36}$/i.test(status.biz_opaque_callback_data || ''))continue;
  await client.from('whatsapp_bot_outbox').update({status:'sent',provider_message_id:status.id,last_error:null}).eq('id',status.biz_opaque_callback_data).eq('wa_id',status.recipient_id);
 }
}

Deno.serve(async(request:Request)=>{
 const url=new URL(request.url);
 if(request.method==='GET') {
  if(url.searchParams.get('hub.mode')==='subscribe') {
   const expected=verifyTokenValue();
   if(expected && equal(url.searchParams.get('hub.verify_token') || '',expected))return new Response(url.searchParams.get('hub.challenge') || '',{headers:{'Content-Type':'text/plain','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
   return json({error:'Verification denied'},403);
  }
  if(url.searchParams.get('legal')==='1') {
   const {data,error}=await db().from('terms_and_conditions').select('version,content,privacy_policy').eq('is_active',true).order('created_at',{ascending:false}).limit(1).single();
   if(error)return json({error:'Terms are unavailable'},503);
   return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>UniLink Terms and Privacy</title></head><body style="font-family:Arial,sans-serif;max-width:800px;margin:30px auto;padding:20px;line-height:1.6"><h1>UniLink Terms and Privacy Policy</h1><p>Version ${escape(data.version)}</p><h2>Terms</h2><pre style="white-space:pre-wrap;font-family:inherit">${escape(data.content)}</pre><h2>Privacy</h2><pre style="white-space:pre-wrap;font-family:inherit">${escape(data.privacy_policy || '')}</pre><p>Return to WhatsApp to agree or cancel.</p></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
  }
  const checks={access_token:!!accessToken(),phone_number_id:!!phoneNumberId(),app_secret:!!appSecretValue(),verify_token:!!verifyTokenValue()};
  return json({configured:Object.values(checks).every(Boolean),checks,credential_source:Deno.env.get('WHATSAPP_BOT_ACCESS_TOKEN')?'bot-specific':'shared'});
 }
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 try {
  const workerSecret=request.headers.get('x-whatsapp-worker-secret');
  if(workerSecret) {
   const client=db();const {data:config,error}=await client.from('whatsapp_bot_config').select('worker_token_hash').eq('id',true).single();if(error)throw error;
   if(!equal(await hash(workerSecret),config.worker_token_hash))return json({error:'Unauthorized'},401);
   return json(await sendOutbox(client));
  }
  const appSecret=appSecretValue();
  if(!appSecret)return json({error:'Webhook signing is not configured'},503);
  const raw=await request.text();
  if(raw.length>1024*1024)return json({error:'Request too large'},413);
  if(!await verifyMetaSignature(raw,request.headers.get('x-hub-signature-256'),appSecret))return json({error:'Invalid webhook signature'},401);
  let body:any;try{body=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
  if(body.object!=='whatsapp_business_account')return json({ignored:true});
  const client=db();
  for(const entry of body.entry || [])for(const change of entry.changes || []) {
   if(change.field!=='messages')continue;
   const value=change.value || {};
   await recordStatuses(client,value);
   for(const message of incomingMessages(value)) {
    const {error}=await client.rpc('whatsapp_bot_message',message);if(error)throw error;
   }
  }
  const task=sendOutbox(client).catch(()=>undefined);
  if(typeof EdgeRuntime!=='undefined')EdgeRuntime.waitUntil(task);else await task;
  return json({received:true});
 } catch { return json({error:'WhatsApp processing temporarily unavailable'},503); }
});
