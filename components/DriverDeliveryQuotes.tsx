import {useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
import {supabase} from '@/lib/supabase';
import type {DeliveryQuote} from '@/lib/delivery-quote-types';
export default function DriverDeliveryQuotes(){
 const [quotes,setQuotes]=useState<DeliveryQuote[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setBusy(true);setError('');try{const {data,error}=await supabase.rpc('driver_delivery_quotes');if(error)throw error;setQuotes(data||[])}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function respond(id:string,accept:boolean){setBusy(true);setError('');try{const {error}=await supabase.rpc('respond_delivery_quote',{p_id:id,p_accept:accept});if(error)throw error;await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <View style={{backgroundColor:'#edf5ff',padding:14,margin:14,borderRadius:12,gap:7}}><Text style={{color:'#102139',fontWeight:'800'}}>Delivery fee proposals</Text><Text style={{color:'#52627c',fontSize:12}}>Verified sign-in is required. Only proposals assigned to you and fitting your approved transport capacity appear. Agree before the customer places the order; you can decline.</Text><TouchableOpacity accessibilityRole="button" disabled={busy} onPress={()=>void load()}><Text style={{color:'#1a73e8',paddingVertical:8}}>Refresh my proposals</Text></TouchableOpacity>
 {quotes.map(q=><View key={q.id} style={{backgroundColor:'#fff',padding:10,borderRadius:10,gap:5}}><Text style={{color:'#102139',fontWeight:'700'}}>Delivery fee: ${Number(q.delivery_fee).toFixed(2)} · {q.transport}</Text><Text style={{color:'#52627c'}}>{q.products.map(p=>`${p.name} × ${p.qty}`).join(', ')}</Text><Text style={{color:'#52627c'}}>{q.road_km} road km · {q.weight_kg??'Unknown'} kg · {q.volume_litres??'Unknown'} L{q.fragile?' · Fragile':''}{q.two_person_lift?' · Two-person lift':''}</Text><Text style={{color:'#52627c'}}>{q.explanation}</Text><TouchableOpacity disabled={busy} onPress={()=>void respond(q.id,true)}><Text style={{color:'#157347',padding:8}}>Accept load and delivery fee</Text></TouchableOpacity><TouchableOpacity disabled={busy} onPress={()=>void respond(q.id,false)}><Text style={{color:'#b42318',padding:8}}>Decline</Text></TouchableOpacity></View>)}
 {error?<Text accessibilityRole="alert" style={{color:'#b42318'}}>{error}</Text>:null}
 </View>;
}
