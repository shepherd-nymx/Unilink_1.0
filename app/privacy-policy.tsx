import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import AccountPolicyLinks from '@/components/AccountPolicyLinks';

export default function PrivacyPolicy() {
 const router=useRouter();const [policy,setPolicy]=useState<{version:string;privacy_policy:string}|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;void(async()=>{
  const result=await supabase.from('terms_and_conditions').select('version,privacy_policy').eq('is_active',true).order('created_at',{ascending:false}).limit(1).single();
  if(!active)return;if(result.error||!result.data?.privacy_policy)setError('The privacy policy could not be loaded. Please contact unilinkbase@gmail.com.');else setPolicy(result.data);
 })();return()=>{active=false}},[]);
 return <ScrollView style={{flex:1,backgroundColor:'#f8fafc'}} contentContainerStyle={{padding:24,maxWidth:900,width:'100%',alignSelf:'center',paddingBottom:60,gap:18}}>
  <TouchableOpacity accessibilityRole="button" onPress={()=>router.canGoBack()?router.back():router.replace('/')}><Text style={{color:'#174ea6'}}>Back to UniLink</Text></TouchableOpacity>
  <Text accessibilityRole="header" style={{fontSize:28,fontWeight:'800',color:'#102139'}}>UniLink privacy policy</Text>
  {error?<Text accessibilityRole="alert" style={{color:'#b42318'}}>{error}</Text>:policy?<View style={{gap:14}}><Text style={{color:'#52627c'}}>Published policy version {policy.version}</Text><Text selectable style={{fontSize:15,lineHeight:24,color:'#18324b'}}>{policy.privacy_policy.replace(/\\n/g,'\n')}</Text></View>:<ActivityIndicator color="#1a73e8"/>}
  <AccountPolicyLinks lightBackground/>
 </ScrollView>;
}
