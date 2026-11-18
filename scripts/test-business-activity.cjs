const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto'),ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync('supabase/functions/business-activity-email/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const token='test-capability',hash=require('node:crypto').createHash('sha256').update(token).digest('hex');
async function scenario({authorized=true,enabled=true,dry=false,fail=false}={}) {
 const sends=[],updates=[],calls=[];let handler;
 const event={id:'event-1',entity_id:'123456789',entity_table:'shop_orders',operation:'insert',created_at:'2026-11-18T00:00:00Z',changed_fields:['status'],snapshot:{status:'pending',customer_name:'<script>alert(1)</script>'}};
 const deliveries=['unilinkbase@gmail.com','shop@example.com'].map((recipient_email,i)=>({id:'delivery-'+i,event_id:event.id,recipient_email,attempts:1}));
 const client={from(table){let patch;const q={select(){return q},eq(){return q},update(value){patch=value;updates.push({table,...value});return q},single:async()=>({data:table==='business_activity_email_config'?{enabled,token_hash:hash}:event,error:null}),then(resolve){resolve({error:null})}};return q},rpc:async name=>{calls.push(name);return{data:deliveries,error:null}}};
 const context={exports:{},require:()=>({createClient:()=>client}),Deno:{env:{get:name=>name==='RESEND_API_KEY'?'test-key':'test-config'},serve:fn=>handler=fn},crypto:webcrypto,TextEncoder,Response,Request,URL,AbortSignal,Date,setTimeout:fn=>{fn();return 0},fetch:async(url,options)=>{sends.push({url,...options,body:JSON.parse(options.body)});return new Response(JSON.stringify(fail?{message:'temporary failure'}:{id:'provider-id'}),{status:fail?503:200})}};
 vm.runInNewContext(source,context);
 const response=await handler(new Request('https://worker.example/'+(dry?'?dry_run=true':''),{method:'POST',headers:authorized?{'x-activity-secret':token}:{}}));
 return {response,body:await response.json(),sends,updates,calls};
}
(async()=>{
 let r=await scenario({authorized:false});assert.equal(r.response.status,401);assert.equal(r.sends.length,0);assert.equal(r.calls.length,0);
 r=await scenario({enabled:false});assert.equal(r.body.status,'disabled');assert.equal(r.sends.length,0);
 r=await scenario({dry:true});assert.equal(r.body.status,'dry_run');assert.equal(r.sends.length,0);assert.equal(r.calls.length,0);
 r=await scenario();assert.equal(r.body.sent,2);assert.deepEqual(r.sends.map(s=>s.body.to),[['unilinkbase@gmail.com'],['shop@example.com']]);assert.equal(r.sends[0].headers['Idempotency-Key'],'business-activity/delivery-0');assert.ok(!r.sends[0].body.html.includes('<script>'));assert.equal(r.updates.filter(u=>u.status==='sent').length,2);
 r=await scenario({fail:true});assert.equal(r.body.failed,2);assert.ok(r.updates.every(u=>u.status==='queued'));assert.ok(r.updates.every(u=>u.error_message.includes('same provider idempotency key')));
 console.log('PASS: capability authentication, disabled/dry runs, mandatory UniLink + separate shop recipients, escaped content, stable retry keys and failure scheduling. No real emails sent.');
})().catch(error=>{console.error(error);process.exit(1)});
