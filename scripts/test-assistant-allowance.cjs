const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {reserveAssistantAllowance}=require('../server/shopping-assistant/allowance.ts'),{checkAllowanceModel}=require('../server/shopping-assistant/intent.ts'),{hasCreditBalance}=require('../server/shopping-assistant/ai-runtime.cjs');
(async()=>{const originalFetch=global.fetch, saved={...process.env};try{
 delete process.env.ASSISTANT_BUDGET_TOKEN;await assert.rejects(reserveAssistantAllowance,/not_configured/);
 process.env.ASSISTANT_BUDGET_TOKEN='a'.repeat(64);process.env.EXPO_PUBLIC_SUPABASE_URL='https://test.supabase.co';process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='test-only-anon';let calls=0;
 global.fetch=async(url,init)=>{calls++;assert.equal(url,'https://test.supabase.co/rest/v1/rpc/reserve_shopping_assistant_request');assert.equal(JSON.parse(init.body).p_token,'a'.repeat(64));return new Response('true',{status:200,headers:{'Content-Type':'application/json'}});};await reserveAssistantAllowance();assert.equal(calls,1);
 global.fetch=async()=>new Response('false',{status:200,headers:{'Content-Type':'application/json'}});await assert.rejects(reserveAssistantAllowance,/exhausted/);
 global.fetch=async()=>new Response('',{status:503});await assert.rejects(reserveAssistantAllowance,/unavailable/);
 global.fetch=async()=>new Response(JSON.stringify({data:[{id:'amazon/nova-micro',pricing:{input:'0.000000035',output:'0.00000014',regional:{eu:{input:'0.01',output:'0.01'}}}}]}),{status:200,headers:{'Content-Type':'application/json'}});await assert.rejects(checkAllowanceModel,/price_changed/);
 global.fetch=async()=>new Response(JSON.stringify({data:[{id:'amazon/nova-micro',pricing:{input:'0.000000035',output:'0.00000014',regional:{eu:{input:'0.000000046',output:'0.000000184'}}}}]}),{status:200,headers:{'Content-Type':'application/json'}});await checkAllowanceModel();
 process.env.AI_GATEWAY_API_KEY='test-only-not-a-real-key';
 global.fetch=async url=>{assert(String(url).includes('/v1/credits'));return new Response(JSON.stringify({balance:'1.00',total_used:'0'}),{status:200,headers:{'Content-Type':'application/json'}});};assert.equal(await hasCreditBalance(.002),true);
 global.fetch=async()=>new Response(JSON.stringify({balance:'0',total_used:'1'}),{status:200,headers:{'Content-Type':'application/json'}});assert.equal(await hasCreditBalance(.002),false);
 console.log('PASS: missing budget token, accepted/exhausted/failed reservations, price-increase refusal including regional prices, and sufficient/exhausted credit balances. No inference or network requests made.');
 }finally{global.fetch=originalFetch;for(const key of ['ASSISTANT_BUDGET_TOKEN','EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_ANON_KEY','AI_GATEWAY_API_KEY'])if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}})().catch(e=>{console.error(e);process.exit(1)});
