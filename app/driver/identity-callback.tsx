import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import PageSkeleton from '@/components/PageSkeleton';
import { supabase } from '@/lib/supabase';
import { verifiedCustomerIdentity } from '@/lib/customer-identity';
import { driverIdentityProfile } from '@/lib/driver-identity';
export default function DriverIdentityCallback() {
 const router=useRouter(),started=useRef(false);const [error,setError]=useState('');
 useEffect(()=>{if(started.current)return;started.current=true;void(async()=>{
  try {
   if(typeof window!=='undefined'){
    const hash=new URLSearchParams(window.location.hash.slice(1));
    if(hash.get('error_description'))throw new Error(hash.get('error_description')!);
    const code=new URLSearchParams(window.location.search).get('code');
    const session=await supabase.auth.getSession();
    if(code&&!session.data.session){const result=await supabase.auth.exchangeCodeForSession(code);if(result.error)throw result.error;}
   }
   await supabase.auth.getSession();
   if(!await verifiedCustomerIdentity())throw new Error('The sign-in link is invalid or expired. Request another link.');
   const profile=await driverIdentityProfile();
   router.replace(profile?'/driver/application-status':{pathname:'/driver/register',params:{identity:'true'}});
  }catch(err:any){setError(err.message||'Could not verify your email.');}
 })();},[router]);
 if(!error)return <PageSkeleton page="driver/identity-callback"/>;
 return <View style={{flex:1,justifyContent:'center',padding:28,gap:20,backgroundColor:'#060c18'}}><Text accessibilityRole="alert" style={{color:'#ff8b9d'}}>{error}</Text><TouchableOpacity onPress={()=>router.replace('/driver/register')}><Text style={{color:'#00e5ff'}}>Try registering again</Text></TouchableOpacity></View>;
}
