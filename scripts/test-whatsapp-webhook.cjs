const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync('supabase/functions/whatsapp-order-bot/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(overrides={}) {
 let handler;const calls=[],requests=[],tasks=[];
 const env={WHATSAPP_TOKEN:'test-token',WHATSAPP_PHONE_NUMBER_ID:'phone-123',WHATSAPP_APP_SECRET:'test-app-secret',WHATSAPP_VERIFY_TOKEN:'verify-test',SUPABASE_URL:'https://db.example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-server-only',...overrides};
 const client={rpc:async(name,args)=>{calls.push({name,args});return{data:name==='whatsapp_bot_claim_outbox'?[]:{},error:null}},from(table){const q={select(){return q},eq(){return q},update(){return q},order(){return q},limit(){return q},single:async()=>({data:table==='whatsapp_bot_config'?{enabled:false,worker_token_hash:crypto.createHash('sha256').update('worker-test').digest('hex')}:{version:'1',content:'<test terms>',privacy_policy:'private'},error:null}),then(resolve){resolve({error:null})}};return q}};
 const context={exports:{},require:()=>({createClient:()=>client}),crypto:crypto.webcrypto,TextEncoder,Response,Request,URL,AbortSignal,Date,Deno:{env:{get:name=>env[name]},serve:fn=>handler=fn},EdgeRuntime:{waitUntil:task=>tasks.push(task)},fetch:async(url,options)=>{requests.push({url,options});if(overrides._fetchReply)return new Response(JSON.stringify(overrides._fetchReply));throw Error('Unexpected external request')}};
 vm.runInNewContext(source,context);
 return{api:context.exports,send:request=>handler(request),calls,requests,tasks};
}
const body=(phone='phone-123')=>({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:phone},messages:[{id:'wamid.test-1',from:'263771234567',type:'text',timestamp:String(Math.floor(Date.now()/1000)),text:{body:'hello'}}]}}]}]});
const signed=data=>({'Content-Type':'application/json','X-Hub-Signature-256':'sha256='+crypto.createHmac('sha256','test-app-secret').update(JSON.stringify(data)).digest('hex')});
(async()=>{
 let h=harness();let r=await h.send(new Request('https://bot.example.invalid?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=12345'));assert.equal(r.status,200);assert.equal(await r.text(),'12345');
 r=await h.send(new Request('https://bot.example.invalid?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345'));assert.equal(r.status,403);
 r=await h.send(new Request('https://bot.example.invalid'));assert.equal((await r.json()).configured,true);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'*');
 r=await h.send(new Request('https://bot.example.invalid',{method:'POST',body:JSON.stringify(body())}));assert.equal(r.status,401);assert.equal(h.calls.length,0);
 h=harness({WHATSAPP_APP_SECRET:undefined});r=await h.send(new Request('https://bot.example.invalid',{method:'POST',body:'{}'}));assert.equal(r.status,503);
 h=harness();const event=body();r=await h.send(new Request('https://bot.example.invalid',{method:'POST',headers:signed(event),body:JSON.stringify(event)}));await Promise.all(h.tasks);assert.equal(r.status,200);assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'whatsapp_bot_message');assert.equal(h.calls[0].args.p_wa_id,'263771234567');assert.equal(h.calls[0].args.p_text,'hello');assert.equal(h.requests.length,0);
 h=harness();const foreign=body('another-business');r=await h.send(new Request('https://bot.example.invalid',{method:'POST',headers:signed(foreign),body:JSON.stringify(foreign)}));await Promise.all(h.tasks);assert.equal(h.calls.length,0);
 h=harness();r=await h.send(new Request('https://bot.example.invalid',{method:'POST',headers:{'x-whatsapp-worker-secret':'wrong'},body:'{}'}));assert.equal(r.status,401);assert.equal(h.requests.length,0);
 r=await h.send(new Request('https://bot.example.invalid',{method:'POST',headers:{'x-whatsapp-worker-secret':'worker-test'},body:'{}'}));assert.equal((await r.json()).status,'disabled');
 const choices=Array.from({length:10},(_,i)=>({id:'product:'+i,title:'A product with a very long title '+i,description:'Description'}));
 let message=h.api.metaMessage('263771234567',{text:'Select a product',choices});assert.equal(message.interactive.type,'list');assert.equal(message.interactive.action.sections[0].rows.length,10);assert.ok(message.interactive.action.sections[0].rows.every(r=>r.title.length<=24));
 message=h.api.metaMessage('263771234567',{text:'Choose',choices:choices.slice(0,3)});assert.equal(message.interactive.type,'button');assert.ok(message.interactive.action.buttons.every(b=>b.reply.title.length<=20));
 message=h.api.metaMessage('263771234567',{text:'Share delivery GPS',kind:'location_request'});assert.equal(message.interactive.action.name,'send_location');
 message=h.api.metaMessage('263771234567',{text:'x'.repeat(1800),choices:choices.slice(0,2)});assert.equal(message.type,'text');assert.ok(message.text.body.includes('1.'));
 message=h.api.metaMessage('263771234567',{text:'Choose',choices:[{id:'product:1',title:'x'.repeat(19)+'😀'}]});assert.ok(!/[\uD800-\uDBFF]$/.test(message.interactive.action.buttons[0].reply.title));
 const raw=JSON.stringify(event),signature=signed(event)['X-Hub-Signature-256'];assert.equal(await h.api.verifyMetaSignature(raw+' ',signature,'test-app-secret'),false);
 // Payment initiation derives amount/order from the database and never recovers
 // a URL or paid status from the legacy browser-writable transaction table.
 const patches=[];
 function paymentClient(started=false){return{from(table){assert.notEqual(table,'paynow_transactions');const q={select(){return q},eq(){return q},update(value){patches.push({table,...value});return q},single:async()=>({data:table==='shop_orders'?{id:'order-1',total_amount:8,status:'pending',payment_method:'paynow',customer_email:null}:{payment_started:started,payment_url:null},error:null}),maybeSingle:async()=>({data:{order_id:'order-1'},error:null}),then(resolve){resolve({error:null})}};return q}}}
 h=harness({_fetchReply:{success:true,payment_url:'https://www.paynow.co.zw/mock-checkout'}});
 let payment=await h.api.paynowPayload(paymentClient(),{id:'outbox-1',wa_id:'263771234567',payload:{text:'Order received',paynow:true,order_id:'order-1',amount:0.01}});
 const initiation=JSON.parse(h.requests[0].options.body);assert.equal(initiation.amount,8);assert.equal(initiation.entity_id,'order-1');assert.equal(initiation.reference,'WA-order-1');assert.equal(payment.paynow,false);assert.ok(payment.text.includes('https://www.paynow.co.zw/mock-checkout'));assert.ok(patches.some(p=>p.table==='whatsapp_bot_orders'&&p.payment_url));
 h=harness();payment=await h.api.paynowPayload(paymentClient(true),{id:'outbox-1',wa_id:'263771234567',payload:{text:'Order received',paynow:true,order_id:'order-1'}});assert.equal(h.requests.length,0);assert.ok(payment.text.includes('could not be confirmed'));
 console.log('PASS: Meta verification challenge, signed webhook authentication, correct business number, private worker authentication, service-only message dispatch, paused sending and native WhatsApp list/button/location payloads. No real WhatsApp messages or payments sent.');
})().catch(error=>{console.error(error);process.exit(1)});
