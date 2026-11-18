import { useState } from 'react';
import { Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const endpoint = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-order-bot`;
export default function WhatsAppBotAdmin() {
 const router=useRouter();
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[data,setData]=useState<any>(null),[health,setHealth]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [waId,setWaId]=useState(''),[customerId,setCustomerId]=useState(''),[ownershipChecked,setOwnershipChecked]=useState(false);
 async function action(kind:string,values:Record<string,unknown>={}) {
  setBusy(true);setError('');
  try {
   const result=await supabase.rpc('whatsapp_bot_admin',{p_username:username,p_password:password,p_action:kind,p_data:values});
   if(result.error)throw result.error;setData(result.data);
   const response=await fetch(endpoint,{cache:'no-store'});if(!response.ok)throw Error('Could not check the WhatsApp connection.');setHealth(await response.json());
  }catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 const button=(label:string,run:()=>void,disabled=false)=><TouchableOpacity accessibilityRole="button" disabled={busy||disabled} onPress={run} style={{backgroundColor:'#1a73e8',padding:12,borderRadius:8,opacity:busy||disabled?0.5:1}}><Text style={{color:'#fff',fontWeight:'700'}}>{label}</Text></TouchableOpacity>;
 const input=(label:string,value:string,change:(text:string)=>void,secure=false)=><View style={{gap:5}}><Text style={{color:'#102139'}}>{label}</Text><TextInput accessibilityLabel={label} autoCapitalize="none" secureTextEntry={secure} value={value} onChangeText={change} editable={!busy} style={{padding:12,borderWidth:1,borderColor:'#b8c9dd',backgroundColor:'#fff',borderRadius:8,color:'#102139'}} /></View>;
 return <ScrollView style={{flex:1,backgroundColor:'#f3f7ff'}} contentContainerStyle={{maxWidth:850,width:'100%',alignSelf:'center',padding:20,paddingBottom:70,gap:15}}>
  {button('Back to admin',()=>router.back())}
  <Text style={{color:'#102139',fontSize:25,fontWeight:'800'}}>WhatsApp ordering bot</Text>
  <Text style={{color:'#52627c'}}>Customers choose a shop and products, share their delivery GPS, review the actual fees, and confirm in WhatsApp. One shop is one order. Passwords below stay in screen memory.</Text>
  {input('Admin username',username,setUsername)}{input('Admin password',password,setPassword,true)}
  {button('Load bot status',()=>void action('list'))}
  {error?<Text accessibilityRole="alert" style={{color:'#b42318'}}>{error}</Text>:null}
  {data&&<>
   <Text style={{color:'#102139',fontWeight:'800'}}>Bot: {data.enabled?'ACTIVE':'PAUSED'}</Text>
   <Text style={{color:health?.configured?'#157347':'#b45309'}}>{health?.configured?'Meta connection secrets are present. Confirm the webhook subscription in Meta before enabling.':'Meta setup is incomplete. Add the missing server secrets below, then reload status.'}</Text>
   {health?.checks&&Object.entries(health.checks).map(([key,value])=><Text key={key} style={{color:'#52627c'}}>{value?'✓':'Missing:'} {key.replaceAll('_',' ')}</Text>)}
   {button(data.enabled?'Pause bot':'Enable WhatsApp ordering',()=>void action('enable',{enabled:!data.enabled}),!data.enabled&&!health?.configured)}
   <Text style={{fontWeight:'800',fontSize:18,color:'#102139'}}>Meta webhook</Text>
   <Text selectable style={{color:'#52627c'}}>{endpoint}</Text>
   <Text style={{color:'#52627c'}}>Subscribe to messages. For a new test app, use WHATSAPP_BOT_ACCESS_TOKEN, WHATSAPP_BOT_PHONE_NUMBER_ID, WHATSAPP_BOT_APP_SECRET and WHATSAPP_BOT_VERIFY_TOKEN. The bot also supports the existing shared WHATSAPP_TOKEN / WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_APP_SECRET and WHATSAPP_VERIFY_TOKEN names. Enter the same verify token in Meta. Never paste credentials into customer chats.</Text>
   {button('Open Meta app settings',()=>void Linking.openURL('https://developers.facebook.com/apps/'))}
   {button('Open server secret settings',()=>void Linking.openURL('https://supabase.com/dashboard/project/yysnoiamfoveltvyjzgx/functions/secrets'))}
   <Text style={{fontWeight:'800',fontSize:18,color:'#102139'}}>Verify an existing account</Text>
   <Text style={{color:'#52627c'}}>A number already registered in UniLink requires an ownership check before linking. Verify the customer’s identity and account ownership directly. The bot never links accounts just because a phone number matches a public profile.</Text>
   {input('WhatsApp sender ID (digits)',waId,text=>{setWaId(text);setOwnershipChecked(false)})}
   {input('Verified customer record ID',customerId,text=>{setCustomerId(text);setOwnershipChecked(false)})}
   <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{checked:ownershipChecked}} disabled={busy} onPress={()=>setOwnershipChecked(!ownershipChecked)}><Text style={{color:'#102139'}}>{ownershipChecked?'☑':'☐'} I verified this person owns the customer account and WhatsApp number.</Text></TouchableOpacity>
   {button('Link verified account',()=>void action('link',{wa_id:waId.trim(),customer_id:customerId.trim()}),!ownershipChecked||!waId||!customerId)}
   <Text style={{fontWeight:'800',fontSize:18,color:'#102139'}}>Recent conversations</Text>
   {(data.sessions||[]).map((session:any)=><View key={session.wa_id} style={{padding:10,backgroundColor:'#fff',borderRadius:8,gap:4}}><Text style={{color:'#102139'}}>{session.wa_id} · {session.step||'menu'} · {session.town||'Town not chosen'}</Text>{session.step==='account_link'&&button('Select for verification',()=>{setWaId(session.wa_id);setOwnershipChecked(false)})}</View>)}
   <Text style={{fontWeight:'800',fontSize:18,color:'#102139'}}>Reply delivery</Text>
   {(data.outbox||[]).map((row:any)=><Text key={row.status} style={{color:'#52627c'}}>{row.status}: {row.count}</Text>)}
   <Text style={{color:'#52627c'}}>An uncertain send may already have arrived. Check Meta delivery status before resending. Paid amounts are confirmed by the payment provider or shop, never by a typed reference. If reviewed delivery quotes are activated, the bot pauses checkout and directs the customer to support for a quote.</Text>
  </>}
 </ScrollView>;
}
