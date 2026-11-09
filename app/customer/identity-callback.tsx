import PageSkeleton from '@/components/PageSkeleton';
import { useEffect, useRef, useState } from 'react';
import { View,Text,ActivityIndicator,TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { verifiedCustomerIdentity,identityCustomerProfile,enterCustomerPortal } from '@/lib/customer-identity';
export default function CustomerIdentityCallback(){
 const router=useRouter();const started=useRef(false);const [error,setError]=useState('');
 useEffect(()=>{if(started.current)return;started.current=true;
  void(async()=>{
   try{
    if(typeof window!=='undefined'){
      const params=new URLSearchParams(window.location.hash.slice(1));
      if(params.get('error_description'))throw new Error(params.get('error_description')!);
      const code=new URLSearchParams(window.location.search).get('code');
      const initial=await supabase.auth.getSession();
      if(code&&!initial.data.session){const result=await supabase.auth.exchangeCodeForSession(code);if(result.error)throw result.error;}
    }
    await supabase.auth.getSession();
    const user=await verifiedCustomerIdentity();if(!user)throw new Error('The sign-in link is invalid or expired. Please request another link.');
    const profile=await identityCustomerProfile();
    if(profile)router.replace(await enterCustomerPortal(profile));
    else router.replace({pathname:'/customer/register',params:{identity:'true'}});
   }catch(e:any){setError(e.message||'Could not complete sign-in. Please try again.');}
  })();
 },[router]);
 if (!error) return <PageSkeleton page="customer/identity-callback"/>;
 return <View style={{flex:1,justifyContent:'center',padding:28,backgroundColor:'#f0f4ff',gap:16}}>{error?<><Text accessibilityRole="alert" style={{color:'#b91c1c'}}>{error}</Text><TouchableOpacity onPress={()=>router.replace('/customer/login')}><Text style={{color:'#1A73E8'}}>Back to sign in</Text></TouchableOpacity></>:<><ActivityIndicator/><Text>Completing your sign-in…</Text></>}</View>;
}
